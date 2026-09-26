from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from app.modules.auth.dependency import get_current_user, require_admin
from app.modules.auth.service import fastapi_users
from app.modules.users.schema import (
    AddUserRequest,
    RoleResponse,
    SetRoleRequest,
    SlaAssignment,
    UserProfile,
    UserRead,
    UserUpdate,
    UsersListResponse,
)
from app.modules.users.service import users_service

router = APIRouter(tags=["users"])

_SUPPORT_ROLES = {"l1", "l2"}

# Mount FastAPI-Users self-service / profile management routes under /api/users
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/api/users",
    tags=["users-profile"],
)


# ---- Pipeline-level SLA Assignments (read-only from users module) ----
@router.get("/api/admin/assignments", response_model=List[SlaAssignment])
async def list_assignments(
    _: UserProfile = Depends(require_admin),
) -> List[SlaAssignment]:
    """Retrieve all pipeline-level SLA assignments across all workspaces."""
    return await users_service.list_all_assignments()


# ---- Users & Roles Management -----------------------------------
@router.get("/api/admin/users", response_model=UsersListResponse)
async def list_users(_: UserProfile = Depends(require_admin)) -> UsersListResponse:
    """List all registered users and available support roles."""
    users = await users_service.list_users()
    roles = await users_service.list_roles()
    return UsersListResponse(users=users, roles=roles)


@router.post("/api/admin/users", response_model=UsersListResponse)
async def add_user(
    payload: AddUserRequest,
    _: UserProfile = Depends(require_admin),
) -> UsersListResponse:
    """Add or update an Entra ID directory user with role L1 or L2."""
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
    """Assign or modify an existing user's support role."""
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
    """Delete a support person from the team roster."""
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
    """Retrieve all configurable support roles."""
    return await users_service.list_roles()
