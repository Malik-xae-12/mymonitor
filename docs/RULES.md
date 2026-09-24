# AI Rulebook & Coding Standards

**Last Updated:** 2026-09-23

## 1. Architectural Boundaries
- **Never** query SQLite outside `db_service.py`.
- **Never** call Fabric REST outside `fabric_client.py` (routed through `rate_limiter`).
- API routes/modules stay thin; business logic lives in `service.py` / `app/services/`.
- The React UI talks to the backend only via `/api` and `/ws` (proxied by Vite in dev).

## 2. Auth & RBAC (must-follow)
- Every non-public API depends on `get_current_user` (validated Entra ID token).
- Admin-only endpoints depend on `require_admin`.
- Workspace/pipeline data is **always** filtered by the caller's assigned workspaces
  (admin bypasses). Never return unassigned workspaces to L1/L2.
- Frontend routes are gated by MSAL auth + role (`RoleRoute`). No secrets in the SPA bundle.

## 3. UI / Fabric Design (must-follow)
- Build to the Microsoft Fabric UI kit (Fluent 2). Pull specs via Figma MCP when available.
- Reuse `components/ui` + `components/layout`; do not hand-roll one-off styles per page.
- Status must be conveyed by icon/label + color, never color alone.
- Every page must be self-explanatory (see `docs/DESIGN.md` §6).

## 2. Code Style
- **Python**: PEP 8, type hints, Pydantic V2 models for I/O boundaries, async/await for I/O.
- **JavaScript/React**: functional components + hooks, no class components.
- Keep changes surgical — do not refactor unrelated files.

## 3. Input Validation & Safety
- Validate all inbound request payloads with Pydantic at the API boundary.
- Never trust Fabric/Gemini/SMTP responses blindly — guard against missing fields.
- No secrets in code. All credentials come from `.env` (see `.env.example`).

## 4. Performance Invariants
- Preserve differential polling: only re-query `InProgress` runs.
- Respect `MAX_CONCURRENT_FABRIC_REQUESTS` (asyncio.Semaphore) to avoid HTTP 429.
- Keep terminal-run and AI-diagnostic caches intact.

## 5. Commit Hygiene
- One atomic vertical slice per commit.
- Run lint before commit: `npm run lint` (frontend), and keep backend importable.
- Update `docs/TASKS.md` and `docs/MEMORY.md` after each completed slice.

## 6. Testing / Verification
- Verify UI with Playwright MCP at localhost:3000 across the responsive matrix.
- Confirm no console errors, failed network calls, or broken WebSocket on smoke test.
