# Backend: Microsoft Fabric Real-Time Job Monitoring API & Workers

The backend is a high-concurrency, asynchronous Python service built with FastAPI, SQLite WAL persistence, Microsoft Entra ID OAuth2 authentication, Google Gemini AI diagnostics, dynamic Fabric Lakehouse/Warehouse telemetry, and Gmail SMTP alerting.

---

## Architecture & Subsystems

### 1. Unified Lifespan Management (`app/main.py`)
- Initializes the SQLite database and executes all DDL migrations during startup.
- Spawns background worker tasks:
  - `leased_poller`: Continuously checks active workspace leases and queries Microsoft Fabric.
  - `alert_service`: Continuously monitors active pipeline durations against SLA thresholds.
- Mounts REST routers, WebSocket hub, and serves compiled React frontend files.

### 2. High-Speed SQLite Persistence (`app/services/db_service.py`)
- Database path: `backend/data/fabric_monitor.db`
- Concurrency hardening:
  - `PRAGMA journal_mode=WAL;` (concurrent non-blocking reads and writes)
  - `PRAGMA synchronous=NORMAL;`
  - `PRAGMA busy_timeout=30000;` (prevents database locked errors)
- **9 Core Tables:**
  1. `workspaces`: Tenant workspaces and polling timestamps.
  2. `pipelines`: Pipeline metadata, master/child flags.
  3. `pipeline_runs`: Execution runs, status, start/end timestamps, invoke types.
  4. `activity_runs`: Inner activity telemetry, error JSON, and child pipeline data.
  5. `pipeline_schedules`: Recurrence rules, execution times, timezones, next run timestamps.
  6. `sla_configs`: Warning/Breach thresholds, L1/L2 emails.
  7. `sla_incidents`: Breach incidents, resolution status, escalation timestamps.
  8. `table_log_mappings`: User-configured Lakehouse/Warehouse IDs and column mappings.
  9. `ai_error_diagnostics`: Persistent cache of Gemini AI root-cause analysis and fix steps.
- **Date Filtering Engine (`get_workspace_tree_by_date`):**
  - Evaluates past executions against date windows (`yesterday`, `today`, `last_week`, custom dates).
  - Evaluates future schedule forecasts (`tomorrow`, `next_week`, custom future dates) by checking recurrence rules.

### 3. Google Gemini AI Diagnostics (`app/services/ai_diagnostic_service.py`)
- Powered by `gemini-3.6-flash`.
- Automatically analyzes pipeline and activity errors, error codes, and failure types.
- Formulates:
  - Root-cause summary.
  - Error category classification.
  - Step-by-step remediation guide.
  - Verification & prevention recommendations.
- Persistent error-signature hash caching in SQLite: repeated identical errors return in < 5ms with zero additional API token consumption.

### 4. Dynamic Lakehouse & Warehouse Table Logging (`app/services/table_log_service.py`)
- **Zero Hardcoding:** Discovers Lakehouses and Warehouses dynamically from the workspace via Fabric REST APIs.
- Queries schemas and column names dynamically.
- Correlates `pipeline_run_id` across:
  - **Batch Header** (batch number, start/end times, pipeline run ID).
  - **ETL Batch Details** (source name, table operations: data load vs source delete).
  - **Bronze Log** (extracted records, load status, timestamps).
  - **Silver Log** (cleaned/transformed row counts, error logs).

### 5. Multi-Schedule Pipeline Client (`app/services/fabric_client.py`)
- Queries Fabric's official DataPipeline job schedule endpoint: `GET /items/{itemId}/jobs/Pipeline/schedules`.
- Extracts all configured schedules from `value: [...]` array, parsing type (`Daily`, `Weekly`), execution times, days of week, and timezone.

### 6. Differential Polling & Terminal Caching (`app/services/leased_poller.py`)
- **Active Viewer Leases:** Polling occurs ONLY for workspaces with $\ge 1$ active WebSocket connection. Idle workspaces consume 0 API calls.
- **Terminal Run Caching:** Succeeded, Failed, and Cancelled runs are never queried again. Fabric `/jobs/instances` and `/queryactivityruns` are called ONLY for `InProgress` runs.

### 7. Multi-User WebSocket Multiplexer (`app/services/connection_manager.py`)
- Manages client connections grouped into workspace rooms.
- Fans out identical telemetry snapshots to all viewers in a room simultaneously.

### 8. SLA Watchdog & Gmail SMTP Alerting (`app/services/alert_service.py`)
- Scans runs and compares duration against SLA thresholds.
- Sends responsive HTML email alerts to L1 and L2 contacts using `uiaptracker@gmail.com` via `smtp.gmail.com:587 TLS`.
- Logs alerts in `sla_incidents` to prevent duplicate notifications.

---

## Key REST & WebSocket Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/workspaces` | Discovers all accessible Fabric workspaces. |
| `GET` | `/api/workspaces/{id}/snapshot` | Returns hierarchical pipeline tree with date filtering (`?date_preset=...&start_date=...&end_date=...`). |
| `GET` | `/api/workspaces/{id}/pipelines/{pipeline_id}/history` | Returns all past execution runs and activities for a pipeline. |
| `GET` | `/api/workspaces/{id}/pipelines/{pipeline_id}/schedule` | Returns all schedules configured for a specific pipeline. |
| `GET` | `/api/workspaces/{id}/schedules` | Returns all upcoming pipeline schedules across the workspace. |
| `POST` | `/api/workspaces/{id}/ai-diagnose` | Generates or retrieves cached Gemini AI root-cause analysis and fix steps. |
| `GET` | `/api/workspaces/{id}/lakehouses-warehouses` | Discovers all Lakehouses and Warehouses in the workspace dynamically. |
| `GET` | `/api/workspaces/{id}/tables-and-columns` | Fetches available tables and schema columns for a Lakehouse or Warehouse. |
| `GET` | `/api/workspaces/{id}/table-log-mapping` | Retrieves saved dynamic table log column mapping configuration. |
| `POST` | `/api/workspaces/{id}/table-log-mapping` | Saves dynamic table log column mapping configuration. |
| `GET` | `/api/workspaces/{id}/pipelines/{pipeline_id}/table-logs` | Fetches dynamic table-level log telemetry for a pipeline run. |
| `GET` | `/api/workspaces/{id}/pipelines/{pipeline_id}/sla` | Retrieves SLA thresholds and L1/L2 emails for a pipeline. |
| `POST` | `/api/workspaces/{id}/pipelines/{pipeline_id}/sla` | Updates SLA thresholds and email recipients for a pipeline. |
| `POST` | `/api/workspaces/{id}/pipelines/{pipeline_id}/test-email` | Dispatches an immediate verification test email. |
| `POST` | `/api/workspaces/{id}/incidents/{incident_id}/resolve` | Resolves an active SLA breach incident. |
| `WS` | `/ws/workspaces/{workspace_id}` | WebSocket stream for live real-time pipeline telemetry. |

---

## Running the Backend

```powershell
# From mymonitor root directory:
backend\venv\Scripts\activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```