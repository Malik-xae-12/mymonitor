# Product Requirements Document (PRD)

**Product:** Microsoft Fabric Real-Time Job Monitoring, AI Diagnostics & SLA Alerting Hub
**Status:** Active (Production-grade)
**Last Updated:** 2026-09-23

---

## 1. Problem Statement
Microsoft Fabric Data Factory operators lack a real-time, multi-tenant view of pipeline
executions. Native Fabric tooling is slow, offers no sub-second telemetry, no AI-assisted
root-cause analysis, no SLA breach escalation, and no consolidated Lakehouse/Warehouse
table-level batch lineage. Teams are blind to failures until they are reported downstream.

## 2. Target Users
- **Data Platform / DataOps Engineers** monitoring Fabric Data Factory pipelines.
- **L1 / L2 Support Operators** responding to SLA breaches and failed runs.
- **Data Engineering Leads** reviewing batch lineage and historical run health.

## 3. Main Outcome
Operators see live pipeline health (sub-50ms cached responses), get AI-generated
root-cause + fix guidance on failures, receive automated SLA breach emails, and can trace
end-to-end batch lineage (Batch Header → Bronze → Silver) — all in one Fabric-native
console scoped to the workspaces they are responsible for.

## 4. User Roles & Access Flow

### Roles
| Role | Capabilities |
| :-- | :-- |
| **Admin** | Signs in, sees all Fabric workspaces, assigns L1 & L2 responsibility per workspace, configures SLA1/SLA2 and table-log config per workspace. Full visibility. |
| **L1 Support** | Sees **only** the workspaces/pipelines assigned to them. Monitors runs, views AI diagnostics, run history, schedules, table-level logs. First responder. |
| **L2 Support** | Same scoped visibility as L1 for their assigned workspaces; receives escalations when SLA2 breaches. |

### Onboarding Flow (Admin)
1. Admin signs in with Microsoft Entra ID (Azure AD).
2. Admin selects a Fabric workspace.
3. Admin assigns the **L1** and **L2** responsible users for that workspace.
4. Admin configures **SLA1** (warning/L1) and **SLA2** (breach/L2) thresholds.
5. Admin completes **Table Config** (selects Lakehouse/Warehouse log tables + column mapping).
6. Workspace is now “live” and scoped to the assigned operators.

### Operator Flow (L1 / L2)
1. L1/L2 signs in with Microsoft Entra ID.
2. Sees only their assigned workspaces.
3. Opens a workspace → sees parent pipelines (sub-pipelines nested inside their parent, never at top level) with live status.
4. On failure → opens AI diagnostics. Views run history + status + diagnostics. Views all schedules. Views table-level logs with AI diagnostics.

## 5. MVP Scope
- **Microsoft Entra ID (Azure AD) sign-in** via MSAL (SPA) + FastAPI token validation.
- **Role-based access**: Admin / L1 / L2 with DB-backed per-workspace assignment.
- Admin assignment console (workspace → L1/L2 → SLA1/SLA2 → table config).
- Real-time pipeline run monitoring via WebSocket rooms (1-to-N multiplexing).
- 100% dynamic parent-child pipeline hierarchy (sub-pipelines nested under parent only).
- Differential polling (query only `InProgress` runs; cache terminal runs).
- Date-based telemetry (Last Week → Next Week) with schedule forecasting.
- Google Gemini AI error diagnostics (pipeline failures + table-level logs) with SQLite caching.
- Dynamic Lakehouse/Warehouse table-level logging & batch lineage.
- SLA1/SLA2 watchdog with L1/L2 Gmail SMTP escalation + 1-click resolution.
- Multi-schedule visibility per pipeline.
- **Fabric-native UI** built to the Microsoft Fabric UI kit (via Figma MCP).

## 6. Out of Scope (v1)
- No mobile native app.
- No payment or billing features.
- No non-Fabric data source integrations.
- No horizontal multi-node clustering (single FastAPI process + SQLite).
- No self-service role management outside the Admin console.

## 7. Success Metrics
- Correct role scoping: L1/L2 never see unassigned workspaces.
- Workspace response time < 50ms from cache (vs ~25s cold Fabric calls).
- 90%+ reduction in redundant Fabric REST calls (differential polling).
- SLA breach email dispatched within one watchdog scan cycle.
- Zero redundant Gemini token spend on repeat identical errors (hash cache).
- UI passes Fabric/Fluent design review — pages are self-explanatory, not “AI-generated”.
