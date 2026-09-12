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
| **11. Live email verification** | `SlaConfigModal.jsx` & `routes_workspaces.py` | "Test L1 Email" and "Test L2 Email" buttons allow operators to verify Gmail SMTP connectivity immediately from the UI with real-time toast feedback. |
| **12. Live SLA Incident Resolution** | `PipelineRow.jsx` & `routes_workspaces.py` | Breached runs display overdue duration in days/hours/minutes (e.g. `+4d 3h 15m`) with an interactive green **"Resolve"** button to acknowledge and clear the incident. |
| **13. Multi-Schedule inspection per pipeline** | `PipelineScheduleModal.jsx` & `fabric_client.py` | Queries `/jobs/Pipeline/schedules` to render all configured triggers (Daily, Weekly, custom days, times, and next run time) in dedicated cards. |
| **14. Date-Based Telemetry & Schedule Forecast** | `DateFilterBar.jsx` & `db_service.py` | Filter by Name, Quick Presets (`Last Week`, `Yesterday`, `Today`, `Tomorrow`, `Next Week`), 15-day navigator strip (Sep 05 → Sep 19), and dynamic status cards for past runs and future schedule forecasts. |
| **15. AI-Powered Diagnostics & Step-by-Step Fixes** | `ai_diagnostic_service.py` & `ErrorDetailModal.jsx` | 1-click **"Diagnose with AI"** powered by Google Gemini 3.6 Flash. Explains root cause, error category, and concrete fix steps with SQLite response caching. |
| **16. Dynamic Lakehouse & Warehouse Table Logging** | `table_log_service.py` & `TableLogConfigModal.jsx` | Zero hardcoding: dynamically introspects Lakehouses, Warehouses, schemas, and columns to map Batch Header, Bronze, and Silver logs. |
| **17. End-to-End Batch Lineage Dashboard** | `TableLogDashboardModal.jsx` & `table_log_service.py` | Correlates `pipeline_run_id` to Batch Header, ETL details, and Bronze-to-Silver row-count transformations with source operation filtering (data load vs source delete). |

---

## 2. Screen-by-Screen Visual Walkthrough

### Screen 1: Top Navigation & Real-Time Header
Located at the top of the page (`DashboardHeader.jsx`), sticky and visible at all times.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚡ Microsoft Fabric Job Monitor [REAL-TIME] [SQLITE CACHE]  [AllConnChk ▼]                       │
│    Sub-50ms hierarchy telemetry, SLA alerting & automated L1/L2 escalation                       │
│                                           ● Live Sync  👥 1 viewer  🔄  [ 🗄️ Table Log Config ]  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Live Connection Indicator:** A pulsing green dot labeled **"Live Sync"**. If network drops, it shifts to amber **"Reconnecting..."** and restores automatically.
2. **Active Viewers Badge (1-to-N Multiplexing in Action):** Displays how many users are currently monitoring this workspace (e.g., `👥 1 viewer`).
3. **Streamlined Header Interface:** Unnecessary static duplicate cards were removed to keep the top view clean and focused on operational controls.
4. **Table Log Config Button:** Opens the dynamic Lakehouse/Warehouse schema and column mapping modal.
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
│ ✔ AllConnChk                                 │
│   fabric learning                            │
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

### Screen 3: Date-Based Telemetry & Schedule Forecast Filter Bar
Positioned directly above the pipeline hierarchy (`DateFilterBar.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔍 [ Search pipelines or activities by name...        ]  [Last Week] [Yesterday] [Today] [Tomorrow] 📅 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📅 DAY-BY-DAY NAVIGATOR (Last Week → Next Week)                                 🟢 Recorded Runs       │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐│
│ │ SUN │ │ MON │ │ TUE │ │ WED │ │ THU │ │ FRI │ │ SAT │ │ SUN │ │ MON │ │ TUE │ │ WED │ │ THU │ │ FRI ││
│ │ 06  │ │ 07  │ │ 08🟢│ │ 09  │ │ 10🟢│ │ 11  │ │ 12★ │ │ 13🟣│ │ 14  │ │ 15  │ │ 16  │ │ 17  │ │ 18  ││
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ● Showing executions for Yesterday (Sep 11, 2026): 0 Ran, 25 Not Run             [ ↺ Reset to Live ]   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [All Pipelines: 25] [Running: 0] [Succeeded: 0] [Failed: 0] [Cancelled: 0] [Not Run: 25]               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Search by Name:** Real-time text filter across pipeline names and inner activities.
2. **Quick Range Presets:** 1-click filtering for `Last Week`, `Yesterday`, `Today`, `Tomorrow`, `Next Week`, and `Latest / All`.
3. **Day-by-Day Strip (Sep 05 → Sep 19):**
   - 🟢 **Emerald dots:** Visually mark dates with recorded execution runs (e.g. Sep 08, Sep 10).
   - 🟣 **Purple dots:** Mark upcoming forecast dates.
4. **Dynamic Metric Cards & Status Tabs:**
   - On past dates: Displays exact counts for `All`, `Running`, `Succeeded`, `Failed`, `Cancelled`, and `Not Run`.
   - On future dates: Displays schedule forecast counts: `All`, `Scheduled to Run`, and `Not Scheduled`.
5. **Context Caption & Live Reset:** Shows active date context with a 1-click **"Reset to Live"** button.

---

### Screen 4: Pipeline Tree Table (Parent-Child Hierarchy)
The main content area (`PipelineTreeTable.jsx` and `PipelineRow.jsx`).

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ NAME                              STATUS & SLA         START TIME           END TIME             DURATION      ACTIONS │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ▼ 🚀 AzureSql_03_MasterPipeline   ✖ Failed             2026-09-08 07:57:28  2026-09-08 08:00:50  3m 05s        [History]
│    Latest Run #e2e28432           ⚠️ SLA Breached (+4d 3h 15m) [✔ Resolve]                                     [Schedule]
│    Invoked: Manual                                                                                             [SLA]
│    ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐ [Table Logs]
│    │ Pipeline Activities (4)                                                                                 │ [Error]
│    │ ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐ │         │
│    │ │ 🔍 Insert Log Header (Lookup)               ✔ Success     2026-09-08 13:27:37  14s                  │ │         │
│    │ │ 📧 Mail Alert Invoke (TridentNotebook)      Inactive      2026-09-08 13:27:37  —                    │ │         │
│    │ │ 🔀 Sub Pipeline Invoke (Sub-pipeline)       ✔ Success     2026-09-08 13:27:54  1m 26s               │ │         │
│    │ │    └─> ▼ 🚀 AzureSql_03_InvokePipeline      ✔ Success     2026-09-08 13:27:54  1m 26s               │ │         │
│    │ └─────────────────────────────────────────────────────────────────────────────────────────────────────┘ │         │
│    └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
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

### Screen 5: Granular Activity Execution List
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

### Screen 6: Deep Error Diagnostics & AI Fix Assistant Modal
Clicking **"View Error"** opens the diagnostic modal (`ErrorDetailModal.jsx`) equipped with Google Gemini 3.6 Flash AI root-cause diagnostics:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️  Activity Execution Failed                                              USERERROR          ✕ │
│    Activity: RunSparkNotebook (Notebook)                                                         │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔴 ERROR DESCRIPTION                                                                 Code: 2200  │
│    ErrorCode=SqlFailedToConnect, Cannot connect to SQL database:                                 │
│    Login failed for user 'etl_user'. IP not in allowed firewall whitelist.                      │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Target: RunSparkNotebook        │  Duration: 1m 49s        │  Failure Time: Sep 08, 08:00:50 PM  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ✨ AI Troubleshooting & Fix Assistant  [ Gemini 3.6 Flash ] [ ⚡ Instant Cached (<5ms) ]         │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Root Cause Analysis:                                                                      │ │
│ │ The execution failed during database authentication because the client IP address is missing │ │
│ │ from the Azure SQL Database server firewall rules.                                           │ │
│ │                                                                                              │ │
│ │ 📌 Likely Causes:                                                                            │ │
│ │ • Azure SQL logical server firewall does not have "Allow Azure services and resources" on.   │ │
│ │ • Self-hosted or Fabric Managed VNet IP address was dynamically rotated.                     │ │
│ │ • The database user credential expired or was locked after consecutive failed attempts.      │ │
│ │                                                                                              │ │
│ │ 🛠️ Step-by-Step Fix Guide:                                                                   │ │
│ │ 1. In the Azure Portal, navigate to the target Azure SQL Database / Server.                  │ │
│ │ 2. Open "Security" > "Networking".                                                           │ │
│ │ 3. Ensure "Allow Azure services and resources to access this server" is checked.             │ │
│ │ 4. Under Firewall rules, add the Fabric tenant outbound CIDR range or execute the rule fix.  │ │
│ │                                                                                              │ │
│ │ 💻 Fix Script (PowerShell / Azure CLI):                                                      │ │
│ │ ┌──────────────────────────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ az sql server firewall-rule create --resource-group rg-data --server sql-fabric-prod \   │ │ │
│ │ │   --name AllowAllAzureIPs --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0            │ │ │
│ │ └──────────────────────────────────────────────────────────────────────────────────────────┘ │ │
│ │ [ 📋 Copy Script ]                                                                           │ │
│ │                                                                                              │ │
│ │ 🛡️ Prevention Tip: Use Azure Managed Identity or Private Endpoints rather than public SQL    │ │
│ │ logins to avoid dynamic IP firewall blocks entirely.                                         │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ [ 📋 Copy Complete Fix ]   [ 🔄 Regenerate Diagnosis ]                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ >_ Raw Execution Diagnostics & Output JSON                             [ 📋 Copy Diagnostics ]   │
│ ┌──────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ { "errorCode": "2200", "failureType": "UserError", "output": { "errors": [...] } }          │ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                        [ Close ] │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Plain-English Error Description:** Highlights the root error message directly from the execution payload.
2. **Google Gemini 3.6 Flash Root Cause Analysis:** Explains why the activity failed in clear technical language.
3. **Likely Causes & Concrete Fix Steps:** Provides actionable numbered steps for operations teams to remediate the failure.
4. **Fix Scripts (PowerShell / SQL / Python):** Provides ready-to-run remediation commands with a 1-click **"Copy Script"** button.
5. **SHA-256 Instant SQLite Caching:** Identical error signatures return instantly (`< 5ms`) from `ai_error_diagnostics` with zero duplicate token usage.
6. **"Copy Complete Fix" Button:** Copies the entire formatted markdown report for Jira, ServiceNow, or Teams escalation.

---

### Screen 7: Pipeline Run History Modal
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

### Screen 8: SLA Configuration Modal & Live Email Verification
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

### Screen 9: Live SLA Incident Banner & Duration Formatting
When an active pipeline exceeds its SLA threshold, the top incident banner activates (`SlaIncidentBanner.jsx`), and overdue duration is formatted with days, hours, and minutes (`PipelineRow.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ ACTIVE SLA INCIDENTS (1)                                                            │
│ • AzureSql_03_MasterPipeline: Run e0e5c9b7 exceeded 15m breach SLA (Duration: 18m 32s)│
│   Notified: az786muzaffar@gmail.com (L1) at 09:48 PM                   [ ✔ Resolve ]   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Human-Readable Overdue Duration:** Overdue SLA duration is rendered cleanly as `+4d 3h 15m` instead of confusing raw minute numbers (e.g. `5955m`).
2. **Notification Proof:** Displays which email addresses were alerted and exact timestamp.
3. **1-Click Resolve Button:** Allows operators to acknowledge the incident, updating `sla_incidents.status = 'RESOLVED'` and dismissing the banner.

---

### Screen 10: Multi-Schedule Pipeline Inspection Modal
Clicking **"Schedule"** on any pipeline opens the multi-schedule viewer (`PipelineScheduleModal.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 📅 Pipeline Schedules                                                               ✕ │
│    AzureSql_03_MasterPipeline                                  [ 2 Schedules ]   [ 🔄 ] │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ● Overall Status: Pipeline has active trigger schedules configured                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚀 Schedule #1: Daily Trigger                                          🟢 Enabled  │ │
│ │    Type: Daily                          Timezone: UTC                              │ │
│ │    Trigger Time: 04:00:00 UTC           Local: 09:30:00 AM IST                     │ │
│ │    ⏰ Next Scheduled Run: Sep 13, 2026, 04:00:00 AM UTC                            │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🚀 Schedule #2: Weekend Full Sync                                      🟢 Enabled  │ │
│ │    Type: Weekly (Sunday)                Timezone: UTC                              │ │
│ │    Trigger Time: 01:00:00 UTC           Days: Sunday                               │ │
│ │    ⏰ Next Scheduled Run: Sep 13, 2026, 01:00:00 AM UTC                            │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Official Fabric Schedule API:** Direct integration with `GET /items/{itemId}/jobs/Pipeline/schedules`.
2. **Multi-Schedule Support:** Displays every schedule configured on the pipeline (Daily, Weekly, custom days of week).
3. **Active/Disabled State:** Visual green badge for enabled schedules and gray badge for paused triggers.
4. **Timezone Conversion:** Displays execution times in UTC and the operator's local browser timezone.
5. **Next Run Forecast:** Calculates the exact upcoming trigger timestamp.

---

### Screen 11: Lakehouse / Warehouse Dynamic Table Log Mapping Modal
Clicking **"Table Log Config"** in the top header opens the dynamic schema mapping modal (`TableLogConfigModal.jsx`):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🗄️ Lakehouse / Warehouse & Dynamic Column Mapping                                             ✕ │
│    Connect dynamically to your Fabric SQL Endpoint and map table logging schemas                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ 1. Source & Tables ]  [ 2. Batch Header Mapping ]  [ 3. Bronze Log Mapping ]  [ 4. Silver Log ]│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Select Lakehouse or Warehouse Artifact                                                   │
│ [ Lakehouse_Finance_Prod (Lakehouse) - 4d19f1c8...                                       ▼ ]     │
│ Server FQDN: xxxxxxxx.datawarehouse.fabric.microsoft.com  Database: Lakehouse_Finance_Prod        │
│                                                                                                  │
│ Select Target Logging Tables:                                                                    │
│ • Batch Header Table:  [ dbo.batch_execution_header                                      ▼ ]     │
│ • Bronze Log Table:    [ dbo.bronze_table_load_log                                       ▼ ]     │
│ • Silver Log Table:    [ dbo.silver_table_load_log                                       ▼ ]     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Step 2: Batch Header Column Mapping (Dynamic Dropdowns populated from SQL Endpoint)              │
│ • Batch ID:           [ batch_id                   ▼ ]   • Pipeline Run ID: [ pipeline_run_id ▼ ]│
│ • Status:             [ batch_status               ▼ ]   • Total Tables:    [ table_count     ▼ ]│
│ • Start Timestamp:    [ start_time                 ▼ ]   • End Timestamp:   [ end_time        ▼ ]│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Step 3: Bronze Log Column Mapping                                                                │
│ • Batch ID:           [ batch_id                   ▼ ]   • Source Name:     [ source_system   ▼ ]│
│ • Table Name:         [ target_table               ▼ ]   • Operation:       [ etl_operation   ▼ ]│
│ • Source Rows:        [ src_row_count              ▼ ]   • Inserted Rows:   [ ins_row_count   ▼ ]│
│ • Status:             [ execution_status           ▼ ]   • Duration (s):    [ duration_sec    ▼ ]│
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [ 🗑️ Reset Mapping ]                                                    [ Cancel ]  [ 💾 Save ] │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Zero Hardcoding:** No pre-baked table or column names; everything is introspected dynamically via Fabric REST APIs (`/lakehouses`, `/warehouses`, and SQL metadata queries).
2. **4-Step Tabbed Workflow:**
   - **Tab 1 (Source & Tables):** Auto-discovers artifacts and fetches available schema tables (`sys.tables`).
   - **Tab 2 (Batch Header):** Maps batch run metadata (`batch_id`, `pipeline_run_id`, status, timestamps).
   - **Tab 3 (Bronze Log):** Maps bronze extraction logs, row counts, source system names, and operations (`Data Load` vs `Source Delete`).
   - **Tab 4 (Silver Log):** Maps silver transformations, source-to-target table names, and transformed row counts.
3. **Reset Mapping Button:** Easily clear existing mappings to configure a different Lakehouse or schema.
4. **Instant Persistence:** Stores mappings in SQLite table `table_log_mappings` for sub-millisecond query execution.

---

### Screen 12: End-to-End Table Log Lineage & Ingestion Dashboard Modal
Clicking **"Table Logs"** on any pipeline row opens the full ETL lineage dashboard (`TableLogDashboardModal.jsx`):

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🗄️ Table Level Execution Logs: AzureSql_03_MasterPipeline                                                            ✕ │
│    Showing ETL table load logs for Batch #104 (Run: e2e28432)                              [ ⚙️ Configure Mapping ] [ 🔄 ]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                            │
│ │ Total Tables  │ │ Loaded (100%) │ │ Failed Tables │ │ Avg. Duration │ │ Rows Loaded   │                            │
│ │ 8 Tables      │ │ 8 Tables      │ │ 0 Clean       │ │ 14.2s         │ │ 1,245,890     │                            │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────────────┐        │
│ │ 🥈 Silver Layer Overview                            │ │ 🥉 Bronze Layer Overview                            │        │
│ │ Total: 4 tables  │  Status: 4 Succeeded, 0 Failed   │ │ Total: 4 tables  │  Status: 4 Succeeded, 0 Failed   │        │
│ │ Duration: 18.4s  │  Rows: 622,945 transformed       │ │ Duration: 10.0s  │  Rows: 622,945 extracted         │        │
│ └─────────────────────────────────────────────────────┘ └─────────────────────────────────────────────────────┘        │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 🔍 [ Search tables...                  ]   Layer: [ All ▼ ]   Status: [ All ▼ ]   Showing 8 of 8 tables                │
│ ┌──────┬──────────────┬────────────────────────┬─────────────┬───────────┬──────────────┬────────────┬───────────────────┐ │
│ │LAYER │ SOURCE       │ SCHEMA.TABLE           │ OPERATION   │ STATUS    │ DURATION     │ ROW COUNTS │ ERROR / FIX       │ │
│ ├──────┼──────────────┼────────────────────────┼─────────────┼───────────┼──────────────┼────────────┼───────────────────┤ │
│ │BRONZE│ AzureSQL_CRM │ dbo.customers_raw      │ Data Load   │ ✔ Success │ 8.2s         │ 150,000    │ —                 │ │
│ │BRONZE│ AzureSQL_ERP │ dbo.orders_raw         │ Data Load   │ ✔ Success │ 12.1s        │ 472,945    │ —                 │ │
│ │SILVER│ Bronze_Delta │ silver.dim_customers   │ Data Load   │ ✔ Success │ 14.5s        │ 150,000    │ —                 │ │
│ │SILVER│ Bronze_Delta │ silver.fact_orders     │ Data Load   │ ✔ Success │ 22.3s        │ 472,945    │ —                 │ │
│ └──────┴──────────────┴────────────────────────┴─────────────┴───────────┴──────────────┴────────────┴───────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### What you see:
1. **Batch ID Dropdown & Pipeline Correlation:** Correlates `pipeline_run_id` to Batch Header automatically, with a dropdown to jump between any recorded batch runs.
2. **5 Core KPI Metric Cards:** Total Tables, Successfully Loaded, Failed Tables, Avg. Load Duration, and Rows Processed.
3. **Dual Layer Summary Cards:** Visual split between Bronze and Silver ingestion metrics.
4. **Operation Differentiation:** Clearly distinguishes between `Data Load` and `Source Delete` operations.
5. **Row Ingestion Progression:** Tracks source rows versus inserted rows across layers to verify 100% data integrity.
6. **Failed Table Debugging with Gemini AI:** If an individual table load fails, clicking its error launches the AI diagnostic service with the table's exact error context.

---

### Screen 13: Pipeline Schedules Slide-Over Drawer
Clicking **"Schedules"** in the top navigation opens the workspace-wide schedule drawer (`SchedulesDrawer.jsx`):

```
┌──────────────────────────────────────────────────┐
│ 📅 Workspace Scheduled Pipelines               ✕ │
│    All configured triggers in this workspace  🔄 │
├──────────────────────────────────────────────────┤
│ 🚀 AzureSql_03_MasterPipeline        ✔ Enabled   │
│    TYPE: Daily             TIMEZONE: UTC         │
│    ⏰ Next Run: Sep 13, 2026, 04:00:00 AM        │
├──────────────────────────────────────────────────┤
│ 🚀 Oracle_05_MasterPipeline          ✔ Enabled   │
│    TYPE: Weekly            TIMEZONE: UTC         │
│    ⏰ Next Run: Sep 14, 2026, 02:00:00 AM        │
└──────────────────────────────────────────────────┘
```

#### What you see:
* Tenant/workspace schedule inventory (`Enabled`, `Disabled`).
* Schedule frequency (`Daily`, `Weekly`, `Cron`).
* Next execution timestamp in local time.

---

## 3. Code Implementation Structure

```
mymonitor/
├── backend/app/
│   ├── main.py                    # App entrypoint, lifespan worker initialization, static UI mount
│   ├── core/
│   │   ├── config.py              # Pydantic settings loading from .env (SMTP, Azure, timeouts)
│   │   └── rate_limiter.py        # Concurrency semaphore limiting parallel Fabric calls to 5
│   ├── models/
│   │   └── monitoring.py          # Pydantic schemas (PipelineRun, ActivityRun, SlaConfig, Incident)
│   ├── services/
│   │   ├── db_service.py          # SQLite engine, WAL mode, 9-table schema, indexed caching, date engine
│   │   ├── fabric_client.py       # Entra ID OAuth2 token renewal & Fabric REST client
│   │   ├── tree_builder.py        # Resolves dynamic ExecutePipeline hierarchy without hardcoding
│   │   ├── connection_manager.py  # WebSocket room manager (1-to-N multiplexer)
│   │   ├── leased_poller.py       # Leased background poller (queries active viewed workspaces only)
│   │   ├── alert_service.py       # SLA watchdog checking run durations & triggering escalation
│   │   ├── email_service.py       # Gmail SMTP dispatcher formatting HTML alert cards
│   │   ├── ai_diagnostic_service.py # Google Gemini 3.6 Flash diagnostics & SHA-256 caching
│   │   └── table_log_service.py   # Dynamic Lakehouse/Warehouse table logging & ETL lineage
│   └── api/
│       ├── routes_workspaces.py   # REST: /workspaces, /snapshot, /history, /schedules, /table-logs
│       ├── routes_sla.py          # REST: /sla/configs, /sla/test-email, /sla/resolve
│       └── websocket_hub.py       # WebSocket: /ws/workspaces/{workspace_id}
│
└── frontend/src/
    ├── main.jsx                   # Entrypoint with global ErrorBoundary wrapper
    ├── App.jsx                    # Root coordinator component
    ├── hooks/
    │   └── useWorkspaceMonitoring.js # Auto-reconnecting WebSocket streaming hook
    └── components/
        ├── DashboardHeader.jsx    # Top bar with active viewers counter & Table Log Config button
        ├── WorkspaceSelector.jsx  # Dynamic tenant workspace dropdown with instant search
        ├── DateFilterBar.jsx      # Name search, quick presets, 15-day strip & forecast tabs
        ├── PipelineTreeTable.jsx  # Hierarchical table with search & status filters
        ├── PipelineRow.jsx        # Parent row with duration, SLA formatting, resolve button & actions
        ├── ActivityList.jsx       # Activity telemetry, status icons, durations, View Error button
        ├── ErrorDetailModal.jsx   # Gemini 3.6 Flash AI diagnostics, fix steps & raw output
        ├── RunHistoryModal.jsx    # Complete historical runs modal with inner activity inspection
        ├── SlaConfigModal.jsx     # SLA threshold configuration & live email test verification
        ├── SlaIncidentBanner.jsx  # Live breach alert banner with 1-click incident resolution
        ├── PipelineScheduleModal.jsx # Multi-schedule cards (Daily, Weekly, days, UTC/local times)
        ├── TableLogConfigModal.jsx   # Dynamic Lakehouse/Warehouse schema & column mapping modal
        ├── TableLogDashboardModal.jsx # Full ETL table log lineage & row counts dashboard
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
3. **Date-Based Filtering:** Click **"Yesterday"** or **"Sep 08"** on the 15-day strip. The table displays recorded historical executions with accurate status counts (`Running`, `Succeeded`, `Failed`, `Cancelled`, `Not Run`). Click **"Tomorrow"** to view scheduled pipeline projections.
4. **AI Diagnostics:** Click **"View Error"** on a failed activity or table run. Click **"Analyze & Get Fix Steps"**. Google Gemini 3.6 Flash generates root-cause reasoning, probable causes, concrete steps, and remediation scripts in < 2 seconds. Re-opening returns cached results instantly (< 5ms).
5. **Dynamic Table Log Mapping:** Click **"Table Log Config"** in the header. Select a Lakehouse or Warehouse; observe schemas, tables, and column dropdowns populated dynamically from the Fabric SQL Endpoint with zero hardcoding.
6. **End-to-End Table Lineage:** Click **"Table Logs"** on `AzureSql_03_MasterPipeline`. Observe Batch Header KPIs, Silver & Bronze layer overviews, operation filters (`Data Load` vs `Source Delete`), and exact row-count progressions.
7. **Multi-Schedules:** Click **"Schedule"** on any pipeline. Observe multi-schedule cards displaying Daily and Weekly trigger times, days of week, and next scheduled runs.
8. **SLA Test Email & Resolution:** Click **"SLA"** on any pipeline, input your email address, and click **"Send Test Email"**. Check your inbox for the immediate confirmation email from `uiaptracker@gmail.com`. If a run breaches SLA, view the formatted `+4d 3h 15m` badge and click **"Resolve"**.
\n