from typing import Any, Dict, List, Optional
import aiosqlite
from app.db.session import get_sqlite_path


class WorkspaceRepository:
    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path

    @property
    def db_path(self) -> str:
        return self._db_path or get_sqlite_path()

    async def save_workspaces(self, workspaces: List[Dict[str, Any]], updated_at: str):
        async with aiosqlite.connect(self.db_path) as db:
            for ws in workspaces:
                wid = ws.get("id")
                name = ws.get("displayName") or ws.get("name") or "Workspace"
                await db.execute("""
                    INSERT INTO workspaces (id, displayName, last_polled_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        displayName=excluded.displayName,
                        last_polled_at=excluded.last_polled_at
                """, (wid, name, updated_at))
            await db.commit()

    async def get_all_workspaces(self) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT id, displayName, last_polled_at FROM workspaces ORDER BY displayName")
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_all_assignments(self) -> List[Dict[str, Any]]:
        """Returns every workspace assignment (admin view)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM workspace_assignments ORDER BY workspace_name")
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_assignment(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM workspace_assignments WHERE workspace_id = ?", (workspace_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_assignments_for_user(self, email: str) -> List[Dict[str, Any]]:
        """Returns assignments where the given email is the L1 or L2 responsible user."""
        e = (email or "").lower()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM workspace_assignments
                WHERE LOWER(l1_email) = ? OR LOWER(l2_email) = ?
                ORDER BY workspace_name
            """, (e, e))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_assigned_workspace_ids_for_user(self, email: str) -> List[str]:
        """Returns all distinct workspace IDs where the user is assigned as L1 or L2 in workspace_assignments OR sla_configs."""
        e = (email or "").strip().lower()
        if not e:
            return []
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                SELECT DISTINCT workspace_id FROM (
                    SELECT workspace_id FROM workspace_assignments
                    WHERE LOWER(COALESCE(l1_email, '')) = ? OR LOWER(COALESCE(l2_email, '')) = ?
                    UNION
                    SELECT workspace_id FROM sla_configs
                    WHERE LOWER(COALESCE(l1_email, '')) = ? OR LOWER(COALESCE(l2_email, '')) = ?
                )
                WHERE workspace_id IS NOT NULL AND workspace_id != ''
            """, (e, e, e, e))
            rows = await cursor.fetchall()
            return [r[0] for r in rows if r[0]]

    async def upsert_assignment(self, data: Dict[str, Any], assigned_by: str, when: str):
        """Creates/updates the L1/L2 + SLA assignment for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO workspace_assignments (
                    workspace_id, workspace_name, l1_email, l2_email,
                    sla1_minutes, sla2_minutes, table_config_done, assigned_by, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    workspace_name=excluded.workspace_name,
                    l1_email=excluded.l1_email,
                    l2_email=excluded.l2_email,
                    sla1_minutes=excluded.sla1_minutes,
                    sla2_minutes=excluded.sla2_minutes,
                    table_config_done=excluded.table_config_done,
                    assigned_by=excluded.assigned_by,
                    updated_at=excluded.updated_at
            """, (
                data.get("workspace_id"),
                data.get("workspace_name"),
                (data.get("l1_email") or "").lower(),
                (data.get("l2_email") or "").lower(),
                int(data.get("sla1_minutes") or 30),
                int(data.get("sla2_minutes") or 60),
                1 if data.get("table_config_done") else 0,
                assigned_by,
                when,
            ))
            await db.commit()

    async def delete_assignment(self, workspace_id: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM workspace_assignments WHERE workspace_id = ?", (workspace_id,))
            await db.commit()


workspace_repository = WorkspaceRepository()
