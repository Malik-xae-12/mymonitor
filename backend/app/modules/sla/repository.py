import datetime
from typing import Any, Dict, List, Optional
import aiosqlite
from app.db.session import get_sqlite_path


class SLARepository:
    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path

    @property
    def db_path(self) -> str:
        return self._db_path or get_sqlite_path()

    async def get_sla_config(self, workspace_id: str, pipeline_id: str) -> Dict[str, Any]:
        """Gets SLA configuration for a pipeline, or defaults if not configured."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, workspace_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs
                WHERE workspace_id = ? AND pipeline_id = ?
            """, (workspace_id, pipeline_id))
            row = await cursor.fetchone()
            if row:
                return {
                    "pipelineId": row["pipeline_id"],
                    "workspaceId": row["workspace_id"],
                    "l1Email": row["l1_email"],
                    "l1Name": row["l1_name"] or "",
                    "l2Email": row["l2_email"],
                    "l2Name": row["l2_name"] or "",
                    "slaMinutes": row["sla_minutes"],
                    "sla1Minutes": row["sla1_minutes"],
                    "sla2Minutes": row["sla2_minutes"],
                }
            return {
                "pipelineId": pipeline_id,
                "workspaceId": workspace_id,
                "l1Email": "",
                "l1Name": "",
                "l2Email": "",
                "l2Name": "",
                "slaMinutes": 30,
                "sla1Minutes": 30,
                "sla2Minutes": 60,
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
    ):
        s1 = sla1_minutes if sla1_minutes is not None else sla_minutes
        s2 = sla2_minutes if sla2_minutes is not None else sla_minutes
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO sla_configs (
                    pipeline_id, workspace_id, l1_email, l2_email, l1_name, l2_name,
                    sla_minutes, sla1_minutes, sla2_minutes, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pipeline_id) DO UPDATE SET
                    workspace_id=excluded.workspace_id,
                    l1_email=excluded.l1_email,
                    l2_email=excluded.l2_email,
                    l1_name=excluded.l1_name,
                    l2_name=excluded.l2_name,
                    sla_minutes=excluded.sla_minutes,
                    sla1_minutes=excluded.sla1_minutes,
                    sla2_minutes=excluded.sla2_minutes,
                    updated_at=excluded.updated_at
            """, (pipeline_id, workspace_id, l1_email, l2_email, l1_name or "", l2_name or "", s1, s1, s2, updated_at))
            await db.commit()

    async def get_sla_configs_for_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Returns SLA configs keyed by pipeline id for a workspace (camelCase)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs WHERE workspace_id = ?
            """, (workspace_id,))
            rows = await cursor.fetchall()
            return {
                r["pipeline_id"]: {
                    "l1Email": r["l1_email"],
                    "l1Name": r["l1_name"] or "",
                    "l2Email": r["l2_email"],
                    "l2Name": r["l2_name"] or "",
                    "sla1Minutes": r["sla1_minutes"],
                    "sla2Minutes": r["sla2_minutes"],
                } for r in rows
            }

    async def get_active_incident_for_run(self, pipeline_run_id: str) -> Optional[Dict[str, Any]]:
        """Gets active incident for a run if any exists."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                       status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                       resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE pipeline_run_id = ?
                ORDER BY failed_at DESC LIMIT 1
            """, (pipeline_run_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_active_incidents(self, workspace_id: Optional[str] = None) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            if workspace_id:
                cursor = await db.execute("""
                    SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                           status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                           resolved_at, resolved_by, error_message
                    FROM sla_incidents
                    WHERE workspace_id = ?
                    ORDER BY failed_at DESC
                """, (workspace_id,))
            else:
                cursor = await db.execute("""
                    SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                           status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                           resolved_at, resolved_by, error_message
                    FROM sla_incidents
                    ORDER BY failed_at DESC
                """)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_all_unresolved_incidents(self) -> List[Dict[str, Any]]:
        """Returns all ACTIVE and ESCALATED_L2 incidents across all workspaces."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                       status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                       resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE status IN ('ACTIVE', 'ESCALATED_L2')
            """)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def create_incident(self, incident: Dict[str, Any]):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO sla_incidents (
                    id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                    status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                    resolved_at, resolved_by, error_message, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    sla_target_time=excluded.sla_target_time,
                    l1_notified_at=excluded.l1_notified_at,
                    l2_escalated_at=excluded.l2_escalated_at,
                    resolved_at=excluded.resolved_at,
                    resolved_by=excluded.resolved_by,
                    error_message=excluded.error_message,
                    updated_at=excluded.updated_at
            """, (
                incident["id"], incident["pipelineId"], incident["pipelineName"],
                incident["pipelineRunId"], incident["workspaceId"], incident.get("status", "ACTIVE"),
                incident["failedAt"], incident["slaTargetTime"], incident.get("l1NotifiedAt"),
                incident.get("l2EscalatedAt"), incident.get("resolvedAt"), incident.get("resolvedBy"),
                incident.get("errorMessage"), incident["updatedAt"]
            ))
            await db.commit()

    async def update_incident(self, incident_id: str, updates: Dict[str, Any]):
        fields = []
        values = []
        for k, v in updates.items():
            fields.append(f"{k} = ?")
            values.append(v)
        values.append(incident_id)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(f"UPDATE sla_incidents SET {', '.join(fields)} WHERE id = ?", values)
            await db.commit()


sla_repository = SLARepository()
