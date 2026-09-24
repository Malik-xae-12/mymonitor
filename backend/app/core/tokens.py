"""Core token handling (JWT access and refresh tokens).
Aligned with next-fastapi-starter and clean modular architecture.
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt
from jwt import InvalidTokenError

from backend.app.core.config import settings

logger = logging.getLogger("fabric_monitor.tokens")


def create_access_token(
    subject: str,
    email: Optional[str] = None,
    role: Optional[str] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS))
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if email:
        payload["email"] = email
    if role:
        payload["role"] = role
    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, settings.ACCESS_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and verify an access token. Raises InvalidTokenError on failure."""
    return jwt.decode(
        token,
        settings.ACCESS_SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "iat", "sub"]},
    )


def create_refresh_token(
    subject: str,
    jti: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT refresh token."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    token_jti = jti or str(uuid.uuid4())
    payload = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "type": "refresh",
        "jti": token_jti,
    }
    return jwt.encode(payload, settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_refresh_token(token: str) -> Dict[str, Any]:
    """Decode and verify a refresh token. Raises InvalidTokenError on failure."""
    payload = jwt.decode(
        token,
        settings.REFRESH_SECRET_KEY,
        algorithms=[settings.ALGORITHM],
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
    if payload.get("type") != "refresh":
        raise InvalidTokenError("Not a refresh token")
    return payload
