import datetime
from typing import Any, Dict, List, Optional
import uuid
import aiosqlite
from app.db.session import get_sqlite_path


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class UsersRepository:
    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path

    @property
    def db_path(self) -> str:
        return self._db_path or get_sqlite_path()

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
                LEFT JOIN roles r ON r.id = u.role_id
                ORDER BY u.email
                """
            )
            return [dict(row) for row in await cursor.fetchall()]

    async def ensure_user(self, email: str, oid: str, display_name: str) -> None:
        now = _now()
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, oid, display_name, created_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    oid = CASE WHEN excluded.oid <> '' THEN excluded.oid ELSE users.oid END,
                    display_name = CASE WHEN excluded.display_name <> '' THEN excluded.display_name ELSE users.display_name END,
                    last_login_at = excluded.last_login_at
                """,
                (user_id, clean, oid or "", display_name or "", now, now),
            )
            await db.commit()

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        now = _now()
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, oid, display_name, role_id, created_at, last_login_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    display_name = CASE WHEN excluded.display_name <> '' THEN excluded.display_name ELSE users.display_name END,
                    oid = CASE WHEN excluded.oid <> '' THEN excluded.oid ELSE users.oid END,
                    role_id = excluded.role_id
                """,
                (user_id, clean, oid or "", display_name or "", role_id, now, now),
            )
            await db.commit()

    async def set_role(self, email: str, role_id: str) -> None:
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        now = _now()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, role_id, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    role_id = excluded.role_id
                """,
                (user_id, clean, role_id, now),
            )
            await db.commit()

    async def assign_role_if_not_admin(self, email: str, role_id: str) -> None:
        clean = (email or "").lower().strip()
        if not clean:
            return
        user_id = str(uuid.uuid4())
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO users (id, email, role_id, created_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(email) DO UPDATE SET
                    role_id = CASE WHEN users.role_id = 'admin' THEN 'admin' ELSE excluded.role_id END
                """,
                (user_id, clean, role_id, _now()),
            )
            await db.commit()

    async def delete_user(self, email: str) -> None:
        clean = (email or "").lower().strip()
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM users WHERE email = ?", (clean,))
            await db.commit()


fabric_users_repository = UsersRepository()
