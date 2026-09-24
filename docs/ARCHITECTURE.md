# System Architecture Document

**Last Updated:** 2026-09-25

## 1. Tech Stack
- **Frontend**: React 19 + Vite 8 (feature-based SPA), Tailwind CSS 4, lucide-react icons.
- **Auth (frontend)**: MSAL (`@azure/msal-browser` + `@azure/msal-react`) — Microsoft Entra ID SPA sign-in.
- **State**: Custom hook `useWorkspaceMonitoring` over native WebSocket + fetch (token-aware client).
- **Backend**: FastAPI (Python 3.10+), Uvicorn ASGI server.
- **Auth (backend)**: Entra ID JWT validation via JWKS (`PyJWT[crypto]`), RBAC guards (`admin`, `l1`, `l2`).
- **Database**: SQLite with WAL mode (`backend/data/fabric_monitor.db`), `aiosqlite`.
- **Realtime**: Native WebSocket rooms via `connection_manager` / `websocket_hub`.
- **External APIs**: Microsoft Fabric REST APIs, Google Gemini (AI diagnostics), Gmail SMTP (alerts).
- **Design source**: Microsoft Fabric UI kit (Fluent 2 design language).

## 2. System Overview & Data Flow
```mermaid
flowchart LR
    User["Browser (React SPA)"] -->|WebSocket Room| Hub["websocket_hub / connection_manager"]
    Hub --> Poller["leased_poller (active viewers only)"]
    Poller -->|Cached terminal runs| DB[("SQLite WAL")]
    Poller -->|Only InProgress runs| RL["rate_limiter (Semaphore=5)"]
    RL --> Fabric["Microsoft Fabric REST APIs"]
    Poller -->|Broadcast snapshot| Hub
    Alert["alert_service (SLA watchdog)"] --> DB
    Alert -->|L1/L2 emails| SMTP["Gmail SMTP"]
    AI["ai_diagnostic_service"] --> DB
    AI -->|Analyze failures| Gemini["Google Gemini"]
    TableLog["table_log_service"] --> DB
```

## 3. Authentication & RBAC Isolation Flow
```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant M as MSAL (Entra ID)
    participant API as FastAPI
    participant DB as SQLite
    U->>M: Sign in (redirect)
    M-->>U: ID token (aud=client_id)
    U->>API: GET /api/auth/me (Bearer token)
    API->>API: Validate token via Entra JWKS
    API->>DB: Resolve role + assigned workspaces (via workspace_assignments & sla_configs)
    DB-->>API: role=admin|l1|l2, is_admin, assigned_workspace_ids[]
    API-->>U: profile + role + scoped workspaces
    Note over U,API: Admin -> full access; L1/L2 -> strict workspace & pipeline isolation
```

### Role-Based Access Control (RBAC) Invariants
1. **Admin (`admin`)**:
   - Access to Admin Console (Users & Support Personnel, Pipeline L1/L2 Teams & SLA).
   - Can add/edit users, assign L1/L2 support leads, and configure SLA1 (Warning) / SLA2 (Breach) times.
   - Access to Lakehouse / Warehouse column mapping configuration (`TableLogConfigPage`).
   - Views all workspaces and all pipelines across the organization.
2. **L1 Support Lead (`l1`)**:
   - Strictly scoped: Only sees workspaces assigned to them in `workspace_assignments` or on any pipeline in `sla_configs`.
   - Within each workspace, only sees pipelines where `p.slaConfig.l1Email == user.email`.
   - Metric cards (Total, In Progress, Completed, Failed, Cancelled, Not Run) compute exclusively over their assigned pipelines.
   - **Admin Console and Table Map ("Map Columns") options are completely hidden.**
3. **L2 Escalation Owner (`l2`)**:
   - Strictly scoped: Only sees workspaces assigned to them.
   - Within each workspace, only sees pipelines where `p.slaConfig.l2Email == user.email`.
   - Metric cards compute exclusively over their assigned pipelines.
   - **Admin Console and Table Map ("Map Columns") options are completely hidden.**

---

## 4. Leased Polling & In-Flight Re-run Mechanics

### Why Terminal States Are Cached
In Microsoft Fabric, once a pipeline execution reaches a terminal status (`Completed`, `Failed`, `Cancelled`), its activity telemetry, error diagnostics, and duration are **immutable**.
- To prevent exhausting Fabric API quotas (HTTP 429 rate limiting), `leased_poller.py` maintains an index of cached terminal run IDs (`db_service.get_known_cached_run_ids`).
- For any run ID in this set, inner activity trees are retrieved in <15ms directly from SQLite, skipping external Fabric REST activity calls.

### How Re-runs Are Detected and Handled
When a user re-runs a pipeline or a scheduled trigger fires:
1. **Immutable Job Instances**: Fabric creates a **brand-new Job Instance with a unique GUID Run ID** (e.g., `run_id = "run-2026-xyz"`). It does *not* overwrite the historical run.
2. **Poller Instance Discovery**: On the next leased poller cycle (every 5 seconds for active viewers), `fabric_client.get_job_instances(workspace_id, pipeline_id)` fetches the pipeline's recent executions.
3. **New In-Flight Run Saved**: The new run `run-2026-xyz` is returned with status `InProgress` and saved into SQLite.
4. **Instant Latest Selection**: `get_workspace_latest_tree` selects the latest run via `MAX(COALESCE(start_time, '1970-01-01'))`. Because `run-2026-xyz` has the newest start timestamp, it immediately replaces the old run as the active execution shown in the tree table.
5. **Live Polling**: Because `run-2026-xyz` has status `InProgress`, it is **not** in `cached_terminal_run_ids`. The poller queries Fabric for its live activity progress and streams updates over WebSockets.
6. **Freezing upon Completion**: Only when `run-2026-xyz` transitions to `Completed`, `Failed`, or `Cancelled` does it enter `cached_terminal_run_ids`. The previous historical run remains permanently preserved in `pipeline_runs` for the Run History modal.

---

## 5. Pipeline Hierarchy & Sub-pipeline Nesting
1. **Master / Root Pipelines**:
   - Pipelines are categorized as master pipelines (`is_master = 1`) or child pipelines (`is_master = 0, is_child = 1`).
   - Root rows in the Monitoring Hub display only parent master pipelines.
2. **Dynamic Child Discovery (Zero Hardcoding)**:
   - When an inner activity is of type `ExecutePipeline` or contains a `pipelineRunId` in its output, `_fetch_activity_tree` recursively retrieves the child pipeline's execution and inner activities.
   - Child pipeline runs are nested directly inside `activity.childPipeline`.
   - `db_service.update_child_pipeline_flags` automatically marks discovered child pipelines so they **never appear as duplicate orphan rows at the root level**.

---

## 6. Automated Alerting & SLA Escalation Engine
- **Failure Trigger**: When `leased_poller` detects a pipeline run in status `Failed`, it dispatches `alert_service.process_failed_run()`.
- **L1 Incident Creation**: An incident is registered in `sla_incidents` (`status = 'ACTIVE'`). An HTML alert email detailing the error and failure timestamp is dispatched to the configured `l1_email`.
- **SLA 1 (Warning)**: Monitors elapsed time against `sla1_minutes`.
- **SLA 2 (Breach Escalation)**: If the incident remains unresolved past the SLA threshold, the watchdog updates status to `ESCALATED_L2`, sends an escalation alert to `l2_email`, and broadcasts an `SLA_BREACHED` message over WebSockets.

---

## 7. Multi-Schedule Support
- Fabric supports multiple recurrence triggers per pipeline.
- `GET /api/workspaces/{workspace_id}/pipelines/{pipeline_id}/schedules` queries Fabric schedule endpoints.
- Displays all configured schedules with their recurrence rules (daily, weekly, hourly), timezone, enabled status, and next scheduled run time in `PipelineScheduleModal`.

---

## 8. Table Logs & Ingestion Telemetry
- Supports Lakehouse and Warehouse audit tables (Batch Header, Bronze Ingestion, Silver Ingestion).
- Admins configure table catalog and column mappings via `TableLogConfigPage`.
- Operational teams view ingestion lineage, batch IDs, row counts, execution durations, and error diagnostics in `TableLogsPage`.

---

## 9. FastAPI Clean Architecture Specification (Skill Aligned & next-fastapi-starter)
Adhering strictly to `.agents/skills/project-scaffold/references/fastapi-architecture.md` and `next-fastapi-starter/backend`:
```text
backend/app/
├── core/                        # Core system configurations, security & JWT
│   ├── config.py                # Environment variables & settings (Pydantic BaseSettings)
│   ├── security.py              # Password rules, validation, hashing
│   ├── tokens.py                # JWT creation, decode, token rotation & expiration
│   ├── permissions.py           # Pre-built Role-based access control guards
│   ├── rate_limit.py            # API rate limiting
│   ├── events.py                # Startup DB ping & connection management
│   ├── exceptions.py            # Global exception handlers
│   └── logging.py               # Enterprise logging formatters
├── db/                          # Database connection and base abstractions
│   ├── base.py                  # SQLAlchemy DeclarativeBase
│   ├── session.py               # Async engine and get_async_session generator
│   └── models_import.py         # Registers all models for Alembic migrations
├── modules/                     # Domain-driven feature packages (Router -> Service -> Repository -> Models)
│   ├── auth/                    # Pre-built JWT & Entra ID SSO workflows, refresh tokens
│   │   ├── router.py, service.py, schema.py, dependency.py, repository.py, models/
│   ├── users/                   # RBAC users, roles, and support assignments
│   │   ├── router.py, service.py, schema.py, repository.py, models/
│   ├── workspaces/              # Workspace catalog & access scoping
│   │   ├── router.py, service.py, schema.py
│   ├── pipelines/               # Parent-child pipeline runs, tree, history & schedules
│   │   ├── router.py, service.py, schema.py
│   ├── sla/                     # SLA thresholds, active incidents, resolution & watchdog
│   │   ├── router.py, service.py, schema.py
│   ├── table_logs/              # Lakehouse / Warehouse column mapping & audit logs
│   │   ├── router.py, service.py, schema.py
│   ├── diagnostics/             # Google Gemini 3.6 Flash root cause diagnostics
│   │   ├── router.py, service.py, schema.py
│   ├── directory/               # Entra ID Microsoft Graph directory user discovery
│   │   ├── router.py, service.py, schema.py
│   └── websocket/               # Real-time WebSocket room subscriptions
│       ├── router.py, connection_manager.py
├── services/                    # Autonomous engines & external clients
│   ├── leased_poller.py         # Adaptive dual-speed (3.5s/15s) differential poller
│   ├── alert_service.py         # SLA watchdog & Gmail SMTP alert dispatcher
│   ├── ai_diagnostic_service.py # Gemini 3.6 Flash failure analysis
│   ├── fabric_client.py         # Microsoft Fabric REST API client
│   ├── tree_builder.py          # Dynamic parent-child hierarchy assembler
│   ├── db_service.py            # SQLite WAL telemetry storage engine
│   └── directory_service.py     # Microsoft Graph directory service
├── shared/                      # Common reusable utilities & envelopes
│   ├── responses.py             # Standard ApiResponse(success, data, message, meta)
│   ├── pagination.py            # PageParams & PaginatedResponse utilities
│   └── constants.py             # System-wide constants
├── app_factory.py               # Application factory function (create_app)
└── main.py                      # Application bootstrap entry point
```


---

## 10. React (Vite) Feature-Based Architecture Specification (Skill Aligned)
Adhering strictly to `.agents/skills/project-scaffold/references/react-vite-architecture.md`:
```text
frontend/src/
├── components/
│   ├── layout/                  # Application shell & structural containers
│   │   ├── FabricSuiteBar.jsx   # Top Microsoft 365 / Fabric suite bar
│   │   ├── FabricNavRail.jsx    # Left icon rail navigation
│   │   └── FabricDetailSidePane.jsx # Right slide-over detail pane
│   └── shared/                  # Reusable domain-agnostic UI & Modals
│       ├── WorkspaceSelector.jsx
│       ├── FabricPeoplePicker.jsx
│       ├── DateFilterBar.jsx
│       ├── RunHistoryModal.jsx
│       ├── PipelineScheduleModal.jsx
│       ├── SchedulesDrawer.jsx
│       ├── SlaConfigModal.jsx
│       ├── ErrorDetailModal.jsx
│       └── ActivityList.jsx
├── features/                    # Self-contained business domains
│   ├── monitoring/              # Real-time pipeline monitoring hub
│   │   ├── components/
│   │   │   ├── PipelineTreeTable.jsx
│   │   │   ├── PipelineRow.jsx
│   │   │   ├── FabricMetricCards.jsx
│   │   │   ├── FabricCommandBar.jsx
│   │   │   └── DashboardHeader.jsx
│   │   └── index.js
│   ├── admin/                   # Admin console & RBAC management
│   │   ├── components/
│   │   │   ├── AdminConsole.jsx
│   │   │   ├── UsersPage.jsx
│   │   │   ├── PipelineTeamsPage.jsx
│   │   │   └── WorkspaceAssignmentPage.jsx
│   │   ├── api/
│   │   └── index.js
│   ├── table-logs/              # Lakehouse / Warehouse audit tables
│   │   ├── components/
│   │   │   ├── TableLogsPage.jsx
│   │   │   ├── TableLogConfigPage.jsx
│   │   │   ├── TableLogDashboardModal.jsx
│   │   │   └── TableLogConfigModal.jsx
│   │   └── index.js
│   └── auth/                    # Entra ID login & authentication
│       ├── components/
│       │   ├── AuthGate.jsx
│       │   └── LoginPage.jsx
│       ├── context/
│       │   └── AuthContext.jsx
│       ├── hooks/
│       │   └── useAuth.js
│       └── index.js
├── hooks/                       # Shared custom hooks
│   └── useWorkspaceMonitoring.js
├── services/                    # API clients & network utilities
├── App.jsx                      # App root router & layout integration
└── main.jsx                     # SPA bootstrap & MSAL provider
```
