"""Directory and people search API routes."""
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query

from backend.app.services.directory_service import directory_service

router = APIRouter(prefix="/api/directory", tags=["directory"])


@router.get("/users", response_model=List[Dict[str, Any]])
async def search_directory_users(
    query: Optional[str] = Query(default="", description="Search by name, email, or upn"),
    top: int = Query(default=15, ge=1, le=50)
) -> List[Dict[str, Any]]:
    """Searches Microsoft Entra ID (Azure AD) directory for users.

    Used by the Microsoft Fabric People Picker to assign L1 and L2 support personnel
    to specific pipelines.
    """
    return await directory_service.search_users(query=query or "", top=top)

