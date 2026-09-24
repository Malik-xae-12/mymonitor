"""Auth / RBAC API endpoints.

Public to any authenticated user:
  - GET  /api/auth/me                      -> profile + role + scoped workspaces
  - GET  /api/auth/my-assignments          -> assignments the caller is L1/L2 for

Admin only:
  - GET    /api/admin/assignments          -> all workspace assignments
  - POST   /api/admin/assignments          -> create/update an assignment
  - DELETE /api/admin/assignments/{id}     -> remove an assignment
"""
from typing import List

from fastapi import APIRouter, Depends

from backend.app.modules.auth.dependency import get_current_user, require_admin
from backend.app.modules.auth.schema import (
    AssignmentUpsertRequest,
    UserProfile,
    WorkspaceAssignment,
)
from backend.app.modules.auth.service import auth_service

router = APIRouter(tags=["auth"])


@router.get("/api/auth/me", response_model=UserProfile)
async def me(user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Returns the signed-in user's profile, resolved role, and scoped workspaces.

    Identity persistence + role resolution happen inside ``get_current_user`` against
    the ``users`` / ``roles`` tables.
    """
    return user


@router.get("/api/auth/my-assignments", response_model=List[WorkspaceAssignment])
async def my_assignments(
    user: UserProfile = Depends(get_current_user),
) -> List[WorkspaceAssignment]:
    """Assignments where the caller is the L1 or L2 responsible user."""
    if user.is_admin:
        return await auth_service.list_all_assignments()
    return await auth_service.list_assignments_for_user(user.email)


@router.get("/api/admin/assignments", response_model=List[WorkspaceAssignment])
async def list_assignments(
    _: UserProfile = Depends(require_admin),
) -> List[WorkspaceAssignment]:
    return await auth_service.list_all_assignments()


@router.post("/api/admin/assignments", response_model=WorkspaceAssignment)
async def upsert_assignment(
    payload: AssignmentUpsertRequest,
    admin: UserProfile = Depends(require_admin),
) -> WorkspaceAssignment:
    return await auth_service.upsert_assignment(payload, assigned_by=admin.email)


@router.delete("/api/admin/assignments/{workspace_id}")
async def delete_assignment(
    workspace_id: str,
    _: UserProfile = Depends(require_admin),
) -> dict:
    await auth_service.delete_assignment(workspace_id)
    return {"success": True, "workspace_id": workspace_id}
