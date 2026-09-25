import json
import datetime
from typing import Any, Dict, Optional
import aiosqlite
from app.db.session import get_sqlite_path


class DiagnosticsRepository:
    def __init__(self, db_path: Optional[str] = None):
        self._db_path = db_path

    @property
    def db_path(self) -> str:
        return self._db_path or get_sqlite_path()

    async def get_cached_ai_diagnosis(self, error_hash: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT diagnosis_json FROM ai_error_diagnostics WHERE error_hash = ?",
                (error_hash,),
            )
            row = await cursor.fetchone()
            if row and row["diagnosis_json"]:
                try:
                    data = json.loads(row["diagnosis_json"])
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
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        diag_str = json.dumps(diagnosis)
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """
                INSERT INTO ai_error_diagnostics (
                    error_hash, error_code, error_message, activity_type,
                    pipeline_name, diagnosis_json, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(error_hash) DO UPDATE SET
                    diagnosis_json=excluded.diagnosis_json,
                    created_at=excluded.created_at
                """,
                (
                    error_hash,
                    error_code,
                    error_message,
                    activity_type,
                    pipeline_name,
                    diag_str,
                    now_iso,
                ),
            )
            await db.commit()


diagnostic_repository = DiagnosticsRepository()
