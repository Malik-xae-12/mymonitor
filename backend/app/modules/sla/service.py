import asyncio
import datetime
import logging
from typing import Any, Dict, List, Optional

from app.modules.sla.schema import IncidentResolveRequest, SlaConfigPayload, TestEmailRequest
from app.services.alert_service import alert_service
from app.services.connection_manager import connection_manager
from app.services.db_service import db_service

logger = logging.getLogger("fabric_monitor.sla")


class SlaService:
    async def get_sla_config(self, workspace_id: str, pipeline_id: str) -> Optional[Dict[str, Any]]:
        return await db_service.get_sla_config(workspace_id, pipeline_id)

    async def save_sla_config(self, workspace_id: str, pipeline_id: str, payload: SlaConfigPayload) -> Dict[str, Any]:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sla1 = payload.sla1Minutes if payload.sla1Minutes is not None else (payload.slaMinutes or 30)
        sla2 = payload.sla2Minutes if payload.sla2Minutes is not None else (payload.slaMinutes or 60)
        l1_email = (payload.l1Email or "").strip()
        l2_email = (payload.l2Email or "").strip()
        l1_name = (payload.l1Name or "").strip()
        l2_name = (payload.l2Name or "").strip()

        await db_service.save_sla_config(
            workspace_id=workspace_id,
            pipeline_id=pipeline_id,
            l1_email=l1_email,
            l2_email=l2_email,
            l1_name=l1_name,
            l2_name=l2_name,
            sla_minutes=sla1,
            updated_at=now_iso,
            sla1_minutes=sla1,
            sla2_minutes=sla2,
        )

        try:
            from app.modules.users.service import users_service
            await users_service.ensure_assignment_users(l1_email, l2_email)
        except Exception as exc:
            logger.warning(f"Could not record user roles for SLA config: {exc}")

        # If pipeline is currently failed, rearm SLA incident and alert L1
        asyncio.create_task(alert_service.rearm_and_notify_l1(
            workspace_id=workspace_id,
            pipeline_id=pipeline_id,
            l1_email=l1_email,
            sla_minutes=sla1,
        ))

        return {
            "status": "success",
            "pipelineId": pipeline_id,
            "l1Email": l1_email,
            "l1Name": l1_name,
            "l2Email": l2_email,
            "l2Name": l2_name,
            "slaMinutes": sla1,
            "sla1Minutes": sla1,
            "sla2Minutes": sla2,
        }

    async def get_workspace_incidents(self, workspace_id: str) -> List[Dict[str, Any]]:
        return await db_service.get_active_incidents(workspace_id)

    async def get_all_incidents(self) -> List[Dict[str, Any]]:
        return await db_service.get_active_incidents()

    async def resolve_incident(self, incident_id: str, resolved_by: str = "Operator", workspace_id: Optional[str] = None) -> Dict[str, Any]:
        result = await alert_service.resolve_incident(incident_id, resolved_by=resolved_by)
        if workspace_id:
            await connection_manager.broadcast_to_workspace(workspace_id, {
                "type": "INCIDENT_RESOLVED",
                "workspaceId": workspace_id,
                "incidentId": incident_id,
                "resolvedBy": resolved_by,
                "resolvedAt": result.get("resolvedAt") if isinstance(result, dict) else None,
            })
        return result

    async def send_test_email(self, payload: TestEmailRequest) -> bool:
        return await alert_service.send_test_email(
            to_email=payload.email.strip(),
            role=payload.role,
            pipeline_name=payload.pipelineName or "Data Pipeline",
        )


sla_service = SlaService()
