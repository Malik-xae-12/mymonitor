from typing import Optional
from fastapi import APIRouter, HTTPException
from app.modules.sla.schema import IncidentResolveRequest, SlaConfigPayload, TestEmailRequest
from app.modules.sla.service import sla_service

router = APIRouter(prefix="/api/workspaces", tags=["sla"])


@router.get("/{workspace_id}/pipelines/{pipeline_id}/sla")
async def get_pipeline_sla_config(workspace_id: str, pipeline_id: str):
    """Retrieve configured SLA warning and breach thresholds."""
    cfg = await sla_service.get_sla_config(workspace_id, pipeline_id)
    return cfg or {}


@router.post("/{workspace_id}/pipelines/{pipeline_id}/sla")
async def save_pipeline_sla_config(workspace_id: str, pipeline_id: str, payload: SlaConfigPayload):
    """Save or update SLA 1 & SLA 2 configuration for a pipeline."""
    assigned_by = (payload.assignedBy or "").strip()
    return await sla_service.save_sla_config(workspace_id, pipeline_id, payload, assigned_by=assigned_by)


@router.post("/{workspace_id}/pipelines/{pipeline_id}/test-email")
async def send_test_email(workspace_id: str, pipeline_id: str, payload: TestEmailRequest):
    """Sends a verification test email from operations alert system."""
    success = await sla_service.send_test_email(payload)
    if success:
        return {"status": "success", "message": f"Test notification sent to {payload.email}"}
    raise HTTPException(status_code=500, detail="Failed to dispatch test email via SMTP server.")


@router.get("/{workspace_id}/incidents")
async def get_workspace_incidents(workspace_id: str):
    """Returns all active, escalated, and resolved SLA incidents for this workspace."""
    incidents = await sla_service.get_workspace_incidents(workspace_id)
    return {"workspaceId": workspace_id, "incidents": incidents}


@router.post("/{workspace_id}/incidents/{incident_id}/resolve")
async def resolve_workspace_incident(
    workspace_id: str,
    incident_id: str,
    payload: IncidentResolveRequest,
):
    """Marks an active or escalated SLA incident as resolved and broadcasts to workspace."""
    result = await sla_service.resolve_incident(
        incident_id=incident_id,
        resolved_by=payload.resolvedBy or "Operator",
        workspace_id=workspace_id,
    )
    return {"status": "success", "incident": result}


@router.get("/incidents")
async def get_all_active_incidents():
    """Get all active SLA warning & escalated failure incidents across all workspaces."""
    return await sla_service.get_all_incidents()


@router.post("/incidents/{incident_id}/resolve")
async def resolve_global_incident(
    incident_id: str,
    payload: Optional[IncidentResolveRequest] = None,
):
    """Acknowledge and mark an SLA failure incident as resolved."""
    resolved_by = payload.resolvedBy if payload else "Operator"
    result = await sla_service.resolve_incident(incident_id=incident_id, resolved_by=resolved_by)
    return {"status": "success", "incident": result}
