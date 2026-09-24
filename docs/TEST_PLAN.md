# Test Plan

**Last Updated:** 2026-09-23
**Tooling:** Playwright MCP (`@playwright/mcp`) driving Chromium.

---

## 1. Pre-Test Setup
1. Backend: `backend\venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000`
2. Frontend (dev): `cd frontend; npm run dev` → serves on `http://localhost:3000`
3. Confirm `.env` populated (Fabric SP credentials at minimum).

## 2. Smoke Test (Playwright MCP)
```
Open http://localhost:3000. Do not modify files.
Check page loading, console errors, failed network requests, broken images,
navigation, buttons, and WebSocket connectivity. Report issues + screenshots.
```
**Acceptance:** page renders, no uncaught console errors, WebSocket connects, workspace
list loads.

## 3. Responsive Multi-Viewport Matrix
Test `http://localhost:3000` at:
- Desktop Large: 1920×1080
- Desktop Standard: 1440×900
- Tablet Landscape: 1024×768
- Tablet Portrait: 768×1024
- Mobile Standard: 390×844
- Mobile Compact: 375×812

Check per breakpoint: horizontal overflow, text clipping, nav/drawer behavior, touch
targets, spacing/typography collapse. Capture a screenshot at each breakpoint.

## 4. Auth & RBAC Acceptance Criteria
| Scenario | Expected |
| :-- | :-- |
| Unauthenticated user opens app | Redirected to Entra ID sign-in; app content hidden |
| Admin signs in | Sees all workspaces + Admin assignment console |
| Admin assigns L1/L2 + SLA + table config | Saved to `workspace_assignments`; workspace goes live |
| L1 signs in | Sees **only** assigned workspaces/pipelines; no admin console |
| L2 signs in | Same scoped visibility; receives SLA2 escalations |
| API called without/with invalid token | 401 Unauthorized |
| L1 requests an unassigned workspace | 403 Forbidden (or filtered out) |

## 5. Functional Acceptance Criteria
| Area | Criteria |
| :-- | :-- |
| Workspace selector | Lists discovered workspaces; selecting one joins a WebSocket room |
| Pipeline tree | Parent-child hierarchy renders; child pipelines nested & deduped |
| Live status | InProgress runs update in near real time |
| Date filter | Presets (Last Week → Next Week) update counts correctly |
| AI diagnostics | Failed activity opens ErrorDetailModal with Gemini root-cause + fix |
| SLA config | Warning/Breach thresholds save; breach badge + Resolve button work |
| Schedules | Multi-schedule modal lists frequency/times/days |
| Table logs | Batch Header → Bronze → Silver lineage renders with row counts |

## 5. Production Build Check
- `cd frontend; npm run build` → `frontend/dist/` produced.
- FastAPI serves the bundle at `http://localhost:8000`.

## 6. Pre-Deployment Checklist
- [ ] Lint passes (`npm run lint`)
- [ ] No secrets committed; `.env` gitignored
- [ ] Responsive matrix verified (375 / 768 / 1440)
- [ ] `docs/TASKS.md` and `docs/MEMORY.md` updated
