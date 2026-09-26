# Microsoft Fabric Real-Time Monitoring Hub — Product Requirements Document (PRD)

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Approved & Implemented  

---

## 1. Product Vision & Executive Purpose

The **Microsoft Fabric Real-Time Monitoring Hub** is an enterprise operational observatory built to deliver unified, real-time observability, automated two-tier SLA escalation, and AI-powered root-cause remediation for data engineering workloads running across Microsoft Fabric.

In enterprise data environments, Microsoft Fabric executes hundreds of complex data pipelines across multiple workspaces. The standard Fabric monitoring portal suffers from three critical operational deficiencies:
1. **Visual Clutter & Disconnected Hierarchy**: Child pipelines invoked via `ExecutePipeline` activities appear as duplicate orphan rows at the root level, obscuring the true operational structure.
2. **API Rate Limiting & Lag**: Constant polling against Fabric APIs triggers HTTP 429 throttling, resulting in stale execution statuses and delayed failure detection.
3. **Absence of SLA Escalation & Multi-Tier Alerting**: Enterprise operations require strict SLAs with immediate L1 alerting and automatic L2 escalation upon breach. Fabric offers only basic email notifications without incident lifecycle management or breach countdowns.

The Monitoring Hub solves these pain points by providing an intelligent, cached, real-time tree hierarchy with automated multi-tier alerting and deep Lakehouse/Warehouse ingestion lineage.

---

## 2. Target Personas & User Roles

| Persona | Role Identifier | Goals & Pain Points | Key Platform Capabilities |
|---|:---:|---|---|
| **Data Platform Administrator** | `admin` | Needs centralized visibility across all tenant workspaces, manages user roles, configures workspace SLA defaults, and sets up delta table audit mappings. | Full tenant workspace access, Admin Console, User & Role management, Lakehouse Column Mapping, SLA editing. |
| **L1 Operations Support Lead** | `l1` | First responder to pipeline failures. Needs an uncluttered view of only assigned pipelines, instant failure alerts, stopwatch execution timers, and rapid AI-assisted root-cause diagnosis. | Scoped workspace & pipeline views, L1 failure alerts with raw log traces, Gemini AI diagnostics, incident resolution. |
| **L2 Escalation Owner** | `l2` | Senior engineer responsible for SLA compliance and resolving complex system failures when L1 fails to resolve an incident within the agreed SLA window. | Scoped pipeline views, Urgent L2 escalation emails with overdue breach timers, SLA breach alerts, deep historical telemetry. |

---

## 3. Core Functional Requirements

### 3.1 Dynamic Workspace Discovery & Role-Based Scoping
- **FR-1.1**: The platform must query Microsoft Fabric APIs (`/v1/workspaces`) and cache all accessible workspaces in local SQLite persistence.
- **FR-1.2**: Workspace listing must be role-scoped:
  - Administrators see all tenant workspaces.
  - L1 and L2 users see strictly the workspaces to which they are assigned via workspace assignments or pipeline SLA configurations.
- **FR-1.3**: Cached workspaces must be retrieved in **<15ms** to guarantee instant workspace switching in the frontend dropdown.

### 3.2 Hierarchical Pipeline Tree & Dynamic Parent/Child Detection
- **FR-2.1**: Master pipelines (`is_master = 1`) must render at the root level of the table with expandable carets (`ChevronRight` / `ChevronDown`).
- **FR-2.2**: Child pipelines invoked by `ExecutePipeline` activities must be detected dynamically via activity outputs (`output.pipelineRunId`) and nested strictly inside the parent activity (`activity["childPipeline"]`).
- **FR-2.3**: Child pipelines must be flagged (`is_master = 0`) to guarantee they **never appear as duplicate orphan rows at the root level**.
- **FR-2.4**: Expanding a parent row reveals all inner activities (Copy, Notebook, Dataflow, Web, ExecutePipeline) with individual status badges, start/end timestamps, durations, and error diagnostics.

### 3.3 Adaptive Dual-Speed Leased Poller & WebSocket Push
- **FR-3.1**: Polling must be **leased**: only workspaces actively viewed by at least one connected browser client via WebSockets are polled. Unviewed workspaces consume zero API calls.
- **FR-3.2**: The poller must operate at **dual speeds**:
  - **Active Speed (3.5s)**: Triggered when at least 1 pipeline in the workspace is `InProgress`, streaming live stopwatch duration updates.
  - **Idle Speed (15.0s)**: Automatically activated when all pipelines are in terminal states, cutting API calls by **80%**.
- **FR-3.3**: Terminal runs (`Completed`, `Failed`, `Cancelled`) must be permanently cached in SQLite. Poller skips fetching activities for cached runs, hitting Fabric only for lightweight status checks.
- **FR-3.4**: When a previously succeeded pipeline is re-run, the system must immediately detect the new GUID Job Instance, bypass cache, stream `InProgress` status, and replace the old run row in the primary view while preserving the old run in Run History.

### 3.4 Multi-Tier SLA Engine & Automated Escalation
- **FR-4.1**: Admins configure `sla1_minutes` (L1 threshold) and `sla2_minutes` (L2 threshold) per pipeline, along with responsible engineer emails and names in `sla_configs`.
- **FR-4.2**: When a pipeline run fails, the system must:
  - Register an incident in `sla_incidents` (`status = 'ACTIVE'`).
  - Calculate `sla_target_time = failed_at + sla1_minutes`.
  - Dispatch a rich HTML alert email to the L1 assignee via SMTP containing error codes, error targets, and formatted log traces.
  - Broadcast `INCIDENT_CREATED` over WebSockets.
- **FR-4.3**: A background SLA watchdog loop must inspect active incidents every 5 seconds. If `now_utc >= sla_target_time`:
  - Update status to `ESCALATED_L2`.
  - Calculate exact overdue minutes.
  - Dispatch an urgent escalation HTML email to the L2 assignee with a pulsating red warning banner.
  - Broadcast `SLA_BREACHED` over WebSockets.
- **FR-4.4**: If an incident remains unresolved past the SLA2 window (`now_utc >= failed_at + sla2_minutes`):
  - Update status to `CRITICAL_UNRESOLVED`.
  - Dispatch an urgent critical escalation email to **both L1 and L2 leads** (`[🚨 CRITICAL - SLA2 BREACHED]`).
  - Broadcast `SLA2_BREACHED` over WebSockets.
  - Automatically dispatch reminder alert emails to both leads every **30 minutes** until manually resolved.
- **FR-4.5**: Operators can mark an incident as `RESOLVED`, recording the resolver email and timestamp, clearing the alert state across the UI.

### 3.5 Multi-Schedule Management & Forecasting
- **FR-5.1**: The platform must query Fabric `/schedules` endpoints to extract all trigger definitions per pipeline.
- **FR-5.2**: Supports multiple schedules per pipeline (e.g. daily batch + hourly delta load).
- **FR-5.3**: Displays recurrence rules, active execution days, local timezone, enabled status, and next scheduled execution time in a dedicated modal.

### 3.6 Lakehouse & Warehouse Ingestion Lineage
- **FR-6.1**: Direct connection to Fabric Lakehouse and Warehouse SQL Endpoints via T-SQL (`pyodbc`) using OAuth tokens.
- **FR-6.2**: Visualizes end-to-end ingestion lineage across:
  - Batch Header Table (`dbo.BatchHeader`)
  - Bronze Ingestion Table (`dbo.BronzeLogs`)
  - Silver Ingestion Table (`dbo.SilverLogs`)
- **FR-6.3**: Displays batch durations, source file paths, target Delta tables, and row-level throughput metrics (Rows Read, Inserted, Updated, Rejected).
- **FR-6.4**: Admins configure custom schemas and column mappings in the Table Log Configuration interface.

### 3.7 Run History & Gemini AI Diagnostics
- **FR-7.1**: Complete historical execution log per pipeline with duration charts and inner activity drill-downs.
- **FR-7.2**: One-click AI Error Diagnosis powered by Google Gemini 1.5 Pro:
  - Analyzes error message, failure code, activity type, and raw stack trace.
  - Returns Root Cause, Recommended Fix, and Confidence Score.
  - Caches results by deterministic error hash to serve duplicate errors instantaneously.

### 3.8 Unified User Setup, Directory & Pipeline-Level Scoping
- **FR-8.1**: Directory search over Microsoft Entra ID and local users.
- **FR-8.2**: Role assignment (`admin`, `l1`, `l2`) with instant permission updates.
- **FR-8.3**: Pipeline-level assignment in `sla_configs` associating L1/L2 support engineers, pipeline display names, and SLA1/SLA2 thresholds with specific pipelines.
- **FR-8.4**: Pipeline-level RBAC scoping ensuring L1 and L2 engineers strictly see only the workspaces and pipelines assigned to them (`assigned_pipeline_ids`).

---

## 4. Non-Functional Requirements (NFRs)

### 4.1 Performance & Latency
- **NFR-1**: Workspace tree hierarchy retrieval from SQLite cache must complete in **<15ms**.
- **NFR-2**: Live stopwatch duration updates must refresh in the browser at 1-second intervals during active runs.
- **NFR-3**: Dual-speed leased polling must reduce Fabric REST API calls by **at least 80%** during idle periods compared to naive continuous polling.

### 4.2 Security & Compliance
- **NFR-4**: All API endpoints must authenticate via Microsoft Entra ID JWTs validated against Microsoft's public JWKS keys.
- **NFR-5**: Zero Raw SQL: 100% of internal application data access must use SQLAlchemy Async ORM with parameterized queries, eliminating SQL injection vectors.
- **NFR-6**: SMTP email dispatches must support TLS encryption (STARTTLS) and credential authentication.

### 4.3 Reliability & Availability
- **NFR-7**: SQLite database must operate in Write-Ahead Logging (WAL) mode to permit concurrent reads and writes without database locks.
- **NFR-8**: WebSocket connections must support automatic reconnection with exponential backoff on client network interruptions.

### 4.4 User Interface & Brand Consistency
- **NFR-9**: The web application must strictly adhere to the **Microsoft Fabric Fluent 2 Light Design System** (`#faf9f8` canvas, `#ffffff` card/table containers, `#0f6cbd` Fabric brand blue, Segoe UI typography, and soft Fluent status badges). **There is no dark mode.**

---

## 5. Acceptance Criteria Matrix

| Feature | Acceptance Criteria | Verified Status |
|---|---|:---:|
| **Pure ORM Backend** | Zero raw SQL queries across all repositories; 100% SQLAlchemy Async ORM. | **PASS** |
| **Workspace Scoping** | Admins see all workspaces; L1/L2 see strictly assigned workspaces. | **PASS** |
| **Parent/Child Linking** | Master pipelines render at root; sub-pipelines nest in activities; 0 duplicate orphan rows. | **PASS** |
| **Re-Run InProgress** | Succeeded pipeline re-run creates new GUID instance, shows InProgress live, freezes on completion. | **PASS** |
| **L1 Alert Email** | Pipeline failure creates ACTIVE incident and dispatches HTML alert to L1 assignee. | **PASS** |
| **L2 Escalation Email** | Watchdog detects SLA breach, updates status to ESCALATED_L2, and sends urgent L2 email. | **PASS** |
| **Multi-Schedules** | Modal displays all recurrence rules, timezones, and next execution forecasts. | **PASS** |
| **Table Lineage** | Batch Header, Bronze, Silver logs displayed with row throughput and duration metrics. | **PASS** |
| **AI Diagnostics** | Gemini analyzes failures, returns root cause and fix, cached by error hash. | **PASS** |
