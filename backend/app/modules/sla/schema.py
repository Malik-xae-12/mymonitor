from typing import Optional
from pydantic import BaseModel


class SlaConfigPayload(BaseModel):
    pipelineName: Optional[str] = None
    l1Email: str = ""
    l1Name: Optional[str] = None
    l2Email: str = ""
    l2Name: Optional[str] = None
    slaMinutes: Optional[int] = 30
    sla1Minutes: Optional[int] = None
    sla2Minutes: Optional[int] = None
    enabled: Optional[bool] = True
    assignedBy: Optional[str] = None


class IncidentResolveRequest(BaseModel):
    resolvedBy: Optional[str] = "Operator"


class TestEmailRequest(BaseModel):
    email: str
    role: str = "L1"
    pipelineName: Optional[str] = None
