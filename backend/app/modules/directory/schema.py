from typing import Optional
from pydantic import BaseModel


class DirectoryUser(BaseModel):
    id: str
    displayName: str
    mail: Optional[str] = None
    userPrincipalName: Optional[str] = None
    jobTitle: Optional[str] = None
    department: Optional[str] = None
