import logging
from typing import Any, Dict, List
from app.services.db_service import db_service
from app.services.fabric_client import fabric_client

logger = logging.getLogger("fabric_monitor.workspaces")


class WorkspaceService:
    async def list_workspaces(self) -> List[Dict[str, Any]]:
        workspaces = await fabric_client.get_workspaces()
        try:
            assignments = await db_service.get_all_assignments()
            assign_map = {a["workspace_id"]: a for a in assignments if "workspace_id" in a}
        except Exception:
            assign_map = {}

        merged = []
        for ws in workspaces:
            wid = ws.get("id")
            asg = assign_map.get(wid, {})
            merged.append({
                "id": wid,
                "displayName": ws.get("displayName") or ws.get("name", "Unnamed"),
                "name": ws.get("displayName") or ws.get("name", "Unnamed"),
                "description": ws.get("description", ""),
                "type": ws.get("type", "Workspace"),
                "l1_email": asg.get("l1_email"),
                "l2_email": asg.get("l2_email"),
                "sla1_minutes": asg.get("sla1_minutes", 30),
                "sla2_minutes": asg.get("sla2_minutes", 60),
                "is_active": ws.get("is_active", True),
            })
        return merged


workspace_service = WorkspaceService()
