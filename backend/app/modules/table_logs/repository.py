import json
from typing import Any, Dict, Optional
from sqlalchemy import delete, select
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from app.db.session import async_session_maker
from app.modules.table_logs.models.table_log_mapping import TableLogMapping


class TableLogRepository:
    def __init__(self):
        """Initializes the table log repository backed by SQLAlchemy Async ORM."""
        pass

    async def get_table_log_mapping(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Fetch saved table log mapping for a workspace."""
        async with async_session_maker() as session:
            mapping = await session.get(TableLogMapping, workspace_id)
            if not mapping:
                return None

            res = {
                "workspace_id": mapping.workspace_id,
                "artifact_type": mapping.artifact_type,
                "artifact_id": mapping.artifact_id,
                "artifact_name": mapping.artifact_name,
                "server_fqdn": mapping.server_fqdn,
                "database_name": mapping.database_name,
                "batch_header_schema": mapping.batch_header_schema,
                "batch_header_table": mapping.batch_header_table,
                "batch_header_mapping": mapping.batch_header_mapping,
                "bronze_schema": mapping.bronze_schema,
                "bronze_table": mapping.bronze_table,
                "bronze_mapping": mapping.bronze_mapping,
                "silver_schema": mapping.silver_schema,
                "silver_table": mapping.silver_table,
                "silver_mapping": mapping.silver_mapping,
                "updated_at": mapping.updated_at,
            }

            for k in ["batch_header_mapping", "bronze_mapping", "silver_mapping"]:
                if res.get(k) and isinstance(res[k], str):
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
    ) -> None:
        """Save or update table log mapping for a workspace."""
        b_hdr_str = json.dumps(batch_header_mapping) if isinstance(batch_header_mapping, dict) else batch_header_mapping
        br_str = json.dumps(bronze_mapping) if isinstance(bronze_mapping, dict) else bronze_mapping
        sl_str = json.dumps(silver_mapping) if isinstance(silver_mapping, dict) else silver_mapping

        async with async_session_maker() as session:
            stmt = sqlite_upsert(TableLogMapping).values(
                workspace_id=workspace_id,
                artifact_type=artifact_type,
                artifact_id=artifact_id,
                artifact_name=artifact_name,
                server_fqdn=server_fqdn,
                database_name=database_name,
                batch_header_schema=batch_header_schema,
                batch_header_table=batch_header_table,
                batch_header_mapping=b_hdr_str,
                bronze_schema=bronze_schema,
                bronze_table=bronze_table,
                bronze_mapping=br_str,
                silver_schema=silver_schema,
                silver_table=silver_table,
                silver_mapping=sl_str,
                updated_at=updated_at,
            ).on_conflict_do_update(
                index_elements=[TableLogMapping.workspace_id],
                set_={
                    "artifact_type": artifact_type,
                    "artifact_id": artifact_id,
                    "artifact_name": artifact_name,
                    "server_fqdn": server_fqdn,
                    "database_name": database_name,
                    "batch_header_schema": batch_header_schema,
                    "batch_header_table": batch_header_table,
                    "batch_header_mapping": b_hdr_str,
                    "bronze_schema": bronze_schema,
                    "bronze_table": bronze_table,
                    "bronze_mapping": br_str,
                    "silver_schema": silver_schema,
                    "silver_table": silver_table,
                    "silver_mapping": sl_str,
                    "updated_at": updated_at,
                },
            )
            await session.execute(stmt)
            await session.commit()

    async def delete_table_log_mapping(self, workspace_id: str) -> None:
        """Delete/reset table log mapping for a workspace."""
        async with async_session_maker() as session:
            await session.execute(
                delete(TableLogMapping).where(TableLogMapping.workspace_id == workspace_id)
            )
            await session.commit()


table_log_repository = TableLogRepository()
