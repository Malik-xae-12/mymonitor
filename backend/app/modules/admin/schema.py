"""Pydantic schemas for the admin management module."""

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

__all__ = [
    "AssignmentUpsertRequest",
    "UserProfile",
    "WorkspaceAssignment",
    "AddUserRequest",
    "RoleResponse",
    "SetRoleRequest",
    "UsersListResponse",
]
