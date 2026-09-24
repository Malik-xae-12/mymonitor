import logging
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
import aiosqlite

from app.core.permissions import RoleName
from app.modules.users import repository
from app.modules.users.fabric_users_repo import fabric_users_repository
from app.modules.users.schema import RoleResponse, UserResponse
from app.services.db_service import db_service

logger = logging.getLogger(__name__)

DEFAULT_ROLES = [
    {"id": "admin", "name": "Administrator", "description": "Full access to platform administration, user management, and workspace assignments"},
    {"id": "l1", "name": "L1 Support Lead", "description": "First-line operational support, failure triaging, and AI-assisted remediation"},
    {"id": "l2", "name": "L2 Escalation Owner", "description": "Senior escalation contact for unresolved SLA breaches"},
]


async def seed_roles(db: AsyncSession) -> None:
    """Ensure all defined roles exist in the database."""
    try:
        for role_name in RoleName:
            existing = await repository.get_role_by_name(db, role_name.value)
            if existing is None:
                await repository.create_role(db, role_name.value, f"{role_name.value} role")
        await repository.commit(db)
    except IntegrityError:
        await db.rollback()
        logger.warning("Ignored IntegrityError in seed_roles (likely a multi-worker race condition)")


async def assign_role_to_user(db: AsyncSession, user_id: str, role_name: str) -> bool:
    """Assign a role to a user. Returns False if role not found or already assigned."""
    role = await repository.get_role_by_name(db, role_name)
    if not role:
        return False

    existing = await repository.get_user_role(db, user_id, role.id)
    if existing:
        return False

    await repository.create_user_role(db, user_id, role.id)
    logger.info("Role '%s' assigned to user %s", role_name, user_id)
    return True


class UsersService:
    async def seed_defaults(self, admin_emails: List[str]) -> None:
        """Seeds the role catalog and bootstraps admin users from configuration."""
        await fabric_users_repository.seed_roles(DEFAULT_ROLES)
        for email in admin_emails:
            clean = (email or "").strip().lower()
            if clean:
                await fabric_users_repository.set_role(clean, "admin")

    async def record_login(self, email: str, oid: str, display_name: str) -> None:
        await fabric_users_repository.ensure_user(email, oid, display_name)

    async def resolve_access(self, email: str) -> Tuple[str, bool, List[str]]:
        e = (email or "").strip().lower()
        user = await fabric_users_repository.get_by_email(e)

        if user and user.get("role_id") == "admin":
            return "admin", True, []

        workspace_ids = await db_service.get_assigned_workspace_ids_for_user(e)

        role = "none"
        assignments = await db_service.get_assignments_for_user(e)
        for a in assignments:
            if (a.get("l1_email") or "").strip().lower() == e:
                role = "l1"
                break
            if (a.get("l2_email") or "").strip().lower() == e:
                role = "l2"

        if role == "none":
            async with aiosqlite.connect(db_service.db_path) as db:
                c1 = await db.execute("SELECT 1 FROM sla_configs WHERE LOWER(l1_email) = ? LIMIT 1", (e,))
                if await c1.fetchone():
                    role = "l1"
                else:
                    c2 = await db.execute("SELECT 1 FROM sla_configs WHERE LOWER(l2_email) = ? LIMIT 1", (e,))
                    if await c2.fetchone():
                        role = "l2"

        if role == "none" and user and user.get("role_id") in ("l1", "l2"):
            role = user["role_id"]

        if role in ("l1", "l2") and (not user or user.get("role_id") != role):
            await fabric_users_repository.assign_role_if_not_admin(e, role)

        return role, False, workspace_ids

    async def list_users(self) -> List[UserResponse]:
        rows = await fabric_users_repository.list_users()
        return [
            UserResponse(
                email=r["email"],
                display_name=r.get("display_name"),
                oid=r.get("oid"),
                role_id=r.get("role_id"),
                role_name=r.get("role_name"),
                is_active=bool(r.get("is_active", 1)),
                created_at=r.get("created_at"),
                last_login_at=r.get("last_login_at"),
            )
            for r in rows
        ]

    async def list_roles(self) -> List[RoleResponse]:
        rows = await fabric_users_repository.list_roles()
        return [RoleResponse(id=r["id"], name=r["name"], description=r.get("description")) for r in rows]

    async def set_role(self, email: str, role_id: str) -> None:
        await fabric_users_repository.set_role(email, role_id)

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        await fabric_users_repository.add_or_update_user(email, display_name, oid, role_id)

    async def delete_user(self, email: str) -> None:
        await fabric_users_repository.delete_user(email)

    async def ensure_assignment_users(self, l1_email: Optional[str], l2_email: Optional[str]) -> None:
        if l1_email:
            await fabric_users_repository.assign_role_if_not_admin(l1_email, "l1")
        if l2_email:
            await fabric_users_repository.assign_role_if_not_admin(l2_email, "l2")


users_service = UsersService()
