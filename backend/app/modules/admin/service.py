import datetime
from typing import List

from app.modules.auth.schema import (
    AssignmentUpsertRequest,
    WorkspaceAssignment,
)
from app.modules.users.service import users_service
from app.modules.workspaces.repository import workspace_repository
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES


def _now() -> str:
    """Return current UTC ISO8601 timestamp."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class AdminService:
    """Service handling platform administrative functions, specifically workspace support team assignments."""

    async def list_all_assignments(self) -> List[WorkspaceAssignment]:
        """Fetch all workspace support team assignments across all workspaces."""
        rows = await workspace_repository.get_all_assignments()
        return [self._to_model(r) for r in rows]

    async def list_assignments_for_user(self, email: str) -> List[WorkspaceAssignment]:
        """Fetch workspace assignments for a specific support engineer (L1 or L2)."""
        rows = await workspace_repository.get_assignments_for_user(email)
        return [self._to_model(r) for r in rows]

    async def upsert_assignment(
        self, payload: AssignmentUpsertRequest, assigned_by: str
    ) -> WorkspaceAssignment:
        """Create or update a workspace assignment with L1/L2 emails and SLA thresholds."""
        await workspace_repository.upsert_assignment(
            data=payload.model_dump(),
            assigned_by=assigned_by,
            when=_now(),
        )
        await users_service.ensure_assignment_users(payload.l1_email, payload.l2_email)
        row = await workspace_repository.get_assignment(payload.workspace_id)
        return self._to_model(row)

    async def delete_assignment(self, workspace_id: str) -> None:
        """Delete an assignment configuration for a workspace."""
        await workspace_repository.delete_assignment(workspace_id)

    @staticmethod
    def _to_model(row: dict) -> WorkspaceAssignment:
        """Transform a database row dictionary into a WorkspaceAssignment schema."""
        return WorkspaceAssignment(
            workspace_id=row.get("workspace_id"),
            workspace_name=row.get("workspace_name"),
            l1_email=row.get("l1_email"),
            l2_email=row.get("l2_email"),
            sla1_minutes=row.get("sla1_minutes") or DEFAULT_SLA1_MINUTES,
            sla2_minutes=row.get("sla2_minutes") or DEFAULT_SLA2_MINUTES,
            table_config_done=bool(row.get("table_config_done")),
            assigned_by=row.get("assigned_by"),
            updated_at=row.get("updated_at"),
        )


admin_service = AdminService()
# Compatibility alias
auth_assignments_service = admin_service
