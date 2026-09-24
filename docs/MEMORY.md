# Project Memory & Active State

Maintains the dynamic pulse of the project across sessions.

---

## Current Status
- **Phase**: Phase 5 — Auth & RBAC + admin SLA setup (per-pipeline SLA delivered)
- **Active Task**: TASK-507 (scope monitoring APIs + workspace picker to assigned workspaces)
- **Last Updated**: 2026-09-23

## Completed Milestones
- [x] Playwright MCP configured & health-checked; Chromium pre-installed
- [x] Figma MCP (Framelink) configured — pending user `FIGMA_API_KEY`
- [x] `docs/` suite updated for auth/RBAC/Fabric-UI scope
- [x] Backend Entra ID token validation + RBAC guards (`modules/auth`)
- [x] Table-level RBAC: `roles` + `users` tables; `modules/users` (models/repo/service/schema/router)
- [x] Seed roles + bootstrap admins from `ADMIN_EMAILS` on startup
- [x] `/api/auth/me`, admin assignment + users/roles endpoints
- [x] Frontend MSAL provider + auth config + login gate + role context
- [x] Admin console: pivot tabs — Workspace access + Users & roles
- [x] Playwright smoke test passed (assignment save → L1/L2 users auto-created w/ roles)
- [x] Per-parent-pipeline SLA1/SLA2 (admin table) + `GET /{ws}/parent-pipelines` — Playwright verified
- [x] Removed top-bar workspace selector + Table Log Config button
- [x] Fixed MSAL `uninitialized_public_client_application` crash (init before account APIs)

## Immediate Next Steps
1. Register `http://localhost:3000` as a SPA redirect URI in the Entra ID app registration.
2. Set real `ADMIN_EMAILS` in `.env` and `FIGMA_API_KEY` in `.agents/mcp_config.json`.
3. Scope monitoring APIs + workspace picker to the caller's assigned workspaces (TASK-507).
4. Begin Fabric UI redesign (Phase 7) pulling from the Fabric UI kit via Figma MCP.

## Dev run notes
- Auth-bypass mode for local UI work: frontend `VITE_AUTH_ENABLED=false` + backend
  `AUTH_ENABLED=False` (env override). Both MUST match or `/api/auth/me` returns 401.
- On restart, port 8000 can be held by a stale `multiprocessing` child — kill the PID tree.

## Known Issues & Technical Debt
- WebSocket auth still open in dev (token not yet passed on WS handshake) — TASK-508.
- Monitoring endpoints (`/api/workspaces/*`) not yet role-scoped — TASK-507.
- Backend still partly flat (`api/` + `services/`); further module migration pending (Phase 6).
- Single-process SQLite — not horizontally scalable (by design for v1).
- Playwright tests left sample data in dev DB (test assignments + `*.test`/`*.ops` users) — harmless.
