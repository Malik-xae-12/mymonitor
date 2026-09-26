"""Workspace repository — lightweight pass-through.

The workspaces table and workspace_assignments table have been removed.
  - Workspace listing is a live Fabric API call (fabric_client.get_workspaces).
  - L1/L2 assignments are now stored per-pipeline in the sla_configs table.

This module is kept for backward compatibility with imports but delegates
all RBAC scoping to the SLA repository.
"""

from typing import Any, Dict, List

from app.modules.sla.repository import sla_repository


class WorkspaceRepository:
    """Thin wrapper that delegates RBAC scoping to sla_repository."""

    async def get_assigned_workspace_ids_for_user(self, email: str) -> List[str]:
        """Returns distinct workspace IDs where the user is assigned as L1 or L2 in sla_configs."""
        return await sla_repository.get_assigned_workspace_ids_for_user(email)

    async def get_assigned_pipeline_ids_for_user(self, email: str) -> List[str]:
        """Returns distinct pipeline IDs where the user is assigned as L1 or L2 in sla_configs."""
        return await sla_repository.get_assigned_pipeline_ids_for_user(email)

    async def get_configs_for_user(self, email: str) -> List[Dict[str, Any]]:
        """Returns SLA configs where the user is L1 or L2 assignee."""
        return await sla_repository.get_configs_for_user(email)

    async def get_sla_configs_for_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Returns SLA configs keyed by pipeline_id for a workspace."""
        return await sla_repository.get_sla_configs_for_workspace(workspace_id)


workspace_repository = WorkspaceRepository()
