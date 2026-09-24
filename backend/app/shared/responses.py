from typing import Any, Optional, Dict
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Standardized API response wrapper matching next-fastapi-starter architecture."""
    success: bool
    data: Optional[Any] = None
    message: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

    @classmethod
    def ok(cls, data: Any = None, message: Optional[str] = None, meta: Optional[Dict[str, Any]] = None):
        return cls(success=True, data=data, message=message, meta=meta)

    @classmethod
    def fail(cls, message: str, data: Any = None):
        return cls(success=False, data=data, message=message)
