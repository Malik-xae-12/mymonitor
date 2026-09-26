# Microsoft Fabric Real-Time Monitoring Hub — Backend

The backend of the Microsoft Fabric Real-Time Monitoring Hub is a high-performance, asynchronous REST & WebSocket service built on **FastAPI** and **SQLAlchemy 2.0 Async ORM**. It interfaces with the Microsoft Fabric REST API, executes direct SQL queries against Lakehouse/Warehouse delta tables via TDS/ODBC endpoints, manages real-time telemetry streaming over WebSockets, handles automated two-tier SLA incident alerting and watchdog escalation, and provides AI-powered error diagnostics via Google Gemini.

---

## Pure SQLAlchemy Async ORM Architecture

All internal application persistence operates exclusively through **SQLAlchemy 2.0 Async ORM** (`sqlite+aiosqlite:///./fabric_monitor.db` in WAL mode). The codebase enforces a **Zero Raw SQL Policy**:
- **Type-Safe Queries**: Relational joins, filters, and window subqueries use `select()`, `and_()`, `or_()`, and `subquery()`.
- **Atomic Bulk Upserts**: High-throughput writes utilize `sqlalchemy.dialects.sqlite.insert` with `on_conflict_do_update()`.
- **Eager Relationship Loading**: User and role hierarchies load cleanly via `selectinload()`.
- **Automated Verification**: Verified by automated test suite (`scratch/test_all_orm_functionality.py`) with 100% pass across all 7 operational domains.

---

## Architecture Overview

The backend strictly follows a **Modular Domain-Driven Architecture**. Every functional domain lives in its own directory under `app/modules/` and adheres to a predictable 5-part separation of concerns:

```
app/modules/<domain>/
├── router.py          # API route definitions, path/query validation, and dependency injection
├── service.py         # Business logic, orchestration, external APIs, background workers
├── repository.py      # Pure SQLAlchemy 2.0 Async ORM queries, transactions, and upserts (Zero Raw SQL)
├── schema.py          # Pydantic V2 models for request validation and response serialization
└── models/            # SQLAlchemy 2.0 DeclarativeBase database table definitions
```

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                  # ASGI entry point executed by Uvicorn
│   ├── app_factory.py           # Application factory, middleware, router mounting, workers
│   ├── core/                    # Core configuration, security, JWT tokens, rate limiting
│   ├── db/                      # SQLite database engine, WAL-mode sessions, and base mixins
│   ├── shared/                  # Shared cross-domain clients (Fabric REST API client)
│   └── modules/                 # Self-contained business domain modules (9 Core Modules)
│       ├── auth/                # Microsoft Entra ID SSO, JWKS key rotation, and session management
│       ├── diagnostics/         # AI failure analysis with Google Gemini Flash
│       ├── directory/           # Microsoft Graph API user and directory search
│       ├── pipelines/           # Data pipeline trees, runs, activities, and leased poller
│       ├── sla/                 # SLA monitoring, incident tracking, and SMTP email alerts
│       ├── table_logs/          # Lakehouse/Warehouse SQL delta table logs and stage KPIs
│       ├── users/               # Unified User Setup: users, RBAC roles (Admin, L1, L2), and workspace support team assignments
│       ├── websocket/           # WebSocket live streaming and workspace viewer tracking
│       └── workspaces/          # Workspace discovery, caching, and role-scoped filtering
├── fabric_monitor.db            # Local SQLite database (WAL mode)
└── requirements.txt             # Python dependencies
```

---

## Core System Folders

### 1. `app/core/` — Infrastructure & Security
Handles cross-cutting concerns required across all domain modules:

| File | Purpose |
| :--- | :--- |
| [`config.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/config.py) | Pydantic `BaseSettings` reading environment variables for Azure Entra ID, Fabric credentials, Google Gemini AI, SMTP mail servers, and database paths. |
| [`tokens.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/tokens.py) | Cryptographic JWT access and refresh token management (`HS256`). Generates access tokens, manages session expiration carryover, and directly deletes consumed, revoked, or expired refresh tokens from the database table in real-time. |
| [`security.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/security.py) | Cryptographic password hashing and verification using `passlib[bcrypt]`. |
| [`csrf.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/csrf.py) | CSRF security utilities and header validations. |
| [`events.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/events.py) | Application lifecycle event handlers executed on startup and shutdown. |
| [`permissions.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/permissions.py) | Role-Based Access Control (RBAC) permission helpers and role constants. |
| [`rate_limiter.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/rate_limiter.py) | Global SlowAPI rate limiter setup protecting sensitive auth and AI diagnosis endpoints. |
| [`logging.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/core/logging.py) | Centralized structured logging formatters. |

---

### 2. `app/db/` — Database Engine & Persistence
Manages the local SQLite database (`fabric_monitor.db`) operating with Write-Ahead Logging (WAL) for concurrent read-heavy operations:

| File | Purpose |
| :--- | :--- |
| [`session.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/db/session.py) | Asynchronous SQLAlchemy session factory (`async_session_maker`), `aiosqlite` path resolver, and database initialization (`init_db`) ensuring WAL pragmas and schema creation. |
| [`base.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/db/base.py) | Declarative ORM Base class from which all models inherit. |
| [`mixins.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/db/mixins.py) | Common model mixins providing standardized `id`, `created_at`, and `updated_at` columns. |
| [`models_import.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/db/models_import.py) | Central registry importing all ORM entities to ensure SQLAlchemy detects table definitions on startup. |

---

### 3. `app/shared/` — Cross-Domain Clients
Reusable external communication clients:

| File | Purpose |
| :--- | :--- |
| [`clients/fabric_client.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/shared/clients/fabric_client.py) | Asynchronous HTTP client wrapping the Microsoft Fabric REST API (`https://api.fabric.microsoft.com/v1`). Acquires Azure AD OAuth2 bearer tokens via Service Principal client credentials, manages in-memory token expiry, and exposes typed methods for querying workspaces, pipelines, execution instances, and activities. |
| [`constants.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/shared/constants.py) | System-wide constants, default fallback names, and pagination limits. |

---

## Domain Modules (`app/modules/`)

### 1. `pipelines` — Pipeline Telemetry & Hierarchical Trees
The primary telemetry module responsible for ingesting, structuring, and serving pipeline execution runs.

- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/pipelines/service.py):
  - **`HierarchyTreeBuilder`**: Transforms flat pipeline runs and nested activities into a parent-child execution tree. Resolves child pipeline executions invoked via `ExecutePipeline` activities.
  - **`LeasedWorkspacePoller`**: An intelligent background polling engine that continuously syncs pipeline runs from Fabric **only for workspaces that currently have active viewers** (via WebSocket leases). Automatically relaxes polling frequency when idle and scales up for active runs.
  - **`PipelineService`**: High-level facade orchestrating snapshot generation, date-filtered queries, run history, and schedule forecasts.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/pipelines/repository.py): Local SQLite persistence for pipelines, pipeline runs, granular activity executions, and trigger schedule rules. Flags parent (`is_master = 1`) vs. dynamically invoked child pipelines (`is_master = 0`).
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/pipelines/router.py):
  - `GET /api/workspaces/{id}/pipelines`: List all Data Pipelines in workspace.
  - `GET /api/workspaces/{id}/pipelines/snapshot`: Live hierarchical execution tree with date filtering.
  - `GET /api/workspaces/{id}/pipelines/{pid}/history`: Full chronological execution history.
  - `GET /api/workspaces/{id}/pipelines/schedules`: Workspace-wide schedule configurations and next execution times.
  - `GET /api/workspaces/{id}/pipelines/assignments`: Parent pipelines with assigned L1/L2 support engineers.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/pipelines/schema.py): Data models for `PipelineRun`, `ActivityRun`, and `WorkspaceSnapshotResponse`.

---

### 2. `workspaces` — Live Workspace Discovery & Role Scoping
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/workspaces/service.py): Queries Microsoft Fabric REST API live for accessible workspaces, eliminating redundant local database tables and preventing cache staleness. Enriches workspaces with representative SLA assignment summaries from `sla_configs`. Scopes workspaces based on whether the caller is an Administrator or an assigned L1/L2 engineer.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/workspaces/repository.py): Lightweight pass-through delegating RBAC scoping queries directly to `sla_repository`.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/workspaces/router.py): `GET /api/workspaces`.

---

### 3. `auth` — Authentication, Entra ID SSO & JWT Lifecycle
- [`dependency.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/auth/dependency.py):
  - **`_get_signing_key` & `_decode_entra_token`**: Validates RS256 tokens from Microsoft Entra ID using dynamic JWKS key retrieval. Features automatic retry and cache invalidation if Microsoft rotates or expires signing keys.
  - **`get_current_user`**: Validates the bearer token, records login telemetry, queries user RBAC status via `users_service.resolve_access`, and attaches both `assigned_workspace_ids` and `assigned_pipeline_ids`.
  - **`require_admin`**: Endpoint guard enforcing Administrator privileges.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/auth/router.py):
  - `POST /api/auth/entra-id/exchange`: Exchanges a Microsoft Entra ID token for a local JWT access and refresh token pair.
  - `POST /api/auth/jwt/refresh`: Rotates the refresh token (maintaining original session expiry) and issues a fresh access token.
  - `POST /api/auth/jwt/logout`: Revokes and deletes user refresh tokens from the database.
  - `GET /api/auth/me`: Returns caller's profile, role, scoped workspaces, and scoped pipeline IDs.
  - `GET /api/auth/my-assignments`: Returns pipeline-level SLA assignments where caller is L1 or L2 engineer.
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/auth/service.py): FastAPI-Users authentication manager and password verification backend.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/auth/repository.py): User lookups by email and Entra ID Object ID (`oid`).
- [`models/refresh_token.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/auth/models/refresh_token.py): `refresh_token` table mapping.

---

### 4. `users` — Unified User Setup, Roles & Pipeline-Level SLA Assignments
The authoritative domain module managing all user lifecycles, security roles, Entra ID directory synchronizations, and pipeline-level L1/L2 SLA assignments (consolidating administrative user setup into one cohesive module).

- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/users/service.py):
  - **User Lifecycle & Sync**: Manages user accounts, assigns roles (`admin`, `l1`, `l2`), records login timestamps, and bootstraps default system roles and admin accounts from settings.
  - **Access & Role Resolution**: `resolve_access(email)` determines effective role (`admin`, `l1`, `l2`, `none`), admin boolean flag, scoped workspace IDs, and specific assigned pipeline IDs from `sla_configs`.
  - **Pipeline-Level SLA Assignments**: Manages L1 and L2 support engineer assignments per pipeline (`list_all_assignments`, `list_assignments_for_user`), including SLA warning and escalation breach thresholds.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/users/repository.py): Pure SQLAlchemy 2.0 Async ORM database operations for `users`, `roles`, and `user_roles` tables (`selectinload`, `sqlite_upsert`).
- [`models/`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/users/models): DeclarativeBase entities for `User`, `Role`, and `UserRole`.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/users/router.py):
  - `GET /api/admin/assignments`: List all pipeline-level SLA assignments across all workspaces.
  - `GET /api/admin/users`: List registered platform users and available roles.
  - `POST /api/admin/users`: Add or update directory user with support role (`l1` or `l2`).
  - `POST /api/admin/users/role`: Update user support role.
  - `DELETE /api/admin/users/{email}`: Remove support user from team roster.
  - `GET /api/roles`: Retrieve all configurable support roles.
  - `/api/users`: FastAPI-Users profile and self-management endpoints.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/users/schema.py): Unified schemas for `UserProfile` (including `assigned_pipeline_ids`), `UserResponse`, `RoleResponse`, `AddUserRequest`, `SetRoleRequest`, `UsersListResponse`, and `SlaAssignment`.

---

### 6. `sla` — Service Level Agreements & Multi-Tier Alert Escalation
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/sla/service.py):
  - **`AlertService`**: Background watchdog loop running every 5 seconds. Evaluates active incidents:
    - **Tier 1 (Failure)**: Creates `ACTIVE` incident, dispatches immediate HTML alert to assigned L1 engineer via SMTP, and broadcasts `INCIDENT_CREATED`.
    - **Tier 2 (SLA1 Breach)**: When `now_utc >= sla1_target`, escalates status to `ESCALATED_L2`, sends urgent escalation HTML email to L2 lead, and broadcasts `SLA_BREACHED`.
    - **Tier 3 (SLA2 Breach)**: When `now_utc >= sla2_target`, escalates status to `CRITICAL_UNRESOLVED`, dispatches critical alert HTML email to **both L1 and L2 leads**, and broadcasts `SLA2_BREACHED`.
    - **Automated Reminders**: Repeats reminder alert emails every 30 minutes for active `CRITICAL_UNRESOLVED` incidents until resolved.
  - **`SlaService`**: Saves pipeline-level SLA configs and assignee details (`save_sla_config` with `pipeline_name` and `assigned_by`), incident lifecycle management (acknowledging and resolving incidents), and test alert dispatching.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/sla/repository.py): Persistence for `sla_configs` (single source of truth for L1/L2 assignments with `pipeline_id` PK) and `sla_incidents`. Exposes `get_assigned_workspace_ids_for_user`, `get_assigned_pipeline_ids_for_user`, and `get_all_unresolved_incidents`.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/sla/router.py):
  - `GET /api/workspaces/{workspace_id}/pipelines/{pipeline_id}/sla`: Retrieve SLA thresholds.
  - `POST /api/workspaces/{workspace_id}/pipelines/{pipeline_id}/sla`: Save SLA thresholds, pipeline name, and assignees.
  - `GET /api/workspaces/incidents`: List all unresolved SLA incidents across the tenant.
  - `POST /api/workspaces/incidents/{incident_id}/resolve`: Mark incident as resolved.
  - `POST /api/workspaces/{workspace_id}/pipelines/{pipeline_id}/test-email`: Verify SMTP deliverability.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/sla/schema.py): Data models for `SlaConfigPayload` (including `pipelineName`, `assignedBy`), `IncidentResolveRequest`, and `TestEmailRequest`.

---

### 7. `table_logs` — Lakehouse & Warehouse SQL Delta Telemetry
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/table_logs/service.py):
  - Discovers Lakehouses and Warehouses inside Fabric workspaces (including nested workspace folders).
  - Connects to SQL Analytics Endpoints via `pyodbc` using Azure Active Directory Service Principal authentication.
  - Queries `INFORMATION_SCHEMA.TABLES` and `INFORMATION_SCHEMA.COLUMNS` to assist users in mapping custom delta log tables.
  - Queries custom batch header and step detail tables to compute load KPIs (total tables loaded, success/fail counts, average duration, rows processed) across Bronze and Silver layers.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/table_logs/repository.py): Stores workspace-to-table column mappings in SQLite (`table_log_mappings`).
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/table_logs/router.py):
  - `GET /api/workspaces/{id}/table-logs/data-artifacts`: Discover Lakehouses & Warehouses.
  - `GET /api/workspaces/{id}/table-logs/schemas-and-tables`: List user schemas and tables.
  - `GET /api/workspaces/{id}/table-logs/columns`: Get table columns and data types.
  - `GET /api/workspaces/{id}/table-logs/mapping`: Get saved column mapping.
  - `POST /api/workspaces/{id}/table-logs/mapping`: Save column mapping.
  - `GET /api/workspaces/{id}/table-logs`: Query aggregated KPIs and batch details.
  - `GET /api/workspaces/{id}/table-logs/preview`: Preview top N rows from target table.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/table_logs/schema.py): Column mapping, preview, and batch log telemetry schemas.

---

### 8. `diagnostics` — AI Failure Analysis (Google Gemini Flash)
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/diagnostics/service.py):
  - Analyzes pipeline and activity execution error messages using Google Gemini 3.6 Flash.
  - **Security Sanitization**: Redacts passwords, connection strings, tokens, and secrets from error messages before sending to Gemini.
  - **Fingerprint Hashing**: Computes deterministic MD5 hashes of sanitized error messages to query a local SQLite cache first, avoiding redundant LLM API calls and costs for recurring errors.
- [`repository.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/diagnostics/repository.py): Caches AI diagnosis responses keyed by error hash.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/diagnostics/router.py):
  - `POST /api/diagnostics/diagnose`: Analyze pipeline activity failure.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/diagnostics/schema.py): Diagnosis request and structured analysis response models.

---

### 9. `directory` — Microsoft Graph Enterprise User Search
- [`service.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/directory/service.py): Connects to Microsoft Graph API (`https://graph.microsoft.com/v1.0/users`) using client credentials to provide user search and email autocomplete for L1/L2 team assignment.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/directory/router.py): `GET /api/directory/users/search`.
- [`schema.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/directory/schema.py): Directory user model.

---

### 10. `websocket` — Real-Time Client Streaming
- [`connection_manager.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/websocket/connection_manager.py): Tracks active client WebSocket connections per workspace ID. Provides broadcast capabilities for pipeline run status updates and SLA incident alerts.
- [`router.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/modules/websocket/router.py): WebSocket endpoint at `/ws/{workspace_id}`. Registers active leases with `LeasedWorkspacePoller` when viewers connect and releases leases upon disconnection.

---

## Application Factory & Bootstrapping

- **[`backend/app/app_factory.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/app_factory.py)**:
  1. Initializes the FastAPI app with title and metadata.
  2. Configures CORS middleware allowing configured frontend origins.
  3. Registers SlowAPI rate-limiting state.
  4. Automatically mounts all 9 domain routers under the root and `/api` prefix.
  5. Connects WebSocket endpoints.
  6. Configures application lifecycle event handlers:
     - Initializes SQLite database schema in WAL mode.
     - Seeds system default roles (`admin`, `l1`, `l2`).
     - Starts `alert_service` (SLA watchdog timer).
     - Starts `leased_poller` (background workspace poller).
- **[`backend/app/main.py`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/backend/app/main.py)**: Exposes `app = create_app()` for ASGI servers.
