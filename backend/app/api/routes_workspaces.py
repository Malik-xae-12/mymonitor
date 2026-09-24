from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import datetime
import asyncio
import logging
from backend.app.services.fabric_client import fabric_client
from backend.app.services.leased_poller import leased_poller
from backend.app.services.db_service import db_service
from backend.app.services.alert_service import alert_service
from backend.app.services.connection_manager import connection_manager
from backend.app.services.table_log_service import table_log_service
from backend.app.models.monitoring import PipelineSchedule

logger = logging.getLogger("fabric_monitor.workspaces")

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

class SlaConfigRequest(BaseModel):
    l1Email: str
    l1Name: Optional[str] = ""
    l2Email: str
    l2Name: Optional[str] = ""
    slaMinutes: int = 30
    sla1Minutes: Optional[int] = None
    sla2Minutes: Optional[int] = None

class IncidentResolveRequest(BaseModel):
    resolvedBy: Optional[str] = "Operator"

class TestEmailRequest(BaseModel):
    email: str
    role: str = "L1 Support"
    pipelineName: Optional[str] = "Pipeline"

class SqlTablesRequest(BaseModel):
    serverFqdn: Optional[str] = None
    databaseName: Optional[str] = None
    server_fqdn: Optional[str] = None
    database_name: Optional[str] = None

class SqlColumnsRequest(BaseModel):
    serverFqdn: Optional[str] = None
    databaseName: Optional[str] = None
    schemaName: Optional[str] = None
    tableName: Optional[str] = None
    server_fqdn: Optional[str] = None
    database_name: Optional[str] = None
    schema_name: Optional[str] = None
    table_name: Optional[str] = None

class SaveTableLogMappingRequest(BaseModel):
    artifactType: Optional[str] = None
    artifactId: Optional[str] = None
    artifactName: Optional[str] = None
    serverFqdn: Optional[str] = None
    databaseName: Optional[str] = None
    batchHeaderSchema: Optional[str] = None
    batchHeaderTable: Optional[str] = None
    batchHeaderMapping: Optional[Dict[str, Any]] = None
    bronzeSchema: Optional[str] = None
    bronzeTable: Optional[str] = None
    bronzeMapping: Optional[Dict[str, Any]] = None
    silverSchema: Optional[str] = None
    silverTable: Optional[str] = None
    silverMapping: Optional[Dict[str, Any]] = None

    artifact_type: Optional[str] = None
    artifact_id: Optional[str] = None
    artifact_name: Optional[str] = None
    server_fqdn: Optional[str] = None
    database_name: Optional[str] = None
    batch_header_schema: Optional[str] = None
    batch_header_table: Optional[str] = None
    batch_header_mapping: Optional[Dict[str, Any]] = None
    bronze_schema: Optional[str] = None
    bronze_table: Optional[str] = None
    bronze_mapping: Optional[Dict[str, Any]] = None
    silver_schema: Optional[str] = None
    silver_table: Optional[str] = None
    silver_mapping: Optional[Dict[str, Any]] = None

class AiFixRequest(BaseModel):
    pipelineName: Optional[str] = "Pipeline"
    activityName: Optional[str] = "Activity"
    activityType: Optional[str] = "Execution"
    errorCode: Optional[str] = "N/A"
    errorMessage: str
    failureType: Optional[str] = "UserError"
    target: Optional[str] = ""
    rawError: Optional[Any] = None
    forceRefresh: Optional[bool] = False

@router.get("", response_model=List[Dict[str, Any]])
async def list_workspaces():
    """Returns all Microsoft Fabric workspaces accessible by the Service Principal."""
    workspaces = await fabric_client.get_workspaces()
    return workspaces

@router.get("/{workspace_id}/pipelines", response_model=List[Dict[str, Any]])
async def list_pipelines(workspace_id: str):
    """Returns all Data Pipelines inside the selected workspace."""
    pipelines = await fabric_client.get_pipelines(workspace_id)
    return pipelines

@router.get("/{workspace_id}/parent-pipelines", response_model=List[Dict[str, Any]])
async def list_parent_pipelines(workspace_id: str, force_sync: bool = False):
    """Returns parent (master) pipelines for a workspace with their SLA1/SLA2 config.

    Set `force_sync=true` to poll Fabric first so parent/child roles are resolved.
    """
    parents = await db_service.get_parent_pipelines(workspace_id)
    if not parents or force_sync:
        try:
            fabric_pipes = await fabric_client.get_pipelines(workspace_id)
            if fabric_pipes:
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                await db_service.save_pipelines(workspace_id, fabric_pipes, now_iso)
                try:
                    await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=force_sync)
                except Exception:
                    pass
                parents = await db_service.get_parent_pipelines(workspace_id)
                if not parents:
                    parents = [
                        {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or "Pipeline"}
                        for p in fabric_pipes
                    ]
        except Exception as exc:
            logger.error(f"Error syncing parent pipelines from Fabric: {exc}")

    sla_by_pid = await db_service.get_sla_configs_for_workspace(workspace_id)
    for p in parents:
        cfg = sla_by_pid.get(p["pipelineId"])
        p["sla1Minutes"] = cfg["sla1Minutes"] if cfg else None
        p["sla2Minutes"] = cfg["sla2Minutes"] if cfg else None
    return parents

@router.get("/{workspace_id}/snapshot")
async def get_workspace_snapshot(
    workspace_id: str, 
    force_sync: bool = False,
    date_preset: Optional[str] = "latest",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """
    Returns the real-time hierarchical pipeline and activity runs tree
    for the selected workspace with date-based execution filtering and schedule forecasting.
    """
    preset = (date_preset or "latest").lower().strip()
    if (preset == "latest") and force_sync:
        await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=True)
    
    date_tree = await db_service.get_workspace_tree_by_date(
        workspace_id=workspace_id,
        date_preset=preset,
        start_date=start_date,
        end_date=end_date
    )

    # If preset is latest and no pipelines in SQLite cache, fetch from Fabric synchronously
    if (preset == "latest") and not date_tree.get("pipelines"):
        await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=False)
        date_tree = await db_service.get_workspace_tree_by_date(
            workspace_id=workspace_id,
            date_preset=preset,
            start_date=start_date,
            end_date=end_date
        )

    return date_tree

@router.get("/{workspace_id}/pipelines/{pipeline_id}/history")
async def get_pipeline_history(workspace_id: str, pipeline_id: str):
    """
    Returns complete run history for a specific pipeline with its activity runs
    and execution telemetry from SQLite cache or live Fabric fallback.
    """
    runs = await db_service.get_pipeline_history(workspace_id, pipeline_id)
    if not runs:
        # Fallback: query Fabric directly for instances
        instances = await fabric_client.get_job_instances(workspace_id, pipeline_id)
        return {
            "workspaceId": workspace_id,
            "pipelineId": pipeline_id,
            "runs": instances
        }
    return {
        "workspaceId": workspace_id,
        "pipelineId": pipeline_id,
        "runs": runs
    }

@router.get("/{workspace_id}/pipelines/{pipeline_id}/sla")
async def get_pipeline_sla_config(workspace_id: str, pipeline_id: str):
    """Returns SLA configuration for the specified pipeline."""
    cfg = await db_service.get_sla_config(workspace_id, pipeline_id)
    return cfg

@router.post("/{workspace_id}/pipelines/{pipeline_id}/sla")
async def update_pipeline_sla_config(workspace_id: str, pipeline_id: str, payload: SlaConfigRequest):
    """Updates L1 assignee, L2 assignee, and SLA1/SLA2 target durations for a pipeline."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    sla1 = payload.sla1Minutes if payload.sla1Minutes is not None else payload.slaMinutes
    sla2 = payload.sla2Minutes if payload.sla2Minutes is not None else payload.slaMinutes
    await db_service.save_sla_config(
        workspace_id=workspace_id,
        pipeline_id=pipeline_id,
        l1_email=payload.l1Email.strip(),
        l2_email=payload.l2Email.strip(),
        l1_name=(payload.l1Name or "").strip(),
        l2_name=(payload.l2Name or "").strip(),
        sla_minutes=sla1,
        updated_at=now_iso,
        sla1_minutes=sla1,
        sla2_minutes=sla2
    )

    # Sync assignees into users and roles tables
    try:
        from backend.app.modules.users.service import users_service
        await users_service.ensure_assignment_users(payload.l1Email.strip(), payload.l2Email.strip())
    except Exception as exc:
        logger.warning(f"Could not record user roles for SLA config: {exc}")

    # If the pipeline is currently failed, rearm the SLA incident and dispatch L1 alert
    asyncio.create_task(alert_service.rearm_and_notify_l1(
        workspace_id=workspace_id,
        pipeline_id=pipeline_id,
        l1_email=payload.l1Email.strip(),
        sla_minutes=sla1
    ))

    return {
        "status": "success",
        "pipelineId": pipeline_id,
        "l1Email": payload.l1Email,
        "l1Name": payload.l1Name,
        "l2Email": payload.l2Email,
        "l2Name": payload.l2Name,
        "slaMinutes": sla1,
        "sla1Minutes": sla1,
        "sla2Minutes": sla2
    }

@router.get("/{workspace_id}/pipeline-assignments")
async def get_workspace_pipeline_assignments(workspace_id: str, force_sync: bool = False):
    """Returns all parent pipelines for the workspace along with their per-pipeline L1 and L2 assignees."""
    pipelines = await db_service.get_parent_pipelines(workspace_id)
    if not pipelines or force_sync:
        try:
            fabric_pipes = await fabric_client.get_pipelines(workspace_id)
            if fabric_pipes:
                now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                await db_service.save_pipelines(workspace_id, fabric_pipes, now_iso)
                try:
                    await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=force_sync)
                except Exception:
                    pass
                pipelines = await db_service.get_parent_pipelines(workspace_id)
                if not pipelines:
                    pipelines = [
                        {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or "Pipeline"}
                        for p in fabric_pipes
                    ]
        except Exception as exc:
            logger.error(f"Error syncing pipelines from Fabric for workspace {workspace_id}: {exc}")

    sla_map = await db_service.get_sla_configs_for_workspace(workspace_id)
    
    results = []
    for p in pipelines:
        pid = p["pipelineId"]
        sla_info = sla_map.get(pid, {})
        results.append({
            "pipelineId": pid,
            "pipelineName": p["pipelineName"],
            "workspaceId": workspace_id,
            "l1Email": sla_info.get("l1Email") or "",
            "l1Name": sla_info.get("l1Name") or "",
            "l2Email": sla_info.get("l2Email") or "",
            "l2Name": sla_info.get("l2Name") or "",
            "sla1Minutes": sla_info.get("sla1Minutes", 30),
            "sla2Minutes": sla_info.get("sla2Minutes", 60)
        })
    return results

@router.post("/{workspace_id}/pipelines/{pipeline_id}/test-email")
async def send_test_email(workspace_id: str, pipeline_id: str, payload: TestEmailRequest):
    """Sends a verification test email from uiaptracker@gmail.com."""
    success = await alert_service.send_test_email(
        to_email=payload.email.strip(),
        role=payload.role,
        pipeline_name=payload.pipelineName or "Data Pipeline"
    )
    if success:
        return {"status": "success", "message": f"Test notification sent to {payload.email}"}
    else:
        raise HTTPException(status_code=500, detail="Failed to dispatch test email via SMTP server.")

@router.get("/{workspace_id}/incidents")
async def get_workspace_incidents(workspace_id: str):
    """Returns all active, escalated, and resolved SLA incidents for this workspace."""
    incidents = await db_service.get_active_incidents(workspace_id)
    return {"workspaceId": workspace_id, "incidents": incidents}

@router.post("/{workspace_id}/incidents/{incident_id}/resolve")
async def resolve_incident(workspace_id: str, incident_id: str, payload: IncidentResolveRequest):
    """Marks an active or escalated SLA incident as resolved, stopping the timer."""
    result = await alert_service.resolve_incident(incident_id, resolved_by=payload.resolvedBy or "Operator")
    
    # Broadcast resolution to WebSocket
    await connection_manager.broadcast_to_workspace(workspace_id, {
        "type": "INCIDENT_RESOLVED",
        "workspaceId": workspace_id,
        "incidentId": incident_id,
        "resolvedBy": payload.resolvedBy,
        "resolvedAt": result.get("resolvedAt")
    })
    return {"status": "success", "incident": result}

def _parse_schedules_payload(sched_data: Any) -> List[Dict[str, Any]]:
    if not sched_data:
        return []
    raw_list = []
    if isinstance(sched_data, dict):
        if "value" in sched_data and isinstance(sched_data["value"], list):
            raw_list = sched_data["value"]
        elif "schedules" in sched_data and isinstance(sched_data["schedules"], list):
            raw_list = sched_data["schedules"]
        elif "configuration" in sched_data or "enabled" in sched_data:
            raw_list = [sched_data]
    elif isinstance(sched_data, list):
        raw_list = sched_data

    all_scheds = []
    for item in raw_list:
        if isinstance(item, dict):
            cfg = item.get("configuration") or {}
            all_scheds.append({
                "id": item.get("id") or "",
                "enabled": bool(item.get("enabled", True)),
                "scheduleType": cfg.get("type") or item.get("scheduleType") or item.get("type") or "Custom",
                "timeZone": cfg.get("localTimeZoneId") or item.get("timeZone") or "UTC",
                "nextRunTime": cfg.get("nextRunTime") or item.get("nextRunTime") or cfg.get("startDateTime"),
                "times": cfg.get("times", []) or item.get("times", []),
                "days": cfg.get("days", []) or item.get("days", []),
                "startDate": cfg.get("startDateTime") or item.get("startDate"),
                "endDate": cfg.get("endDateTime") or item.get("endDate"),
                "rawConfiguration": cfg or item
            })
    return all_scheds

@router.get("/{workspace_id}/pipelines/{pipeline_id}/schedule")
async def get_pipeline_schedule(workspace_id: str, pipeline_id: str):
    """Returns all schedule configurations for a single pipeline."""
    # 1. Fetch fresh live schedules from Microsoft Fabric REST API
    sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pipeline_id)
    all_schedules = _parse_schedules_payload(sched_data)

    # 2. Fallback to cached DB if Fabric returned nothing or had an error
    if not all_schedules:
        cached = await db_service.get_schedule_for_pipeline(workspace_id, pipeline_id)
        if cached:
            cached_raw = cached.get("rawConfiguration") or {}
            all_schedules = _parse_schedules_payload(cached_raw)
            if not all_schedules and cached.get("enabled"):
                all_schedules = [{
                    "id": "cached_sched",
                    "enabled": cached.get("enabled", False),
                    "scheduleType": cached.get("scheduleType", "Manual / None"),
                    "timeZone": cached.get("timeZone", "UTC"),
                    "nextRunTime": cached.get("nextRunTime"),
                    "times": [],
                    "days": [],
                    "rawConfiguration": cached_raw
                }]

    active_schedules = [s for s in all_schedules if s.get("enabled")]
    primary = active_schedules[0] if active_schedules else (all_schedules[0] if all_schedules else None)

    return {
        "pipelineId": pipeline_id,
        "enabled": bool(active_schedules),
        "totalSchedules": len(all_schedules),
        "scheduleType": primary.get("scheduleType") if primary else "Manual / None",
        "nextRunTime": primary.get("nextRunTime") if primary else None,
        "timeZone": primary.get("timeZone") if primary else "UTC",
        "schedules": all_schedules,
        "rawConfiguration": sched_data
    }

@router.get("/{workspace_id}/schedules", response_model=List[PipelineSchedule])
async def get_workspace_schedules(workspace_id: str):
    """
    Returns upcoming schedules and next execution times for pipelines in the workspace.
    Fast read from SQLite with fallback.
    """
    cached = await db_service.get_pipeline_schedules(workspace_id)
    if cached:
        return [PipelineSchedule(**c) for c in cached]

    # Otherwise fetch from Fabric
    pipelines = await fabric_client.get_pipelines(workspace_id)
    schedules: List[PipelineSchedule] = []

    for p in pipelines:
        pid = p.get("id")
        p_name = p.get("displayName")
        sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pid)
        all_s = _parse_schedules_payload(sched_data)
        active = [s for s in all_s if s.get("enabled")]
        primary = active[0] if active else (all_s[0] if all_s else None)

        if primary:
            schedules.append(PipelineSchedule(
                pipelineId=pid,
                pipelineName=p_name,
                enabled=bool(active),
                scheduleType=primary.get("scheduleType", "Custom"),
                nextRunTime=primary.get("nextRunTime"),
                timeZone=primary.get("timeZone", "UTC"),
                schedules=all_s,
                rawConfiguration={"schedules": all_s, "raw": sched_data}
            ))
        else:
            schedules.append(PipelineSchedule(
                pipelineId=pid,
                pipelineName=p_name,
                enabled=False,
                scheduleType="Manual / None",
                nextRunTime=None,
                timeZone=None,
                schedules=[],
                rawConfiguration=sched_data
            ))

    # Persist in DB
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db_service.save_schedules(workspace_id, [s.model_dump() for s in schedules], now_iso)
    return schedules

@router.get("/{workspace_id}/data-artifacts")
async def get_workspace_data_artifacts(workspace_id: str):
    """
    Returns all Warehouses and Lakehouses inside the selected workspace
    along with their SQL endpoint connection strings.
    """
    artifacts = await table_log_service.get_data_artifacts(workspace_id)
    return {"workspaceId": workspace_id, "artifacts": artifacts}

@router.post("/{workspace_id}/sql-metadata/tables")
async def get_sql_tables(workspace_id: str, payload: SqlTablesRequest):
    """
    Dynamically connects to the selected Warehouse or Lakehouse SQL endpoint
    and lists all user schemas and tables.
    """
    server = (payload.serverFqdn or payload.server_fqdn or "").strip()
    db = (payload.databaseName or payload.database_name or "").strip()
    if not server or not db:
        return {"tables": []}
    try:
        tables = await table_log_service.get_schemas_and_tables(server, db)
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query tables from SQL Endpoint: {e}")

@router.post("/{workspace_id}/sql-metadata/columns")
async def get_sql_columns(workspace_id: str, payload: SqlColumnsRequest):
    """
    Dynamically fetches all columns and data types for the selected schema and table.
    """
    server = (payload.serverFqdn or payload.server_fqdn or "").strip()
    db = (payload.databaseName or payload.database_name or "").strip()
    schema = (payload.schemaName or payload.schema_name or "").strip()
    table = (payload.tableName or payload.table_name or "").strip()
    if not server or not db or not schema or not table:
        return {"columns": []}
    try:
        columns = await table_log_service.get_table_columns(server, db, schema, table)
        return {"columns": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query columns for {schema}.{table}: {e}")

@router.get("/{workspace_id}/table-log-mapping")
async def get_table_log_mapping(workspace_id: str):
    """
    Fetches the configured table log and column mapping for the workspace.
    """
    mapping = await db_service.get_table_log_mapping(workspace_id)
    return {"workspaceId": workspace_id, "mapping": mapping}

@router.post("/{workspace_id}/table-log-mapping")
async def save_table_log_mapping(workspace_id: str, payload: SaveTableLogMappingRequest):
    """
    Persists the warehouse/lakehouse and column mapping in the SQLite database.
    """
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
        updated_at=now_iso
    )
    return {"status": "success", "workspaceId": workspace_id, "updatedAt": now_iso}

@router.delete("/{workspace_id}/table-log-mapping")
async def delete_table_log_mapping(workspace_id: str):
    """
    Resets/deletes the table log and column mapping for the workspace.
    """
    await db_service.delete_table_log_mapping(workspace_id)
    return {"status": "success", "message": "Mapping cleared successfully."}

@router.get("/{workspace_id}/table-logs")
async def get_table_logs(
    workspace_id: str,
    pipeline_run_id: Optional[str] = None,
    batch_id: Optional[str] = None
):
    """
    Queries table-level logs for the specified pipeline run ID or batch ID.
    Computes top KPIs (without alerts), Bronze/Silver layer overviews, and table details.
    """
    try:
        data = await table_log_service.query_table_logs(
            workspace_id=workspace_id,
            pipeline_run_id=pipeline_run_id,
            batch_id=batch_id
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query table logs: {e}")

@router.post("/{workspace_id}/diagnostics/ai-fix")
async def diagnose_pipeline_error(
    workspace_id: str,
    payload: AiFixRequest
):
    """
    Analyzes a failed pipeline or activity using Google Gemini 3.6 Flash.
    Returns plain-English RCA, likely causes, step-by-step fix checklist,
    copyable SQL/code, and prevention tips. Caches results in SQLite.
    """
    from backend.app.services.ai_diagnostic_service import ai_diagnostic_service
    res = await ai_diagnostic_service.diagnose_failure(
        pipeline_name=payload.pipelineName or "Pipeline",
        activity_name=payload.activityName or "Activity",
        activity_type=payload.activityType or "Execution",
        error_code=payload.errorCode or "N/A",
        error_message=payload.errorMessage,
        failure_type=payload.failureType or "UserError",
        target=payload.target or "",
        raw_error=payload.rawError,
        force_refresh=payload.forceRefresh or False
    )
    return res


