import asyncio
import logging
import uuid
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from jwt import InvalidTokenError, PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.tokens import decode_access_token
from app.modules.auth.schema import UserProfile
from app.modules.users.models.user import User
from app.db.session import get_async_session

logger = logging.getLogger("fabric_monitor.auth")

_bearer_scheme = HTTPBearer(auto_error=False)

_TENANT = settings.AZURE_AD_TENANT_ID or "008502d6-3f79-46f0-ab37-9354e3fe80ff"
_CLIENT_ID = settings.AZURE_AD_CLIENT_ID or "25ad11d7-5885-4f0e-8424-919bf02e04eb"
_JWKS_URI = f"https://login.microsoftonline.com/{_TENANT}/discovery/v2.0/keys"
_VALID_ISSUERS = {
    f"https://login.microsoftonline.com/{_TENANT}/v2.0",
    f"https://sts.windows.net/{_TENANT}/",
}

try:
    _jwk_client = PyJWKClient(_JWKS_URI)
except Exception:
    _jwk_client = None


def _decode_entra_token(token: str) -> dict:
    if not _jwk_client:
        raise ValueError("JWK client uninitialized")
    signing_key = _jwk_client.get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=_CLIENT_ID,
        options={"require": ["exp", "iat"], "verify_aud": True},
    )
    issuer = payload.get("iss", "")
    if issuer not in _VALID_ISSUERS:
        raise jwt.InvalidIssuerError(f"Untrusted issuer: {issuer}")
    return payload


def _extract_email(payload: dict) -> str:
    return (
        payload.get("preferred_username")
        or payload.get("email")
        or payload.get("upn")
        or payload.get("sub")
        or ""
    ).lower()


async def current_active_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    db: AsyncSession = Depends(get_async_session),
) -> User:
    """Decode the access token and return the active user, or raise 401."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        logger.warning("Token decode failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.id == str(user_id), User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if user is None:
        logger.warning("Auth failed: user=%s not found or inactive", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> UserProfile:
    """FastAPI dependency: validates the token and resolves the caller's role + scope."""
    # Local-dev bypass only. Never enable in production.
    if not getattr(settings, "AUTH_ENABLED", True):
        return UserProfile(
            email="dev@localhost",
            name="Dev User",
            oid="dev",
            role="admin",
            is_admin=True,
            assigned_workspace_ids=[],
        )

    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Try Entra ID RS256 token decode first, then fallback to local JWT HS256 decode
    payload = None
    try:
        payload = await asyncio.to_thread(_decode_entra_token, creds.credentials)
    except Exception:
        try:
            payload = decode_access_token(creds.credentials)
        except Exception as exc:
            logger.warning("Token validation failed for both Entra ID and local JWT: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

    email = _extract_email(payload)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no usable email claim",
        )

    # Import users_service dynamically to resolve RBAC
    from app.modules.users.service import users_service

    await users_service.record_login(email, payload.get("oid", ""), payload.get("name", ""))
    role, is_admin, workspace_ids = await users_service.resolve_access(email)

    return UserProfile(
        email=email,
        name=payload.get("name"),
        oid=payload.get("oid"),
        role=role,
        is_admin=is_admin,
        assigned_workspace_ids=workspace_ids,
    )


async def require_admin(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Guard for admin-only endpoints."""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator role required",
        )
    return user
