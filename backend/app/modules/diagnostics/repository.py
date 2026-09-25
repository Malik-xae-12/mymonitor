import datetime
import json
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from app.db.session import async_session_maker
from app.modules.diagnostics.models.diagnostic import AIErrorDiagnostic


class DiagnosticsRepository:
    """Repository handling persistence and cache retrieval for AI error diagnostic results."""

    def __init__(self):
        """Initializes the diagnostics repository backed by SQLAlchemy Async ORM."""
        pass

    async def get_cached_ai_diagnosis(self, error_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieve previously cached AI diagnosis matching error fingerprint hash."""
        async with async_session_maker() as session:
            diag = await session.get(AIErrorDiagnostic, error_hash)
            if diag and diag.diagnosis_json:
                try:
                    data = json.loads(diag.diagnosis_json)
                    data["cached"] = True
                    return data
                except Exception:
                    return None
            return None

    async def save_ai_diagnosis(
        self,
        error_hash: str,
        error_code: str,
        error_message: str,
        activity_type: str,
        pipeline_name: str,
        diagnosis: Dict[str, Any],
    ) -> None:
        """Store newly generated AI diagnosis keyed by deterministic error hash."""
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        diag_str = json.dumps(diagnosis)
        async with async_session_maker() as session:
            stmt = sqlite_upsert(AIErrorDiagnostic).values(
                error_hash=error_hash,
                error_code=error_code,
                error_message=error_message,
                activity_type=activity_type,
                pipeline_name=pipeline_name,
                diagnosis_json=diag_str,
                created_at=now_iso,
            ).on_conflict_do_update(
                index_elements=[AIErrorDiagnostic.error_hash],
                set_={
                    "diagnosis_json": diag_str,
                    "created_at": now_iso,
                },
            )
            await session.execute(stmt)
            await session.commit()


diagnostic_repository = DiagnosticsRepository()
