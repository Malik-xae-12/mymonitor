# Microsoft Fabric Monitoring Hub — Poller, RBAC, and Operations Guide

**Document Version:** 2.0  
**Updated:** 2026-09-25  

---

## 1. Executive Summary
This document provides an end-to-end technical explanation and operational walkthrough of the Microsoft Fabric Monitoring Hub. It covers:
1. **Pipeline Hierarchy & Tree Visualization** (Parent master pipelines vs dynamically nested sub-pipelines).
2. **Leased Polling & In-Flight Re-run Mechanics** (Caching of terminal states and how new pipeline re-runs are detected and streamed live).
3. **Role-Based Access Control (RBAC)** (Admin vs L1 Support vs L2 Escalation Owner workspace and pipeline isolation).
4. **Automated Incident & Email Alerting** (L1 notification upon failure and SLA2 automatic escalation to L2).
5. **Multi-Schedule Support** (Full recurrence rules, timezones, and next run times).
6. **Lakehouse / Warehouse Ingestion Audit Logs** (Batch Header, Bronze, Silver lineage and diagnostics).
7. **Run History & AI Remediation** (Comprehensive run telemetry with Gemini AI diagnostics).

---

## 2. Parent-Child Pipeline Hierarchy
The system prevents cluttered duplicate rows and renders a unified tree hierarchy mirroring the true Fabric workload structure.

### Mechanics:
- **Parent / Master Pipelines (`is_master = 1`)**:
  - Independent pipelines that trigger workloads or run standalone.
  - Rendered at the root level of the Monitoring Hub table.
  - Collapsible/expandable with caret icons (`ChevronRight` / `ChevronDown`).
- **Child / Sub-pipelines (`is_child = 1, is_master = 0`)**:
  - Pipelines invoked via `ExecutePipeline` activities inside a parent run.
  - Discovered dynamically by `leased_poller._fetch_activity_tree()`:
    - Inspects `output.pipelineRunId` and `input.pipeline.referenceName`.
    - Recursively queries the child pipeline's inner activities.
    - Nests the child execution inside `activity['childPipeline']`.
  - Automatically flagged via `db_service.update_child_pipeline_flags()` so they **never render as separate orphan rows at the root level**.

---

## 3. Leased Polling & Re-run Handling Explained

### The Core Problem:
Microsoft Fabric enforces strict API rate limits. Querying thousands of historical activities every few seconds causes HTTP 429 throttling and slows down the application.

### The Leased Polling Solution:
1. **Active Leases Only**:
   - The poller (`leased_poller._poll_loop`) only polls workspaces that have active browser viewers connected via WebSockets (`connection_manager.get_active_workspace_ids()`).
   - If no users are viewing a workspace, polling is suspended, conserving compute and API quota.
2. **Checking Status vs. Fetching Activities**:
   - To detect if a pipeline ran again, the system queries the lightweight Job Instance endpoint (`/items/{id}/jobs/instances`). If a workspace has 25 pipelines, it checks instances across those 25 pipelines.
   - **What is cached?** The heavy activity graph (`/queryactivityruns`) is 100% cached for terminal runs. If 25 pipelines are already succeeded, 0 activity calls are made.
3. **Adaptive Dual-Speed Polling**:
   - **Active Mode (`POLL_INTERVAL_ACTIVE_SECONDS = 3.5s`)**: Engaged when at least 1 pipeline is actively `InProgress`. Provides live sub-second stopwatch duration and real-time step execution updates.
   - **Idle Mode (`POLL_INTERVAL_IDLE_SECONDS = 15.0s`)**: Automatically activated when all pipelines in the workspace are in terminal states (`Completed`, `Failed`, `Cancelled`). This reduces Fabric API calls by **80%** while idle, perfectly balancing rate limits and responsiveness.
4. **Permanent Caching of Terminal Runs**:
   - Once a pipeline execution reaches a terminal status (`Completed`, `Failed`, `Cancelled`), its inner activities and durations are **immutable**.
   - `db_service.get_known_cached_run_ids(workspace_id)` queries all runs that already have full activity trees recorded in SQLite.
   - The poller skips re-querying Fabric for these runs and serves the full tree from SQLite in **<15ms**.

### What Happens When a Succeeded Pipeline Is Re-run?
> **User Question:** *"Let's say if a pipeline is succeeded it is cached in table, if user runs again will it show InProgress here? How are these cases handled?"*

**Detailed Technical Lifecycle:**
1. **Fabric Generates an Immutable Job Instance**:
   - When a user clicks "Run" in Fabric or a schedule triggers, Microsoft Fabric does **not** update or overwrite the previous run.
   - Fabric creates a **new Job Instance with a brand-new GUID Run ID** (e.g. `run_id = "f8a12e4b-..."`).
2. **Poller Instance Check**:
   - Every 5 seconds, the leased poller queries Fabric:
     `GET /workspaces/{ws_id}/items/{pipeline_id}/jobs/instances`
   - Fabric returns the latest executions, including the newly created instance with `status: "InProgress"` (or `"NotStarted"`).
3. **Database Insertion & Latest Start Selection**:
   - The poller saves the new run into the `pipeline_runs` table with its current start timestamp.
   - `get_workspace_latest_tree` selects the latest execution per pipeline using:
     ```sql
     SELECT pipeline_id, MAX(COALESCE(start_time, '1970-01-01')) as max_start
     FROM pipeline_runs
     WHERE workspace_id = ?
     GROUP BY pipeline_id
     ```
   - Because the new run has the latest start timestamp, it immediately replaces the old run as the active execution shown in the UI.
4. **Cache Miss & Live Tracking**:
   - The poller compares the new run ID against `cached_terminal_run_ids`.
   - Because this run ID is in `InProgress`, it is **not in the terminal cache**.
   - The poller queries Fabric for its live activities and durations.
   - The poller broadcasts the updated snapshot over WebSockets to the frontend.
5. **Immediate UI Transition**:
   - The frontend immediately displays the pipeline row with the spinning blue **InProgress** badge and live elapsed duration counter.
6. **Freezing Upon Completion**:
   - Once the execution reaches `Completed`, `Failed`, or `Cancelled` and all activities are stored, its run ID is added to `cached_terminal_run_ids`.
   - The previous historical run remains permanently preserved and accessible anytime via the **Run History** modal.

---

## 4. Role-Based Access Control (RBAC) & View Isolation

The application enforces role-based security:

| Feature / Capability | Admin (`admin`) | L1 Support (`l1`) | L2 Support (`l2`) |
| :--- | :---: | :---: | :---: |
| **Workspace Visibility** | All Workspaces | Only Assigned Workspaces | Only Assigned Workspaces |
| **Pipeline Visibility** | All Pipelines | Only Pipelines where L1 = User | Only Pipelines where L2 = User |
| **Metric Summary Cards** | Organization Total | Scoped to Assigned Pipelines | Scoped to Assigned Pipelines |
| **Admin Console Tab** | Visible | **Hidden** | **Hidden** |
| **Table Map ("Map Columns")**| Configurable | **Hidden** | **Hidden** |
| **SLA Configuration Modal** | Edit & Save | **Locked / Hidden** | **Locked / Hidden** |
| **Run History & AI Diagnostics** | Full Access | Full Access | Full Access |
| **Lakehouse Ingestion Logs** | Full Access | Full Access | Full Access |
| **Multi-Schedule Viewer** | Full Access | Full Access | Full Access |

### How RBAC Isolation Operates:
1. **User Sign-In**:
   - The frontend acquires an ID token from Microsoft Entra ID (Azure AD).
   - Calls `GET /api/auth/me`.
   - The backend validates the JWT and resolves the user's role and assigned workspace IDs from `workspace_assignments` and `sla_configs`.
2. **Workspace Dropdown Filtering**:
   - For L1 and L2 users, `scopedWorkspaces` filters the dropdown list to strictly those workspace IDs assigned to the user.
   - Unassigned workspaces are neither visible nor switchable.
3. **Pipeline Table Filtering**:
   - Within an assigned workspace, `scopedPipelineTree` filters the pipeline list to only pipelines where:
     - For L1: `pipeline.slaConfig.l1Email.toLowerCase() === user.email.toLowerCase()`.
     - For L2: `pipeline.slaConfig.l2Email.toLowerCase() === user.email.toLowerCase()`.
   - Pipelines assigned to other team members are omitted.
4. **Summary Metric Calculation**:
   - Metric cards (Total, In Progress, Completed, Failed, Cancelled, Not Run) compute solely over the user's scoped pipeline set.
5. **Admin Controls Removal**:
   - The "Admin console" navigation item in the left rail is conditionally hidden (`isAdmin && ...`).
   - The "Map Columns" configuration button in `TableLogsPage` is hidden (`isAdmin ? handleOpenTableLogConfig : null`).

---

## 5. Automated Alerting & SLA Escalation Workflow

### Step-by-Step Incident Lifecycle:
1. **Pipeline Failure Detection**:
   - When a pipeline run finishes with status `Failed`, `leased_poller` immediately invokes:
     `alert_service.process_failed_run(workspace_id, pipeline_id, run_id, error_info, failed_at)`
2. **Incident Creation & L1 Email Dispatch**:
   - The system checks if an active incident already exists for this `pipeline_run_id`.
   - If not, an incident is created in `sla_incidents` (`status = 'ACTIVE'`).
   - Retrieves the configured `l1_email` from `sla_configs`.
   - Sends an automated HTML alert email via Gmail SMTP containing:
     - Pipeline Name & Workspace.
     - Failure timestamp.
     - Error code & Failure message.
     - Target SLA Warning & Breach countdown.
   - Sets `l1_notified_at = now`.
   - Broadcasts an `INCIDENT_CREATED` WebSocket message to all active operators.
3. **SLA Watchdog & Escalation to L2**:
   - Background SLA monitor checks active incidents every 30 seconds.
   - Calculates elapsed minutes since failure against `sla1_minutes`.
   - If `elapsed >= sla1_minutes` and incident is still `ACTIVE`:
     - Updates incident status to `ESCALATED_L2`.
     - Sets `l2_escalated_at = now`.
     - Sends an escalation alert email to `l2_email`.
     - Broadcasts an `SLA_BREACHED` WebSocket notification with a red warning badge.
4. **Resolution**:
   - Operators can click "Resolve Incident" in the UI.
   - Updates status to `RESOLVED` with resolver email and timestamp.

---

## 6. Multi-Schedule Management
- Microsoft Fabric pipelines can have multiple independent triggers (e.g., daily batch + hourly incremental).
- The Hub queries `/items/{pipeline_id}/jobs/Pipeline/schedules`.
- In `PipelineScheduleModal`:
  - Iterates over all configured schedules.
  - Displays each schedule's recurrence type (Daily, Weekly, Cron), active days, scheduled execution times, local timezone, enabled status, and next scheduled execution time.

---

## 7. Lakehouse & Warehouse Ingestion Table Logs
- Supports monitoring of Lakehouse and Warehouse audit tables across data platforms.
- Lineage Architecture:
  `Batch Header Table` ➔ `Bronze Ingestion Table` ➔ `Silver Ingestion Table`
- Displays:
  - Batch ID, Ingestion Start/End Timestamps, Duration.
  - Source file path, Target Delta table name.
  - Rows Read, Rows Inserted, Rows Updated, Rows Rejected.
  - Ingestion Status (Success / Error).
- Admins configure tables and audit column mappings in `TableLogConfigPage`.

---

## 8. Practical Operational Scenarios & Concrete Examples

### Scenario 1: All 5 Pipelines in a Workspace Have Succeeded
* **Poller State**: **Idle Mode** (`POLL_INTERVAL_IDLE_SECONDS = 15.0s`).
* **Execution**: Every 15 seconds, the poller queries Fabric for the 5 pipeline job instances.
* **Activity Calls**: **0 activity calls** are made (all activities are loaded from the SQLite cache).
* **Network Cost**: Exactly 5 lightweight instance checks every 15 seconds (averaging only 20 calls/minute for the entire workspace).

### Scenario 2: 2 Pipelines are Running (`InProgress`) and 3 are Succeeded
* **Poller State**: **Active Mode** (`POLL_INTERVAL_ACTIVE_SECONDS = 3.5s`).
* **For the 2 Running Pipelines**:
  * Queried **every 3.5 seconds**.
  * Hits Fabric for their parent status **and** all their inner activities.
  * Feeds the live ticking stopwatch and real-time step progress to the UI.
* **For the 3 Succeeded Pipelines**:
  * **Skipped** on the 3.5-second fast ticks!
  * Only checked **once every 15 seconds** to see if a user re-triggered them.
  * When checked at the 15-second mark, **0 activity calls** are made because their terminal execution tree is already frozen in SQLite.
* **UI Snapshot**: The backend reads the SQLite tree (<15ms) containing the 2 active pipelines updating live and the 3 completed pipelines preserved, and broadcasts it over WebSockets.

### Scenario 3: User Re-Runs a Pipeline That Previously Succeeded
* **Event**: A pipeline that succeeded 1 hour ago is manually re-run or triggered by schedule.
* **Fabric Execution**: Fabric does *not* overwrite the old run; it creates a **new Job Instance with a brand-new GUID Run ID** (e.g. `run-2026-new`) with status `InProgress`.
* **Detection**: On the next polling cycle, `get_job_instances` returns `run-2026-new`.
* **Cache Bypass**: Because `run-2026-new` has status `InProgress`, it is **not** in `cached_terminal_run_ids`.
* **Active Selection**: `db_service.get_workspace_latest_tree` uses `MAX(COALESCE(start_time, '1970-01-01'))`. Because `run-2026-new` has the newest start timestamp, it immediately replaces the old run as the active execution row in the UI.
* **Live Streaming**: The main table transitions the row to the spinning blue **`In progress`** badge, and the poller tracks its live inner activities.
* **Freezing Upon Completion**: Once finished, `run-2026-new` is added to `cached_terminal_run_ids`. The previous run remains permanently preserved in the **Run History** modal.

### Scenario 4: L1 Support User Logs In
* **Authentication**: User logs in with Entra ID. `/api/auth/me` resolves their role as `l1` and populates `assigned_workspace_ids`.
* **Workspace Selector**: Filters strictly to the workspaces where the user is assigned as L1. Unassigned workspaces are invisible.
* **Pipeline Table**: Filters to **only pipelines where `p.slaConfig.l1Email === user.email`**. Pipelines assigned to other team members are omitted.
* **Summary Metrics**: Metric cards (Total, In Progress, Completed, Failed, Cancelled, Not Run) compute exclusively over their assigned pipelines.
* **UI Controls Masked**:
  * The "Admin console" navigation item in the left rail is hidden.
  * The "Map Columns" configuration button in `TableLogsPage` is hidden.
  * SLA configuration modals are locked / hidden.

### Scenario 5: Pipeline Execution Fails
* **Detection**: Leased poller discovers that a run has status `Failed`.
* **Incident Dispatch**: `alert_service.process_failed_run()` registers an active incident in `sla_incidents` (`status = 'ACTIVE'`).
* **L1 Email Notification**: An automated HTML email is sent to `l1_email` with pipeline name, workspace, failure timestamp, error diagnostics, and SLA warning countdown.
* **Watchdog Countdown**: Background task monitors elapsed time against `sla1_minutes`.
* **L2 Escalation**: If unresolved after `sla1_minutes`, status escalates to `ESCALATED_L2`, sends an escalation alert email to `l2_email`, and broadcasts `SLA_BREACHED` over WebSockets.
* **Resolution**: Operator clicks "Resolve Incident" in the UI to clear the alert state.
