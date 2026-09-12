import re
import json
import hashlib
import logging
from typing import Dict, Any, Optional
import httpx

from backend.app.core.config import settings
from backend.app.services.db_service import db_service

logger = logging.getLogger("fabric_monitor.ai_diagnostic")

class AiDiagnosticService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL or "gemini-3.6-flash"

    def _sanitize_error_text(self, text: str) -> str:
        """Removes passwords, secrets, connection strings, and tokens from error messages."""
        if not text:
            return ""
        s = str(text)
        # Redact password, pwd, secret parameters
        s = re.sub(r'(?i)(password|pwd|client_secret|secret|access_token|authorization|bearer)\s*[:=]\s*([^\s;,]+)', r'\1=[REDACTED]', s)
        # Redact JWT tokens
        s = re.sub(r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}', '[REDACTED_JWT]', s)
        # Redact account keys or long hex/base64 strings
        s = re.sub(r'(?i)(AccountKey|SharedAccessKey)=([^\s;]+)', r'\1=[REDACTED]', s)
        return s

    def _compute_hash(self, error_code: str, error_message: str, activity_type: str) -> str:
        """Computes deterministic hash for error fingerprinting."""
        raw = f"{str(error_code).strip().lower()}:{str(error_message).strip()[:300].lower()}:{str(activity_type).strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def diagnose_failure(
        self,
        pipeline_name: str,
        activity_name: str,
        activity_type: str,
        error_code: str,
        error_message: str,
        failure_type: str = "UserError",
        target: str = "",
        raw_error: Optional[Any] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Diagnoses a pipeline or activity failure using Google Gemini 3.6 Flash.
        Returns root cause, likely causes, step-by-step fix instructions, copyable script, and prevention tips.
        Results are cached in SQLite by error signature.
        """
        sanitized_msg = self._sanitize_error_text(error_message)
        sanitized_code = self._sanitize_error_text(error_code or "N/A")
        sanitized_raw = self._sanitize_error_text(json.dumps(raw_error) if raw_error else "")

        error_hash = self._compute_hash(sanitized_code, sanitized_msg, activity_type)

        # Check cache if not forcing refresh
        if not force_refresh:
            cached = await db_service.get_cached_ai_diagnosis(error_hash)
            if cached:
                logger.info(f"Returning cached AI diagnosis for hash {error_hash[:10]}")
                return cached

        if not self.api_key:
            return {
                "success": False,
                "error": "Google Gemini API key is not configured in .env. Please set GEMINI_API_KEY to enable AI troubleshooting.",
                "rootCause": "AI Diagnostic service is unavailable because GEMINI_API_KEY is missing.",
                "severity": "Medium",
                "likelyCauses": ["GEMINI_API_KEY is not set in .env"],
                "fixSteps": ["Add GEMINI_API_KEY=<your-google-ai-studio-key> to .env and restart the server."],
                "fixScript": "",
                "fixScriptLanguage": "",
                "preventionTip": "Ensure environment variables are configured in production."
            }

        system_instruction = (
            "You are a Principal Microsoft Fabric & Azure Data Factory Solutions Architect and DataOps Troubleshooting Specialist.\n"
            "Analyze the following data pipeline / activity failure.\n"
            "Identify the exact root cause in plain English, explain why it happened, and provide a clear, numbered checklist of steps to fix it in Fabric / SQL.\n"
            "If a SQL command, PySpark script, or schema alteration fixes the issue, provide the exact copy-pasteable script.\n"
            "You MUST respond ONLY with a JSON object matching this exact schema:\n"
            "{\n"
            '  "rootCause": "Clear, concise 1-2 sentence explanation of what failed and why.",\n'
            '  "severity": "Critical" | "High" | "Medium" | "Low",\n'
            '  "likelyCauses": ["Cause 1", "Cause 2", "Cause 3"],\n'
            '  "fixSteps": ["Step 1: Actionable instruction", "Step 2: Next action", "Step 3: Verification"],\n'
            '  "fixScript": "Copyable SQL script, PySpark snippet, or CLI command if applicable, otherwise empty string",\n'
            '  "fixScriptLanguage": "sql" | "python" | "json" | "bash" | "",\n'
            '  "preventionTip": "Practical advice to prevent this failure in future runs."\n'
            "}"
        )

        user_content = f"""
Failed Pipeline: {pipeline_name}
Failed Activity: {activity_name}
Activity Type: {activity_type}
Failure Type: {failure_type}
Target Object: {target or activity_name}
Error Code: {sanitized_code}
Error Message:
{sanitized_msg}

Raw Diagnostic Details:
{sanitized_raw[:1500]}
"""

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_content}]
                }
            ],
            "systemInstruction": {
                "parts": [{"text": system_instruction}]
            },
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
                "maxOutputTokens": 2048
            }
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(gemini_url, json=payload)
                if res.status_code != 200:
                    logger.error(f"Gemini API returned status {res.status_code}: {res.text}")
                    return {
                        "success": False,
                        "error": f"Gemini API error ({res.status_code}): {res.text[:200]}",
                        "rootCause": f"Error communicating with AI service (HTTP {res.status_code}).",
                        "severity": "Medium",
                        "likelyCauses": ["Gemini API quota exceeded, invalid model, or network issue"],
                        "fixSteps": ["Check Gemini API quota and API key permissions in Google AI Studio."],
                        "fixScript": "",
                        "fixScriptLanguage": "",
                        "preventionTip": "Verify API key status and network connectivity."
                    }

                res_json = res.json()
                candidates = res_json.get("candidates", [])
                if not candidates:
                    return {
                        "success": False,
                        "error": "No response candidates returned by Gemini model.",
                        "rootCause": "The AI model did not generate a response for this error payload.",
                        "severity": "Medium",
                        "likelyCauses": ["Content safety filter or empty prompt"],
                        "fixSteps": ["Review the error payload and retry."],
                        "fixScript": "",
                        "fixScriptLanguage": "",
                        "preventionTip": "Ensure error details are well formed."
                    }

                raw_text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                diag_data = json.loads(raw_text)

                result = {
                    "success": True,
                    "cached": False,
                    "pipelineName": pipeline_name,
                    "activityName": activity_name,
                    "activityType": activity_type,
                    "errorCode": sanitized_code,
                    "rootCause": diag_data.get("rootCause", "An unexpected failure occurred."),
                    "severity": diag_data.get("severity", "High"),
                    "likelyCauses": diag_data.get("likelyCauses", []),
                    "fixSteps": diag_data.get("fixSteps", []),
                    "fixScript": diag_data.get("fixScript", ""),
                    "fixScriptLanguage": diag_data.get("fixScriptLanguage", ""),
                    "preventionTip": diag_data.get("preventionTip", "")
                }

                # Save into SQLite cache
                await db_service.save_ai_diagnosis(
                    error_hash=error_hash,
                    error_code=sanitized_code,
                    error_message=sanitized_msg,
                    activity_type=activity_type,
                    pipeline_name=pipeline_name,
                    diagnosis=result
                )

                return result

        except json.JSONDecodeError as jde:
            logger.error(f"Failed to parse Gemini JSON output: {jde}, Raw text: {raw_text}")
            return {
                "success": True,
                "cached": False,
                "pipelineName": pipeline_name,
                "activityName": activity_name,
                "activityType": activity_type,
                "errorCode": sanitized_code,
                "rootCause": raw_text[:300] if 'raw_text' in locals() else "Activity failed during execution.",
                "severity": "High",
                "likelyCauses": ["Malformed AI output"],
                "fixSteps": ["Check activity logs and parameters."],
                "fixScript": "",
                "fixScriptLanguage": "",
                "preventionTip": ""
            }
        except Exception as e:
            logger.exception(f"Error calling AI diagnostic service: {e}")
            return {
                "success": False,
                "error": str(e),
                "rootCause": f"Internal exception while generating AI diagnosis: {str(e)}",
                "severity": "High",
                "likelyCauses": ["Connection timeout or unexpected error"],
                "fixSteps": ["Check server logs and retry diagnosis."],
                "fixScript": "",
                "fixScriptLanguage": "",
                "preventionTip": ""
            }

ai_diagnostic_service = AiDiagnosticService()

