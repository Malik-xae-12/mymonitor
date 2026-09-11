# Microsoft Fabric Real-Time Job Monitoring: Implementation & UI Screen Guide

This document details the code implementation, UI components, screen-by-screen features, and how all operational and enterprise monitoring requirements are satisfied.

---

## 1. Complete Requirements Coverage Matrix

| Requirement | Implementation Component | What You See & How It Works |
| :--- | :--- | :--- |
| **1. See all pipelines in a workspace** | `WorkspaceSelector.jsx` & `PipelineTreeTable.jsx` | Dropdown discovers and lists all workspaces in the tenant. Selecting a workspace immediately loads all pipelines (including idle / never-run pipelines). |
| **2. Dynamic parent-child pipeline hierarchy** | `tree_builder.py` & `PipelineRow.jsx` | Child pipelines triggered by `ExecutePipeline` activities appear nested inside the parent row with purple badge and indentation. 100% dynamic without hardcoded name rules. |
| **3. Granular activity telemetry & real error logs** | `ActivityList.jsx` & `ErrorDetailModal.jsx` | Displays inner activities, live status spinners, start/end timestamps, calculated duration, and a "View Error" button for deep error diagnostics. |
| **4. Deduplicate child pipelines from top level** | `tree_builder.py` & `db_service.py` | If a pipeline is invoked as a child in any current run, it is removed from the top-level table and shown strictly inside the parent pipeline accordion. If a pipeline is NOT a child, it is shown in the root table. |
| **5. Latest run view with dedicated History button** | `PipelineRow.jsx` & `RunHistoryModal.jsx` | The main view displays only the **latest execution run** for each pipeline. A dedicated **"History"** button opens a full modal displaying all historical runs, with deep activity trees and error logs. |
| **6. Calculated execution duration** | `db_service.py`, `PipelineRow.jsx`, `RunHistoryModal.jsx` | Parent pipeline duration is calculated via `endTimeUtc - startTimeUtc`. If missing, it sums all inner activity durations. Rendered as `Xm Ys` or `Xh Ym Zs`. |
| **7. Real-time updates without page refresh** | `useWorkspaceMonitoring.js` & `websocket_hub.py` | Persistent WebSocket connection pushes state changes instantly with zero user action needed. |
| **8. Multi-User Concurrency (1-to-N Multiplexing)** | `connection_manager.py` & `leased_poller.py` | If 50 users view the same workspace, the backend makes **ONLY 1 single Fabric API call** and broadcasts the payload to all 50 users simultaneously. |
| **9. Terminal run caching & differential polling** | `leased_poller.py` & `db_service.py` | Succeeded, Failed, and Cancelled runs are cached permanently in SQLite. Only `InProgress` runs trigger outgoing Fabric API requests. |
| **10. SLA thresholds & automated email escalation** | `SlaConfigModal.jsx`, `alert_service.py`, `email_service.py` | Configure Warning and Breach SLA thresholds in minutes. If breached, the watchdog automatically dispatches formatted alert emails to L1 and L2 recipients via Gmail SMTP. |
| **11. Live email verification** | `SlaConfigModal.jsx` & `routes_sla.py` | "Test L1 Email" and "Test L2 Email" buttons allow operators to verify Gmail SMTP connectivity immediately from the UI with real-time toast feedback. |
| **12. Live SLA Incident Banner & 1-Click Resolution** | `SlaIncidentBanner.jsx` & `routes_sla.py` | Breached runs display a top alert banner with an interactive **"Resolve"** button to acknowledge and clear the incident. |
| **13. Upcoming scheduled runs** | `SchedulesDrawer.jsx` | Slide-over drawer detailing next scheduled execution times, timezones, and schedule types. |

---

## 2. Screen-by-Screen Visual Walkthrough

### Screen 1: Top Navigation & Real-Time Header
Located at the top of the page (`DashboardHeader.jsx`), sticky and visible at all times.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Microsoft Fabric Job Monitor [REAL-TIME]                [fabric learning ▼]              │
│    Live activity-level execution tracking                  ● Live WebSocket  👥 5 viewers 🔄 │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ Total Pipelines: 5  │  ▶ Running: 1  │  ✔ Succeeded: 3  │  ✖ Failed: 1                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Live Connection Indicator:** A pulsing green dot labeled **"Live WebSocket"**. If network drops, it shifts to amber **"Reconnecting..."** and restores automatically.
2. **Active Viewers Badge (1-to-N Multiplexing in Action):** Displays how many users are currently logged in and monitoring this workspace (e.g., `👥 5 active viewers`).
3. **Cleaned Header Interface:** Per user specification, global schedule clutter has been streamlined, keeping focus on core operational metrics and live status.
4. **Metric Summary Cards:** Total Pipelines, Running (blue), Succeeded (green), and Failed (red).
5. **Manual Refresh Button:** Allows triggering an immediate poll sync on demand.

---

### Screen 2: Dynamic Tenant Workspace Selector
Clicking the workspace dropdown (`WorkspaceSelector.jsx`) opens a search-enabled menu:

```
┌──────────────────────────────────────────────┐
│ 📁 Select Workspace...                     ▲ │
├──────────────────────────────────────────────┤
│ 🔍 [ Search workspaces...              ]  🔄 │
├──────────────────────────────────────────────┤
│ ✔ fabric learning                            │
│   workspace-analytics                        │
│   production-data-engineering                │
│   finance-reporting-prod                     │
└──────────────────────────────────────────────┘
```

#### What you see:
1. **Tenant-Wide Discovery:** Dynamically populates every workspace accessible to the Service Principal.
2. **Instant Search Filter:** Real-time text search for environments with dozens of workspaces.
3. **Seamless Switching:** Clicking any workspace switches the active WebSocket room instantly without reloading the browser page.

---

### Screen 3: Pipeline Tree Table (Parent-Child Hierarchy)
The main content area (`PipelineTreeTable.jsx` and `PipelineRow.jsx`).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [ Filter pipelines by name... ]       [All Pipelines] [Running] [Failed] [Succeeded] [Never Run]              │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ 🚀 AzureSql_03_MasterPipeline         Duration: 3m 05s │ Manual │ ✖ Failed │ ⚠️ SLA Breached [History] [SLA] │
│    Run ID: e0e5c9b7-b08e-49fb...        Start: Sep 11, 09:45 PM                                                  │
│    ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐     │
│    │ Pipeline Activities (4)                                                                               │     │
│    │ [Activity Table renders here - see Screen 4]                                                          │     │
│    │                                                                                                       │     │
│    │ 🔀 Child Pipelines Executed by this Pipeline (1)                                                      │     │
│    │ ┌───────────────────────────────────────────────────────────────────────────────────────────────────┐ │     │
│    │ │ ▼ 🔀 AzureSql_03_PL_SourceToBronze [CHILD PIPELINE]   Duration: 15m 41s │ ✔ Succeeded [History] [SLA]│ │     │
│    │ │    Run ID: d401b332... • Triggered by: Execute_SourceToBronze                                     │ │     │
│    │ └───────────────────────────────────────────────────────────────────────────────────────────────────┘ │     │
│    └───────────────────────────────────────────────────────────────────────────────────────────────────────┘     │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▶ 🚀 Oracle_05_MasterPipeline            Duration: 2m 48s │ Manual │ ✔ Succeeded │ ⚡ SLA OK   [History] [SLA] │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Latest Run Display:** The primary row reflects the single most recent execution run for that pipeline.
2. **Accurate Duration:** Shows calculated run duration (`3m 05s`, `15m 41s`) computed from UTC timestamps or summed activity durations.
3. **Dynamic Child Pipeline Nesting:** Child pipelines called via `ExecutePipeline` are automatically removed from top-level workspace rows and nested under their parent.
4. **SLA Status Badges:**
   - `⚡ SLA OK` or `⚡ SLA 14m left`: Execution completed within threshold or is currently running healthy.
   - `⚠️ SLA Breached (L1 Notified)`: Execution time exceeded configured SLA.
5. **Action Buttons:**
   - **`[History]` Button:** Opens the complete historical run archive modal for this pipeline.
   - **`[SLA]` Button:** Opens the SLA configuration modal to inspect or update warning/breach limits and alert recipients.

---

### Screen 4: Granular Activity Execution List
Inside the expanded pipeline row (`ActivityList.jsx`):

| Activity Name | Type | Status | Start Time | End Time | Duration | Diagnostics |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| 🗄️ **CopyCustomerData** | `Copy` | 🟢 `Succeeded` | 09:45:02 PM | 09:46:15 PM | 1m 13s | — |
| 💻 **RunSparkNotebook** | `Notebook` | 🔴 `Failed` | 09:46:18 PM | 09:48:07 PM | 1m 49s | `[View Error]` |
| 🔀 **Execute_SourceToBronze** | `ExecutePipeline` | 🟢 `Succeeded` | 09:48:10 PM | 10:03:51 PM | 15m 41s | — |

#### What you see:
1. **Activity Type Icons:** Distinct color-coded icons for `Copy`, `Notebook`, `ExecutePipeline`, `SQL`, `WebActivity`, and `Script`.
2. **Real-time Status Badges:** Spinning loader on `Running`, green check on `Succeeded`, red alert on `Failed`.
3. **Execution Duration:** Precise duration displayed for each activity.
4. **"View Error" Button:** Prominently displayed only on failed activities to inspect the exact failure message.

---

### Screen 5: Deep Error Diagnostics Modal
Clicking **"View Error"** opens the diagnostic modal (`ErrorDetailModal.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️  Activity Execution Failed                                                        ✕ │
│    Activity: RunSparkNotebook (Notebook)                                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔴 USERERROR                                                              Code: 2200   │
│    ErrorCode=SqlFailedToConnect, Cannot connect to SQL database:                       │
│    Login failed for user 'etl_user'. IP not in allowed firewall whitelist.            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Target: RunSparkNotebook  │  Duration: 1m 49s  │  Timestamp: 09:48:07 PM               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ >_ Raw Execution Diagnostics & Output JSON                       [ 📋 Copy Diagnostics ]│
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ {                                                                                  │ │
│ │   "errorCode": "2200",                                                             │ │
│ │   "message": "ErrorCode=SqlFailedToConnect, Cannot connect...",                    │ │
│ │   "failureType": "UserError",                                                      │ │
│ │   "output": {                                                                      │ │
│ │     "errors": [{ "Code": 2200, "Message": "TCP Provider: Connection refused" }]    │ │
│ │   }                                                                                │ │
│ │ }                                                                                  │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                              [ Close ] │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Plain-English Error Message:** Highlights the root cause without having to parse raw JSON.
2. **Error Code & Classification:** Shows `failureType` (e.g., `UserError`, `SystemError`) and exact `errorCode`.
3. **Scrollable Output JSON:** Complete execution diagnostics and driver output.
4. **"Copy Diagnostics" Button:** One-click copy with instant visual checkmark.

---

### Screen 6: Pipeline Run History Modal
Clicking the **"History"** button on any pipeline opens the deep history viewer (`RunHistoryModal.jsx`):

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 📜 Execution History: AzureSql_03_MasterPipeline                                          ✕ │
│    Showing all past executions recorded in SQLite cache                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ Run ID: e0e5c9b7... │ Start: Sep 11, 09:45 PM │ Duration: 3m 05s │ ✖ Failed   [View Error]│
│   ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│   │ Activities in this run:                                                               │ │
│   │ • CopyCustomerData (Copy) - 1m 13s - ✔ Succeeded                                      │ │
│   │ • RunSparkNotebook (Notebook) - 1m 49s - ✖ Failed [View Error]                        │ │
│   └───────────────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▶ Run ID: a112ef44... │ Start: Sep 10, 04:00 AM │ Duration: 2m 58s │ ✔ Succeeded            │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▶ Run ID: f883dd91... │ Start: Sep 09, 04:00 AM │ Duration: 3m 12s │ ✔ Succeeded            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Historical Run List:** Chronological archive of all past runs stored in SQLite.
2. **Interactive Run Accordion:** Expanding any historical run displays all activities that executed inside that run.
3. **Activity Logs & Errors:** Even in historical runs, clicking **"View Error"** inspects the exact failure message and driver diagnostics.
4. **Calculated Durations:** Each run displays exact execution duration (`endTimeUtc - startTimeUtc`).

---

### Screen 7: SLA Configuration Modal
Clicking the **"SLA"** button opens the SLA settings panel (`SlaConfigModal.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⏱️  Configure SLA & Escalation: AzureSql_03_MasterPipeline                           ✕ │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ [✔] Enable SLA Monitoring for this pipeline                                            │
│                                                                                        │
│ Warning Threshold (Minutes):               Breach Threshold (Minutes):                 │
│ [ 10                             ]         [ 15                             ]         │
│                                                                                        │
│ L1 Alert Email:                                                                        │
│ [ az786muzaffar@gmail.com                           ]      [ ✉️ Send Test Email ]      │
│                                                                                        │
│ L2 Escalation Email (Manager / Lead):                                                  │
│ [ teamlead@example.com                              ]      [ ✉️ Send Test Email ]      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                 [ Cancel ]  [ Save ]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Configurable Thresholds:** Define warning and critical breach thresholds in minutes.
2. **L1 & L2 Recipients:** Set primary support contact (L1) and escalation contact (L2).
3. **Live Test Email Verification:** Clicking **"Send Test Email"** triggers an immediate verification email via Gmail SMTP (`uiaptracker@gmail.com`) to confirm that notifications reach the inbox.
4. **Instant Persistence:** Settings are saved to SQLite (`sla_configs`) and immediately evaluated by the watchdog worker.

---

### Screen 8: Live SLA Incident Banner
When an active pipeline exceeds its SLA threshold, the top incident banner activates (`SlaIncidentBanner.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ ACTIVE SLA INCIDENTS (1)                                                            │
│ • AzureSql_03_MasterPipeline: Run e0e5c9b7 exceeded 15m breach SLA (Duration: 18m 32s)│
│   Notified: az786muzaffar@gmail.com (L1) at 09:48 PM                   [ ✔ Resolve ]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Breach Warning:** Clearly lists which pipeline and run exceeded SLA.
2. **Notification Proof:** Displays which email addresses were alerted and exact timestamp.
3. **1-Click Resolve Button:** Allows operators to acknowledge the incident, updating `sla_incidents.status = 'RESOLVED'` and dismissing the banner.

---

### Screen 9: Pipeline Schedules Drawer
Clicking **"Schedules"** opens the slide-over drawer (`SchedulesDrawer.jsx`):

```
┌──────────────────────────────────────────────────┐
│ 📅 Pipeline Schedules                          ✕ │
│    Scheduled triggers in this workspace        🔄│
├──────────────────────────────────────────────────┤
│ 🚀 AzureSql_03_MasterPipeline        ✔ Enabled   │
│    TYPE: Daily             TIMEZONE: UTC         │
│    ⏰ Next Run: Sep 12, 2026, 04:00:00 AM        │
├──────────────────────────────────────────────────┤
│ 🚀 Oracle_05_MasterPipeline          ✔ Enabled   │
│    TYPE: Weekly            TIMEZONE: UTC         │
│    ⏰ Next Run: Sep 14, 2026, 02:00:00 AM        │
└──────────────────────────────────────────────────┘
```

#### What you see:
* Enablement status (`Enabled`, `Disabled`).
* Schedule frequency (`Daily`, `Weekly`, `Cron`).
* Next execution time calculated in user's timezone.

---

## 3. Code Implementation Structure

```
RealPOC/
├── backend/app/
│   ├── main.py                    # App entrypoint, lifespan worker initialization, static UI mount
│   ├── core/
│   │   ├── config.py              # Pydantic settings loading from .env (SMTP, Azure, timeouts)
│   │   └── rate_limiter.py        # Concurrency semaphore limiting parallel Fabric calls to 5
│   ├── models/
│   │   └── monitoring.py          # Pydantic schemas (PipelineRun, ActivityRun, SlaConfig, Incident)
│   ├── services/
│   │   ├── db_service.py          # SQLite engine, WAL mode, schema, indexed caching, duration math
│   │   ├── fabric_client.py       # Entra ID OAuth2 token renewal & Fabric REST client
│   │   ├── tree_builder.py        # Resolves dynamic ExecutePipeline hierarchy without hardcoding
│   │   ├── connection_manager.py  # WebSocket room manager (1-to-N multiplexer)
│   │   ├── leased_poller.py       # Leased background poller (queries active viewed workspaces only)
│   │   ├── alert_service.py       # SLA watchdog checking run durations & triggering escalation
│   │   └── email_service.py       # Gmail SMTP dispatcher formatting HTML alert cards
│   └── api/
│       ├── routes_workspaces.py   # REST: /workspaces, /snapshot, /history, /schedules
│       ├── routes_sla.py          # REST: /sla/configs, /sla/test-email, /sla/resolve
│       └── websocket_hub.py       # WebSocket: /ws/workspaces/{workspace_id}
│
└── frontend/src/
    ├── main.jsx                   # Entrypoint with global ErrorBoundary wrapper
    ├── App.jsx                    # Root coordinator component
    ├── hooks/
    │   └── useWorkspaceMonitoring.js # Auto-reconnecting WebSocket streaming hook
    └── components/
        ├── DashboardHeader.jsx    # Top bar with active viewers counter & summary metrics
        ├── WorkspaceSelector.jsx  # Dynamic tenant workspace dropdown with instant search
        ├── PipelineTreeTable.jsx  # Hierarchical table with search & status filters
        ├── PipelineRow.jsx        # Parent row with calculated duration, SLA badges & action buttons
        ├── ActivityList.jsx       # Activity telemetry, status icons, durations, View Error button
        ├── ErrorDetailModal.jsx   # Deep error diagnostic modal & copy diagnostics button
        ├── RunHistoryModal.jsx    # Complete historical runs modal with inner activity inspection
        ├── SlaConfigModal.jsx     # SLA threshold configuration & live email test verification
        ├── SlaIncidentBanner.jsx  # Live breach alert banner with 1-click incident resolution
        ├── SchedulesDrawer.jsx    # Slide-over panel for upcoming scheduled pipeline runs
        └── ErrorBoundary.jsx      # Global React crash protection component
```

---

## 4. How to Run & Verify

### Single-Command Unified Server
From the root directory:
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open your browser to:
👉 **`http://localhost:8000`**

### Live Verification Checklist:
1. **Multi-User Multiplexing:** Open `http://localhost:8000` in two separate browser tabs. Both tabs join the same room; the header displays `👥 2 active viewers`, and the backend issues only 1 Fabric query.
2. **Terminal Caching:** Expand a completed pipeline. Observe response latency < 15ms. In backend logs, notice Fabric `/queryactivityruns` is NOT called because the terminal run is permanently cached.
3. **Run History:** Click **"History"** on `AzureSql_03_MasterPipeline`. Expand any historical run to inspect inner activities and error diagnostics.
4. **Calculated Duration:** Confirm that parent pipeline headers display formatted durations (`2m 48s`, `3m 05s`, `15m 41s`).
5. **SLA Test Email:** Click **"SLA"** on any pipeline, input your email address, and click **"Send Test Email"**. Check your inbox for the immediate confirmation email from `uiaptracker@gmail.com`.\n