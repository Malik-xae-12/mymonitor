import logging
import secrets
import urllib.parse
import uuid
from pathlib import Path
from typing import Optional

from fastapi import Depends, Request
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi_users import (
        BaseUserManager,
        FastAPIUsers,
        UUIDIDMixin,
        InvalidPasswordException,
)
from fastapi_users.authentication import (
        AuthenticationBackend,
        BearerTransport,
        JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

from app.core.config import settings
from app.core.security import validate_password_rules
from app.db.session import get_user_db, get_async_session
from app.modules.users.models.user import User
from app.modules.auth.schema import UserCreate
from app.shared.constants import AUTH_URL_PATH


logger = logging.getLogger(__name__)


def get_email_config() -> ConnectionConfig:
    """Builds and returns the email server connection configuration."""
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=settings.MAIL_STARTTLS,
        MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
        USE_CREDENTIALS=settings.USE_CREDENTIALS,
        VALIDATE_CERTS=settings.VALIDATE_CERTS,
        TEMPLATE_FOLDER=Path(__file__).parent / "email_templates",
    )


async def send_reset_password_email(user: User, token: str) -> None:
    """Sends a password recovery email containing the reset token link."""
    if not all([settings.MAIL_SERVER, settings.MAIL_PORT, settings.MAIL_FROM]):
        raise ValueError(
            "Email configuration incomplete. "
            f"MAIL_SERVER={settings.MAIL_SERVER}, "
            f"MAIL_PORT={settings.MAIL_PORT}, "
            f"MAIL_FROM={settings.MAIL_FROM}"
        )

    conf = get_email_config()
    email = user.email
    base_url = f"{settings.FRONTEND_URL}/password-recovery/confirm?"
    params = {"token": token}
    encoded_params = urllib.parse.urlencode(params)
    link = f"{base_url}{encoded_params}"

    message = MessageSchema(
        subject="Password recovery",
        recipients=[email],
        template_body={"username": email, "link": link},
        subtype=MessageType.html,
    )

    fm = FastMail(conf)
    await fm.send_message(message, template_name="password_reset.html")


class StringIDMixin:
    """Mixin to cast arbitrary user IDs to string."""
    def parse_id(self, value: any) -> str:
        """Parses and casts the input value to a string."""
        return str(value)


class UserManager(StringIDMixin, BaseUserManager[User, str]):
    reset_password_token_secret = settings.RESET_PASSWORD_SECRET_KEY
    verification_token_secret = settings.VERIFICATION_SECRET_KEY

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        """Callback invoked immediately after user registration."""
        logger.info("User %s has registered.", user.id)

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """Callback invoked after password reset is requested."""
        try:
            await send_reset_password_email(user, token)
            logger.info("Password reset email sent to %s", user.email)
        except Exception as exc:
            logger.error(
                "Failed to send password reset email to %s: %s: %s",
                user.email, type(exc).__name__, str(exc),
            )

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        """Callback invoked when email verification is requested."""
        logger.info("Verification requested for user %s", user.id)

    async def validate_password(
        self,
        password: str,
        user: UserCreate,
    ) -> None:
        """Validates that a password satisfies length and complexity rules."""
        errors = validate_password_rules(password, user.email)

        if errors:
            raise InvalidPasswordException(reason=errors)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    """FastAPI dependency yielding the UserManager instance."""
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl=f"/{AUTH_URL_PATH}/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    """Configures the JWT authentication strategy using system settings."""
    return JWTStrategy(
        secret=settings.ACCESS_SECRET_KEY,
        lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS,
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, str](get_user_manager, [auth_backend])
