# Frontend: Microsoft Fabric Real-Time Job Monitoring Dashboard

The frontend is a modern, high-performance React 19 application built with Vite, Tailwind CSS v4, and Lucide React icons. It provides sub-second live streaming telemetry, date-based filtering covering Last Week to Next Week, Gemini AI error troubleshooting, dynamic Lakehouse/Warehouse table logging, multi-schedule inspection, and SLA configuration.

---

## Architecture & Technology Stack

- **React 19:** Modern functional components with hooks and strict lifecycle control.
- **Vite:** Next-generation frontend build tooling with ultra-fast Hot Module Replacement (HMR) and optimized production chunking.
- **Tailwind CSS v4:** Utility-first CSS styling using modern CSS variables and dark-mode optimization.
- **Lucide React:** Consistent, lightweight, accessible SVG icon library.
- **WebSockets (`useWorkspaceMonitoring`):** Resilient streaming telemetry hook with automatic reconnect, date-filter synchronization, and instant snapshot ingestion.
- **ErrorBoundary:** Top-level error boundary wrapping the application to prevent any child component exception from breaking the dashboard.

---

## Component Hierarchy

```
App.jsx (Root Coordinator & State Manager)
│
├── DashboardHeader.jsx (Sticky Top Navigation Bar)
│   ├── WorkspaceSelector.jsx (Tenant-wide Searchable Dropdown)
│   ├── Connection Badge (Pulsing Green 'Live Sync' / Amber 'Reconnecting...')
│   ├── Active Viewers Counter (👥 X viewers)
│   ├── Refresh Button (Manual Fabric Poll Sync)
│   └── Table Log Config Button (Dynamic Lakehouse/Warehouse Mapping Launcher)
│
├── PipelineTreeTable.jsx (Main Hierarchy & Filter Container)
│   │
│   ├── DateFilterBar.jsx (Date Range & Execution Filter Controls)
│   │   ├── Search by Name (Real-time pipeline & activity search)
│   │   ├── Quick Presets (Last Week, Yesterday, Today, Tomorrow, Next Week, Latest/All)
│   │   ├── Day-by-Day Navigator (15-day interactive strip: Sep 05 → Sep 19)
│   │   ├── Calendar Date Picker (<input type="date">)
│   │   └── Dynamic Metric Cards / Status Tabs:
│   │       ├── Past/Today: All, Running, Succeeded, Failed, Cancelled, Not Run
│   │       └── Future Forecast: Total, Scheduled to Run, Not Scheduled
│   │
│   └── PipelineRow.jsx (Collapsible Pipeline Accordion)
│       ├── Status Badges (Running, Success, Failed, Cancelled, Scheduled, Not Run)
│       ├── SLA Badges (Overdue days/hours/mins + 1-Click Green 'Resolve' Button)
│       ├── Execution Timestamps & Dynamic Duration ('Upcoming' for scheduled runs)
│       ├── Action Buttons:
│       │   ├── [History] -> Opens RunHistoryModal
│       │   ├── [Schedule] -> Opens PipelineScheduleModal
│       │   ├── [SLA] -> Opens SlaConfigModal
│       │   ├── [Table Logs] -> Opens TableLogDashboardModal
│       │   └── [Error] -> Opens ErrorDetailModal (Failed activities only)
│       │
│       ├── ActivityList.jsx (Inner Pipeline Activity Telemetry)
│       │   ├── Activity Type Icons (Copy, Notebook, ExecutePipeline, SQL, Lookup, etc.)
│       │   ├── Status Badges & Timestamps
│       │   └── [View Error] Button
│       │
│       └── Nested PipelineRow.jsx (Child Pipelines Triggered by ExecutePipeline)
│
└── Modals & Drawers
    ├── DateFilterBar.jsx (Integrated in Tree Table)
    ├── ErrorDetailModal.jsx (Deep Error Diagnostics + Google Gemini AI Fix Guide)
    ├── RunHistoryModal.jsx (Historical Runs Archive with Activities, Errors & Table Logs)
    ├── PipelineScheduleModal.jsx (Multi-Schedule Cards: Daily, Weekly, Times, Days, Next Run)
    ├── SlaConfigModal.jsx (Target Minutes, L1/L2 Emails, SMTP Test Buttons)
    ├── SchedulesDrawer.jsx (Workspace-wide upcoming schedule drawer)
    ├── TableLogConfigModal.jsx (Dynamic Lakehouse/Warehouse Schema & Column Mapping)
    └── TableLogDashboardModal.jsx (Batch Header -> Bronze -> Silver Table Logs & Lineage)
```

---

## Key Feature Highlights

### 1. Date-Based Filter Bar (`DateFilterBar.jsx`)
- Replaces static top banners and duplicate metrics with an interactive, date-driven telemetry hub.
- Highlights days with past recorded executions (emerald dots) and future schedule windows (purple dots).
- Dynamically shifts status cards between past execution counts (*Succeeded, Failed, Cancelled, Not Run*) and future forecast counts (*Scheduled, Not Scheduled*).

### 2. Google Gemini AI Diagnostics (`ErrorDetailModal.jsx`)
- One-click **"Diagnose with AI"** button on any failed activity or pipeline run.
- Generates categorized root-cause explanations and numbered step-by-step remediation steps.
- Cached locally in SQLite for instant repeat loads.

### 3. Dynamic Table Logging (`TableLogConfigModal.jsx` & `TableLogDashboardModal.jsx`)
- Configure which Lakehouse or Warehouse to monitor with zero hardcoding.
- Map custom table and column names for Batch Header, Bronze, and Silver logs.
- Inspect real-time batch metrics, row counts, and data load vs source delete operations.

### 4. Multi-Schedule Support (`PipelineScheduleModal.jsx`)
- Renders dedicated schedule cards for pipelines with multiple schedules (e.g. Daily at 08:00 + Weekly on Sundays).
- Displays trigger type, execution times, active days, timezone, and start/end dates.

---

## Development & Build Commands

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```
The Vite development server runs on `http://localhost:3000` and automatically proxies `/api` and `/ws` requests to `http://127.0.0.1:8000`.

### Production Build
```bash
npm run build
```
Compiles the application into `frontend/dist/` in < 1 second. The FastAPI backend automatically serves these static assets on `http://localhost:8000`.