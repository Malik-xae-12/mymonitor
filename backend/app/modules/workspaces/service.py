import logging
from typing import Any, Dict, List
from app.modules.workspaces.repository import workspace_repository
from app.shared.clients.fabric_client import fabric_client
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES, DEFAULT_WORKSPACE_NAME

logger = logging.getLogger("fabric_monitor.workspaces")


class WorkspaceService:
    async def list_workspaces(self) -> List[Dict[str, Any]]:
        workspaces = await fabric_client.get_workspaces()
        try:
            assignments = await workspace_repository.get_all_assignments()
            assign_map = {a["workspace_id"]: a for a in assignments if "workspace_id" in a}
        except Exception:
            assign_map = {}

        merged = []
        for ws in workspaces:
            wid = ws.get("id")
            asg = assign_map.get(wid, {})
            name = ws.get("displayName") or ws.get("name") or DEFAULT_WORKSPACE_NAME
            merged.append({
                "id": wid,
                "displayName": name,
                "name": name,
                "description": ws.get("description", ""),
                "type": ws.get("type", "Workspace"),
                "l1_email": asg.get("l1_email"),
                "l2_email": asg.get("l2_email"),
                "sla1_minutes": asg.get("sla1_minutes", DEFAULT_SLA1_MINUTES),
                "sla2_minutes": asg.get("sla2_minutes", DEFAULT_SLA2_MINUTES),
                "is_active": ws.get("is_active", True),
            })
        return merged


workspace_service = WorkspaceService()
