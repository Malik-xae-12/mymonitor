"""Authentication dependencies: Entra ID (Azure AD) token validation + RBAC guards.

Validates the Microsoft Entra ID **ID token** presented as a Bearer token:
  - signature verified against the tenant JWKS,
  - audience == configured SPA client id,
  - issuer == the configured tenant's v2.0 issuer,
  - standard expiry / not-before checks.

Role resolution:
  - emails in ``ADMIN_EMAILS`` are admins,
  - otherwise the role is derived from ``workspace_assignments`` (L1/L2),
  - users with no assignment get role ``none`` (authenticated but unscoped).
"""
import asyncio
import logging
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.core.config import settings
from backend.app.modules.auth.schema import UserProfile

logger = logging.getLogger("fabric_monitor.auth")

_TENANT = settings.AZURE_AD_TENANT_ID
_CLIENT_ID = settings.AZURE_AD_CLIENT_ID
_JWKS_URI = f"https://login.microsoftonline.com/{_TENANT}/discovery/v2.0/keys"
# Entra ID v2.0 issuers (GUID tenant form). Both forms are accepted for robustness.
_VALID_ISSUERS = {
    f"https://login.microsoftonline.com/{_TENANT}/v2.0",
    f"https://sts.windows.net/{_TENANT}/",
}

# PyJWKClient caches signing keys in-process after the first fetch.
_jwk_client = PyJWKClient(_JWKS_URI)

# Bearer is optional so we can return a clean 401 instead of a 403 from the scheme itself.
_bearer = HTTPBearer(auto_error=False)


def _decode_token(token: str) -> dict:
    """Verifies signature + claims and returns the token payload. Raises on failure."""
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
        or ""
    ).lower()


async def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> UserProfile:
    """FastAPI dependency: validates the token and resolves the caller's role + scope."""
    # Local-dev bypass only. Never enable in production.
    if not settings.AUTH_ENABLED:
        return UserProfile(
            email="dev@localhost", name="Dev User", oid="dev",
            role="admin", is_admin=True, assigned_workspace_ids=[],
        )

    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # PyJWKClient network + PyJWT decode are blocking; run off the event loop.
        payload = await asyncio.to_thread(_decode_token, creds.credentials)
    except Exception as exc:  # noqa: BLE001 - surface any validation failure as 401
        logger.warning("Token validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    email = _extract_email(payload)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no usable email/upn claim",
        )

    # Persist the identity, then resolve role + scope from the users/roles tables.
    # Imported lazily to avoid a users<->auth module import cycle at load time.
    from backend.app.modules.users.service import users_service

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
