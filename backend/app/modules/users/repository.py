from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models.role import Role, UserRole
from app.modules.users.models.user import User


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.name == name))
    return result.scalar_one_or_none()


async def get_user_role(db: AsyncSession, user_id: str, role_id: str) -> UserRole | None:
    result = await db.execute(
        select(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
    )
    return result.scalar_one_or_none()


async def create_user_role(db: AsyncSession, user_id: str, role_id: str) -> None:
    db.add(UserRole(user_id=str(user_id), role_id=role_id))
    await db.commit()


async def create_role(db: AsyncSession, name: str, description: str) -> None:
    db.add(Role(name=name, description=description))


async def commit(db: AsyncSession) -> None:
    await db.commit()
