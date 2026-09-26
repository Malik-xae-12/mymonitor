# Microsoft Fabric Monitoring Hub — Architectural Decision Records (ADRs)

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Approved & Enforced  

---

## ADR-001: Microsoft Entra ID Authentication & In-Memory JWKS Key Rotation

### Context
The platform requires secure enterprise single sign-on (SSO) integrated with organizational identity providers. Authenticating each HTTP request by making an external network round-trip to Microsoft Entra ID creates severe latency and failure points if the identity provider suffers brief outages.

### Decision
Implement Microsoft Entra ID OpenID Connect / OAuth 2.0 with JWT Bearer tokens. The backend fetches Microsoft's JSON Web Key Set (`jwks_uri`) and caches the public keys in memory with a 24-hour expiration window. Incoming tokens are verified locally by matching the key ID (`kid`) header and decoding the signature using `cryptography` and `PyJWT`.

### Consequences
- **Pros**: Sub-millisecond JWT validation (<1ms), zero external network latency per API request, seamless SSO for enterprise users.
- **Cons**: Public keys must be refreshed if Microsoft rotates keys (handled gracefully with automatic fallback retry on signature verification failure).

---

## ADR-002: Dual-Speed WebSocket Leased Poller & Terminal State Caching

### Context
Microsoft Fabric enforces strict API rate limits (HTTP 429). Naively polling dozens of workspaces and hundreds of historical pipeline activities continuously exhausts API quotas, degrades dashboard responsiveness, and inflates cloud costs.

### Decision
Implement **Leased Polling** with **Dual-Speed Adaptive Intervals** and **Permanent Terminal State Caching**:
1. **Leased Polling**: Polling is strictly restricted to workspaces currently viewed by at least one connected browser client via WebSockets (`connection_manager.get_active_workspace_ids()`). If 0 users are viewing a workspace, polling is suspended.
2. **Dual-Speed Intervals**:
   - Active Speed (`POLL_INTERVAL_ACTIVE_SECONDS = 3.5s`): Engaged when at least 1 pipeline is actively running (`InProgress`).
   - Idle Speed (`POLL_INTERVAL_IDLE_SECONDS = 15.0s`): Activated when all pipelines are in terminal states.
3. **Permanent Caching**: Terminal runs (`Completed`, `Failed`, `Cancelled`) have immutable activity trees. Once stored in SQLite, activity API calls are permanently skipped for these executions.

### Consequences
- **Pros**: Reduces Fabric REST API calls by **80%** during idle periods; eliminates HTTP 429 throttling; serves trees from local SQLite in <15ms; provides live ticking stopwatch duration for active runs.
- **Cons**: Background poller must track connected WebSocket clients accurately (handled via connection manager lifecycle hooks).

---

## ADR-003: Pure SQLAlchemy Async ORM Migration & Zero Raw SQL Policy

### Context
The initial prototype utilized raw string SQL queries via `aiosqlite`. As the platform expanded with complex subqueries, union queries, and relational joins across workspaces, pipelines, incidents, and roles, raw SQL strings introduced risks of SQL injection, lack of type safety, and code duplication.

### Decision
Migrate 100% of internal application data access across all repositories (`workspaces`, `pipelines`, `users`, `sla`, `table_logs`, `diagnostics`) to **SQLAlchemy 2.0 Async ORM**:
- Declarative models inheriting from `app.db.base.Base`.
- Asynchronous sessions via `async_session_maker()`.
- High-performance SQLite bulk upserts via `sqlalchemy.dialects.sqlite.insert` with `on_conflict_do_update()`.
- Eager relationship loading via `selectinload()`.
- Explicit subqueries and window joins using `select()`, `subquery()`, and `func.max()`.

### Consequences
- **Pros**: 100% type safety, zero SQL injection vulnerability, automated schema validation, clean repository abstractions, seamless testability.
- **Cons**: Requires strict layer discipline to ensure ORM models are mapped to Pydantic schemas before returning across API boundaries.

---

## ADR-004: Dynamic Parent/Child Pipeline Resolution & Hierarchy Flattening

### Context
In Microsoft Fabric, master pipelines invoke child pipelines using `ExecutePipeline` activities. If displayed naively, child pipelines appear twice: once inside the parent's activity list and once as a standalone root-level row. This clutters the interface and confuses operators.

### Decision
Implement dynamic parent/child pipeline detection in `leased_poller` and `pipeline_repository`:
1. Discover child executions dynamically by inspecting `output.pipelineRunId` and `input.pipeline.referenceName` on `ExecutePipeline` activities.
2. Recursively fetch and embed the child pipeline's execution tree inside `activity["childPipeline"]`.
3. Invoke `pipeline_repository.update_child_pipeline_flags()` to flag discovered child pipelines with `is_master = 0`.
4. Ensure `get_workspace_latest_tree` queries exclusively `is_master = 1` for root rows.

### Consequences
- **Pros**: Clean, uncluttered UI mirroring the actual orchestration architecture; single unified view of complex hierarchical workloads.
- **Cons**: Poller must perform recursive activity inspection for nested executions (bounded to 5 recursion levels).

---

## ADR-005: Two-Tier SLA Engine & Automated Watchdog Escalation

### Context
Enterprise data teams require guaranteed operational response times. Standard email alerts sent to generic distribution lists lead to notification fatigue and unaddressed pipeline failures.

### Decision
Implement a **Two-Tier SLA Engine** with an automated background watchdog:
1. **Tier 1 (L1 Alert)**: When a pipeline fails, an incident is created (`status = 'ACTIVE'`), and a rich HTML alert email is immediately dispatched to the designated L1 support engineer with the failure diagnostics and target SLA countdown.
2. **Tier 2 (L2 Escalation)**: A background watchdog evaluates active incidents every 5 seconds. If `now_utc >= sla_target_time` without resolution, status updates to `ESCALATED_L2`, an urgent escalation email is dispatched to the senior L2 lead, and a red breach alert is broadcast over WebSockets.
3. **Audit Resolution**: Incidents can be resolved by operators, recording the resolver and timestamp.

### Consequences
- **Pros**: Enforces accountability; prevents silent failures from lingering; provides clear audit history of incident resolution.
- **Cons**: Requires accurate SMTP credentials and email address configuration.

---

## ADR-006: Direct Fabric Lakehouse/Warehouse Ingestion Audit Lineage

### Context
Monitoring pipeline status alone does not guarantee data validity. Operators need visibility into row-level throughput, rejected rows, and duration across Delta table layers (Batch Header ➔ Bronze ➔ Silver).

### Decision
Establish direct read-only T-SQL connectivity to the Fabric Lakehouse and Warehouse SQL Endpoints via `pyodbc` using the operator's Azure OAuth token. Allow administrators to configure schema and column mappings in the UI.

### Consequences
- **Pros**: End-to-end data lineage; instant identification of data-level discrepancies; visibility into ingestion batch throughput.
- **Cons**: Requires Azure SQL ODBC driver (Driver 17/18 for SQL Server) on the host environment.

---

## ADR-007: Elimination of Refresh Token Poller in Favor of Silent Client Refresh

### Context
Maintaining a background polling loop to continuously refresh tokens for offline users consumes server resources, clutters database tables, and introduces security risks if cached tokens linger unnecessarily.

### Decision
Eliminate the background token refresh scheduler. Token lifecycle is managed strictly on-demand:
- Frontend MSAL client performs silent token renewal against Microsoft Entra ID using standard PKCE flow.
- Backend verifies incoming Bearer tokens statelessly using public JWKS keys.
- Refresh tokens are only stored for explicit offline user sessions and are pruned upon logout or revocation.

### Consequences
- **Pros**: Cleaner architecture; zero background token polling overhead; enhanced security compliance.
- **Cons**: Inactive sessions naturally expire and require re-authentication.

---

## ADR-008: Microsoft Fabric Fluent 2 Light Design System (Zero Dark Mode)

### Context
Initial documentation inaccurately referenced dark mode mission-control themes. The actual application interface is designed to provide seamless visual continuity for operators working daily in Microsoft Fabric (`app.fabric.microsoft.com`).

### Decision
Standardize the frontend exclusively on the **Microsoft Fabric Fluent 2 Light Design System**:
- **Canvas & Surface Palette**: `#faf9f8` canvas, `#ffffff` card/table containers, `#f3f2f1` subheaders/column headers, `#edebe9`/`#e1dfdd` Fluent borders.
- **Brand Identity**: Microsoft Fabric Brand Blue `#0f6cbd` (hover `#115ea3`, active tint `#eff6fc`).
- **Typography**: `"Segoe UI Variable Text", "Segoe UI", -apple-system, Roboto, sans-serif` with high-contrast text (`#242424` primary, `#605e5c` secondary).
- **Semantic Badges**: High-contrast, soft-tinted status badges (`#dff6dd` for succeeded, `#fde7e9` for failed, `#eff6fc` for running, `#f3f2f1` for cancelled/not run).
- **Explicit Invariant**: There is **no dark mode**; all components adhere strictly to Microsoft Fabric's clean, modern light aesthetic.

### Consequences
- **Pros**: 100% aesthetic alignment with native Microsoft Fabric; zero cognitive dissonance for Fabric engineers; clean enterprise readability.
- **Cons**: Users preferring high-contrast dark themes must rely on OS-level contrast tools.

---

## ADR-009: Consolidation of Admin and Users Modules into Unified User Setup Domain

### Context
Previously, platform administration endpoints (`/api/admin/assignments`, `/api/admin/users`, `/api/admin/users/role`) were divided between an `admin` module and a `users` module. Since workspace L1/L2 assignments, user directory syncing, and role provisioning are all facets of user setup and access governance, maintaining two separate modules caused unnecessary architectural fragmentation.

### Decision
Consolidate `admin` and `users` into a unified `users` module (`backend/app/modules/users`):
1. **Unified Schema**: `users/schema.py` defines user profiles, roles, and workspace assignment schemas.
2. **Unified Service**: `users_service` manages user lifecycles, Entra ID sync, role changes, and workspace support team assignments (`list_all_assignments`, `upsert_assignment`, `delete_assignment`).
3. **Unified Router**: `users/router.py` mounts `/api/admin/assignments`, `/api/admin/users`, `/api/roles`, and `/api/users/...` routes, preserving 100% backwards compatibility with the frontend.
4. **Deprecate Separate Admin Router**: Mount `users_router` directly in `app_factory.py`, maintaining lightweight re-exports in `admin/` for backwards compatibility.

### Consequences
- **Pros**: Cleaner domain boundaries; reduced module fragmentation (9 cohesive modules instead of 10); single source of truth for user access and support assignments.
- **Cons**: None; full URL route compatibility maintained for all frontend API calls.

---

## ADR-010: Elimination of `workspaces` Table and Merging of `workspace_assignments` into `sla_configs`

### Context
Maintaining a local `workspaces` table introduced unnecessary synchronization overhead: when new workspaces were granted to the Service Principal in Fabric, cached database records caused latency or required manual sync. Furthermore, having separate `workspace_assignments` and `sla_configs` tables led to overlapping and duplicated data (both stored L1/L2 emails and SLA thresholds).

### Decision
1. **Live Workspace Discovery**: Retrieve workspaces live from Microsoft Fabric via `/v1/workspaces`. The local `workspaces` table is deleted.
2. **Consolidate into `sla_configs`**: Remove `workspace_assignments` and standardize on `sla_configs` (`pipeline_id` PK) as the sole source of truth for pipeline assignments, display names, L1/L2 contacts, and SLA thresholds.

### Consequences
- **Pros**: Zero cache staleness when Fabric workspace access changes; single source of truth for all support assignments; simpler database schema.
- **Cons**: Slightly dependent on Fabric REST API response times for workspace listings (mitigated by HTTP client pooling and client-side caching in React).

---

## ADR-011: Three-Tier SLA Escalation (`CRITICAL_UNRESOLVED`) and Granular Pipeline-Level Scoping

### Context
Previously, when SLA1 expired, an incident transitioned to `ESCALATED_L2` and alerted the L2 engineer, but there was no further escalation if the failure remained unresolved past SLA2. Additionally, non-admin L1 and L2 engineers could see all pipelines in an assigned workspace rather than only the specific pipelines assigned to their responsibility.

### Decision
1. **Three-Tier SLA Escalation Engine**:
   - `ACTIVE`: Pipeline fails, L1 alerted immediately.
   - `ESCALATED_L2`: SLA1 expires without resolution, L2 lead alerted.
   - `CRITICAL_UNRESOLVED`: SLA2 expires without resolution, urgent critical alert dispatched to **both L1 and L2 leads**, accompanied by an automated recurring reminder every 30 minutes until resolved.
2. **Granular Pipeline-Level Scoping**:
   - `users_service.resolve_access()` queries `sla_configs` to determine both `assigned_workspace_ids` and `assigned_pipeline_ids`.
   - The frontend `scopedPipelineTree` filters the pipeline tree so that non-admin engineers strictly see their assigned pipelines within workspaces.

### Consequences
- **Pros**: Complete escalation lifecycle preventing unmonitored breaches; guaranteed operational attention for critical outages; strict least-privilege visibility for operational support staff.
- **Cons**: Requires active SMTP infrastructure to deliver recurring critical reminders.
