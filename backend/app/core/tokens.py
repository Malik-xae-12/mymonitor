import logging
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from jwt import InvalidTokenError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.auth.models.refresh_token import RefreshToken
from app.modules.users.models.user import User

logger = logging.getLogger(__name__)


def create_access_token(user_id: uuid.UUID, email: str | None = None) -> str:
    """Creates a short-lived signed JWT access token for authentication."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "aud": ["fastapi-users:auth"],
        "iat": now,
        "exp": now + timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS),
        "type": "access",
    }
    if email:
        payload["email"] = email
    return jwt.encode(payload, settings.ACCESS_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decodes and validates a local JWT access token."""
    return jwt.decode(
        token,
        settings.ACCESS_SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        audience=["fastapi-users:auth"],
        options={"require": ["exp", "iat", "sub"]},
    )


def _encode_refresh_jwt(user_id: uuid.UUID, jti: str, expires_at: datetime) -> str:
    """Create a signed JWT refresh token with the given jti and fixed expiry."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": expires_at,
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_refresh_token(token: str) -> dict:
    """Decode and verify a refresh JWT. Raises InvalidTokenError on failure."""
    payload = jwt.decode(
        token,
        settings.REFRESH_SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
    if payload.get("type") != "refresh":
        raise InvalidTokenError("Not a refresh token")
    return payload


async def create_refresh_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    expires_at: datetime | None = None,
) -> str:
    """Create a new refresh token (JWT) and persist its jti in the database.
    Also removes any expired refresh tokens for this user from the table.
    """
    now = datetime.now(timezone.utc)
    if expires_at is None:
        expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    # Clean up expired tokens for this user from the table
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == str(user_id),
            RefreshToken.expires_at < now,
        )
    )

    jti = str(uuid.uuid4())

    refresh_token = RefreshToken(
        id=str(uuid.uuid4()),
        token=jti,
        user_id=str(user_id),
        expires_at=expires_at,
        revoked=False,
    )
    db.add(refresh_token)
    await db.commit()
    logger.info("Created refresh token jti=%s for user=%s, expires=%s", jti, user_id, expires_at)
    return _encode_refresh_jwt(user_id, jti, expires_at)


async def rotate_refresh_token(db: AsyncSession, old_token: str) -> tuple[str, User] | None:
    """Validate, remove old token from table, and reissue a refresh token with the same fixed expiry.

    The new token inherits the original session's expiry — no sliding window.
    Returns (new_token, user) or None if invalid/expired/revoked."""
    # 1. Verify JWT signature and expiry (no DB hit)
    try:
        payload = decode_refresh_token(old_token)
    except InvalidTokenError as exc:
        logger.warning("Refresh token decode failed: %s", exc)
        return None

    jti = payload["jti"]
    logger.info("Refresh token rotation attempt for jti=%s, user=%s", jti, payload.get("sub"))

    # 2. Check DB for active token
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == jti,
            RefreshToken.revoked == False,  # noqa: E712
        )
    )
    existing = result.scalar_one_or_none()

    if not existing:
        logger.warning("Refresh token jti=%s not found or already consumed", jti)
        return None

    user_id = existing.user_id
    original_expiry = existing.expires_at.replace(tzinfo=timezone.utc) if existing.expires_at.tzinfo is None else existing.expires_at

    # 3. Load and verify the user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        # Delete invalid user's token from table
        await db.delete(existing)
        await db.commit()
        return None

    # 4. Remove the old consumed refresh token directly from the table
    await db.delete(existing)

    # 5. Issue new refresh token with THE EXACT SAME expiry as the original session
    new_token = await create_refresh_token(db, user_id, expires_at=original_expiry)
    return new_token, user


async def revoke_refresh_token(db: AsyncSession, token: str) -> bool:
    """Remove a single refresh token from the table. Returns True if found and removed."""
    try:
        payload = decode_refresh_token(token)
    except InvalidTokenError:
        return False

    jti = payload["jti"]
    result = await db.execute(
        delete(RefreshToken).where(RefreshToken.token == jti)
    )
    await db.commit()
    return result.rowcount > 0


async def revoke_all_user_refresh_tokens(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Remove all refresh tokens for a user from the table. Returns count removed."""
    result = await db.execute(
        delete(RefreshToken).where(RefreshToken.user_id == str(user_id))
    )
    await db.commit()
    return result.rowcount
