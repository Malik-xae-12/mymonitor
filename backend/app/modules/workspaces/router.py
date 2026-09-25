from fastapi import APIRouter
from app.modules.workspaces.service import workspace_service

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("")
@router.get("/", include_in_schema=False)
async def get_workspaces():
    """List all accessible Fabric workspaces."""
    return await workspace_service.list_workspaces()
