# Project Task Matrix (TASKS.md)

Work on **one atomic task at a time**. Check off completed tasks and update `MEMORY.md`.

## Phase 0: Tooling & Verification Setup
- [x] TASK-001: Configure Playwright MCP server (`.agents/mcp_config.json`)
- [x] TASK-002: Verify Node/npm + Playwright package health check
- [x] TASK-003: Pre-install Chromium browser binary
- [x] TASK-004: Initialize `docs/` suite (PRD, ARCHITECTURE, DESIGN, RULES, etc.)
- [x] TASK-005: Configure Figma MCP (Framelink `figma-developer-mcp`) — set `FIGMA_API_KEY`

## Phase 1: Backend Core (Delivered)
- [x] TASK-101: FastAPI app factory & config (`app/main.py`, `core/config.py`)
- [x] TASK-102: SQLite WAL schema & `db_service.py` (9 tables)
- [x] TASK-103: `fabric_client.py` + `rate_limiter.py` (Semaphore throttle)
- [x] TASK-104: `leased_poller.py` differential polling + `tree_builder.py`
- [x] TASK-105: WebSocket rooms (`connection_manager.py`, `websocket_hub.py`)

## Phase 2: Intelligence & Alerting (Delivered)
- [x] TASK-201: `ai_diagnostic_service.py` (Gemini) + `ai_error_diagnostics` cache
- [x] TASK-202: `alert_service.py` SLA watchdog + Gmail SMTP escalation
- [x] TASK-203: `table_log_service.py` Lakehouse/Warehouse batch lineage

## Phase 3: Frontend (Delivered)
- [x] TASK-301: Fabric shell (NavRail, SuiteBar, CommandBar, MetricCards)
- [x] TASK-302: `PipelineTreeTable` + `useWorkspaceMonitoring` WebSocket hook
- [x] TASK-303: Modals (RunHistory, ErrorDetail, SlaConfig, Schedule, TableLog)
- [x] TASK-304: `DateFilterBar` date-based telemetry + forecast

## Phase 4: Verification & Production Readiness
- [ ] TASK-401: Run Playwright MCP responsive matrix (375 / 768 / 1440) at :3000
- [ ] TASK-402: Smoke test — console errors, failed network, WebSocket health
- [ ] TASK-403: Audit security controls (secrets in `.env`, input validation)
- [ ] TASK-404: Verify production build (`npm run build`) served by FastAPI

## Phase 5: Auth & RBAC (Azure AD)
- [x] TASK-501: Backend Entra ID token validation (JWKS) + `get_current_user` / `require_admin`
- [x] TASK-502: DB `workspace_assignments` tables & db_service methods
- [x] TASK-503: `modules/auth` router: `/api/auth/me`, admin assignment CRUD
- [x] TASK-504: Backend config: `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `ADMIN_EMAILS`
- [x] TASK-505: Frontend MSAL provider + `authConfig` + login gate + role context
- [x] TASK-506: Admin assignment feature (workspace → L1/L2 → SLA1/SLA2 → table config)
- [x] TASK-509: Table-level RBAC — `roles` + `users` tables; `modules/users`
      (models/repository/service/schema/router); seed roles + bootstrap admins on startup
- [x] TASK-510: Users & roles admin UI (`features/admin/UsersPage` + `AdminConsole` pivot tabs)
- [x] TASK-511: Playwright smoke test (auth-bypass) — admin console, assignment save,
      L1/L2 users auto-created with correct roles
- [x] TASK-512: Per-parent-pipeline SLA — `sla_configs` gains `sla1_minutes`/`sla2_minutes`;
      `GET /{ws}/parent-pipelines` (SLA1/SLA2 merged); admin page lists parent pipelines with
      SLA1(→L1)/SLA2(→L2) per pipeline (L1/L2 emails stay workspace-level)
- [x] TASK-513: Remove top-bar workspace selector + Table Log Config button from suite bar
- [x] TASK-514: Fix MSAL crash — call account APIs only after `initialize()` (msalInstance/main)
- [x] TASK-507: Scope monitoring APIs + workspace picker to assigned workspaces
- [ ] TASK-508: Token-aware WebSocket handshake; 401/403 handling in UI

## Phase 6: Architecture Realignment & Optimization
- [x] TASK-601: Remove Next.js frontend from `next-fastapi-starter/` leaving only the FastAPI backend
- [x] TASK-602: Update project documentation (`TASKS.md`, `ARCHITECTURE.md`, `PRD.md`, `MEMORY.md`) to document the architecture migration and cleanup
- [x] TASK-603: Align FastAPI architecture with `project-scaffold` and `next-fastapi-starter/backend` (`core/security.py`, `core/tokens.py`, `shared/responses.py`, `shared/constants.py`, `app_factory.py`)
- [x] TASK-604: Reorganize React frontend to adhere strictly to `react-vite-architecture.md` (`features/{monitoring,admin,table-logs,auth}`, `components/{layout,shared,ui}`, `routes/`, `services/`, `utils/`, `constants/`, `config/`, `context/`)
- [x] TASK-605: Clean up dead/unwanted code and files, update all imports, verify `npm run build` and runtime integrity

## Phase 7: Fabric UI Redesign (Figma MCP + Fabric UI kit)
- [ ] TASK-701: Pull Fabric UI kit tokens/frames via Figma MCP; map to Tailwind/Fluent tokens
- [ ] TASK-702: Rebuild shell (nav rail, suite bar, command bar, side pane) to Fluent 2
- [ ] TASK-703: Redesign each page to be self-explanatory per `docs/DESIGN.md` §6
- [ ] TASK-704: Playwright MCP visual pass across the responsive matrix

