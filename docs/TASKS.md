# Microsoft Fabric Real-Time Monitoring Hub — Master Implementation Tasks

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** 100% Completed & Verified  

---

## Phase 1: Project Foundation & Architecture Setup
- [x] **TASK-101**: Scaffold modular clean architecture backend (`app/core`, `app/db`, `app/modules`, `app/shared`).
- [x] **TASK-102**: Configure SQLite database in WAL mode with connection pooling and async engine.
- [x] **TASK-103**: Define declarative base models and aggregate in `app/db/models_import.py`.
- [x] **TASK-104**: Scaffold feature-based frontend architecture (`src/features`, `src/components`, `src/services`, `src/store`).
- [x] **TASK-105**: Configure environment variables and settings via Pydantic Settings (`app/core/config.py`).

---

## Phase 2: Authentication & RBAC Security
- [x] **TASK-201**: Implement Microsoft Entra ID (Azure AD) OpenID Connect authentication flow with MSAL in frontend.
- [x] **TASK-202**: Implement JWT signature verification with dynamic in-memory caching of Microsoft public JWKS keys.
- [x] **TASK-203**: Implement `users_service.resolve_access()` for dynamic role scoping (`admin`, `l1`, `l2`).
- [x] **TASK-204**: Seed default platform roles (`admin`, `l1`, `l2`) on backend application startup.
- [x] **TASK-205**: Implement directory user search, role assignment, and login audit tracking.

---

## Phase 3: Workspaces Module & Role Scoping
- [x] **TASK-301**: Implement dynamic workspace synchronization from Microsoft Fabric REST API (`/v1/workspaces`).
- [x] **TASK-302**: Cache workspaces in SQLite `workspaces` table for <15ms retrieval.
- [x] **TASK-303**: Implement role-scoped workspace filtering (`get_scoped_workspace_ids`):
  - Admins access all tenant workspaces.
  - L1 and L2 users access strictly assigned workspaces.
- [x] **TASK-304**: Implement workspace assignment persistence associating workspaces with designated L1 and L2 engineers.
- [x] **TASK-305**: Build responsive frontend workspace selector with instant search and switching.

---

## Phase 4: Pipelines & Hierarchical Tree Engine
- [x] **TASK-401**: Fetch all pipelines per workspace and persist in SQLite `pipelines` table.
- [x] **TASK-402**: Implement dynamic parent/child pipeline detection via `ExecutePipeline` activity outputs.
- [x] **TASK-403**: Implement `update_child_pipeline_flags()` to guarantee child pipelines are flagged (`is_master = 0`) and never appear as root rows.
- [x] **TASK-404**: Implement `get_workspace_latest_tree()` using SQLAlchemy ORM subqueries to construct the hierarchical pipeline tree.
- [x] **TASK-405**: Implement date-windowed pipeline tree retrieval (`get_workspace_tree_by_date`) for historical inspection.
- [x] **TASK-406**: Build frontend expandable tree table with animated chevrons, activity badges, and nested child pipeline cards.

---

## Phase 5: Adaptive Leased Poller & WebSocket Push
- [x] **TASK-501**: Implement WebSocket connection manager with active workspace lease tracking (`connection_manager.get_active_workspace_ids()`).
- [x] **TASK-502**: Implement leased polling: suspend polling completely for workspaces with 0 active browser viewers.
- [x] **TASK-503**: Implement dual-speed adaptive polling:
  - Active Mode: 3.5s interval when pipelines are `InProgress`.
  - Idle Mode: 15.0s interval when all pipelines are in terminal states.
- [x] **TASK-504**: Implement permanent caching of terminal runs (`Completed`, `Failed`, `Cancelled`), skipping redundant activity API calls.
- [x] **TASK-505**: Handle pipeline re-runs: detect new GUID Job Instances, bypass cache, stream live InProgress state, and update tree.
- [x] **TASK-506**: Build client-side live ticking duration stopwatch for active executions.

---

## Phase 6: Two-Tier SLA Engine & Automated Escalation
- [x] **TASK-601**: Implement SLA configuration schema (`sla1_minutes`, `sla2_minutes`, `l1_email`, `l2_email`).
- [x] **TASK-602**: Implement failure incident creation in `sla_incidents` (`status = 'ACTIVE'`) upon pipeline failure.
- [x] **TASK-603**: Build rich HTML L1 alert email template with failure diagnostics and SLA target countdown.
- [x] **TASK-604**: Implement SMTP email dispatch with STARTTLS encryption.
- [x] **TASK-605**: Build background SLA watchdog loop evaluating active incidents every 5 seconds.
- [x] **TASK-606**: Implement automated L2 escalation upon SLA1 breach: update status to `ESCALATED_L2`, send urgent L2 alert email, and broadcast WebSocket warning.
- [x] **TASK-607**: Implement operator incident resolution flow (`POST /api/sla/incidents/{id}/resolve`) with audit logging.
- [x] **TASK-608**: Implement "Send Test Email" deliverability verification for L1 and L2 contacts.

---

## Phase 7: Multi-Schedule Forecast Engine
- [x] **TASK-701**: Query Fabric `/schedules` endpoints to extract all trigger definitions per pipeline.
- [x] **TASK-702**: Persist schedules in SQLite `pipeline_schedules` table with recurrence rules and next execution forecasts.
- [x] **TASK-703**: Build frontend `PipelineScheduleModal` displaying recurrence patterns, active days, timezones, and countdowns.

---

## Phase 8: Lakehouse & Warehouse Ingestion Lineage
- [x] **TASK-801**: Direct connection to Fabric Lakehouse/Warehouse SQL Endpoints via T-SQL (`pyodbc`) using OAuth tokens.
- [x] **TASK-802**: Discover tables and schemas across Batch Header, Bronze, and Silver Delta layers.
- [x] **TASK-803**: Implement Table Log Mapping configuration page with custom column mapping.
- [x] **TASK-804**: Build Ingestion Audit Log viewer displaying batch duration, row throughput, and status per batch.

---

## Phase 9: AI Root-Cause Diagnostics (Gemini 1.5 Pro)
- [x] **TASK-901**: Build AI error diagnostic pipeline integrating Google Gemini 1.5 Pro.
- [x] **TASK-902**: Extract structured root cause, recommended fix, and confidence score.
- [x] **TASK-903**: Implement deterministic error hash caching in `ai_error_diagnostics` to serve repeat errors instantaneously.
- [x] **TASK-904**: Build frontend AI Diagnostics Modal with glassmorphic styling and copy-to-clipboard remediation advice.

---

## Phase 10: Pure SQLAlchemy Async ORM Migration
- [x] **TASK-1001**: Convert `workspaces/repository.py` from raw SQL to pure SQLAlchemy Async ORM (`select`, `sqlite_upsert`, `union`).
- [x] **TASK-1002**: Convert `users/repository.py` and `users/service.py` from raw SQL to pure SQLAlchemy Async ORM (`selectinload`, `sqlite_upsert`).
- [x] **TASK-1003**: Convert `pipelines/repository.py` from raw SQL to pure SQLAlchemy Async ORM (subqueries, `sqlite_upsert`, `and_`).
- [x] **TASK-1004**: Convert `sla/repository.py` from raw SQL to pure SQLAlchemy Async ORM.
- [x] **TASK-1005**: Convert `table_logs/repository.py` from raw SQL to pure SQLAlchemy Async ORM.
- [x] **TASK-1006**: Convert `diagnostics/repository.py` from raw SQL to pure SQLAlchemy Async ORM.
- [x] **TASK-1007**: Verify 0 raw SQL queries or `aiosqlite` imports remain across backend repositories.
- [x] **TASK-1008**: Build and execute end-to-end ORM automated verification test suite (`scratch/test_all_orm_functionality.py`) — **100% PASS**.

---

## Phase 11: UI/UX Refactoring & Code Hygiene
- [x] **TASK-1101**: Remove all hardcoded URLs and endpoints from frontend services.
- [x] **TASK-1102**: Enforce concise docstrings across all backend and frontend functions.
- [x] **TASK-1103**: Enforce role-based control masking (Admin Console, Column Mapping, SLA Editing).
- [x] **TASK-1104**: Optimize responsive layout across mobile, tablet, and desktop viewports.

---

## Phase 12: Documentation Synchronization
- [x] **TASK-1201**: Remove deprecated `docs/POLLER_AND_RBAC_GUIDE.md` and fold all contents into `docs/ARCHITECTURE.md`.
- [x] **TASK-1202**: Rewrite `docs/PRD.md` with complete functional and non-functional requirements.
- [x] **TASK-1203**: Rewrite `docs/ARCHITECTURE.md` with full system diagrams, ORM models, and lifecycle mechanics.
- [x] **TASK-1204**: Rewrite `docs/DESIGN.md` with complete design tokens, components, and responsive specs.
- [x] **TASK-1205**: Rewrite `docs/RULES.md` with mandatory coding standards and zero-raw-SQL rules.
- [x] **TASK-1206**: Rewrite `docs/TASKS.md` with completed checklist across all phases.
- [x] **TASK-1207**: Rewrite `docs/DECISIONS.md` with comprehensive Architectural Decision Records.
- [x] **TASK-1208**: Rewrite `docs/MEMORY.md` with active project state and guarantees.
- [x] **TASK-1209**: Rewrite `docs/TEST_PLAN.md` with complete test verification matrices.
- [x] **TASK-1210**: Rewrite `docs/SECURITY.md` with authentication, RBAC, and data security controls.
- [x] **TASK-1211**: Update root `README.md`, `backend/README.md`, and `frontend/README.md`.
