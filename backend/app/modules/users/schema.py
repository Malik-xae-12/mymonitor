"""Pydantic schemas for the unified users and user-setup management module."""

import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---- FastAPI Users Base Schemas ----
class UserBase(BaseModel):
    email: EmailStr
    is_active: bool = True
    is_superuser: bool = False
    is_verified: bool = False


class UserRead(UserBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    is_active: bool | None = None
    is_superuser: bool | None = None
    is_verified: bool | None = None


# ---- Fabric Monitoring RBAC & User Management Schemas ----
class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class UserResponse(BaseModel):
    email: str
    display_name: Optional[str] = None
    oid: Optional[str] = None
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None


class AddUserRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    oid: Optional[str] = None
    role_id: str  # 'l1' or 'l2'


class SetRoleRequest(BaseModel):
    email: str
    role_id: str  # 'l1' or 'l2'


class UsersListResponse(BaseModel):
    users: List[UserResponse]
    roles: List[RoleResponse]


class UserProfile(BaseModel):
    email: str
    name: Optional[str] = None
    oid: Optional[str] = None
    role: str = "none"  # admin | l1 | l2 | none
    is_admin: bool = False
    assigned_workspace_ids: List[str] = Field(default_factory=list)


# ---- Workspace L1/L2 Support Team Assignment Schemas ----
class WorkspaceAssignment(BaseModel):
    workspace_id: str
    workspace_name: Optional[str] = None
    l1_email: Optional[str] = None
    l2_email: Optional[str] = None
    sla1_minutes: int = 30
    sla2_minutes: int = 60
    table_config_done: bool = False
    assigned_by: Optional[str] = None
    updated_at: Optional[str] = None


class AssignmentUpsertRequest(BaseModel):
    workspace_id: str
    workspace_name: Optional[str] = None
    l1_email: Optional[str] = None
    l2_email: Optional[str] = None
    sla1_minutes: int = 30
    sla2_minutes: int = 60
    table_config_done: bool = False


__all__ = [
    "UserBase",
    "UserRead",
    "UserUpdate",
    "RoleResponse",
    "UserResponse",
    "AddUserRequest",
    "SetRoleRequest",
    "UsersListResponse",
    "UserProfile",
    "WorkspaceAssignment",
    "AssignmentUpsertRequest",
]
