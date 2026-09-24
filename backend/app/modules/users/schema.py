"""Pydantic request/response schemas for the users module."""
from typing import List, Optional

from pydantic import BaseModel


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


class UsersListResponse(BaseModel):
    users: List[UserResponse]
    roles: List[RoleResponse]


class SetRoleRequest(BaseModel):
    email: str
    role_id: str


class AddUserRequest(BaseModel):
    email: str
    display_name: Optional[str] = None
    oid: Optional[str] = None
    role_id: str
