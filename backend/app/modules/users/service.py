"""Business logic for users & roles."""
from typing import List, Optional, Tuple

from backend.app.modules.users.models import DEFAULT_ROLES, ROLE_ADMIN
from backend.app.modules.users.repository import users_repository
from backend.app.modules.users.schema import RoleResponse, UserResponse
from backend.app.services.db_service import db_service


class UsersService:
    async def seed_defaults(self, admin_emails: List[str]) -> None:
        """Seeds the role catalog and bootstraps admin users from configuration."""
        await users_repository.seed_roles(DEFAULT_ROLES)
        for email in admin_emails:
            clean = (email or "").strip().lower()
            if clean:
                await users_repository.set_role(clean, ROLE_ADMIN)

    async def record_login(self, email: str, oid: str, display_name: str) -> None:
        await users_repository.ensure_user(email, oid, display_name)

    async def resolve_access(self, email: str) -> Tuple[str, bool, List[str]]:
        """Returns (role, is_admin, assigned_workspace_ids) for a signed-in email.

        Precedence: an explicit ``admin`` role in the users table wins. Otherwise the
        role is derived from workspace assignments (L1/L2), falling back to any stored
        role on the user record.
        """
        e = (email or "").lower()
        user = await users_repository.get_by_email(e)
        assignments = await db_service.get_assignments_for_user(e)
        workspace_ids = [a["workspace_id"] for a in assignments]

        if user and user.get("role_id") == ROLE_ADMIN:
            return ROLE_ADMIN, True, []  # admins are unscoped (see all workspaces)

        role = "none"
        for a in assignments:
            if (a.get("l1_email") or "").lower() == e:
                role = "l1"
                break
            if (a.get("l2_email") or "").lower() == e:
                role = "l2"
        if role == "none" and user and user.get("role_id") in ("l1", "l2"):
            role = user["role_id"]

        # Keep the stored role in sync with the derived one (non-admin only).
        if role in ("l1", "l2") and (not user or user.get("role_id") != role):
            await users_repository.assign_role_if_not_admin(e, role)

        return role, False, workspace_ids

    async def list_users(self) -> List[UserResponse]:
        rows = await users_repository.list_users()
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
        rows = await users_repository.list_roles()
        return [RoleResponse(id=r["id"], name=r["name"], description=r.get("description")) for r in rows]

    async def set_role(self, email: str, role_id: str) -> None:
        await users_repository.set_role(email, role_id)

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        await users_repository.add_or_update_user(email, display_name, oid, role_id)

    async def delete_user(self, email: str) -> None:
        await users_repository.delete_user(email)

    async def ensure_assignment_users(self, l1_email: Optional[str], l2_email: Optional[str]) -> None:
        """Called when an admin saves a workspace assignment: create/refresh L1/L2 users."""
        if l1_email:
            await users_repository.assign_role_if_not_admin(l1_email, "l1")
        if l2_email:
            await users_repository.assign_role_if_not_admin(l2_email, "l2")


users_service = UsersService()
