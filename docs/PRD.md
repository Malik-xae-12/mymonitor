# Product Requirements Document (PRD)

**Product:** Microsoft Fabric Real-Time Job Monitoring, AI Diagnostics & SLA Alerting Hub  
**Status:** Production  
**Last Updated:** 2026-09-25  

---

## 1. Problem Statement
Enterprise data platforms running on Microsoft Fabric Data Factory lack unified operational visibility:
- **High Latency & Slow Telemetry**: Native Fabric monitoring is slow, requiring manual browser refreshes without real-time sub-second duration ticking.
- **API Throttling Risks**: Repeatedly polling all historical pipeline activities exhausts Fabric REST API quotas, triggering HTTP 429 errors.
- **Cluttered Visual Hierarchy**: Sub-pipelines invoked by master pipelines are displayed as duplicate orphan root rows in native views.
- **Lack of Granular SLA & Alerting**: No automated multi-tier escalation (L1 warning countdown vs. L2 management breach) or instant incident dispatch via email.
- **No Consolidated Ingestion Lineage**: Operators cannot correlate pipeline runs with Lakehouse/Warehouse table audit telemetry (Batch Header → Bronze → Silver).
- **Missing Role-Based Scoping**: L1 and L2 support leads see everything rather than being restricted to the workspaces and pipelines they are responsible for.

---

## 2. Target Personas
- **Admin**: Platform architects and team leads who manage users, assign L1/L2 ownership per workspace and pipeline, configure SLA thresholds, and map Lakehouse audit tables.
- **L1 Support Lead**: Operations engineers who monitor active runs, respond to failure alerts, review AI diagnostics, and resolve incidents.
- **L2 Escalation Owner**: Senior engineers or managers who receive escalations when incidents exceed warning thresholds (SLA 1 breach).

---

## 3. Core Functional Capabilities

### A. Parent-Child Pipeline Hierarchy
- **Master Pipelines (`is_master = 1`)**: Independent pipelines rendered at the root level of the Monitoring Hub.
- **Nested Sub-pipelines (`is_child = 1`)**: When a master pipeline executes an `ExecutePipeline` or `InvokePipeline` activity, the child pipeline run is dynamically discovered and nested inside `activity.childPipeline`.
- **Zero Orphan Rows**: Child pipelines are never rendered as duplicate top-level rows.

### B. Run History & AI Diagnostics
- **Full Run History**: Chronological modal displaying all historical runs for any selected pipeline.
- **Activity Telemetry**: Expandable activity runs showing type, status, start/end timestamps, and duration.
- **AI Diagnostics**: Google Gemini-powered error analysis parsing error codes, failure reasons, and stack traces into actionable root causes and step-by-step remediation, cached by error hash in SQLite to prevent duplicate token costs.

### C. Multi-Schedule Management
- **Multiple Triggers per Pipeline**: If a pipeline has multiple schedules (e.g. daily batch + hourly incremental), all schedules are surfaced.
- **Schedule Details**: Displays recurrence frequency, days, times, timezones, enabled status, and exact next run times.

### D. Lakehouse & Warehouse Ingestion Table Logs
- **3-Tier Batch Lineage**: Batch Header Table ➔ Bronze Ingestion Table ➔ Silver Ingestion Table.
- **Audit Metrics**: Batch IDs, source paths, destination tables, rows read, inserted, updated, rejected, execution durations, and error diagnostics.

### E. Admin Console
- **Tab 1: Users & Support Personnel**: Add and manage directory users from Entra ID; assign roles (`admin`, `l1`, `l2`).
- **Tab 2: Pipeline L1/L2 Teams & SLA**: Select any workspace, view all parent pipelines, assign dedicated L1 and L2 personnel, and set SLA 1 (Warning) and SLA 2 (Breach) times.
- **Table Configuration Wizard**: Configure Lakehouse/Warehouse table catalog and column mappings.

### F. Automated Alerting Engine
- **Failure Notification**: On pipeline failure, an incident is created in `sla_incidents` (`ACTIVE`) and an automated HTML alert email is dispatched to the configured `l1_email`.
- **SLA Escalation**: If an incident is not resolved within `sla1_minutes`, the SLA watchdog updates status to `ESCALATED_L2`, sends an escalation email to `l2_email`, and broadcasts an `SLA_BREACHED` alert over WebSockets.
- **Incident Resolution**: 1-click incident resolution in the UI, stamping resolver identity and timestamp.

### G. Role-Based Access Control (RBAC) & View Isolation
- **Admin**: Views all workspaces and all pipelines across the tenant. Access to Admin Console and Table Mapping configuration.
- **L1 Support**: Strictly scoped. Only sees workspaces where they are assigned as L1 (in `workspace_assignments` or on any pipeline in `sla_configs`). Inside each workspace, only sees pipelines where `l1Email == user.email`. Metric cards compute only over their assigned pipelines. Admin Console and Table Mapping are hidden.
- **L2 Support**: Strictly scoped. Only sees workspaces where they are assigned as L2. Inside each workspace, only sees pipelines where `l2Email == user.email`. Admin Console and Table Mapping are hidden.

### H. Adaptive Leased Polling & Re-run Detection
- **Leased Poller**: Active polling only runs for workspaces with connected WebSocket viewers. If 0 viewers, polling stops (0 API calls).
- **Terminal Run Caching**: When a run completes, fails, or cancels, its activity graph is frozen in SQLite. Future checks skip activity API calls (<15ms UI response).
- **In-Flight Re-run Detection**: When a pipeline is re-run, Fabric generates an immutable job instance with a new GUID Run ID in status `InProgress`. The poller detects the new ID, immediately selects it as the active run via latest start timestamp, and streams live updates.
- **Adaptive Dual-Speed Polling**:
  - **Active Mode (3.5s)**: When at least one pipeline is `InProgress`, polls every 3.5s for live progress.
  - **Idle Mode (15.0s)**: When all pipelines are in terminal states (`Completed`, `Failed`), relaxes polling to 15s.
  - **Differential Pipeline Polling**: When 2 pipelines are running and 3 are succeeded, the 2 running pipelines are polled every 3.5s, while the 3 succeeded pipelines are checked only every 15s (with 0 activity calls).

---

## 4. Architectural Principles
- **Backend**: FastAPI modular clean architecture (Router $\rightarrow$ Service $\rightarrow$ Repository $\rightarrow$ Models) with dedicated `core/` (config, security, tokens), `shared/` (`ApiResponse`, pagination, constants), and domain `modules/`.
- **Frontend**: React 19 + Vite 8 feature-based architecture (`features/{monitoring,admin,table-logs,auth}`, `components/{layout,shared}`).
- **Zero Overhead**: Minimal memory footprint, no redundant code, strictly separated presentation and domain logic.
