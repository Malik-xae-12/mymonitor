import sys
from pathlib import Path

# Ensure project root is in sys.path
project_root = Path(__file__).resolve().parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from backend.app.core.config import settings
from backend.app.services.leased_poller import leased_poller
from backend.app.services.db_service import db_service
from backend.app.services.alert_service import alert_service
from backend.app.api.routes_workspaces import router as workspaces_router
from backend.app.api.websocket_hub import router as websocket_router
from backend.app.modules.auth import auth_router
from backend.app.modules.users import users_router, users_service
from backend.app.api.routes_directory import router as directory_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("fabric_monitor")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite DB, background poller, and SLA alert monitor
    logger.info("Initializing Microsoft Fabric Real-Time Monitoring Hub & SQLite DB...")
    await db_service.init_db()
    # Seed RBAC role catalog + bootstrap admin users from ADMIN_EMAILS.
    admin_emails = [e.strip() for e in (settings.ADMIN_EMAILS or "").split(",") if e.strip()]
    await users_service.seed_defaults(admin_emails)
    leased_poller.start()
    alert_service.start()
    yield
    # Shutdown: Stop poller and alert service
    logger.info("Shutting down Fabric Monitoring Hub...")
    leased_poller.stop()
    alert_service.stop()

app = FastAPI(
    title="Microsoft Fabric Real-Time Monitoring Hub",
    description="Real-time pipeline & activity monitoring for Microsoft Fabric with parent-child hierarchy and WebSockets",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]
if "*" in origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(directory_router)
app.include_router(workspaces_router)
app.include_router(websocket_router)

from backend.app.api.routes_workspaces import AiFixRequest

@app.post("/api/diagnostics/ai-fix")
async def global_diagnose_pipeline_error(payload: AiFixRequest):
    """Global endpoint to analyze failures using Google Gemini 3.6 Flash."""
    from backend.app.services.ai_diagnostic_service import ai_diagnostic_service
    return await ai_diagnostic_service.diagnose_failure(
        pipeline_name=payload.pipelineName or "Pipeline",
        activity_name=payload.activityName or "Activity",
        activity_type=payload.activityType or "Execution",
        error_code=payload.errorCode or "N/A",
        error_message=payload.errorMessage,
        failure_type=payload.failureType or "UserError",
        target=payload.target or "",
        raw_error=payload.rawError,
        force_refresh=payload.forceRefresh or False
    )

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "fabric-monitoring-backend",
        "tenant_id": settings.AZURE_TENANT_ID,
        "poller_active": leased_poller._is_running
    }

# Mount static build files from frontend/dist if available
from pathlib import Path
from fastapi.staticfiles import StaticFiles

frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Microsoft Fabric Real-Time Job Monitoring API is running",
            "docs": "/docs",
            "health": "/health"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

