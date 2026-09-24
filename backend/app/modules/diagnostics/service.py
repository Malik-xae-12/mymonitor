import logging
from typing import Dict, Any
from app.services.ai_diagnostic_service import ai_diagnostic_service

logger = logging.getLogger("fabric_monitor.diagnostics")


class DiagnosticsService:
    async def diagnose(self, payload: Any) -> Dict[str, Any]:
        return await ai_diagnostic_service.diagnose_failure(
            pipeline_name=payload.pipelineName or "Pipeline",
            activity_name=payload.activityName or "Activity",
            activity_type=payload.activityType or "Execution",
            error_code=payload.errorCode or "N/A",
            error_message=payload.errorMessage,
            failure_type=payload.failureType or "UserError",
            target=payload.target or "",
            raw_error=payload.rawError,
            force_refresh=payload.forceRefresh or False,
        )


diagnostics_service = DiagnosticsService()
