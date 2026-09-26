from typing import Any, Dict, List, Optional
from sqlalchemy import func, or_, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from app.db.session import async_session_maker
from app.modules.sla.models.sla_config import SLAConfig
from app.modules.sla.models.sla_incident import SLAIncident


class SLARepository:
    def __init__(self):
        """Initializes the SLA repository backed by SQLAlchemy Async ORM."""
        pass

    # ---- SLA Config (single source of truth for L1/L2 assignments) ----

    async def get_sla_config(self, workspace_id: str, pipeline_id: str) -> Dict[str, Any]:
        """Gets SLA configuration for a pipeline, or defaults if not configured."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig).where(
                    SLAConfig.workspace_id == workspace_id,
                    SLAConfig.pipeline_id == pipeline_id,
                )
            )
            cfg = result.scalar_one_or_none()
            if cfg:
                s1 = cfg.sla1_minutes if cfg.sla1_minutes is not None else cfg.sla_minutes
                s2 = cfg.sla2_minutes if cfg.sla2_minutes is not None else cfg.sla_minutes
                return {
                    "pipelineId": cfg.pipeline_id,
                    "workspaceId": cfg.workspace_id,
                    "pipelineName": cfg.pipeline_name or "",
                    "l1Email": cfg.l1_email or "",
                    "l1Name": cfg.l1_name or "",
                    "l2Email": cfg.l2_email or "",
                    "l2Name": cfg.l2_name or "",
                    "slaMinutes": cfg.sla_minutes,
                    "sla1Minutes": s1,
                    "sla2Minutes": s2,
                    "assignedBy": cfg.assigned_by or "",
                }
            return {
                "pipelineId": pipeline_id,
                "workspaceId": workspace_id,
                "pipelineName": "",
                "l1Email": "",
                "l1Name": "",
                "l2Email": "",
                "l2Name": "",
                "slaMinutes": 30,
                "sla1Minutes": 30,
                "sla2Minutes": 60,
                "assignedBy": "",
            }

    async def save_sla_config(
        self,
        workspace_id: str,
        pipeline_id: str,
        l1_email: str,
        l2_email: str,
        sla_minutes: int,
        updated_at: str,
        sla1_minutes: Optional[int] = None,
        sla2_minutes: Optional[int] = None,
        l1_name: Optional[str] = None,
        l2_name: Optional[str] = None,
        pipeline_name: Optional[str] = None,
        assigned_by: Optional[str] = None,
    ) -> None:
        """Saves or updates SLA notification thresholds and engineer contacts for a pipeline."""
        s1 = sla1_minutes if sla1_minutes is not None else sla_minutes
        s2 = sla2_minutes if sla2_minutes is not None else sla_minutes

        async with async_session_maker() as session:
            stmt = sqlite_upsert(SLAConfig).values(
                pipeline_id=pipeline_id,
                workspace_id=workspace_id,
                pipeline_name=pipeline_name or "",
                l1_email=l1_email,
                l2_email=l2_email,
                l1_name=l1_name or "",
                l2_name=l2_name or "",
                sla_minutes=sla_minutes,
                sla1_minutes=s1,
                sla2_minutes=s2,
                assigned_by=assigned_by or "",
                updated_at=updated_at,
            ).on_conflict_do_update(
                index_elements=[SLAConfig.pipeline_id],
                set_={
                    "workspace_id": workspace_id,
                    "pipeline_name": pipeline_name or "",
                    "l1_email": l1_email,
                    "l2_email": l2_email,
                    "l1_name": l1_name or "",
                    "l2_name": l2_name or "",
                    "sla_minutes": sla_minutes,
                    "sla1_minutes": s1,
                    "sla2_minutes": s2,
                    "assigned_by": assigned_by or "",
                    "updated_at": updated_at,
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def get_sla_configs_for_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Returns SLA configs keyed by pipeline id for a workspace (camelCase)."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig).where(SLAConfig.workspace_id == workspace_id)
            )
            rows = result.scalars().all()
            return {
                r.pipeline_id: {
                    "pipelineName": r.pipeline_name or "",
                    "l1Email": r.l1_email or "",
                    "l1Name": r.l1_name or "",
                    "l2Email": r.l2_email or "",
                    "l2Name": r.l2_name or "",
                    "sla1Minutes": r.sla1_minutes if r.sla1_minutes is not None else r.sla_minutes,
                    "sla2Minutes": r.sla2_minutes if r.sla2_minutes is not None else r.sla_minutes,
                    "assignedBy": r.assigned_by or "",
                }
                for r in rows
            }

    async def get_all_sla_configs(self) -> List[Dict[str, Any]]:
        """Returns all SLA configs across all workspaces for admin view."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig).order_by(SLAConfig.workspace_id.asc(), SLAConfig.pipeline_name.asc())
            )
            rows = result.scalars().all()
            return [
                {
                    "pipeline_id": r.pipeline_id,
                    "workspace_id": r.workspace_id,
                    "pipeline_name": r.pipeline_name or "",
                    "l1_email": r.l1_email or "",
                    "l2_email": r.l2_email or "",
                    "l1_name": r.l1_name or "",
                    "l2_name": r.l2_name or "",
                    "sla1_minutes": r.sla1_minutes if r.sla1_minutes is not None else r.sla_minutes,
                    "sla2_minutes": r.sla2_minutes if r.sla2_minutes is not None else r.sla_minutes,
                    "assigned_by": r.assigned_by or "",
                    "updated_at": r.updated_at,
                }
                for r in rows
            ]

    async def delete_sla_config(self, pipeline_id: str) -> None:
        """Deletes an SLA config by pipeline ID."""
        from sqlalchemy import delete
        async with async_session_maker() as session:
            await session.execute(
                delete(SLAConfig).where(SLAConfig.pipeline_id == pipeline_id)
            )
            await session.commit()

    # ---- RBAC Scoping: workspace + pipeline IDs for L1/L2 users ----

    async def get_assigned_workspace_ids_for_user(self, email: str) -> List[str]:
        """Returns distinct workspace IDs where the user is assigned as L1 or L2."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig.workspace_id)
                .where(
                    or_(
                        func.lower(func.coalesce(SLAConfig.l1_email, "")) == e,
                        func.lower(func.coalesce(SLAConfig.l2_email, "")) == e,
                    ),
                    SLAConfig.workspace_id.isnot(None),
                    SLAConfig.workspace_id != "",
                )
                .distinct()
            )
            return [row[0] for row in result.all() if row[0]]

    async def get_assigned_pipeline_ids_for_user(self, email: str) -> List[str]:
        """Returns distinct pipeline IDs where the user is assigned as L1 or L2."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig.pipeline_id)
                .where(
                    or_(
                        func.lower(func.coalesce(SLAConfig.l1_email, "")) == e,
                        func.lower(func.coalesce(SLAConfig.l2_email, "")) == e,
                    ),
                    SLAConfig.pipeline_id.isnot(None),
                    SLAConfig.pipeline_id != "",
                )
                .distinct()
            )
            return [row[0] for row in result.all() if row[0]]

    async def get_configs_for_user(self, email: str) -> List[Dict[str, Any]]:
        """Returns all SLA configs where the user is L1 or L2 assignee."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAConfig)
                .where(
                    or_(
                        func.lower(func.coalesce(SLAConfig.l1_email, "")) == e,
                        func.lower(func.coalesce(SLAConfig.l2_email, "")) == e,
                    )
                )
                .order_by(SLAConfig.workspace_id.asc(), SLAConfig.pipeline_name.asc())
            )
            rows = result.scalars().all()
            return [
                {
                    "pipeline_id": r.pipeline_id,
                    "workspace_id": r.workspace_id,
                    "pipeline_name": r.pipeline_name or "",
                    "l1_email": r.l1_email or "",
                    "l2_email": r.l2_email or "",
                    "l1_name": r.l1_name or "",
                    "l2_name": r.l2_name or "",
                    "sla1_minutes": r.sla1_minutes if r.sla1_minutes is not None else r.sla_minutes,
                    "sla2_minutes": r.sla2_minutes if r.sla2_minutes is not None else r.sla_minutes,
                    "assigned_by": r.assigned_by or "",
                    "updated_at": r.updated_at,
                }
                for r in rows
            ]

    # ---- SLA Incidents ----

    async def get_active_incident_for_run(self, pipeline_run_id: str) -> Optional[Dict[str, Any]]:
        """Gets active incident for a run if any exists."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAIncident)
                .where(SLAIncident.pipeline_run_id == pipeline_run_id)
                .order_by(SLAIncident.failed_at.desc())
                .limit(1)
            )
            inc = result.scalar_one_or_none()
            if not inc:
                return None
            return self._incident_to_dict(inc)

    async def get_active_incidents(self, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves active or escalated SLA incidents, optionally filtered by workspace."""
        async with async_session_maker() as session:
            stmt = select(SLAIncident)
            if workspace_id:
                stmt = stmt.where(SLAIncident.workspace_id == workspace_id)
            stmt = stmt.order_by(SLAIncident.failed_at.desc())

            result = await session.execute(stmt)
            rows = result.scalars().all()
            return [self._incident_to_dict(r) for r in rows]

    async def get_all_unresolved_incidents(self) -> List[Dict[str, Any]]:
        """Returns all ACTIVE, ESCALATED_L2 and CRITICAL_UNRESOLVED incidents across all workspaces."""
        async with async_session_maker() as session:
            result = await session.execute(
                select(SLAIncident)
                .where(SLAIncident.status.in_(["ACTIVE", "ESCALATED_L2", "CRITICAL_UNRESOLVED"]))
                .order_by(SLAIncident.failed_at.desc())
            )
            rows = result.scalars().all()
            return [self._incident_to_dict(r) for r in rows]

    async def create_incident(self, incident: Dict[str, Any]) -> None:
        """Creates or updates an SLA tracking incident for a pipeline execution."""
        async with async_session_maker() as session:
            stmt = sqlite_upsert(SLAIncident).values(
                id=incident["id"],
                pipeline_id=incident.get("pipelineId"),
                pipeline_name=incident.get("pipelineName"),
                pipeline_run_id=incident.get("pipelineRunId"),
                workspace_id=incident.get("workspaceId"),
                status=incident.get("status", "ACTIVE"),
                failed_at=incident.get("failedAt"),
                sla_target_time=incident.get("slaTargetTime"),
                l1_notified_at=incident.get("l1NotifiedAt"),
                l2_escalated_at=incident.get("l2EscalatedAt"),
                resolved_at=incident.get("resolvedAt"),
                resolved_by=incident.get("resolvedBy"),
                error_message=incident.get("errorMessage"),
                updated_at=incident.get("updatedAt"),
            ).on_conflict_do_update(
                index_elements=[SLAIncident.id],
                set_={
                    "pipeline_id": incident.get("pipelineId"),
                    "pipeline_name": incident.get("pipelineName"),
                    "pipeline_run_id": incident.get("pipelineRunId"),
                    "workspace_id": incident.get("workspaceId"),
                    "status": incident.get("status", "ACTIVE"),
                    "failed_at": incident.get("failedAt"),
                    "sla_target_time": incident.get("slaTargetTime"),
                    "l1_notified_at": incident.get("l1NotifiedAt"),
                    "l2_escalated_at": incident.get("l2EscalatedAt"),
                    "resolved_at": incident.get("resolvedAt"),
                    "resolved_by": incident.get("resolvedBy"),
                    "error_message": incident.get("errorMessage"),
                    "updated_at": incident.get("updatedAt"),
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def get_incident_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single incident by its primary identifier."""
        async with async_session_maker() as session:
            r = await session.get(SLAIncident, incident_id)
            if not r:
                return None
            return self._incident_to_dict(r)

    async def update_incident(self, incident_id: str, updates: Dict[str, Any]) -> None:
        """Updates specific columns of an existing SLA incident record."""
        async with async_session_maker() as session:
            await session.execute(
                update(SLAIncident)
                .where(SLAIncident.id == incident_id)
                .values(**updates)
            )
            await session.commit()

    @staticmethod
    def _incident_to_dict(r: SLAIncident) -> Dict[str, Any]:
        """Helper to convert an SLAIncident ORM row to a dictionary."""
        return {
            "id": r.id,
            "pipeline_id": r.pipeline_id,
            "pipeline_name": r.pipeline_name,
            "pipeline_run_id": r.pipeline_run_id,
            "workspace_id": r.workspace_id,
            "status": r.status,
            "failed_at": r.failed_at,
            "sla_target_time": r.sla_target_time,
            "l1_notified_at": r.l1_notified_at,
            "l2_escalated_at": r.l2_escalated_at,
            "resolved_at": r.resolved_at,
            "resolved_by": r.resolved_by,
            "error_message": r.error_message,
            "updated_at": r.updated_at,
        }


sla_repository = SLARepository()
