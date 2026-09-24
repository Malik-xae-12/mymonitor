"""Users & roles API endpoints (admin only).

  - GET  /api/admin/users     -> list users + role catalog
  - POST /api/admin/users/role -> set a user's role
  - GET  /api/roles           -> role catalog (any authenticated user)
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.modules.auth.dependency import get_current_user, require_admin
from backend.app.modules.auth.schema import UserProfile
from backend.app.modules.users.models import ROLE_ADMIN, ROLE_L1, ROLE_L2
from backend.app.modules.users.schema import (
    AddUserRequest,
    RoleResponse,
    SetRoleRequest,
    UsersListResponse,
)
from backend.app.modules.users.service import users_service

router = APIRouter(tags=["users"])

_SUPPORT_ROLES = {ROLE_L1, ROLE_L2}


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
    # Check if target is admin
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
