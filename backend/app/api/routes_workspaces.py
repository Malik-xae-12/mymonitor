from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import datetime
import asyncio
from backend.app.services.fabric_client import fabric_client
from backend.app.services.leased_poller import leased_poller
from backend.app.services.db_service import db_service
from backend.app.services.alert_service import alert_service
from backend.app.services.connection_manager import connection_manager
from backend.app.models.monitoring import PipelineSchedule

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

class SlaConfigRequest(BaseModel):
    l1Email: str
    l2Email: str
    slaMinutes: int = 30

class IncidentResolveRequest(BaseModel):
    resolvedBy: Optional[str] = "Operator"

class TestEmailRequest(BaseModel):
    email: str
    role: str = "L1 Support"
    pipelineName: Optional[str] = "Pipeline"

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

@router.get("/{workspace_id}/snapshot")
async def get_workspace_snapshot(workspace_id: str, force_sync: bool = False):
    """
    Returns the real-time hierarchical pipeline and activity runs tree
    for the selected workspace. Served from SQLite (<15ms) on subsequent loads.
    """
    snapshot = await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=force_sync)
    return {
        "workspaceId": workspace_id,
        "pipelines": snapshot
    }

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
    """Updates L1 email, L2 email, and SLA target duration for a pipeline."""
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db_service.save_sla_config(
        workspace_id=workspace_id,
        pipeline_id=pipeline_id,
        l1_email=payload.l1Email.strip(),
        l2_email=payload.l2Email.strip(),
        sla_minutes=payload.slaMinutes,
        updated_at=now_iso
    )

    # If the pipeline is currently failed, rearm the SLA incident and dispatch L1 alert
    asyncio.create_task(alert_service.rearm_and_notify_l1(
        workspace_id=workspace_id,
        pipeline_id=pipeline_id,
        l1_email=payload.l1Email.strip(),
        sla_minutes=payload.slaMinutes
    ))

    return {
        "status": "success",
        "pipelineId": pipeline_id,
        "l1Email": payload.l1Email,
        "l2Email": payload.l2Email,
        "slaMinutes": payload.slaMinutes
    }

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

@router.get("/{workspace_id}/pipelines/{pipeline_id}/schedule")
async def get_pipeline_schedule(workspace_id: str, pipeline_id: str):
    """Returns schedule configuration for a single pipeline."""
    sched = await db_service.get_schedule_for_pipeline(workspace_id, pipeline_id)
    if not sched:
        # Fallback to Fabric
        sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pipeline_id)
        if sched_data and sched_data.get("enabled", False):
            cfg = sched_data.get("configuration", {})
            return {
                "pipelineId": pipeline_id,
                "enabled": True,
                "scheduleType": cfg.get("type", "Custom"),
                "nextRunTime": cfg.get("nextRunTime") or cfg.get("startDateTime"),
                "timeZone": cfg.get("localTimeZoneId", "UTC"),
                "rawConfiguration": cfg
            }
        return {
            "pipelineId": pipeline_id,
            "enabled": False,
            "scheduleType": "Manual / None",
            "nextRunTime": None,
            "timeZone": None,
            "rawConfiguration": sched_data
        }
    return sched

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
        if sched_data and sched_data.get("enabled", False):
            config = sched_data.get("configuration", {})
            schedules.append(PipelineSchedule(
                pipelineId=pid,
                pipelineName=p_name,
                enabled=sched_data.get("enabled", True),
                scheduleType=config.get("type", "Custom"),
                nextRunTime=config.get("nextRunTime") or config.get("startDateTime"),
                timeZone=config.get("localTimeZoneId", "UTC"),
                rawConfiguration=config
            ))
        else:
            schedules.append(PipelineSchedule(
                pipelineId=pid,
                pipelineName=p_name,
                enabled=False,
                scheduleType="Manual / None",
                nextRunTime=None,
                timeZone=None,
                rawConfiguration=sched_data
            ))

    # Persist in DB
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    await db_service.save_schedules(workspace_id, [s.model_dump() for s in schedules], now_iso)
    return schedules
