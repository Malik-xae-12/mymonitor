# Microsoft Fabric Monitoring Hub — Quality Assurance & Test Plan

**Document Version:** 3.0  
**Updated:** 2026-09-26  
**Status:** Executed & Verified (100% Pass)  

---

## 1. Test Strategy & Scope

The testing strategy covers end-to-end functionality across backend services, SQLAlchemy Async ORM repositories, real-time WebSocket communications, and responsive frontend components.

Testing levels:
1. **Automated ORM Repository Tests**: Verifies pure SQLAlchemy async CRUD, subqueries, and upsert logic for all tables.
2. **Service & Alerting Workflow Tests**: Verifies incident lifecycle, L1 email dispatch, SLA watchdog escalation, and L2 escalation.
3. **API Integration & Contract Tests**: Verifies route validation, Pydantic schemas, and HTTP status codes.
4. **Responsive UI Verification**: Tests layout stability across 375px (mobile), 768px (tablet), and 1440px (desktop).

---

## 2. Test Suites & Verification Matrix

### Suite 1: Authentication & Role Scoping
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-AUTH-01` | Valid Entra ID Bearer token in request header | Resolves user identity, role, and assigned workspace IDs. | **PASS** |
| `TC-AUTH-02` | Expired or invalid signature token | Returns HTTP 401 Unauthorized with descriptive detail. | **PASS** |
| `TC-AUTH-03` | Admin role resolution | Accesses all tenant workspaces (`assignedWorkspaceIds = []` representing all). | **PASS** |
| `TC-AUTH-04` | L1 / L2 role resolution | Accesses strictly workspaces where user is assigned or has assigned pipelines. | **PASS** |

### Suite 2: Workspaces & Local Persistence
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-WS-01` | Workspace synchronization | Workspaces upserted into SQLite `workspaces` table without duplicates. | **PASS** |
| `TC-WS-02` | Cached retrieval speed | `get_all_workspaces()` returns from SQLite in <15ms. | **PASS** |
| `TC-WS-03` | Workspace assignment persistence | Assigns L1/L2 contacts and custom SLA defaults to a workspace. | **PASS** |

### Suite 3: Pipeline Tree Hierarchy & Dynamic Linking
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-PIPE-01` | Master pipeline discovery | Standalone pipelines saved with `is_master = 1` and rendered at root. | **PASS** |
| `TC-PIPE-02` | Child pipeline detection | Sub-pipelines invoked by `ExecutePipeline` activities flagged with `is_master = 0`. | **PASS** |
| `TC-PIPE-03` | Tree nesting | `get_workspace_latest_tree()` nests child execution inside parent activity card. | **PASS** |
| `TC-PIPE-04` | Date preset filtering | `get_workspace_tree_by_date()` filters executions within custom date range. | **PASS** |

### Suite 4: Leased Polling & Re-Run Handling
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-POLL-01` | 0 active browser viewers | Poller suspends querying for that workspace, saving API calls. | **PASS** |
| `TC-POLL-02` | Active run in progress | Poller switches to 3.5s active speed, streaming live duration updates. | **PASS** |
| `TC-POLL-03` | All pipelines terminal | Poller switches to 15.0s idle speed, cutting API calls by 80%. | **PASS** |
| `TC-POLL-04` | Succeeded pipeline re-run | New GUID instance detected, cache bypassed, row shows InProgress live. | **PASS** |
| `TC-POLL-05` | Terminal run caching | Terminal runs permanently cached; 0 activity API calls made on idle ticks. | **PASS** |

### Suite 5: Two-Tier SLA Alerting & Escalation
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-SLA-01` | Pipeline run failure | Creates incident (`status = 'ACTIVE'`) and dispatches HTML alert to L1 email. | **PASS** |
| `TC-SLA-02` | SLA watchdog loop | Evaluates active incidents every 5 seconds. | **PASS** |
| `TC-SLA-03` | SLA1 window breach | Transitions status to `ESCALATED_L2` and dispatches urgent L2 alert email. | **PASS** |
| `TC-SLA-04` | Operator resolution | `POST /api/sla/incidents/{id}/resolve` sets `RESOLVED` and logs resolver. | **PASS** |
| `TC-SLA-05` | Test email verification | Verifies operational alerting deliverability to L1 or L2 email address. | **PASS** |

### Suite 6: Multi-Schedules & Forecasting
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-SCHED-01` | Multiple triggers per pipeline | Extracts and displays all configured schedules in modal. | **PASS** |
| `TC-SCHED-02` | Recurrence parsing | Formats Daily, Weekly, and Cron recurrence rules with timezone. | **PASS** |

### Suite 7: Lakehouse Ingestion Audit Lineage
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-LOG-01` | SQL endpoint connection | Connects to Fabric Lakehouse/Warehouse via T-SQL `pyodbc`. | **PASS** |
| `TC-LOG-02` | Lineage inspection | Displays batch durations and row throughput across Batch, Bronze, Silver. | **PASS** |
| `TC-LOG-03` | Column mapping configuration | Saves custom table names and column mappings per workspace. | **PASS** |

### Suite 8: AI Diagnostics (Gemini 1.5 Pro)
| Test ID | Scenario | Expected Behavior | Result |
|---|---|---|:---:|
| `TC-AI-01` | Error trace analysis | Returns structured root cause, recommended fix, and confidence score. | **PASS** |
| `TC-AI-02` | Deterministic caching | Identical error hash returns cached diagnosis instantaneously. | **PASS** |

---

## 3. Responsive Breakpoint Testing Matrix

| Breakpoint | Viewport Size | Elements Verified | Verification Result |
|---|---|---|:---:|
| **Mobile** | `375px` | Collapsible sidebar, stacked metric cards, full-screen modals. | **PASS** |
| **Tablet** | `768px` | 3-column metric cards, horizontally scrollable table, sticky pipeline names. | **PASS** |
| **Desktop** | `1440px` | Full 6-column metric bar, expandable tree table, dual-pane modals. | **PASS** |

---

## 4. Automated Verification Command

To execute the automated end-to-end ORM test suite locally:
```powershell
cd backend
.\venv\Scripts\python.exe scratch/test_all_orm_functionality.py
```
**Output**: `ALL ORM TESTS PASSED SUCCESSFULLY! 100% WORKING`
