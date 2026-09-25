# Microsoft Fabric Monitoring Hub — Coding Standards & Engineering Rules

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Mandatory Enforced  

---

## 1. Core Architectural Invariants

### Rule 1.1: Zero Raw SQL Policy
- **Requirement**: All database interactions with the local application database (`fabric_monitor.db`) MUST use **SQLAlchemy 2.0 Async ORM**.
- **Prohibited**:
  - `aiosqlite.connect(...)` or raw cursor queries.
  - String concatenation in SQL statements (`cursor.execute(f"SELECT * FROM ...")`).
  - `session.execute(text("SELECT ..."))` for internal application tables.
- **Allowed**: `select()`, `update()`, `delete()`, `sqlite_upsert()`, and relationship loaders (`selectinload()`).
- *Exception*: Remote Fabric Lakehouse/Warehouse queries executed over `pyodbc` T-SQL connection strings against external data endpoints.

### Rule 1.2: Strict Modular Clean Architecture
Every backend feature MUST adhere to the 4-layer structure:
```
router.py ──> service.py ──> repository.py ──> models/ & schema.py
```
- **Router**: Only path/query validation, dependency injection, and HTTP status codes. No business logic or ORM sessions.
- **Service**: Business logic, domain rules, transaction coordination, external client calls (Fabric, SMTP, Gemini), and WebSocket broadcasting.
- **Repository**: Pure SQLAlchemy ORM database queries, transactions, and upsert handling. No HTTP or external network calls.
- **Models**: Declarative SQLAlchemy table models inheriting from `app.db.base.Base`.
- **Schemas**: Pydantic V2 models for serialization, deserialization, and request validation.

### Rule 1.3: Mandatory Concise Function Docstrings
Every function, method, and class in both backend and frontend utility layers MUST contain a concise 1-line or 2-line docstring explaining its exact purpose:
```python
async def get_workspace_latest_tree(self, workspace_id: str) -> List[Dict[str, Any]]:
    """Builds the latest execution hierarchy from SQLite cache, nesting sub-pipelines inside parent activities."""
```

### Rule 1.4: Zero Hardcoded Configuration
- All secrets, tenant IDs, URLs, ports, and credentials MUST be loaded through `app.core.config.settings` (backed by Pydantic Settings and `.env`).
- Never hardcode URLs (`http://localhost:8000`), workspace IDs, or tenant GUIDs in source code.

---

## 2. Frontend Engineering Rules (React 18 + Vite)

### Rule 2.1: Feature-Based Structure
Code MUST be organized by domain under `src/features/` (`auth`, `monitoring`, `tableLogs`, `admin`, `users`). Shared components reside in `src/components/ui/` or `src/components/shared/`.

### Rule 2.2: Strict State Hygiene
- Never mutate state directly (`state.push(...)`). Always use immutable state update patterns (`[...prev, newItem]`).
- Clean up all timers and WebSocket listeners in `useEffect` cleanup functions to eliminate memory leaks.

### Rule 2.3: Zero Hardcoded API Endpoints
All API calls must use `src/services/axiosClient.js` with centralized route definitions in `src/services/endpoints.js`.

### Rule 2.4: Microsoft Fabric Fluent 2 Light UI Standard
- The web interface MUST strictly use the **Microsoft Fabric Fluent 2 Light Design System** (`#faf9f8` canvas, `#ffffff` card/table containers, `#0f6cbd` Fabric brand blue, Segoe UI typography, and soft Fluent status badges).
- **There is no dark mode**; all components and modals adhere strictly to Microsoft Fabric's enterprise light aesthetic.

---

## 3. Data Integrity & Concurrency Rules

### Rule 3.1: SQLite WAL Mode
The local database MUST always operate in Write-Ahead Logging (`PRAGMA journal_mode=WAL;`) with `busy_timeout=15000` to prevent database locks during concurrent WebSocket broadcasts and poller writes.

### Rule 3.2: Leased Polling Lifecycle
The background poller MUST check `connection_manager.get_active_workspace_ids()` before issuing API requests. If a workspace has 0 active WebSocket viewers, polling MUST be suspended.

### Rule 3.3: Idempotent Incident Creation
The alerting engine MUST verify that no active incident already exists for a `pipeline_run_id` before inserting a new record into `sla_incidents` to prevent duplicate email alerts.

---

## 4. Git & Commit Hygiene
- Commit messages must follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- Never commit `.env`, credentials, or temporary SQLite database files to source control.
