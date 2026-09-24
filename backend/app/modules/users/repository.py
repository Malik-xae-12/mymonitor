"""Repository layer for users & roles (SQLite via aiosqlite).

Encapsulates all SQL for the ``users`` and ``roles`` tables. No HTTP concepts here.
Table DDL lives in ``db_service.init_db``; this layer only reads/writes rows.
"""
import datetime
from typing import Any, Dict, List, Optional

import aiosqlite

from backend.app.core.config import settings


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class UsersRepository:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.SQLITE_DB_PATH

    # ---- Roles -------------------------------------------------------
    async def seed_roles(self, roles: List[Dict[str, str]]) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            for r in roles:
                await db.execute(
                    """
                    INSERT INTO roles (id, name, description, created_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name=excluded.name,
                        description=excluded.description
                    """,
                    (r["id"], r["name"], r.get("description"), _now()),
                )
            await db.commit()

    async def list_roles(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM roles ORDER BY id")
            return [dict(row) for row in await cursor.fetchall()]

    # ---- Users -------------------------------------------------------
    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM users WHERE email = ?", ((email or "").lower(),)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def list_users(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                """
                SELECT u.*, r.name AS role_name
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                ORDER BY u.email
                """
            )
            return [dict(row) for row in await cursor.fetchall()]

    async def ensure_user(
        self, email: str, oid: str, display_name: str, role_id: Optional[str] = None
    ) -> None:
        """Inserts the user if missing; otherwise refreshes identity + last login.

        Never downgrades an existing role. If the row exists and already has a role,
        the passed ``role_id`` is ignored (use :meth:`set_role` to change roles).
        """
        e = (email or "").lower()
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, display_name, oid, role_id, is_active, created_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    display_name=excluded.display_name,
                    oid=excluded.oid,
                    last_login_at=excluded.last_login_at
                """,
                (oid or e, e, display_name, oid, role_id, now, now),
            )
            await db.commit()

    async def set_role(self, email: str, role_id: str) -> None:
        e = (email or "").lower()
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            # Upsert so assigning a not-yet-seen email creates the user with the role.
            await db.execute(
                """
                INSERT INTO users (id, email, role_id, is_active, created_at, last_login_at)
                VALUES (?, ?, ?, 1, ?, NULL)
                ON CONFLICT(email) DO UPDATE SET role_id=excluded.role_id
                """,
                (e, e, role_id, now),
            )
            await db.commit()

    async def assign_role_if_not_admin(self, email: str, role_id: str) -> None:
        """Sets L1/L2 for an assigned email, but never overrides an admin."""
        existing = await self.get_by_email(email)
        if existing and existing.get("role_id") == "admin":
            return
        await self.set_role(email, role_id)

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        e = (email or "").lower()
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, display_name, oid, role_id, is_active, created_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(email) DO UPDATE SET
                    display_name=CASE WHEN excluded.display_name != '' THEN excluded.display_name ELSE users.display_name END,
                    oid=CASE WHEN excluded.oid != '' THEN excluded.oid ELSE users.oid END,
                    role_id=excluded.role_id
                """,
                (oid or e, e, display_name, oid, role_id, now),
            )
            await db.commit()

    async def delete_user(self, email: str) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM users WHERE email = ?", ((email or "").lower(),))
            await db.commit()


users_repository = UsersRepository()
