from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models.user import User


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Fetch a user by email for authentication purposes."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_azure_oid(db: AsyncSession, oid: str) -> User | None:
    """Fetch a user by Azure AD Object ID (SSO)."""
    result = await db.execute(select(User).where(User.azure_oid == oid))
    return result.scalar_one_or_none()
