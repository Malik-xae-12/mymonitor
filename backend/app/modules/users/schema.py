import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr


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


# ---- Fabric Monitoring RBAC Schemas ----
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
