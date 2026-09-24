"""Pydantic schemas for the auth / RBAC module."""
from typing import List, Optional
from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """The signed-in user's identity + resolved role and scoped workspaces."""
    email: str
    name: Optional[str] = None
    oid: Optional[str] = None
    role: str = Field(description="admin | l1 | l2 | none")
    is_admin: bool = False
    assigned_workspace_ids: List[str] = []


class WorkspaceAssignment(BaseModel):
    """A single workspace's L1/L2 responsibility + SLA thresholds."""
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
    """Admin request to create/update a workspace assignment."""
    workspace_id: str
    workspace_name: Optional[str] = None
    l1_email: str
    l2_email: str
    sla1_minutes: int = 30
    sla2_minutes: int = 60
    table_config_done: bool = False
