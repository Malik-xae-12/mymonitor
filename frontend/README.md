# Microsoft Fabric Real-Time Monitoring Hub — Frontend

The frontend of the Microsoft Fabric Real-Time Monitoring Hub is a single-page application built with **React** and **Vite**. It provides real-time hierarchical visibility into Microsoft Fabric data pipelines, interactive execution run trees, custom Lakehouse/Warehouse Delta table telemetry, automated SLA incident management, AI error remediation, and administrative team assignments.

---

## Architecture Overview

The frontend follows a **Feature-First Architecture**. Instead of grouping by technical type (e.g. putting all components or all hooks in global folders), business domains are organized into self-contained feature packages under `src/features/`:

```
src/features/<feature-name>/
├── api/             # Typed API client functions for this feature
├── components/      # React UI views, modals, cards, and tables
├── hooks/           # Custom React hooks encapsulating business logic & state
├── context/         # Feature-specific React context (if applicable)
└── index.js         # Public feature barrel export
```

Cross-cutting infrastructure lives in dedicated directories:
- `src/config/`: MSAL authentication, application settings, environment variables.
- `src/services/api/`: Base API client with automatic Entra ID bearer token attachment.
- `src/components/ui/`: Atomic, reusable design system components (Button, Badge, Modal, Input, Spinner).
- `src/components/shared/`: Shared composite UI components used across multiple features.
- `src/context/`: Global theme and visual layout state.

---

## Directory Structure

```
frontend/
├── src/
│   ├── main.jsx                 # Application entry point (MSAL & Theme providers)
│   ├── App.jsx                  # Main view container, tab switcher, workspace selector
│   ├── index.css                # Base stylesheet and theme variables
│   ├── config/                  # MSAL configuration and environment variables
│   │   ├── authConfig.js        # Azure Entra ID client ID, authority, redirect URI
│   │   ├── env.js               # Environment variable helpers (Vite import.meta.env)
│   │   └── msalInstance.js      # PublicClientApplication instance singleton
│   ├── services/                # Global services & HTTP fetch layer
│   │   └── api/
│   │       ├── apiClient.js     # Authenticated fetch wrapper with MSAL token attachment
│   │       └── endpoints.js     # Backend API endpoint URL definitions
│   ├── context/                 # Global UI context
│   │   └── ThemeContext.jsx     # Microsoft Fabric theme provider (Fluent 2 Light Design)
│   ├── constants/               # System constants
│   │   ├── roles.js             # RBAC role constants ('admin', 'l1', 'l2')
│   │   ├── routes.js            # Tab identifiers and navigation route keys
│   │   └── apiConstants.js      # HTTP headers and status codes
│   ├── components/
│   │   ├── ui/                  # Reusable atomic UI components
│   │   │   ├── Badge/           # Status and SLA badges
│   │   │   ├── Button/          # Multi-variant action buttons with loading states
│   │   │   ├── Input/           # Form inputs and search controls
│   │   │   ├── Modal/           # Accessible dialog modals with backdrop blur
│   │   │   └── Spinner/         # Loading spinner animations
│   │   └── shared/              # Shared composite UI components
│   │       ├── Header.jsx       # Top navigation bar with workspace picker & user menu
│   │       ├── ErrorDetailModal.jsx # Error inspection modal with AI diagnostic advice
│   │       ├── SlaBadge.jsx     # Visual SLA status indicator
│   │       └── SlaConfigModal.jsx   # Modal for configuring pipeline SLA thresholds
│   └── features/                # Feature-driven domain packages
│       ├── auth/                # Entra ID SSO login and authentication gate
│       ├── monitoring/          # Pipeline tree tables, metrics, and WebSocket streaming
│       ├── table-logs/          # Lakehouse/Warehouse delta logs and batch dashboards
│       └── admin/               # Support assignment console and user role administration
├── package.json                 # Dependencies and scripts
└── vite.config.js               # Vite build and dev server configuration
```

---

## Infrastructure & Shared Folders

### 1. `src/config/` — MSAL & Environment
- [`authConfig.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/config/authConfig.js): Configures Microsoft Authentication Library (MSAL) for React (`@azure/msal-react`). Defines the Azure Entra ID Client ID, Tenant Authority (`https://login.microsoftonline.com/{TENANT_ID}`), redirect URI, and default login scopes (`User.Read`).
- [`msalInstance.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/config/msalInstance.js): Initializes and exports the singleton `PublicClientApplication` instance.
- [`env.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/config/env.js): Validates and provides typed access to environment variables (`VITE_API_URL`, `VITE_WS_URL`).

### 2. `src/services/api/` — Authenticated HTTP Client
- [`apiClient.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/services/api/apiClient.js):
  - Central `apiFetch(path, options)` wrapper used for all backend network requests.
  - Automatically acquires fresh Microsoft Entra ID tokens silently (`msalInstance.acquireTokenSilent`).
  - Injects `Authorization: Bearer <token>` headers into every outbound request.
  - Provides interactive login fallback if the active session expires.
  - Handles JSON serialization, parsing, and structured HTTP error propagation.
- [`endpoints.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/services/api/endpoints.js): URL constants for backend endpoints.

### 3. `src/components/ui/` — Atomic Design System
- **`Badge/`**: Color-coded badges for pipeline statuses (`Completed`, `Failed`, `InProgress`, `Cancelled`), SLA states, and role tags.
- **`Button/`**: Reusable button component supporting variants (`primary`, `secondary`, `danger`, `ghost`), sizes, and loading spinner states.
- **`Input/`**: Styled input controls for text fields, search bars with icons, and form validation errors.
- **`Modal/`**: Accessible overlay dialog with backdrop blur, smooth entry animations, and keyboard Escape dismissal.
- **`Spinner/`**: Accessible SVG loading spinners.

### 4. `src/components/shared/` — Shared Composite Components
- [`Header.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/components/shared/Header.jsx): Top navigation header featuring the workspace dropdown selector, live WebSocket connection status indicator, manual refresh button with countdown, and signed-in user avatar/profile menu.
- [`ErrorDetailModal.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/components/shared/ErrorDetailModal.jsx): Inspects failed pipeline activities, presents sanitized stack traces, and queries Google Gemini Flash to display root-cause explanations and step-by-step remediation advice.
- [`SlaBadge.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/components/shared/SlaBadge.jsx): Displays SLA status with warning badges, breach indicators, and remaining resolution countdowns.
- [`SlaConfigModal.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/components/shared/SlaConfigModal.jsx): Modal allowing users to configure pipeline-level SLA1 warning minutes, SLA2 breach minutes, and assigned L1/L2 contact emails.

---

## Feature Modules (`src/features/`)

### 1. `auth` — Microsoft Single Sign-On & Access Gate
Protects application routes and manages the user's authentication and RBAC identity.

- [`components/AuthGate.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/auth/components/AuthGate.jsx): Top-level authentication wrapper. If auth is enabled and the user is unauthenticated, intercepts rendering and displays the `LoginPage`.
- [`components/LoginPage.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/auth/components/LoginPage.jsx): Corporate branded sign-in page triggering Microsoft Entra ID interactive popup or redirect login.
- [`context/AuthContext.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/auth/context/AuthContext.jsx): Provides global user session state, resolved security role (`admin`, `l1`, `l2`), and assigned workspace list.
- [`hooks/useAuth.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/auth/hooks/useAuth.js): Hook exposing `user`, `role`, `isAdmin`, `isL1`, `isL2`, `login()`, and `logout()`.
- [`api/authApi.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/auth/api/authApi.js): API calls for `/api/auth/me`, `/api/auth/entra-id/exchange`, `/api/auth/jwt/refresh`, and logout.

---

### 2. `monitoring` — Real-Time Pipeline Hierarchy & Execution Trees
The primary operational monitoring view of the platform.

- [`components/PipelineTreeTable.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/components/PipelineTreeTable.jsx):
  - Renders the hierarchical table displaying parent pipelines, invoked child pipeline runs, and individual activity execution steps.
  - Supports collapsible rows, status badges, execution duration formatting, and error dialog triggers.
- [`components/PipelineRow.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/components/PipelineRow.jsx): Renders an individual pipeline run row with expand/collapse chevron, status indicators, schedule badges, and actions.
- [`components/FabricCommandBar.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/components/FabricCommandBar.jsx): Command toolbar providing live text search, status filters (All, Failed, In Progress, Succeeded), date range pickers, and manual sync triggers.
- [`components/FabricMetricCards.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/components/FabricMetricCards.jsx): Top-level KPI overview cards displaying Total Runs, Active/Running count, Succeeded count, and Failed count for the selected time window.
- [`hooks/useWorkspaceMonitoring.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/hooks/useWorkspaceMonitoring.js):
  - Manages real-time WebSocket connection to `/ws/{workspace_id}`.
  - Maintains the active leased polling session on the backend.
  - Handles fast snapshot retrieval, live incremental updates, search filtering, and date window state.
- [`api/monitoringApi.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/monitoring/api/monitoringApi.js): API calls for `/pipelines/snapshot`, `/pipelines/{id}/history`, `/pipelines/schedules`, and parent pipeline assignments.

---

### 3. `table-logs` — Lakehouse & Warehouse Delta Table Telemetry
Visualizes low-level batch runs, custom delta audit tables, and stage load metrics.

- [`components/TableLogsPage.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/components/TableLogsPage.jsx): Main dashboard showing batch execution history, stage KPIs (Total Tables, Successfully Loaded, Failed, Average Duration, Rows Processed), and Bronze vs. Silver layer load tables.
- [`components/TableLogConfigPage.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/components/TableLogConfigPage.jsx) & [`TableLogConfigModal.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/components/TableLogConfigModal.jsx):
  - Configuration interface allowing users to select target Lakehouses/Warehouses.
  - Interactively maps database columns (Batch ID, Table Name, Schema, Status, Rows Processed, Timestamps) to platform monitoring fields.
- [`components/TableLogDashboardModal.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/components/TableLogDashboardModal.jsx): Modal providing granular inspection of an individual batch run with step execution charts.
- [`hooks/useTableLogs.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/hooks/useTableLogs.js): Custom hook managing artifact discovery, schema fetching, column loading, table previews, and batch log telemetry queries.
- [`api/tableLogsApi.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/table-logs/api/tableLogsApi.js): API calls for discovering data artifacts, fetching schemas, reading column mappings, and executing log queries.

---

### 4. `admin` — Team Assignments & System Administration
Administrative console for managing support operations (Admin-only).

- [`components/AdminConsole.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/admin/components/AdminConsole.jsx): Tabbed container housing User Management and Pipeline Support Teams & SLA.
- [`components/UsersPage.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/admin/components/UsersPage.jsx):
  - Lists registered platform users with their current support roles.
  - Provides modal for adding directory users with autocomplete search against Microsoft Graph API.
  - Enables changing user roles (`admin`, `l1`, `l2`) and revoking access.
- [`components/PipelineTeamsPage.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/admin/components/PipelineTeamsPage.jsx): Fine-grained per-pipeline assignment interface allowing administrators to configure L1 support leads, L2 escalation owners, and custom SLA1/SLA2 thresholds on individual parent pipelines.
- [`hooks/useAdminUsers.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/admin/hooks/useAdminUsers.js): Manages user list state, role changes, and Microsoft Graph directory search queries.
- [`api/adminApi.js`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/features/admin/api/adminApi.js): API calls for `/api/admin/users`, `/api/admin/roles`, `/api/admin/assignments`, `/api/workspaces/{id}/pipeline-assignments`, and `/api/workspaces/{id}/pipelines/{pid}/sla`.

---

## Application Root & Navigation

- **[`src/main.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/main.jsx)**: Mounts React onto `#root`, binds `MsalProvider`, and initializes `ThemeProvider`.
- **[`src/App.jsx`](file:///c:/Users/mohammedabdulmalik.m/Documents/myapplications/monitor/mymonitor/frontend/src/App.jsx)**:
  - Top-level application shell wrapped by `AuthGate`.
  - **Pipeline-Level Scoping**: Uses `assignedPipelineIds` from `useAuth()` to ensure L1 and L2 engineers strictly see only the pipelines assigned to them.
  - Coordinates active workspace state across features.
  - Manages primary view navigation:
    1. **Monitoring Hub**: Live hierarchical pipeline and activity run trees, metric overview cards, and real-time SLA breach alerts.
    2. **Table Logs**: Lakehouse/Warehouse Delta table telemetry and KPIs.
    3. **Table Log Configuration Wizard**: Admin-guided column and schema mapping.
    4. **Admin Console**: User roles and pipeline SLA team assignments (accessible to Administrators).
  - Listens for global refresh signals and WebSockets (`INCIDENT_CREATED`, `SLA_BREACHED`, `SLA2_BREACHED`, `INCIDENT_RESOLVED`) for zero-polling real-time updates.
