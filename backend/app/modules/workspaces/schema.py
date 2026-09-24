from typing import Optional
from pydantic import BaseModel

class WorkspaceItem(BaseModel):
    id: str
    displayName: str
    description: Optional[str] = None
    type: Optional[str] = None
