import datetime
from typing import Any, Dict, List, Optional
import uuid
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import async_session_maker
from app.modules.users.models.role import Role
from app.modules.users.models.user import User


def _now() -> str:
    """Return current UTC ISO8601 timestamp."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class UserRepository:
    """Consolidated repository for User and Role data access backed by SQLAlchemy Async ORM."""

    def __init__(self):
        """Initializes the user repository backed by SQLAlchemy Async ORM."""
        pass

    # ---- Roles Management ----------------------------------------------------
    async def seed_roles(self, roles: List[Dict[str, str]]) -> None:
        """Bootstrap default roles into the roles table if not already present."""
        async with async_session_maker() as session:
            for r in roles:
                stmt = sqlite_upsert(Role).values(
                    id=r["id"],
                    name=r["name"],
                    description=r.get("description"),
                    created_at=_now(),
                ).on_conflict_do_update(
                    index_elements=[Role.id],
                    set_={
                        "name": r["name"],
                        "description": r.get("description"),
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def list_roles(self) -> List[Dict[str, Any]]:
        """Fetch all defined system roles sorted by identifier."""
        async with async_session_maker() as session:
            result = await session.execute(select(Role).order_by(Role.id.asc()))
            roles = result.scalars().all()
            return [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "created_at": r.created_at,
                }
                for r in roles
            ]

    # ---- Users Management ----------------------------------------------------
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Retrieve a user row by normalized email address."""
        clean = (email or "").strip().lower()
        if not clean:
            return None
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).options(selectinload(User.role)).where(func.lower(User.email) == clean)
            )
            u = result.scalar_one_or_none()
            if not u:
                return None
            return {
                "id": str(u.id),
                "email": u.email,
                "oid": u.oid,
                "display_name": u.display_name,
                "role_id": u.role_id,
                "role_name": u.role.name if u.role else None,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "last_login_at": u.last_login_at,
                "created_at": u.created_at,
            }

    async def list_users(self) -> List[Dict[str, Any]]:
        """List all users joined with their human-readable role name."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(User).options(selectinload(User.role)).order_by(User.email.asc())
            )
            users = result.scalars().all()
            return [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "oid": u.oid,
                    "display_name": u.display_name,
                    "role_id": u.role_id,
                    "role_name": u.role.name if u.role else None,
                    "is_active": u.is_active,
                    "is_verified": u.is_verified,
                    "last_login_at": u.last_login_at,
                    "created_at": u.created_at,
                }
                for u in users
            ]

    async def ensure_user(self, email: str, oid: str, display_name: str) -> None:
        """Create or update user on login with fresh Entra ID OID and last_login_at timestamp."""
        now = _now()
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        async with async_session_maker() as session:
            stmt = sqlite_upsert(User).values(
                id=user_id,
                email=clean,
                oid=oid or "",
                display_name=display_name or "",
                created_at=now,
                last_login_at=now,
            ).on_conflict_do_update(
                index_elements=[User.email],
                set_={
                    "oid": func.coalesce(func.nullif(oid, ""), User.oid),
                    "display_name": func.coalesce(func.nullif(display_name, ""), User.display_name),
                    "last_login_at": now,
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        """Insert or update directory user attributes and assigned role."""
        now = _now()
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        async with async_session_maker() as session:
            stmt = sqlite_upsert(User).values(
                id=user_id,
                email=clean,
                oid=oid or "",
                display_name=display_name or "",
                role_id=role_id,
                created_at=now,
                last_login_at=now,
            ).on_conflict_do_update(
                index_elements=[User.email],
                set_={
                    "display_name": func.coalesce(func.nullif(display_name, ""), User.display_name),
                    "oid": func.coalesce(func.nullif(oid, ""), User.oid),
                    "role_id": role_id,
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def set_role(self, email: str, role_id: str) -> None:
        """Assign or update a user's role by email."""
        clean = (email or "").lower().strip()
        if not clean:
            return
        now = _now()
        user_id = str(uuid.uuid4())
        async with async_session_maker() as session:
            stmt = sqlite_upsert(User).values(
                id=user_id,
                email=clean,
                role_id=role_id,
                created_at=now,
            ).on_conflict_do_update(
                index_elements=[User.email],
                set_={"role_id": role_id},
            )
            await session.execute(stmt)
            await session.commit()

    async def assign_role_if_not_admin(self, email: str, role_id: str) -> None:
        """Assign support role (l1, l2) to email without overriding existing admin status."""
        clean = (email or "").lower().strip()
        if not clean:
            return
        now = _now()
        user_id = str(uuid.uuid4())
        async with async_session_maker() as session:
            # Query existing user
            result = await session.execute(
                select(User).where(func.lower(User.email) == clean)
            )
            existing = result.scalar_one_or_none()
            if existing:
                if existing.role_id != "admin":
                    existing.role_id = role_id
                    await session.commit()
            else:
                new_user = User(
                    id=user_id,
                    email=clean,
                    role_id=role_id,
                    created_at=now,
                )
                session.add(new_user)
                await session.commit()

    async def delete_user(self, email: str) -> None:
        """Remove a user from the system by email address."""
        clean = (email or "").lower().strip()
        if not clean:
            return
        async with async_session_maker() as session:
            await session.execute(
                delete(User).where(func.lower(User.email) == clean)
            )
            await session.commit()

    # ---- SQLAlchemy AsyncSession Helpers -------------------------------------
    async def get_user_by_id(self, db: AsyncSession, user_id: str) -> Optional[User]:
        """Fetch user ORM model by primary key ID."""
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_user_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Fetch user ORM model by email address."""
        result = await db.execute(select(User).where(func.lower(User.email) == (email or "").lower()))
        return result.scalar_one_or_none()

    async def get_role_by_id(self, db: AsyncSession, role_id: str) -> Optional[Role]:
        """Fetch role ORM model by role ID."""
        result = await db.execute(select(Role).where(Role.id == role_id))
        return result.scalar_one_or_none()

    async def get_role_by_name(self, db: AsyncSession, name: str) -> Optional[Role]:
        """Fetch role ORM model by role display name."""
        result = await db.execute(select(Role).where(Role.name == name))
        return result.scalar_one_or_none()

    async def assign_role_to_user(self, db: AsyncSession, user_id: str, role_id: str) -> bool:
        """Assign role to user via SQLAlchemy session."""
        user = await self.get_user_by_id(db, user_id)
        if not user:
            return False
        user.role_id = role_id
        await db.commit()
        return True

    async def create_role(self, db: AsyncSession, role_id: str, name: str, description: str) -> None:
        """Create new role row in SQLAlchemy session."""
        db.add(Role(id=role_id, name=name, description=description))


user_repository = UserRepository()
fabric_users_repository = user_repository
