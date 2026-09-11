import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Root directory of RealPOC
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent

class Settings(BaseSettings):
    AZURE_TENANT_ID: str
    AZURE_CLIENT_ID: str 
    AZURE_CLIENT_SECRET: str 
    
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

    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

