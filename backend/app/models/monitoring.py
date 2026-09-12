from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class WorkspaceItem(BaseModel):
    id: str
    displayName: str
    description: Optional[str] = None
    type: Optional[str] = None

class ActivityError(BaseModel):
    errorCode: Optional[str] = None
    message: Optional[str] = None
    failureType: Optional[str] = None
    target: Optional[str] = None
    rawError: Optional[Any] = None

class ActivityRun(BaseModel):
    activityRunId: Optional[str] = None
    activityName: str
    activityType: str
    status: str  # InProgress, Succeeded, Failed, Queued
    activityRunStart: Optional[str] = None
    activityRunEnd: Optional[str] = None
    durationInMs: Optional[int] = None
    error: Optional[ActivityError] = None
    output: Optional[Dict[str, Any]] = None
    childPipeline: Optional[Any] = None

class PipelineRun(BaseModel):
    id: str
    pipelineId: str
    pipelineName: str
    workspaceId: str
    status: str  # InProgress, Completed, Failed, Cancelled, NotStarted
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    durationInMs: Optional[int] = None
    invokeType: Optional[str] = None
    isChild: bool = False
    parentRunId: Optional[str] = None
    parentActivityName: Optional[str] = None
    error: Optional[ActivityError] = None
    activities: List[ActivityRun] = Field(default_factory=list)
    childPipelines: List['PipelineRun'] = Field(default_factory=list)

class PipelineSchedule(BaseModel):
    pipelineId: str
    pipelineName: str
    enabled: bool
    scheduleType: Optional[str] = None
    nextRunTime: Optional[str] = None
    timeZone: Optional[str] = None
    schedules: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    rawConfiguration: Optional[Dict[str, Any]] = None

class WebSocketMessage(BaseModel):
    type: str  # FULL_SNAPSHOT, STATE_UPDATE, HEARTBEAT, ERROR
    workspaceId: str
    timestamp: str
    data: Any

