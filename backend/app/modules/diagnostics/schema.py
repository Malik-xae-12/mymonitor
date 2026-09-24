from typing import Optional, Any
from pydantic import BaseModel


class AiFixRequest(BaseModel):
    pipelineName: Optional[str] = None
    activityName: Optional[str] = None
    activityType: Optional[str] = None
    errorCode: Optional[str] = None
    errorMessage: Optional[str] = None
    failureType: Optional[str] = None
    target: Optional[str] = None
    rawError: Optional[Any] = None
    forceRefresh: Optional[bool] = False
