# Backend: Microsoft Fabric Real-Time Job Monitoring API & Workers

The backend is a high-concurrency, asynchronous Python service built with FastAPI, SQLite WAL persistence, Microsoft Entra ID OAuth2 authentication, and Gmail SMTP alerting.

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
- 7 core tables: `workspaces`, `pipelines`, `pipeline_runs`, `activity_runs`, `pipeline_schedules`, `sla_configs`, `sla_incidents`.
- Duration calculation engine: Computes `duration_in_ms = endTimeUtc - startTimeUtc` and falls back to summing inner activity durations.

### 3. Differential Polling & Terminal Caching (`app/services/leased_poller.py`)
- **Active Viewer Leases:** Polling occurs ONLY for workspaces with $\ge 1$ active WebSocket connection. Idle workspaces consume 0 API calls.
- **Terminal Run Caching:** Succeeded, Failed, and Cancelled runs are never queried again. Fabric `/jobs/instances` and `/queryactivityruns` are called ONLY for `InProgress` runs.

### 4. Multi-User WebSocket Multiplexer (`app/services/connection_manager.py`)
- Manages client connections grouped into workspace rooms.
- Fans out identical telemetry snapshots to all viewers in a room simultaneously.

### 5. SLA Watchdog & Gmail SMTP Alerting (`app/services/alert_service.py` & `email_service.py`)
- Scans active runs every 10 seconds.
- Compares running duration against warning and breach thresholds.
- Sends responsive HTML email alerts to L1 and L2 contacts using `uiaptracker@gmail.com` via `smtp.gmail.com:587 TLS`.
- Logs alerts in `sla_incidents` to prevent spamming notifications.

---

## Key REST & WebSocket Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/workspaces` | Discovers all accessible Fabric workspaces. |
| `GET` | `/api/workspaces/{id}/snapshot` | Returns the hierarchical pipeline tree (< 15ms response from SQLite). |
| `GET` | `/api/workspaces/{id}/pipelines/{pipeline_id}/history` | Returns all past execution runs and activities for a pipeline. |
| `GET` | `/api/workspaces/{id}/schedules` | Returns upcoming pipeline schedules. |
| `GET` | `/api/sla/configs/{pipeline_id}` | Retrieves SLA thresholds and L1/L2 emails. |
| `POST` | `/api/sla/configs` | Updates SLA thresholds and email recipients. |
| `POST` | `/api/sla/test-email` | Dispatches an immediate verification test email. |
| `POST` | `/api/sla/resolve/{incident_id}` | Resolves an active SLA breach incident. |
| `WS` | `/ws/workspaces/{workspace_id}` | WebSocket stream for live real-time pipeline telemetry. |

---

## Running the Backend

```powershell
# From RealPOC/backend:
venv\Scripts\activate
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```\n