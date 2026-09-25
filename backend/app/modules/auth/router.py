import logging
import secrets
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from jwt import InvalidTokenError, PyJWKClient, decode
from fastapi_users.exceptions import UserNotExists
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.core.tokens import (
    create_access_token,
    create_refresh_token,
    revoke_all_user_refresh_tokens,
    rotate_refresh_token,
)
from app.db.session import get_async_session
from app.modules.auth.schema import (
        EntraIdExchangeRequest,
        RefreshRequest,
        TokenPairResponse,
        UserCreate,
        UserRead,
)
from app.modules.auth.service import fastapi_users, get_user_manager
import time
from functools import lru_cache

# Simple in-memory cache for SSO exchange (token -> (claims, timestamp))
# Bounded to prevent memory leaks
_sso_exchange_cache: dict[str, tuple[dict, float]] = {}
_SSO_CACHE_SECONDS = 30  # Cache for 30 seconds
_SSO_CACHE_MAX_SIZE = 100  # Max entries before pruning


def _prune_sso_cache() -> None:
    """Remove expired entries and enforce max size."""
    now = time.time()
    expired_keys = [k for k, (_, ts) in _sso_exchange_cache.items() if now - ts >= _SSO_CACHE_SECONDS]
    for k in expired_keys:
        del _sso_exchange_cache[k]
    # If still over limit, remove oldest entries
    if len(_sso_exchange_cache) > _SSO_CACHE_MAX_SIZE:
        sorted_keys = sorted(_sso_exchange_cache, key=lambda k: _sso_exchange_cache[k][1])
        for k in sorted_keys[: len(_sso_exchange_cache) - _SSO_CACHE_MAX_SIZE]:
            del _sso_exchange_cache[k]
from app.modules.auth.dependency import current_active_user, _decode_entra_token
from app.modules.users.models.user import User

router = APIRouter(tags=["auth"])


# ---------------------------------------------------------------------------
# Azure AD helpers
# ---------------------------------------------------------------------------

def _verify_azure_token(token: str) -> dict[str, Any]:
    """Verifies and decodes an Entra ID token using dynamic key rotation and claims validation."""
    tenant = settings.AZURE_AD_TENANT_ID or settings.AZURE_TENANT_ID
    client_id = settings.AZURE_AD_CLIENT_ID or settings.AZURE_CLIENT_ID
    if not tenant or not client_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Azure AD settings are not configured",
        )
    return _decode_entra_token(token)


# ---------------------------------------------------------------------------
# Custom endpoints: login, refresh, logout, SSO exchange
# ---------------------------------------------------------------------------


@router.post("/jwt/login", response_model=TokenPairResponse)
@limiter.limit(settings.RATE_LIMIT_LOGIN)
async def jwt_login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    user_manager=Depends(get_user_manager),
    db: AsyncSession = Depends(get_async_session),
):
    """Email/password login → access token + refresh token."""
    @dataclass
    class _Creds:
        username: str
        password: str

    user = await user_manager.authenticate(
        credentials=_Creds(username=username, password=password),
    )

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )

    # Revoke any existing refresh tokens for this user
    await revoke_all_user_refresh_tokens(db, user.id)

    access_token = create_access_token(user.id, user.email)
    refresh_token = await create_refresh_token(db, user.id)

    return TokenPairResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/jwt/refresh", response_model=TokenPairResponse)
@limiter.limit(settings.RATE_LIMIT_REFRESH)
async def jwt_refresh(
    request: Request,
    body: RefreshRequest,
    db: AsyncSession = Depends(get_async_session),
):
    """Rotate the refresh token and get a new access token.

    The new refresh token inherits the original session expiry (no sliding window).
    """
    result = await rotate_refresh_token(db, body.refresh_token)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_REFRESH_TOKEN",
        )

    new_refresh_token, user = result
    access_token = create_access_token(user.id, user.email)

    return TokenPairResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/jwt/logout")
async def jwt_logout(
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Revoke all refresh tokens for the current user."""
    await revoke_all_user_refresh_tokens(db, user.id)
    return {"detail": "Successfully logged out"}



@router.post("/entra-id/exchange", response_model=TokenPairResponse)
@limiter.limit(settings.RATE_LIMIT_SSO_EXCHANGE)
async def exchange_entra_id_token(
    request: Request,
    payload: EntraIdExchangeRequest,
    user_manager=Depends(get_user_manager),
    db: AsyncSession = Depends(get_async_session),
):
    """Exchanges an Entra ID token for a local JWT access and refresh token pair."""
    logger = logging.getLogger(__name__)
    now = time.time()
    cache_key = payload.id_token
    # Check cache first
    cache_entry = _sso_exchange_cache.get(cache_key)
    if cache_entry:
        claims, ts = cache_entry
        if now - ts < _SSO_CACHE_SECONDS:
            logger.info("SSO exchange: cache hit")
        else:
            claims = None
    else:
        claims = None

    if not claims:
        try:
            claims = _verify_azure_token(payload.id_token)
            _prune_sso_cache()
            _sso_exchange_cache[cache_key] = (claims, now)
            logger.info("SSO exchange: cache miss, verified token")
        except InvalidTokenError as exc:
            logger.exception("Invalid Azure AD token")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Azure AD token",
            ) from exc
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Azure token verification failed: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Token verification error: {type(exc).__name__}: {exc}",
            ) from exc

    email = (
        claims.get("preferred_username")
        or claims.get("email")
        or claims.get("upn")
        or claims.get("unique_name")
    )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email claim not found in token",
        )

    azure_oid = claims.get("oid")

    try:
        user = await user_manager.get_by_email(email)
    except UserNotExists:
        random_suffix = secrets.token_urlsafe(24)
        temp_password = f"SSO!Temp_{random_suffix}"
        user_create = UserCreate(email=email, password=temp_password)
        user = await user_manager.create(user_create, safe=True)
        user.is_verified = True
        user.oid = azure_oid
        user.display_name = claims.get("name")
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Store / update the Azure AD object ID
    if azure_oid and user.oid != azure_oid:
        user.oid = azure_oid
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Revoke any existing refresh tokens for this user
    await revoke_all_user_refresh_tokens(db, user.id)

    access_token = create_access_token(user.id, user.email)
    refresh_token = await create_refresh_token(db, user.id)

    return TokenPairResponse(access_token=access_token, refresh_token=refresh_token)


# ---------------------------------------------------------------------------
# FastAPI Users built-in routers (register, password reset, verify)
# ---------------------------------------------------------------------------

router.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_reset_password_router(),
    tags=["auth"],
)
router.include_router(
    fastapi_users.get_verify_router(UserRead),
    tags=["auth"],
)

from app.modules.auth.dependency import get_current_user
from app.modules.auth.schema import UserProfile, WorkspaceAssignment
from app.modules.admin.service import admin_service


@router.get("/me", response_model=UserProfile)
async def get_me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Returns the signed-in user's profile, resolved role, and scoped workspaces."""
    return user


@router.get("/my-assignments", response_model=list[WorkspaceAssignment])
async def get_my_assignments(
    user: UserProfile = Depends(get_current_user),
) -> list[WorkspaceAssignment]:
    """Assignments where the caller is the L1 or L2 responsible user."""
    if user.is_admin:
        return await admin_service.list_all_assignments()
    return await admin_service.list_assignments_for_user(user.email)
