import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory of RealPOC
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    AZURE_TENANT_ID: str
    AZURE_CLIENT_ID: str 
    AZURE_CLIENT_SECRET: str 

    # Microsoft Entra ID (Azure AD) sign-in / RBAC.
    # These identify the SPA app registration used for user sign-in and token validation.
    # May differ from the Fabric Service Principal above.
    AZURE_AD_TENANT_ID: str = "008502d6-3f79-46f0-ab37-9354e3fe80ff"
    AZURE_AD_CLIENT_ID: str = "25ad11d7-5885-4f0e-8424-919bf02e04eb"
    # Azure AD Service Principal for selecting people / users (Microsoft Graph)
    USERS_AZURE_AD_CLIENT_SECRET: str = "m1N8Q~tpbpecTl-wipABz2KMkRJI0LBJpSB.xaBI"
    USERS_AZURE_AD_CLIENT_ID: str = "6eafc8c7-0d3f-4d8a-b8c1-308384cb6829"
    USERS_AZURE_AD_TENANT_ID: str = "008502d6-3f79-46f0-ab37-9354e3fe80ff"

    # Comma-separated list of bootstrap admin emails (case-insensitive).
    ADMIN_EMAILS: str = ""
    # When False, backend skips token validation (local dev only). Keep True in real use.
    AUTH_ENABLED: bool = True

    # JWT & Auth Settings (aligned with next-fastapi-starter architecture)
    ACCESS_SECRET_KEY: str = "fabric-monitor-jwt-secret-key-2026"
    REFRESH_SECRET_KEY: str = "fabric-monitor-refresh-secret-key-2026"
    RESET_PASSWORD_SECRET_KEY: str = "fabric-monitor-reset-secret-key-2026"
    VERIFICATION_SECRET_KEY: str = "fabric-monitor-verification-secret-key-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600  # 1 hour
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    POLL_INTERVAL_ACTIVE_SECONDS: float = 3.5
    POLL_INTERVAL_IDLE_SECONDS: float = 15.0
    MAX_PARALLEL_FABRIC_REQUESTS: int = 5
    
    ALLOWED_ORIGINS: str = "*"

    # Database
    SQLITE_DB_PATH: str = str(BASE_DIR / "backend" / "data" / "fabric_monitor.db")

    # SMTP Email Alerting Settings
    MAIL_USERNAME: str = "uiaptracker@gmail.com"
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "uiaptracker@gmail.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # Google Gemini AI Diagnostics
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

