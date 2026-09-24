from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.auth.auth_assignments_service import auth_assignments_service
from app.modules.auth.dependency import get_current_user, require_admin
from app.modules.auth.schema import (
    AssignmentUpsertRequest,
    UserProfile,
    WorkspaceAssignment,
)
from app.modules.users.schema import (
    AddUserRequest,
    RoleResponse,
    SetRoleRequest,
    UsersListResponse,
)
from app.modules.users.service import users_service

router = APIRouter(tags=["fabric-admin"])

_SUPPORT_ROLES = {"l1", "l2"}


# ---- Workspace Assignments ---------------------------------------
@router.get("/api/admin/assignments", response_model=List[WorkspaceAssignment])
async def list_assignments(
    _: UserProfile = Depends(require_admin),
) -> List[WorkspaceAssignment]:
    return await auth_assignments_service.list_all_assignments()


@router.post("/api/admin/assignments", response_model=WorkspaceAssignment)
async def upsert_assignment(
    payload: AssignmentUpsertRequest,
    admin: UserProfile = Depends(require_admin),
) -> WorkspaceAssignment:
    return await auth_assignments_service.upsert_assignment(payload, assigned_by=admin.email)


@router.delete("/api/admin/assignments/{workspace_id}")
async def delete_assignment(
    workspace_id: str,
    _: UserProfile = Depends(require_admin),
) -> dict:
    await auth_assignments_service.delete_assignment(workspace_id)
    return {"success": True, "workspace_id": workspace_id}


# ---- Users & Roles Management -----------------------------------
@router.get("/api/admin/users", response_model=UsersListResponse)
async def list_users(_: UserProfile = Depends(require_admin)) -> UsersListResponse:
    users = await users_service.list_users()
    roles = await users_service.list_roles()
    return UsersListResponse(users=users, roles=roles)


@router.post("/api/admin/users", response_model=UsersListResponse)
async def add_user(
    payload: AddUserRequest,
    _: UserProfile = Depends(require_admin),
) -> UsersListResponse:
    """Adds or updates a directory user with role L1 or L2."""
    if payload.role_id not in _SUPPORT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Support role must be 'l1' or 'l2'",
        )
    target = await users_service.resolve_access(payload.email)
    if target[1]:  # is_admin
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{payload.email} is an Administrator and cannot be demoted to support staff.",
        )
    await users_service.add_or_update_user(
        email=payload.email,
        display_name=payload.display_name or "",
        oid=payload.oid or "",
        role_id=payload.role_id,
    )
    users = await users_service.list_users()
    roles = await users_service.list_roles()
    return UsersListResponse(users=users, roles=roles)


@router.post("/api/admin/users/role", response_model=UsersListResponse)
async def set_user_role(
    payload: SetRoleRequest,
    _: UserProfile = Depends(require_admin),
) -> UsersListResponse:
    if payload.role_id not in _SUPPORT_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'l1' or 'l2' (Administrator role is managed in database)",
        )
    target = await users_service.resolve_access(payload.email)
    if target[1]:  # is_admin
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator role cannot be altered via UI (managed in database)",
        )
    await users_service.set_role(payload.email, payload.role_id)
    users = await users_service.list_users()
    roles = await users_service.list_roles()
    return UsersListResponse(users=users, roles=roles)


@router.delete("/api/admin/users/{email}", response_model=UsersListResponse)
async def delete_user(
    email: str,
    _: UserProfile = Depends(require_admin),
) -> UsersListResponse:
    target = await users_service.resolve_access(email)
    if target[1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator account cannot be deleted via UI",
        )
    await users_service.delete_user(email)
    users = await users_service.list_users()
    roles = await users_service.list_roles()
    return UsersListResponse(users=users, roles=roles)


@router.get("/api/roles", response_model=List[RoleResponse])
async def list_roles(_: UserProfile = Depends(get_current_user)) -> List[RoleResponse]:
    return await users_service.list_roles()
