import json
from typing import Any, Dict, Optional
import aiosqlite
from app.db.session import get_sqlite_path


class TableLogRepository:
    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path

    @property
    def db_path(self) -> str:
        return self._db_path or get_sqlite_path()

    async def get_table_log_mapping(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Fetch saved table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM table_log_mappings WHERE workspace_id = ?;", (workspace_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            for k in ["batch_header_mapping", "bronze_mapping", "silver_mapping"]:
                if res.get(k):
                    try:
                        res[k] = json.loads(res[k])
                    except Exception:
                        pass
            return res

    async def save_table_log_mapping(
        self,
        workspace_id: str,
        artifact_type: str,
        artifact_id: str,
        artifact_name: str,
        server_fqdn: str,
        database_name: str,
        batch_header_schema: str,
        batch_header_table: str,
        batch_header_mapping: Dict[str, Any],
        bronze_schema: str,
        bronze_table: str,
        bronze_mapping: Dict[str, Any],
        silver_schema: str,
        silver_table: str,
        silver_mapping: Dict[str, Any],
        updated_at: str,
    ):
        """Save or update table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO table_log_mappings (
                    workspace_id, artifact_type, artifact_id, artifact_name,
                    server_fqdn, database_name,
                    batch_header_schema, batch_header_table, batch_header_mapping,
                    bronze_schema, bronze_table, bronze_mapping,
                    silver_schema, silver_table, silver_mapping,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    artifact_type=excluded.artifact_type,
                    artifact_id=excluded.artifact_id,
                    artifact_name=excluded.artifact_name,
                    server_fqdn=excluded.server_fqdn,
                    database_name=excluded.database_name,
                    batch_header_schema=excluded.batch_header_schema,
                    batch_header_table=excluded.batch_header_table,
                    batch_header_mapping=excluded.batch_header_mapping,
                    bronze_schema=excluded.bronze_schema,
                    bronze_table=excluded.bronze_table,
                    bronze_mapping=excluded.bronze_mapping,
                    silver_schema=excluded.silver_schema,
                    silver_table=excluded.silver_table,
                    silver_mapping=excluded.silver_mapping,
                    updated_at=excluded.updated_at;
            """, (
                workspace_id,
                artifact_type,
                artifact_id,
                artifact_name,
                server_fqdn,
                database_name,
                batch_header_schema,
                batch_header_table,
                json.dumps(batch_header_mapping),
                bronze_schema,
                bronze_table,
                json.dumps(bronze_mapping),
                silver_schema,
                silver_table,
                json.dumps(silver_mapping),
                updated_at,
            ))
            await db.commit()

    async def delete_table_log_mapping(self, workspace_id: str):
        """Delete/reset table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM table_log_mappings WHERE workspace_id = ?;", (workspace_id,))
            await db.commit()


table_log_repository = TableLogRepository()
