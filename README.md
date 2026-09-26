# Microsoft Fabric Real-Time Monitoring Hub

An enterprise-grade monitoring, alerting, and observability platform for **Microsoft Fabric Data Pipelines** and **Lakehouse/Warehouse Delta Tables**. Provides real-time hierarchical execution tracking, automated SLA breach escalation, AI failure remediation via Google Gemini, Microsoft Entra ID single sign-on, and a **pure SQLAlchemy 2.0 Async ORM** backend architecture.

---

## Repository Structure

The project is structured as a full-stack application following modular clean architecture on the backend and feature-based architecture on the frontend:

```
mymonitor/
├── backend/                  # FastAPI asynchronous REST & WebSocket service (Modular Clean Architecture)
│   ├── app/
│   │   ├── core/             # Configuration, JWT security, logging, and lifecycle hooks
│   │   ├── db/               # SQLAlchemy async engine, sessionmaker, base models, models aggregator
│   │   ├── shared/           # Shared clients (Fabric REST API client, constants)
│   │   └── modules/          # 10 domain modules (pipelines, auth, sla, workspaces, users, table_logs, etc.)
│   │       └── <module>/     # router.py -> service.py -> repository.py -> models/ & schema.py
│   ├── fabric_monitor.db     # SQLite persistence cache (WAL mode)
│   ├── requirements.txt      # Python dependencies
│   └── README.md             # Detailed Backend Architecture Documentation
│
├── frontend/                 # React 18 + Vite single-page application (Feature-Based Architecture)
│   ├── src/
│   │   ├── config/           # MSAL authentication and environment configuration
│   │   ├── services/         # Authenticated Axios HTTP client with token injection & endpoints
│   │   ├── components/       # Atomic design system (ui/) and composite shared layout components
│   │   └── features/         # Feature domains (monitoring, auth, tableLogs, admin, users)
│   ├── package.json          # Node.js dependencies
│   └── README.md             # Detailed Frontend Architecture Documentation
│
├── docs/                     # Comprehensive Engineering & Architecture Documentation Suite
│   ├── PRD.md                # Product Requirements Document (Personas, Requirements, Acceptance Criteria)
│   ├── ARCHITECTURE.md       # High-Level Architecture, Leased Poller, Tree Engine, RBAC, ORM Models
│   ├── DESIGN.md             # UI/UX Design System, Color Tokens, Components, Responsive Breakpoints
│   ├── RULES.md              # Coding Standards, Pure ORM Policy, Modular Clean Architecture Rules
│   ├── TASKS.md              # Phased Implementation Tasks (100% Completed & Verified)
│   ├── DECISIONS.md          # Architectural Decision Records (ADR-001 through ADR-007)
│   ├── MEMORY.md             # Current System State, Active Capabilities, Verified Test Results
│   ├── TEST_PLAN.md          # Quality Assurance Matrices, Test Suites, Responsive Verification
│   └── SECURITY.md           # Entra ID Authentication, RBAC Scoping, SQL Injection Prevention
│
└── README.md                 # Project Overview & Quick Start Guide
```

---

## Detailed Project Documentation Suite (`docs/`)

The repository contains an exhaustive documentation suite structured according to the **Vibe Coding: Beginner-to-Production** workflow:

| Document | Purpose |
|---|---|
| 📖 **[PRD.md](docs/PRD.md)** | Full Product Requirements Document detailing problem statement, user personas (`admin`, `l1`, `l2`), functional requirements (FR-1 to FR-8), NFRs, and acceptance criteria. |
| 🏗️ **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Deep architectural specifications: adaptive dual-speed leased polling, permanent terminal state caching, re-run handling lifecycle, dynamic child pipeline detection, two-tier SLA engine, and SQLAlchemy ORM models. |
| 🎨 **[DESIGN.md](docs/DESIGN.md)** | UI/UX design tokens, Microsoft Fabric Fluent 2 Light System (#faf9f8 canvas, #ffffff cards, #0f6cbd brand, no dark mode), live stopwatch timer, component specs, and responsive rules. |
| 📏 **[RULES.md](docs/RULES.md)** | Enforced engineering rules: Zero Raw SQL Policy, strict 4-layer discipline (`router` ➔ `service` ➔ `repository` ➔ `models`), mandatory docstrings, and Pydantic validation. |
| ✅ **[TASKS.md](docs/TASKS.md)** | Complete phased implementation checklist across 12 engineering phases, with 100% of capabilities verified and marked complete. |
| ⚖️ **[DECISIONS.md](docs/DECISIONS.md)** | Architectural Decision Records (ADRs) covering Entra ID JWKS key rotation, dual-speed leased polling, pure SQLAlchemy Async ORM migration, dynamic tree building, and SLA escalation. |
| 🧠 **[MEMORY.md](docs/MEMORY.md)** | Persistent active project state, active guarantees, runtime health evidence, and automated test outputs. |
| 🧪 **[TEST_PLAN.md](docs/TEST_PLAN.md)** | Comprehensive test suites (TC-AUTH, TC-WS, TC-PIPE, TC-POLL, TC-SLA, TC-SCHED, TC-LOG, TC-AI) and responsive testing matrices. |
| 🛡️ **[SECURITY.md](docs/SECURITY.md)** | Microsoft Entra ID OpenID Connect / OAuth 2.0 PKCE, role-based authorization, SQL injection elimination via ORM parameter binding, and secret redaction. |

---

## Core Capabilities & How Cases Are Handled

### 1. Dynamic Live Workspace Discovery & Pipeline-Level Role Scoping
- **Live Discovery**: Workspaces are queried directly from Microsoft Fabric via `/v1/workspaces` live (eliminating redundant local tables and avoiding cache staleness when workspaces are added or permissions change).
- **Workspace Scoping**: Administrators see all tenant workspaces; L1 and L2 support engineers see strictly the workspaces where they are assigned to at least one pipeline.
- **Pipeline-Level Scoping**: When an L1 or L2 engineer opens a workspace, they strictly see **only the specific pipelines assigned to them** (`assigned_pipeline_ids`), preventing visibility of unassigned pipelines.

### 2. Hierarchical Pipeline Tree & Dynamic Parent/Child Detection
- **Master Pipelines (`is_master = 1`)**: Rendered at root level with expandable carets (`ChevronRight` / `ChevronDown`).
- **Child Pipelines (`is_master = 0, is_child = 1`)**: Dynamically discovered by inspecting `ExecutePipeline` activities (`output.pipelineRunId`), recursively fetching child activities, and embedding inside `activity["childPipeline"]`.
- **Zero Orphan Rows**: Automatically flagged so child pipelines **never appear as duplicate orphan rows at the root level**.

### 3. Adaptive Dual-Speed Leased Poller & In-Flight Re-Run Handling
- **Leased Polling**: Only workspaces actively viewed by connected browser clients via WebSockets are polled. Unviewed workspaces consume zero API calls.
- **Dual Speeds**:
  - **Active Speed (3.5s)**: Triggered when at least 1 pipeline is running (`InProgress`), streaming live stopwatch duration updates.
  - **Idle Speed (15.0s)**: Automatically activated when all pipelines are in terminal states, cutting API calls by **80%**.
- **Permanent Terminal Caching**: Terminal runs (`Completed`, `Failed`, `Cancelled`) are frozen in SQLite; 0 activity API calls are made during idle checks.
- **Succeeded Pipeline Re-Runs**: When a succeeded pipeline is re-run, Fabric issues a brand-new GUID Job Instance. The poller detects the new instance, compares start timestamps via ORM subquery (`latest_sub`), bypasses cache, immediately streams the spinning blue **`In progress`** status badge to the UI, and updates duration live.

### 4. Multi-Tier SLA Alerting & Automated Watchdog Escalation
- **Unified SLA Configuration**: All L1/L2 assignments and thresholds are consolidated into a single `sla_configs` table (`pipeline_id` as primary key).
- **Tier 1 (L1 Alert)**: When a pipeline execution fails, an incident is registered in `sla_incidents` (`status = 'ACTIVE'`), breach target is calculated, an automated HTML diagnostic email is dispatched to the L1 assignee via SMTP, and `INCIDENT_CREATED` is broadcast over WebSockets.
- **Tier 2 (SLA1 Breach - L2 Escalation)**: A background watchdog monitors active incidents every 5 seconds. If `now_utc >= sla_target_time`, status transitions to `ESCALATED_L2`, an urgent escalation email is dispatched to the senior L2 lead, and an `SLA_BREACHED` WebSocket notification is broadcast.
- **Tier 3 (SLA2 Breach - Critical Escalation)**: If an incident remains unresolved when the SLA2 threshold expires, status transitions to `CRITICAL_UNRESOLVED`, an urgent escalation alert is dispatched to **both L1 and L2 leads** (`[🚨 CRITICAL - SLA2 BREACHED]`), and an `SLA2_BREACHED` WebSocket alert is broadcast.
- **Recurring Reminders**: Active `CRITICAL_UNRESOLVED` incidents trigger automated reminder emails sent to both leads every 30 minutes until manually acknowledged and resolved.
- **UI & Resolution**: Pulsing `🚨 SLA2 BREACHED (+Xm)` badge with one-click resolution. Operators acknowledge and resolve incidents, recording the resolver and timestamp for audit logs.

### 5. Multi-Schedule Management & Forecasting
- Ingests multiple independent triggers per pipeline from Fabric `/schedules`.
- Displays recurrence patterns (Daily, Weekly, Cron), active execution days, local timezone, and calculated next run countdowns in a dedicated modal.

### 6. Lakehouse & Warehouse Ingestion Lineage
- Connects directly to Fabric Lakehouse/Warehouse SQL Endpoints via T-SQL (`pyodbc`).
- Lineage across Batch Header, Bronze, and Silver Delta tables.
- Displays batch duration, source files, target Delta tables, and row-level throughput (Rows Read, Inserted, Updated, Rejected).

### 7. AI-Powered Root-Cause Diagnostics
- Powered by Google Gemini 1.5 Pro.
- Analyzes error message, failure code, activity type, and raw stack traces.
- Caches diagnoses via deterministic error fingerprint hashes (`AIErrorDiagnostic`) to serve repeat errors instantaneously.

### 8. Pure SQLAlchemy Async ORM Data Layer
- 100% of internal application tables are managed via **SQLAlchemy 2.0 Async ORM**.
- **Consolidated Tables**: Legacy `workspaces` table eliminated in favor of live Fabric discovery; `workspace_assignments` merged cleanly into `sla_configs`.
- **Zero raw SQL**: Parameterized expressions, `sqlite_upsert`, `selectinload`, and clean repository abstractions.

---

## Quick Start & Verification

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Microsoft ODBC Driver 17 or 18 for SQL Server (for Lakehouse/Warehouse queries)

### 2. Backend Setup
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Backend will be available at: `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev -- --port 3000
```
Frontend will be available at: `http://localhost:3000`.

### 4. Running the Automated ORM Test Suite
Execute the comprehensive end-to-end ORM test suite verifying all 7 backend domains:
```powershell
cd backend
.\venv\Scripts\python.exe scratch/test_all_orm_functionality.py
```
**Output**: `ALL ORM TESTS PASSED SUCCESSFULLY! 100% WORKING`
