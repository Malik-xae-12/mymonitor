import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import delete, func, or_, select, union
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from app.db.session import async_session_maker
from app.modules.workspaces.models.workspace import Workspace
from app.modules.workspaces.models.assignment import WorkspaceAssignment
from app.modules.sla.models.sla_config import SLAConfig
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES, DEFAULT_WORKSPACE_NAME


class WorkspaceRepository:
    def __init__(self):
        """Initializes the workspaces repository backed by SQLAlchemy Async ORM."""
        pass

    async def save_workspaces(self, workspaces: List[Dict[str, Any]], updated_at: Optional[str] = None) -> None:
        """Persists workspaces to the local SQLite database using SQLAlchemy ORM upsert."""
        if not workspaces:
            return
        if not updated_at:
            updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        async with async_session_maker() as session:
            for ws in workspaces:
                wid = ws.get("id")
                name = ws.get("displayName") or ws.get("name") or DEFAULT_WORKSPACE_NAME
                stmt = sqlite_upsert(Workspace).values(
                    id=wid,
                    displayName=name,
                    last_polled_at=updated_at,
                ).on_conflict_do_update(
                    index_elements=[Workspace.id],
                    set_={
                        "displayName": name,
                        "last_polled_at": updated_at,
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def get_all_workspaces(self) -> List[Dict[str, Any]]:
        """Retrieves all workspaces stored in the local SQLite cache ordered by display name."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(Workspace).order_by(Workspace.displayName.asc())
            )
            workspaces = result.scalars().all()
            return [
                {
                    "id": w.id,
                    "displayName": w.displayName,
                    "last_polled_at": w.last_polled_at,
                }
                for w in workspaces
            ]

    async def get_all_assignments(self) -> List[Dict[str, Any]]:
        """Returns every workspace assignment record for administrative view."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(WorkspaceAssignment).order_by(WorkspaceAssignment.workspace_name.asc())
            )
            rows = result.scalars().all()
            return [
                {
                    "workspace_id": r.workspace_id,
                    "workspace_name": r.workspace_name,
                    "l1_email": r.l1_email,
                    "l2_email": r.l2_email,
                    "sla1_minutes": r.sla1_minutes,
                    "sla2_minutes": r.sla2_minutes,
                    "table_config_done": r.table_config_done,
                    "assigned_by": r.assigned_by,
                    "updated_at": r.updated_at,
                }
                for r in rows
            ]

    async def get_assignment(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Fetches the assignment record for a single workspace ID."""
        async with async_session_maker() as session:
            assignment = await session.get(WorkspaceAssignment, workspace_id)
            if not assignment:
                return None
            return {
                "workspace_id": assignment.workspace_id,
                "workspace_name": assignment.workspace_name,
                "l1_email": assignment.l1_email,
                "l2_email": assignment.l2_email,
                "sla1_minutes": assignment.sla1_minutes,
                "sla2_minutes": assignment.sla2_minutes,
                "table_config_done": assignment.table_config_done,
                "assigned_by": assignment.assigned_by,
                "updated_at": assignment.updated_at,
            }

    async def get_assignments_for_user(self, email: str) -> List[Dict[str, Any]]:
        """Returns assignments where the given email is the L1 or L2 responsible user."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with async_session_maker() as session:
            result = await session.execute(
                select(WorkspaceAssignment)
                .where(
                    or_(
                        func.lower(WorkspaceAssignment.l1_email) == e,
                        func.lower(WorkspaceAssignment.l2_email) == e,
                    )
                )
                .order_by(WorkspaceAssignment.workspace_name.asc())
            )
            rows = result.scalars().all()
            return [
                {
                    "workspace_id": r.workspace_id,
                    "workspace_name": r.workspace_name,
                    "l1_email": r.l1_email,
                    "l2_email": r.l2_email,
                    "sla1_minutes": r.sla1_minutes,
                    "sla2_minutes": r.sla2_minutes,
                    "table_config_done": r.table_config_done,
                    "assigned_by": r.assigned_by,
                    "updated_at": r.updated_at,
                }
                for r in rows
            ]

    async def get_assigned_workspace_ids_for_user(self, email: str) -> List[str]:
        """Returns all distinct workspace IDs where the user is assigned as L1 or L2 in workspace_assignments OR sla_configs."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with async_session_maker() as session:
            q1 = select(WorkspaceAssignment.workspace_id).where(
                or_(
                    func.lower(func.coalesce(WorkspaceAssignment.l1_email, "")) == e,
                    func.lower(func.coalesce(WorkspaceAssignment.l2_email, "")) == e,
                )
            )
            q2 = select(SLAConfig.workspace_id).where(
                or_(
                    func.lower(func.coalesce(SLAConfig.l1_email, "")) == e,
                    func.lower(func.coalesce(SLAConfig.l2_email, "")) == e,
                )
            )
            combined = union(q1, q2).subquery()
            result = await session.execute(
                select(combined.c.workspace_id).where(
                    combined.c.workspace_id.isnot(None),
                    combined.c.workspace_id != "",
                )
            )
            return [row[0] for row in result.all() if row[0]]

    async def upsert_assignment(self, data: Dict[str, Any], assigned_by: str, when: str) -> None:
        """Creates/updates the L1/L2 + SLA assignment for a workspace."""
        wid = data.get("workspace_id")
        wname = data.get("workspace_name")
        l1 = (data.get("l1_email") or "").lower()
        l2 = (data.get("l2_email") or "").lower()
        s1 = int(data.get("sla1_minutes") or DEFAULT_SLA1_MINUTES)
        s2 = int(data.get("sla2_minutes") or DEFAULT_SLA2_MINUTES)
        done = 1 if data.get("table_config_done") else 0

        async with async_session_maker() as session:
            stmt = sqlite_upsert(WorkspaceAssignment).values(
                workspace_id=wid,
                workspace_name=wname,
                l1_email=l1,
                l2_email=l2,
                sla1_minutes=s1,
                sla2_minutes=s2,
                table_config_done=done,
                assigned_by=assigned_by,
                updated_at=when,
            ).on_conflict_do_update(
                index_elements=[WorkspaceAssignment.workspace_id],
                set_={
                    "workspace_name": wname,
                    "l1_email": l1,
                    "l2_email": l2,
                    "sla1_minutes": s1,
                    "sla2_minutes": s2,
                    "table_config_done": done,
                    "assigned_by": assigned_by,
                    "updated_at": when,
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def delete_assignment(self, workspace_id: str) -> None:
        """Deletes a workspace assignment record by its workspace ID."""
        async with async_session_maker() as session:
            await session.execute(
                delete(WorkspaceAssignment).where(WorkspaceAssignment.workspace_id == workspace_id)
            )
            await session.commit()


workspace_repository = WorkspaceRepository()
