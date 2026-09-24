"""User domain model (row representation for the ``users`` table)."""
from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    oid: Optional[str] = None
    role_id: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None
