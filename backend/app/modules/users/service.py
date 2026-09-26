import datetime
import logging
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.db.session import async_session_maker
from app.modules.sla.models.sla_config import SLAConfig
from app.modules.sla.repository import sla_repository
from app.modules.users.repository import user_repository
from app.modules.users.schema import (
    RoleResponse,
    UserResponse,
    SlaAssignment,
)
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES

logger = logging.getLogger(__name__)

DEFAULT_ROLES = [
    {"id": "admin", "name": "Administrator", "description": "Full access to platform administration, user management, and workspace assignments"},
    {"id": "l1", "name": "L1 Support Lead", "description": "First-line operational support, failure triaging, and AI-assisted remediation"},
    {"id": "l2", "name": "L2 Escalation Owner", "description": "Senior escalation contact for unresolved SLA breaches"},
]


def _now() -> str:
    """Return current UTC ISO8601 timestamp."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


async def assign_role_to_user(db: AsyncSession, user_id: str, role_id: str) -> bool:
    """Assign a role (admin, l1, l2) to a user in the database session."""
    return await user_repository.assign_role_to_user(db, user_id, role_id)


class UsersService:
    """Unified service layer managing user lifecycles, Entra ID directory syncing,
    support role assignments (admin, l1, l2), and pipeline-level L1/L2 SLA assignments."""

    async def seed_defaults(self, admin_emails: List[str]) -> None:
        """Seed the default system roles and bootstrap administrator accounts from settings."""
        await user_repository.seed_roles(DEFAULT_ROLES)
        for email in admin_emails:
            clean = (email or "").strip().lower()
            if clean:
                await user_repository.set_role(clean, "admin")

    async def record_login(self, email: str, oid: str, display_name: str) -> None:
        """Record or update user login telemetry and Entra ID object identifier."""
        await user_repository.ensure_user(email, oid, display_name)

    async def resolve_access(self, email: str) -> Tuple[str, bool, List[str], List[str]]:
        """Resolve a user's effective role, admin privilege flag, accessible workspace IDs,
        and accessible pipeline IDs. Returns (role, is_admin, workspace_ids, pipeline_ids).
        
        For admins: workspace_ids=[] and pipeline_ids=[] (meaning ALL access).
        For L1/L2: scoped to only assigned workspaces/pipelines from sla_configs.
        """
        e = (email or "").strip().lower()
        user = await user_repository.get_by_email(e)

        if user and user.get("role_id") == "admin":
            return "admin", True, [], []

        # Query sla_configs for workspace and pipeline assignments
        workspace_ids = await sla_repository.get_assigned_workspace_ids_for_user(e)
        pipeline_ids = await sla_repository.get_assigned_pipeline_ids_for_user(e)

        # Determine role from sla_configs
        role = "none"
        async with async_session_maker() as session:
            r1 = await session.execute(
                select(SLAConfig.pipeline_id).where(func.lower(SLAConfig.l1_email) == e).limit(1)
            )
            if r1.scalar_one_or_none():
                role = "l1"
            else:
                r2 = await session.execute(
                    select(SLAConfig.pipeline_id).where(func.lower(SLAConfig.l2_email) == e).limit(1)
                )
                if r2.scalar_one_or_none():
                    role = "l2"

        # Fallback to stored role if no sla_configs assignments found
        if role == "none" and user and user.get("role_id") in ("l1", "l2"):
            role = user["role_id"]

        # Auto-assign role if derived from sla_configs but not yet stored
        if role in ("l1", "l2") and (not user or user.get("role_id") != role):
            await user_repository.assign_role_if_not_admin(e, role)

        return role, False, workspace_ids, pipeline_ids

    async def list_users(self) -> List[UserResponse]:
        """Fetch all registered platform users with their assigned role name."""
        rows = await user_repository.list_users()
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
        """Fetch all configured security roles in the platform."""
        rows = await user_repository.list_roles()
        return [RoleResponse(id=r["id"], name=r["name"], description=r.get("description")) for r in rows]

    async def set_role(self, email: str, role_id: str) -> None:
        """Update a specific user's assigned role."""
        await user_repository.set_role(email, role_id)

    async def add_or_update_user(
        self, email: str, display_name: str, oid: str, role_id: str
    ) -> None:
        """Add a new directory user or update an existing user's attributes and role."""
        await user_repository.add_or_update_user(email, display_name, oid, role_id)

    async def delete_user(self, email: str) -> None:
        """Delete a user account by email address."""
        await user_repository.delete_user(email)

    async def ensure_assignment_users(self, l1_email: Optional[str], l2_email: Optional[str]) -> None:
        """Ensure designated L1 and L2 assignees have their respective roles recorded."""
        if l1_email:
            await user_repository.assign_role_if_not_admin(l1_email, "l1")
        if l2_email:
            await user_repository.assign_role_if_not_admin(l2_email, "l2")

    # ---- Pipeline-Level SLA Assignment Management ----

    async def list_all_assignments(self) -> List[SlaAssignment]:
        """Fetch all pipeline-level SLA assignments across all workspaces."""
        rows = await sla_repository.get_all_sla_configs()
        return [self._to_assignment_model(r) for r in rows]

    async def list_assignments_for_user(self, email: str) -> List[SlaAssignment]:
        """Fetch SLA assignments for a specific support engineer (L1 or L2)."""
        rows = await sla_repository.get_configs_for_user(email)
        return [self._to_assignment_model(r) for r in rows]

    @staticmethod
    def _to_assignment_model(row: dict) -> SlaAssignment:
        """Transform a database row dictionary into an SlaAssignment schema."""
        return SlaAssignment(
            pipeline_id=row.get("pipeline_id", ""),
            workspace_id=row.get("workspace_id"),
            pipeline_name=row.get("pipeline_name"),
            l1_email=row.get("l1_email"),
            l2_email=row.get("l2_email"),
            l1_name=row.get("l1_name"),
            l2_name=row.get("l2_name"),
            sla1_minutes=row.get("sla1_minutes") or DEFAULT_SLA1_MINUTES,
            sla2_minutes=row.get("sla2_minutes") or DEFAULT_SLA2_MINUTES,
            assigned_by=row.get("assigned_by"),
            updated_at=row.get("updated_at"),
        )


users_service = UsersService()

# Compatibility aliases
admin_service = users_service
auth_assignments_service = users_service
