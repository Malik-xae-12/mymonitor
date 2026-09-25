from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.users.models import Role, User


async def get_user_by_id(db: AsyncSession, user_id: str) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_role_by_id(db: AsyncSession, role_id: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.id == role_id))
    return result.scalar_one_or_none()


async def get_role_by_name(db: AsyncSession, name: str) -> Role | None:
    result = await db.execute(select(Role).where(Role.name == name))
    return result.scalar_one_or_none()


async def assign_role_to_user(db: AsyncSession, user_id: str, role_id: str) -> bool:
    user = await get_user_by_id(db, user_id)
    if not user:
        return False
    user.role_id = role_id
    await db.commit()
    return True


async def create_role(db: AsyncSession, role_id: str, name: str, description: str) -> None:
    db.add(Role(id=role_id, name=name, description=description))


async def commit(db: AsyncSession) -> None:
    await db.commit()
