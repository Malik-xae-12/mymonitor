import datetime
from typing import List
from app.modules.auth.schema import (
    AssignmentUpsertRequest,
    WorkspaceAssignment,
)
from app.modules.users.service import users_service
from app.modules.workspaces.repository import workspace_repository


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


class AuthAssignmentsService:
    async def list_all_assignments(self) -> List[WorkspaceAssignment]:
        rows = await workspace_repository.get_all_assignments()
        return [self._to_model(r) for r in rows]

    async def list_assignments_for_user(self, email: str) -> List[WorkspaceAssignment]:
        rows = await workspace_repository.get_assignments_for_user(email)
        return [self._to_model(r) for r in rows]

    async def upsert_assignment(
        self, payload: AssignmentUpsertRequest, assigned_by: str
    ) -> WorkspaceAssignment:
        await workspace_repository.upsert_assignment(
            data=payload.model_dump(),
            assigned_by=assigned_by,
            when=_now(),
        )
        await users_service.ensure_assignment_users(payload.l1_email, payload.l2_email)
        row = await workspace_repository.get_assignment(payload.workspace_id)
        return self._to_model(row)

    async def delete_assignment(self, workspace_id: str) -> None:
        await workspace_repository.delete_assignment(workspace_id)

    @staticmethod
    def _to_model(row: dict) -> WorkspaceAssignment:
        return WorkspaceAssignment(
            workspace_id=row.get("workspace_id"),
            workspace_name=row.get("workspace_name"),
            l1_email=row.get("l1_email"),
            l2_email=row.get("l2_email"),
            sla1_minutes=row.get("sla1_minutes") or 30,
            sla2_minutes=row.get("sla2_minutes") or 60,
            table_config_done=bool(row.get("table_config_done")),
            assigned_by=row.get("assigned_by"),
            updated_at=row.get("updated_at"),
        )


auth_assignments_service = AuthAssignmentsService()
