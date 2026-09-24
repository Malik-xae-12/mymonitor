# Project Memory & Active State

Maintains the dynamic pulse of the project across sessions.

---

## Current Status
- **Phase**: Phase 6 Completed — Full Monitoring Backend Promoted to Modular Domain Architecture (`Router -> Service -> Repository -> Models`), Unused Artifacts Removed, Clean Consolidated Root
- **Active Branch**: `admin`
- **Last Updated**: 2026-09-25

## Completed Milestones
- [x] Playwright MCP configured & health-checked; Chromium pre-installed
- [x] Backend Entra ID token validation + RBAC guards (`modules/auth`)
- [x] Table-level RBAC: `roles` + `users` tables; `modules/users` (models/repo/service/schema/router)
- [x] Seed roles + bootstrap admins from `ADMIN_EMAILS` on startup
- [x] `/api/auth/me`, admin assignment + users/roles endpoints
- [x] Frontend MSAL provider + auth config + login gate + role context
- [x] Admin console: pivot tabs — Users & Support Personnel + Pipeline L1/L2 Teams & SLA
- [x] Dynamic parent-child pipeline tree table: master pipelines at root, sub-pipelines strictly nested inside `activity.childPipeline` with zero orphan duplicate rows
- [x] Per-parent-pipeline L1/L2 assignees, SLA 1, and SLA 2 thresholds saved to `sla_configs`
- [x] Automated Gmail SMTP alerting: L1 alert on pipeline failure + watchdog L2 escalation on SLA 1 breach
- [x] Role-Based Access Control (RBAC) Scoping:
  - Non-admin L1/L2 users only see assigned workspaces.
  - Non-admin L1/L2 users only see their assigned pipelines (`l1Email`/`l2Email` match).
  - Admin Console and Table Map ("Map Columns") options completely hidden for non-admins.
  - Metric summary cards compute dynamically over scoped pipelines.
- [x] Adaptive Dual-Speed Differential Poller:
  - Active Mode: 3.5s interval when pipelines are `InProgress`.
  - Idle Mode: 15.0s interval when all pipelines are `Completed`/`Failed` to conserve 80% of API calls.
  - Differential checking: running pipelines checked every 3.5s, succeeded pipelines checked every 15.0s with 0 activity calls.
  - In-flight re-run detection via immutable job instance GUIDs and `MAX(COALESCE(start_time, '1970-01-01'))`.
- [x] Multi-schedule modal showing all configured schedules per pipeline
- [x] Lakehouse/Warehouse table logging & batch lineage (Batch Header → Bronze → Silver)
- [x] Google Gemini AI error diagnostics with SQLite error-hash caching
- [x] Phase 6: Architecture Realignment & Consolidation:
  - Promoted FastAPI modular clean architecture to `/backend/app/`: `app_factory.py`, `core/security.py`, `core/tokens.py`, `core/exceptions.py`, `shared/responses.py`, `shared/constants.py`, `shared/pagination.py`.
  - Stripped out the generic SQL table-viewer admin panel from starter (`modules/admin/registry.py`, `service.py`, `schema.py`) and removed dummy items module.
  - Preserved Fabric Admin endpoints (`/api/admin/assignments`, `/api/admin/users`, `/api/roles`) in `modules/admin/router.py`.
  - Removed entire `next-fastapi-starter/` directory along with unused `nginx`, `.github`, `local-shared-data`.
  - Reorganized React frontend into full feature-based architecture (`features/{monitoring,admin,table-logs,auth}`, `components/{layout,shared,ui}`, `routes/`, `services/`, `utils/`, `constants/`, `config/`, `context/`).
  - Removed dead/unwanted code (`AccessManagementPage.jsx`, `DashboardHeader.jsx`, `ActivityList.jsx`, flat root component files).
  - Verified 100% build integrity (`npm run build` in 2.15s) and ASGI integration test passing across all endpoints (`/health`, `/api/workspaces`, `/api/admin/users`, `/api/auth/me`, and static SPA hosting).
- [x] Comprehensive documentation suite in `docs/` (`PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, `MEMORY.md`, `POLLER_AND_RBAC_GUIDE.md`)

## Immediate Operational Notes
- Branch `admin` is synced with `origin/admin`.
- Running the application:
  - Backend: `uvicorn app.main:app --reload` from `backend/` or `uvicorn backend.app.main:app --reload` from root on port 8000.
  - Frontend: `npm run dev` from `frontend/` on port 5173 / port 3000 (Vite).
- Auth mode: `VITE_AUTH_ENABLED=true` in frontend, `AUTH_ENABLED=True` in backend.
