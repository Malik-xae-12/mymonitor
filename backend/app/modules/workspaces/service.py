import logging
from typing import Any, Dict, List
from app.modules.sla.repository import sla_repository
from app.shared.clients.fabric_client import fabric_client
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES, DEFAULT_WORKSPACE_NAME

logger = logging.getLogger("fabric_monitor.workspaces")


class WorkspaceService:
    async def list_workspaces(self) -> List[Dict[str, Any]]:
        """Lists workspaces from Fabric enriched with per-pipeline SLA assignment summaries."""
        workspaces = await fabric_client.get_workspaces()

        # Build a summary of L1/L2 assignments per workspace from sla_configs
        try:
            all_configs = await sla_repository.get_all_sla_configs()
            # Group by workspace: pick first L1/L2 found as representative
            ws_summary: Dict[str, Dict[str, Any]] = {}
            for cfg in all_configs:
                wid = cfg.get("workspace_id")
                if wid and wid not in ws_summary:
                    ws_summary[wid] = {
                        "l1_email": cfg.get("l1_email"),
                        "l2_email": cfg.get("l2_email"),
                        "sla1_minutes": cfg.get("sla1_minutes", DEFAULT_SLA1_MINUTES),
                        "sla2_minutes": cfg.get("sla2_minutes", DEFAULT_SLA2_MINUTES),
                    }
        except Exception:
            ws_summary = {}

        merged = []
        for ws in workspaces:
            wid = ws.get("id")
            summary = ws_summary.get(wid, {})
            name = ws.get("displayName") or ws.get("name") or DEFAULT_WORKSPACE_NAME
            merged.append({
                "id": wid,
                "displayName": name,
                "name": name,
                "description": ws.get("description", ""),
                "type": ws.get("type", "Workspace"),
                "l1_email": summary.get("l1_email"),
                "l2_email": summary.get("l2_email"),
                "sla1_minutes": summary.get("sla1_minutes", DEFAULT_SLA1_MINUTES),
                "sla2_minutes": summary.get("sla2_minutes", DEFAULT_SLA2_MINUTES),
                "is_active": ws.get("is_active", True),
            })
        return merged


workspace_service = WorkspaceService()
