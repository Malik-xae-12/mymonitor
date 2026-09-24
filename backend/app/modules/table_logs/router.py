from typing import Optional
from fastapi import APIRouter, HTTPException
from app.modules.table_logs.schema import (
    SaveTableConfigRequest,
    SaveTableLogMappingRequest,
    SqlColumnsRequest,
    SqlTablesRequest,
    TestConnectionRequest,
)
from app.modules.table_logs.service import table_log_domain_service

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["table-logs"])


@router.get("/data-artifacts")
async def get_workspace_data_artifacts(workspace_id: str):
    """Returns all Warehouses and Lakehouses inside the workspace with SQL endpoints."""
    artifacts = await table_log_domain_service.get_data_artifacts(workspace_id)
    return {"workspaceId": workspace_id, "artifacts": artifacts}


@router.post("/sql-metadata/tables")
async def get_sql_tables(workspace_id: str, payload: SqlTablesRequest):
    """Lists all user schemas and tables from Warehouse or Lakehouse SQL endpoint."""
    try:
        tables = await table_log_domain_service.get_sql_tables(payload)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query tables from SQL Endpoint: {e}")


@router.post("/sql-metadata/columns")
async def get_sql_columns(workspace_id: str, payload: SqlColumnsRequest):
    """Fetches all columns and data types for selected schema and table."""
    try:
        columns = await table_log_domain_service.get_sql_columns(payload)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query columns: {e}")


@router.get("/table-log-mapping")
async def get_table_log_mapping(workspace_id: str):
    """Fetches configured table log and column mapping for workspace."""
    mapping = await table_log_domain_service.get_table_log_mapping(workspace_id)
    return {"workspaceId": workspace_id, "mapping": mapping}


@router.post("/table-log-mapping")
async def save_table_log_mapping(workspace_id: str, payload: SaveTableLogMappingRequest):
    """Persists warehouse/lakehouse and column mapping in SQLite database."""
    return await table_log_domain_service.save_table_log_mapping(workspace_id, payload)


@router.delete("/table-log-mapping")
async def delete_table_log_mapping(workspace_id: str):
    """Resets/deletes the table log and column mapping for the workspace."""
    return await table_log_domain_service.delete_table_log_mapping(workspace_id)


@router.get("/table-logs")
async def get_table_logs(
    workspace_id: str,
    pipeline_run_id: Optional[str] = None,
    batch_id: Optional[str] = None,
):
    """Queries table-level logs (KPIs, Bronze/Silver layer overviews, table details)."""
    try:
        return await table_log_domain_service.query_table_logs(
            workspace_id=workspace_id,
            pipeline_run_id=pipeline_run_id,
            batch_id=batch_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query table logs: {e}")


# ---- Lakehouse & Batch Log Subroutes --------------------------------
@router.get("/table-logs/tables")
async def get_workspace_tables(workspace_id: str, refresh: bool = False):
    """Discover available Lakehouse & Warehouse delta tables."""
    return await table_log_domain_service.get_tables(workspace_id, force_refresh=refresh)


@router.get("/table-logs/config")
async def get_table_log_config(workspace_id: str):
    """Retrieve saved table log column mapping configuration."""
    cfg = await table_log_domain_service.get_config(workspace_id)
    return cfg or {}


@router.post("/table-logs/config")
async def save_table_log_config(workspace_id: str, payload: SaveTableConfigRequest):
    """Save or update Lakehouse table log column mappings."""
    return await table_log_domain_service.save_config(workspace_id, payload)


@router.get("/table-logs/headers")
async def get_batch_headers(
    workspace_id: str,
    pipeline_name: Optional[str] = None,
    run_id: Optional[str] = None,
    limit: int = 50,
):
    """Fetch batch execution headers from Lakehouse / Warehouse."""
    return await table_log_domain_service.get_headers(workspace_id, pipeline_name, run_id, limit)


@router.get("/table-logs/details")
async def get_batch_details(
    workspace_id: str,
    batch_id: Optional[str] = None,
    limit: int = 100,
):
    """Fetch activity-level details and step metrics for a batch."""
    return await table_log_domain_service.get_details(workspace_id, batch_id, limit)


@router.get("/table-logs/diagnostic")
async def get_table_log_diagnostic(workspace_id: str):
    """Perform diagnostic connectivity and health checks for table log storage."""
    return await table_log_domain_service.get_diagnostic(workspace_id)


@router.post("/table-logs/refresh-headers")
async def refresh_batch_headers(
    workspace_id: str,
    pipeline_name: Optional[str] = None,
    limit: int = 50,
):
    """Force an active sync of batch headers from Lakehouse SQL endpoint."""
    return await table_log_domain_service.refresh_headers(workspace_id, pipeline_name, limit)


@router.post("/table-logs/test-connection")
async def test_table_connection(payload: TestConnectionRequest):
    """Test SQL endpoint connectivity with provided server/database credentials."""
    return await table_log_domain_service.test_connection(payload.server, payload.database)


@router.get("/table-logs/table-preview")
async def get_table_preview(
    workspace_id: str,
    table_name: str,
    lakehouse_id: Optional[str] = None,
    limit: int = 10,
):
    """Fetch top N rows from a specific Lakehouse table for column mapping preview."""
    return await table_log_domain_service.preview_table(workspace_id, table_name, lakehouse_id, limit)
