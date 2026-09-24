# Architecture Decision Records (ADRs)

**Last Updated:** 2026-09-23

---

## ADR-001: SQLite with WAL instead of PostgreSQL
- **Context**: Single-process FastAPI deployment; sub-50ms cached reads required.
- **Decision**: Use SQLite with `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=30000`.
- **Consequences**: Extremely fast local reads, zero DB server ops. Trade-off: not suited
  for multi-node horizontal scaling (explicitly out of scope for v1).

## ADR-002: Differential Polling (cache terminal runs)
- **Context**: Fabric REST APIs rate-limit (HTTP 429) under frequent polling.
- **Decision**: Permanently cache terminal runs; re-query only `InProgress` runs.
- **Consequences**: ~90% fewer redundant calls; near-real-time freshness for active runs.

## ADR-003: Leased Poller + 1-to-N WebSocket Multiplexing
- **Context**: Many operators may view the same workspace simultaneously.
- **Decision**: Workspaces with 0 viewers sleep; N viewers share a single Fabric call and
  receive a broadcast snapshot.
- **Consequences**: Constant Fabric load regardless of viewer count; idle workspaces cost nothing.

## ADR-004: Gemini AI Diagnostics with Hash Cache
- **Context**: Repeated identical pipeline errors would waste AI tokens.
- **Decision**: Cache root-cause analysis in `ai_error_diagnostics` keyed by `error_hash`.
- **Consequences**: Sub-5ms repeat loads, zero redundant token spend.

## ADR-005: Playwright MCP for UI Verification
- **Context**: Need automated browser verification of the operations console.
- **Decision**: Use Microsoft's `@playwright/mcp` server configured in `.agents/mcp_config.json`.
- **Consequences**: Agent can smoke-test localhost:3000, run the responsive matrix, and
  capture console/network errors without manual QA.

## ADR-006: Microsoft Entra ID (Azure AD) + ID-token validation
- **Context**: App needs org sign-in and Admin/L1/L2 roles; only a SPA client id is provisioned.
- **Decision**: MSAL SPA acquires an **ID token** (aud = client id); FastAPI validates it against
  the Entra JWKS (issuer + audience + signature) using `PyJWT[crypto]`.
- **Consequences**: No custom API app registration required for v1. Trade-off: to call MS Graph
  or expose scoped API permissions later, a dedicated API app registration + scopes would be added.

## ADR-007: DB-backed RBAC via `workspace_assignments`
- **Context**: Admin assigns responsibility per workspace; L1/L2 must be scoped.
- **Decision**: Store `l1_email`/`l2_email` (+ SLA1/SLA2) per workspace in SQLite; resolve role
  and scope at request time. Bootstrap admins via `ADMIN_EMAILS`.
- **Consequences**: Simple, transparent scoping reusing the existing `aiosqlite` layer; no
  external identity store needed. Admin membership changes require an env update (acceptable for v1).

## ADR-008: Figma MCP (Framelink) for Fabric UI kit fidelity
- **Context**: UI must match the Microsoft Fabric UI kit and not look AI-generated.
- **Decision**: Use Framelink `figma-developer-mcp` (needs `FIGMA_API_KEY`) to pull frame specs
  and tokens from the Fabric UI kit and map them to Tailwind/Fluent components.
- **Consequences**: Design fidelity to Fluent 2. Trade-off: requires a Figma token + the kit's
  file key; when unavailable, fall back to documented Fluent 2 principles.

## ADR-009: Restructure into feature modules (keep working code)
- **Context**: Existing app is functional but flat (`api/` + `services/`).
- **Decision**: Introduce `app/modules/<domain>/` (router/service/repository/schema/models) and a
  feature-based `frontend/src/features/` layout, while keeping `db_service` + engines intact.
- **Consequences**: Cleaner boundaries and testability without a risky big-bang rewrite.

## ADR-011: SLA defined per parent pipeline (SLA1/SLA2); L1/L2 emails per workspace
- **Context**: Admin needs distinct warning/breach thresholds per parent pipeline, but a single
  responsible L1/L2 pair per workspace.
- **Decision**: `sla_configs` (per pipeline) gains `sla1_minutes` (warn→L1) + `sla2_minutes`
  (breach→L2); `sla_minutes` mirrors SLA1 for the existing alert engine. L1/L2 emails stay in
  `workspace_assignments`. Admin page lists parent pipelines (`is_master=1`) and saves SLA per row.
- **Consequences**: Fine-grained SLA control without changing RBAC scoping. Sub-pipelines inherit
  from their parent. Verified end-to-end via Playwright (SLA1=15/SLA2=45 persisted).

## ADR-012: MSAL account APIs only after initialize()
- **Context**: `@azure/msal-browser` v4 throws `uninitialized_public_client_application` if
  `getAllAccounts()` / `getActiveAccount()` run before `initialize()`.
- **Decision**: `msalInstance.js` only constructs the instance + registers an event callback at
  module load; active-account selection moved into `main.jsx` bootstrap **after** `initialize()`.
- **Consequences**: No more blank-screen crash on load; login/redirect flow intact.

## ADR-010: Table-level RBAC (`roles` + `users`) over env-only admin list
- **Context**: Admin identity/roles must be data-driven, not just an env list.
- **Decision**: Add `roles` (admin/l1/l2) and `users` (email + role_id) tables. `ADMIN_EMAILS`
  is now only a **bootstrap seed** that upserts admin users on startup; role resolution reads the
  `users` table (admin wins), else derives L1/L2 from `workspace_assignments` and syncs it back.
  Saving an assignment auto-creates the L1/L2 users with the right role.
- **Consequences**: Admins can promote/demote users at runtime via the Users & roles page; roles
  persist in the DB. Kept on `aiosqlite` (no ORM) per ADR-001. Verified end-to-end via Playwright.

## ADR-013: Adaptive Dual-Speed Differential Poller
- **Context**: Polling all pipelines every 3.5 seconds wastes API quota when pipelines are already in a terminal state (`Completed`, `Failed`).
- **Decision**: Implement dual-speed adaptive polling:
  - **Active Mode (3.5s)**: Triggered when at least one pipeline is `InProgress`.
  - **Idle Mode (15.0s)**: Engaged when all pipelines are in terminal states.
  - **Differential Filtering**: During fast cycles, only running pipelines hit Fabric; completed pipelines are skipped until their 15.0s interval elapses.
- **Consequences**: Up to 80% reduction in Fabric API requests; eliminates HTTP 429 risks while maintaining real-time sub-second duration tracking for active workloads.

## ADR-014: Immutable Fabric Job Instances for In-Flight Re-Run Detection
- **Context**: Detecting when a pipeline that previously succeeded is re-run by a user or scheduled trigger.
- **Decision**: In Fabric, re-runs create immutable job instances with brand-new GUID run IDs. SQLite stores all runs and selects the active execution via `MAX(COALESCE(start_time, '1970-01-01'))`. Because the new run ID is not in `cached_terminal_run_ids`, it is tracked live and immediately replaces the old run in the tree table.
- **Consequences**: Seamless live transition from `Completed` to `InProgress` with zero stale state, while preserving full run history for audits.

## ADR-015: Multi-Tier RBAC Scoping & Admin Control Masking
- **Context**: L1/L2 support personnel must only see the workspaces and pipelines they own, and must not see admin setup or table mapping options.
- **Decision**: Backend resolves assigned workspaces across both `workspace_assignments` AND per-pipeline `sla_configs`. Frontend derives `scopedWorkspaces` and `scopedPipelineTree` matching `l1Email`/`l2Email` to `user.email`. Admin Console and Table Map ("Map Columns") buttons are conditionally hidden for non-admins. Summary metrics compute exclusively over the scoped set.
- **Consequences**: Zero data leakage between support teams; administrative controls are completely invisible to non-admin operators.
