# Frontend: Microsoft Fabric Real-Time Job Monitoring Dashboard

The frontend is a modern, high-performance, real-time React 19 application built with Vite, Tailwind CSS v4, and Lucide React icons. It provides sub-second live streaming telemetry, interactive hierarchical pipeline views, deep execution history, SLA configuration, and error diagnostics.

---

## Architecture & Technology Stack

- **React 19:** Modern functional components with hooks and strict lifecycle control.
- **Vite:** Next-generation frontend build tooling with ultra-fast Hot Module Replacement (HMR).
- **Tailwind CSS v4:** Utility-first CSS styling using modern CSS variables and dark-mode optimization.
- **Lucide React:** Consistent, lightweight, accessible SVG icon library.
- **WebSockets (`useWorkspaceMonitoring`):** Resilient streaming telemetry hook with automatic reconnect, exponential backoff, and instant snapshot ingestion.
- **ErrorBoundary:** Top-level error boundary wrapping the application to prevent any child component exception from breaking the dashboard.

---

## Component Hierarchy

```
App.jsx (Root Coordinator)
│
├── ErrorBoundary.jsx (Crash Shield)
│
├── DashboardHeader.jsx (Sticky Top Navigation)
│   ├── WorkspaceSelector.jsx (Tenant-wide Searchable Dropdown)
│   ├── Active Viewers Counter (👥 X active viewers)
│   ├── Live WebSocket Status Pill (Pulsing Green / Reconnecting Amber)
│   └── Summary Metric Cards (Total, Running, Succeeded, Failed)
│
├── SlaIncidentBanner.jsx (Active SLA Breach Alert Banner + 1-Click Resolution)
│
├── PipelineTreeTable.jsx (Main Content Area)
│   ├── Search & Status Filter Pills (All, Running, Failed, Succeeded, Never Run)
│   └── PipelineRow.jsx (Collapsible Pipeline Accordion)
│       ├── SLA Status Badge (OK / Breached / InProgress Countdown)
│       ├── Duration Badge (Calculated mm:ss / hh:mm:ss)
│       ├── Action Buttons ([History], [SLA])
│       │
│       ├── ActivityList.jsx (Inner Pipeline Activity Telemetry)
│       │   ├── Activity Type Icons (Copy, Notebook, ExecutePipeline, SQL, Script)
│       │   ├── Live Status Spinners
│       │   ├── Duration & Timestamps
│       │   └── [View Error] Button
│       │
│       └── Nested PipelineRow.jsx (Child Pipelines Triggered by ExecutePipeline)
│
├── Modals & Drawers
│   ├── ErrorDetailModal.jsx (Deep Error Diagnostics & 1-Click Copy)
│   ├── RunHistoryModal.jsx (Historical Runs Archive with Inner Activities & Errors)
│   ├── SlaConfigModal.jsx (Warning/Breach Thresholds, L1/L2 Emails, Test Email Buttons)
│   └── SchedulesDrawer.jsx (Slide-over Upcoming Schedule Telemetry)
```

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
Compiles the application into `frontend/dist/`. The FastAPI backend automatically serves these static assets on `http://localhost:8000`.\n