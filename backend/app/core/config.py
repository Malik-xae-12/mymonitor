from pathlib import Path
import json
import os

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_app_dir = Path(__file__).resolve().parent.parent
_backend_dir = _app_dir.parent
_root_dir = _backend_dir.parent


class Settings(BaseSettings):
    # OpenAPI docs
    OPENAPI_OUTPUT_FILE: str | None = None

    # Environment
    PROD: bool = False
    AUTH_ENABLED: bool = True

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./app.db"
    PROD_DATABASE_URL: str | None = None
    EXPIRE_ON_COMMIT: bool = False

    # JWT Authentication & Authorization (Pre-built)
    ACCESS_SECRET_KEY: str = "fabric-monitor-jwt-access-secret-2026"
    REFRESH_SECRET_KEY: str = "fabric-monitor-jwt-refresh-secret-2026"
    RESET_PASSWORD_SECRET_KEY: str = "fabric-monitor-jwt-reset-secret-2026"
    VERIFICATION_SECRET_KEY: str = "fabric-monitor-jwt-verify-secret-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600  # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Token cleanup scheduler
    TOKEN_CLEANUP_INTERVAL_HOURS: int = 6
    TOKEN_CLEANUP_RETENTION_DAYS: int = 30

    # Microsoft Fabric REST APIs (Service Principal)
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""

    # Microsoft Entra ID (Azure AD) – User Authentication / SSO / RBAC
    AZURE_AD_TENANT_ID: str = ""
    AZURE_AD_CLIENT_ID: str = ""
    AZURE_AD_CLIENT_SECRET: str = ""
    AZURE_AD_ISSUER: str = ""

    # Microsoft Graph API Directory Service Credentials
    USERS_AZURE_AD_TENANT_ID: str = ""
    USERS_AZURE_AD_CLIENT_ID: str = ""
    USERS_AZURE_AD_CLIENT_SECRET: str = ""

    # SQLite Database for Real-Time Snapshot Cache & Telemetry
    SQLITE_DB_PATH: str = "backend/data/fabric_monitor.db"

    # Adaptive Dual-Speed Leased Polling Intervals (Seconds)
    ACTIVE_POLL_INTERVAL: float = 3.5
    IDLE_POLL_INTERVAL: float = 15.0
    LEASE_EXPIRY_SECONDS: int = 30
    RATE_LIMIT_DELAY: float = 0.05
    MAX_CONCURRENT_REQUESTS: int = 5
    MAX_PARALLEL_FABRIC_REQUESTS: int = 5

    # Real-Time SLA Escalation & Incident Management
    SLA_POLL_INTERVAL: int = 15
    ALERT_COOLDOWN_MINUTES: int = 30
    NOTIFICATION_EMAIL: str = "uiaptracker@gmail.com"
    ALERT_EMAIL_PASSWORD: str = ""
    ALERT_SMTP_HOST: str = "smtp.gmail.com"
    ALERT_SMTP_PORT: int = 465

    # Role-Based Access Control Bootstrap (Comma-separated admin emails)
    ADMIN_EMAILS: str = "mohammedabdulmalik.m@ubtiinc.com"

    # AI Failure Diagnostics (Google Gemini 3.6 Flash)
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Frontend URL & CORS
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "*"
    CORS_ORIGINS: list[str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except (json.JSONDecodeError, TypeError):
                pass
            return [s.strip() for s in v.split(",") if s.strip()]
        return v or []

    # Rate limiting (requests per minute)
    RATE_LIMIT_LOGIN: str = "10/minute"
    RATE_LIMIT_REFRESH: str = "20/minute"
    RATE_LIMIT_SSO_EXCHANGE: str = "30/minute"

    # CSRF
    CSRF_SECRET: str | None = None

    model_config = SettingsConfigDict(
        env_file=[
            str(_root_dir / ".env"),
            str(_backend_dir / ".env"),
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
