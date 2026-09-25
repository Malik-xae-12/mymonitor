import uuid
from typing import Optional, List
from fastapi_users import schemas
from pydantic import BaseModel, Field


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


class UserProfile(BaseModel):
    email: str
    name: Optional[str] = None
    oid: Optional[str] = None
    role: str = "none"  # admin | l1 | l2 | none
    is_admin: bool = False
    assigned_workspace_ids: List[str] = Field(default_factory=list)


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
