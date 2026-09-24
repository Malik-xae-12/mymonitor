from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query
from app.modules.directory.service import directory_domain_service

router = APIRouter(prefix="/api/directory", tags=["directory"])


@router.get("/users", response_model=List[Dict[str, Any]])
async def get_directory_users(
    query: Optional[str] = Query(default="", description="Search by name, email, or upn"),
    q: Optional[str] = Query(default=None, description="Alternative parameter for search query"),
    top: int = Query(default=15, ge=1, le=50),
    limit: Optional[int] = Query(default=None, ge=1, le=50),
):
    """Searches Microsoft Entra ID (Azure AD) directory for users."""
    search_term = q if q is not None else (query or "")
    top_limit = limit if limit is not None else top
    return await directory_domain_service.search_users(query=search_term, limit=top_limit)


@router.get("/users/search", response_model=List[Dict[str, Any]])
async def search_directory_users(
    q: Optional[str] = Query(default="", description="Prefix search by display name or email"),
    query: Optional[str] = Query(default=None, description="Search by name, email, or upn"),
    limit: int = Query(15, ge=1, le=50),
    top: Optional[int] = Query(default=None, ge=1, le=50),
):
    """Search Entra ID users via Microsoft Graph API."""
    search_term = query if query is not None else (q or "")
    top_limit = top if top is not None else limit
    return await directory_domain_service.search_users(query=search_term, limit=top_limit)
