import uuid
from typing import Optional, List
from fastapi_users import schemas
from pydantic import BaseModel, Field

from app.modules.users.schema import (
    UserProfile,
    WorkspaceAssignment,
    AssignmentUpsertRequest,
)


class UserRead(schemas.BaseUser[str]):
    pass


class UserCreate(schemas.BaseUserCreate):
    pass


class UserUpdate(schemas.BaseUserUpdate):
    pass


class EntraIdExchangeRequest(BaseModel):
    id_token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


__all__ = [
    "UserRead",
    "UserCreate",
    "UserUpdate",
    "EntraIdExchangeRequest",
    "TokenResponse",
    "TokenPairResponse",
    "RefreshRequest",
    "UserProfile",
    "WorkspaceAssignment",
    "AssignmentUpsertRequest",
]
