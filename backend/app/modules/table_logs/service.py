import datetime
import logging
from typing import Any, Dict, List, Optional

from app.modules.table_logs.schema import (
    SaveTableConfigRequest,
    SaveTableLogMappingRequest,
    SqlColumnsRequest,
    SqlTablesRequest,
)
from app.services.db_service import db_service
from app.services.table_log_service import table_log_service

logger = logging.getLogger("fabric_monitor.table_logs")


class TableLogDomainService:
    async def get_data_artifacts(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await table_log_service.get_data_artifacts(workspace_id)

    async def get_sql_tables(self, payload: SqlTablesRequest) -> List[Dict[str, Any]]:
        server = (payload.serverFqdn or payload.server_fqdn or "").strip()
        db = (payload.databaseName or payload.database_name or "").strip()
        if not server or not db:
            return []
        return await table_log_service.get_schemas_and_tables(server, db)

    async def get_sql_columns(self, payload: SqlColumnsRequest) -> List[Dict[str, Any]]:
        server = (payload.serverFqdn or payload.server_fqdn or "").strip()
        db = (payload.databaseName or payload.database_name or "").strip()
        schema = (payload.schemaName or payload.schema_name or "").strip()
        table = (payload.tableName or payload.table_name or "").strip()
        if not server or not db or not schema or not table:
            return []
        return await table_log_service.get_table_columns(server, db, schema, table)

    async def get_table_log_mapping(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        return await db_service.get_table_log_mapping(workspace_id)

    async def save_table_log_mapping(self, workspace_id: str, payload: SaveTableLogMappingRequest) -> Dict[str, Any]:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        await db_service.save_table_log_mapping(
            workspace_id=workspace_id,
            artifact_type=payload.artifactType or payload.artifact_type or "",
            artifact_id=payload.artifactId or payload.artifact_id or "",
            artifact_name=payload.artifactName or payload.artifact_name or "",
            server_fqdn=payload.serverFqdn or payload.server_fqdn or "",
            database_name=payload.databaseName or payload.database_name or "",
            batch_header_schema=payload.batchHeaderSchema or payload.batch_header_schema or "",
            batch_header_table=payload.batchHeaderTable or payload.batch_header_table or "",
            batch_header_mapping=payload.batchHeaderMapping or payload.batch_header_mapping or {},
            bronze_schema=payload.bronzeSchema or payload.bronze_schema or "",
            bronze_table=payload.bronzeTable or payload.bronze_table or "",
            bronze_mapping=payload.bronzeMapping or payload.bronze_mapping or {},
            silver_schema=payload.silverSchema or payload.silver_schema or "",
            silver_table=payload.silverTable or payload.silver_table or "",
            silver_mapping=payload.silverMapping or payload.silver_mapping or {},
            updated_at=now_iso,
        )
        return {"status": "success", "workspaceId": workspace_id, "updatedAt": now_iso}

    async def delete_table_log_mapping(self, workspace_id: str) -> Dict[str, Any]:
        await db_service.delete_table_log_mapping(workspace_id)
        return {"status": "success", "message": "Mapping cleared successfully."}

    async def query_table_logs(
        self,
        workspace_id: str,
        pipeline_run_id: Optional[str] = None,
        batch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await table_log_service.query_table_logs(
            workspace_id=workspace_id,
            pipeline_run_id=pipeline_run_id,
            batch_id=batch_id,
        )

    # Lakehouse discovery & diagnostics
    async def get_tables(self, workspace_id: str, force_refresh: bool = False) -> List[Dict[str, Any]]:
        return await table_log_service.discover_tables(workspace_id, force_refresh=force_refresh)

    async def get_config(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        return await table_log_service.get_table_log_config(workspace_id)

    async def save_config(self, workspace_id: str, payload: SaveTableConfigRequest) -> Dict[str, Any]:
        return await table_log_service.save_table_log_config(
            workspace_id=workspace_id,
            batch_header_table=payload.batchHeaderTable,
            batch_details_table=payload.batchDetailsTable,
            log_storage_type=payload.logStorageType or 'lakehouse',
            lakehouse_id=payload.lakehouseId,
            column_mappings=payload.columnMappings or {},
        )

    async def get_headers(self, workspace_id: str, pipeline_name: Optional[str] = None, run_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        return await table_log_service.query_batch_headers(
            workspace_id=workspace_id,
            pipeline_name=pipeline_name,
            run_id=run_id,
            limit=limit,
        )

    async def get_details(self, workspace_id: str, batch_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        return await table_log_service.query_batch_details(
            workspace_id=workspace_id,
            batch_id=batch_id,
            limit=limit,
        )

    async def get_diagnostic(self, workspace_id: str) -> Dict[str, Any]:
        return await table_log_service.diagnose_connection(workspace_id)

    async def refresh_headers(self, workspace_id: str, pipeline_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        return await table_log_service.refresh_batch_headers(
            workspace_id=workspace_id,
            pipeline_name=pipeline_name,
            limit=limit,
        )

    async def test_connection(self, server: Optional[str] = None, database: Optional[str] = None) -> Dict[str, Any]:
        return await table_log_service.test_direct_connection(server=server, database=database)

    async def preview_table(self, workspace_id: str, table_name: str, lakehouse_id: Optional[str] = None, limit: int = 10) -> List[Dict[str, Any]]:
        return await table_log_service.query_table_preview(
            workspace_id=workspace_id,
            table_name=table_name,
            lakehouse_id=lakehouse_id,
            limit=limit,
        )


table_log_domain_service = TableLogDomainService()
