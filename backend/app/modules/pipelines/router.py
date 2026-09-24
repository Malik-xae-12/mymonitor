from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from app.modules.pipelines.schema import PipelineSchedule
from app.modules.pipelines.service import pipeline_service

router = APIRouter(prefix="/api/workspaces/{workspace_id}", tags=["pipelines"])


@router.get("/pipelines", response_model=List[Dict[str, Any]])
async def list_pipelines(workspace_id: str):
    """Returns all Data Pipelines inside the selected workspace."""
    return await pipeline_service.list_pipelines(workspace_id)


@router.get("/parent-pipelines", response_model=List[Dict[str, Any]])
async def list_parent_pipelines(workspace_id: str, force_sync: bool = False):
    """Returns parent (master) pipelines for a workspace with their SLA1/SLA2 config."""
    return await pipeline_service.list_parent_pipelines(workspace_id, force_sync=force_sync)


@router.get("/snapshot")
async def get_workspace_snapshot(
    workspace_id: str,
    force_sync: bool = False,
    date_preset: Optional[str] = "latest",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """Returns the real-time hierarchical pipeline and activity runs tree with date filtering."""
    return await pipeline_service.get_workspace_snapshot(
        workspace_id=workspace_id,
        force_sync=force_sync,
        date_preset=date_preset,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/tree")
async def get_workspace_tree(workspace_id: str):
    """Retrieve the latest parent-child pipeline tree for the workspace."""
    return await pipeline_service.get_workspace_tree(workspace_id)


@router.get("/pipelines/{pipeline_id}/history")
async def get_pipeline_history(workspace_id: str, pipeline_id: str):
    """Get the full chronological run history for a pipeline."""
    return await pipeline_service.get_pipeline_history(workspace_id, pipeline_id)


@router.get("/pipelines/{pipeline_id}/schedule")
async def get_pipeline_schedule(workspace_id: str, pipeline_id: str):
    """Get schedule configurations for a specific pipeline."""
    return await pipeline_service.get_pipeline_schedule(workspace_id, pipeline_id)


@router.get("/pipelines/{pipeline_id}/schedules")
async def get_pipeline_schedules(workspace_id: str, pipeline_id: str):
    """Alias for schedules configured for a specific pipeline."""
    return await pipeline_service.get_pipeline_schedule(workspace_id, pipeline_id)


@router.get("/schedules", response_model=List[PipelineSchedule])
async def get_workspace_schedules(workspace_id: str):
    """Get all configured pipeline schedules across a workspace."""
    return await pipeline_service.get_workspace_schedules(workspace_id)


@router.get("/pipeline-assignments")
async def get_workspace_pipeline_assignments(workspace_id: str, force_sync: bool = False):
    """Returns all parent pipelines with their per-pipeline L1 and L2 assignees."""
    return await pipeline_service.get_workspace_pipeline_assignments(workspace_id, force_sync=force_sync)
