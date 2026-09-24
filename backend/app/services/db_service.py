import json
import logging
import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
import aiosqlite
from backend.app.core.config import settings

logger = logging.getLogger("fabric_monitor.db")

class DatabaseService:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.SQLITE_DB_PATH
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

    async def init_db(self):
        """Initializes database schema with WAL mode and tables."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("PRAGMA journal_mode=WAL;")
            await db.execute("PRAGMA synchronous=NORMAL;")
            await db.execute("PRAGMA busy_timeout=30000;")
            
            # 1. Workspaces
            await db.execute("""
                CREATE TABLE IF NOT EXISTS workspaces (
                    id TEXT PRIMARY KEY,
                    displayName TEXT,
                    last_polled_at TEXT
                );
            """)

            # 2. Pipelines
            await db.execute("""
                CREATE TABLE IF NOT EXISTS pipelines (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT,
                    displayName TEXT,
                    is_master INTEGER DEFAULT 1,
                    prefix TEXT,
                    updated_at TEXT
                );
            """)

            # 3. Pipeline Runs
            await db.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_runs (
                    id TEXT PRIMARY KEY,
                    pipeline_id TEXT,
                    workspace_id TEXT,
                    pipeline_name TEXT,
                    status TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    duration_in_ms INTEGER,
                    invoke_type TEXT,
                    is_child INTEGER DEFAULT 0,
                    parent_run_id TEXT,
                    parent_activity_name TEXT,
                    failure_reason TEXT,
                    updated_at TEXT
                );
            """)

            # 4. Activity Runs (with child_pipeline_data for full nesting)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS activity_runs (
                    activity_run_id TEXT PRIMARY KEY,
                    pipeline_run_id TEXT,
                    activity_name TEXT,
                    activity_type TEXT,
                    status TEXT,
                    start_time TEXT,
                    end_time TEXT,
                    duration_in_ms INTEGER,
                    error TEXT,
                    output TEXT,
                    child_pipeline_run_id TEXT,
                    child_pipeline_data TEXT,
                    updated_at TEXT
                );
            """)

            # Ensure child_pipeline_data column exists if table was created previously
            try:
                await db.execute("ALTER TABLE activity_runs ADD COLUMN child_pipeline_data TEXT;")
            except Exception:
                pass

            # 5. Pipeline Schedules
            await db.execute("""
                CREATE TABLE IF NOT EXISTS pipeline_schedules (
                    pipeline_id TEXT PRIMARY KEY,
                    workspace_id TEXT,
                    pipeline_name TEXT,
                    enabled INTEGER DEFAULT 0,
                    schedule_type TEXT,
                    next_run_time TEXT,
                    time_zone TEXT,
                    raw_configuration TEXT,
                    updated_at TEXT
                );
            """)

            # 6. SLA Configurations
            await db.execute("""
                CREATE TABLE IF NOT EXISTS sla_configs (
                    pipeline_id TEXT PRIMARY KEY,
                    workspace_id TEXT,
                    l1_email TEXT,
                    l2_email TEXT,
                    sla_minutes INTEGER DEFAULT 30,
                    updated_at TEXT
                );
            """)

            # 7. SLA Incidents
            await db.execute("""
                CREATE TABLE IF NOT EXISTS sla_incidents (
                    id TEXT PRIMARY KEY,
                    pipeline_id TEXT,
                    pipeline_name TEXT,
                    pipeline_run_id TEXT,
                    workspace_id TEXT,
                    status TEXT DEFAULT 'ACTIVE',
                    failed_at TEXT,
                    sla_target_time TEXT,
                    l1_notified_at TEXT,
                    l2_escalated_at TEXT,
                    resolved_at TEXT,
                    resolved_by TEXT,
                    error_message TEXT,
                    updated_at TEXT
                );
            """)

            # 8. Table Log Mappings
            await db.execute("""
                CREATE TABLE IF NOT EXISTS table_log_mappings (
                    workspace_id TEXT PRIMARY KEY,
                    artifact_type TEXT,
                    artifact_id TEXT,
                    artifact_name TEXT,
                    server_fqdn TEXT,
                    database_name TEXT,
                    batch_header_schema TEXT,
                    batch_header_table TEXT,
                    batch_header_mapping TEXT,
                    bronze_schema TEXT,
                    bronze_table TEXT,
                    bronze_mapping TEXT,
                    silver_schema TEXT,
                    silver_table TEXT,
                    silver_mapping TEXT,
                    updated_at TEXT
                );
            """)

            # 9. AI Error Diagnostics Cache
            await db.execute("""
                CREATE TABLE IF NOT EXISTS ai_error_diagnostics (
                    error_hash TEXT PRIMARY KEY,
                    error_code TEXT,
                    error_message TEXT,
                    activity_type TEXT,
                    pipeline_name TEXT,
                    diagnosis_json TEXT,
                    created_at TEXT
                );
            """)

            # 10. Workspace Assignments (RBAC: Admin assigns L1/L2 responsibility per workspace)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS workspace_assignments (
                    workspace_id TEXT PRIMARY KEY,
                    workspace_name TEXT,
                    l1_email TEXT,
                    l2_email TEXT,
                    sla1_minutes INTEGER DEFAULT 30,
                    sla2_minutes INTEGER DEFAULT 60,
                    table_config_done INTEGER DEFAULT 0,
                    assigned_by TEXT,
                    updated_at TEXT
                );
            """)

            # 11. Roles (RBAC role catalog)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS roles (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at TEXT
                );
            """)

            # 12. Users (signed-in identities + assigned role)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    display_name TEXT,
                    oid TEXT,
                    role_id TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at TEXT,
                    last_login_at TEXT,
                    FOREIGN KEY (role_id) REFERENCES roles(id)
                );
            """)

            # Ensure per-pipeline SLA columns exist (added incrementally)
            for _col, _type in [("sla1_minutes", "INTEGER"), ("sla2_minutes", "INTEGER"), ("l1_name", "TEXT"), ("l2_name", "TEXT")]:
                try:
                    await db.execute(f"ALTER TABLE sla_configs ADD COLUMN {_col} {_type};")
                except Exception:
                    pass

            # Indexes for instant querying
            await db.execute("CREATE INDEX IF NOT EXISTS idx_runs_ws ON pipeline_runs(workspace_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_runs_pipe ON pipeline_runs(pipeline_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_act_run ON activity_runs(pipeline_run_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_inc_ws ON sla_incidents(workspace_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_mapping_ws ON table_log_mappings(workspace_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_ai_diag_hash ON ai_error_diagnostics(error_hash);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_inc_pipe ON sla_incidents(pipeline_id);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_inc_status ON sla_incidents(status);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_assign_l1 ON workspace_assignments(l1_email);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_assign_l2 ON workspace_assignments(l2_email);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            await db.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);")

            await db.commit()
            logger.info(f"SQLite database initialized at {self.db_path} (WAL mode enabled)")

    # ------------------------------------------------------------------
    # RBAC: Workspace assignments & signed-in user records
    # ------------------------------------------------------------------
    async def get_all_assignments(self) -> List[Dict[str, Any]]:
        """Returns every workspace assignment (admin view)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM workspace_assignments ORDER BY workspace_name")
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def get_assignment(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM workspace_assignments WHERE workspace_id = ?", (workspace_id,)
            )
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_assignments_for_user(self, email: str) -> List[Dict[str, Any]]:
        """Returns assignments where the given email is the L1 or L2 responsible user."""
        e = (email or "").lower()
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM workspace_assignments
                WHERE LOWER(l1_email) = ? OR LOWER(l2_email) = ?
                ORDER BY workspace_name
            """, (e, e))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def upsert_assignment(self, data: Dict[str, Any], assigned_by: str, when: str):
        """Creates/updates the L1/L2 + SLA assignment for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO workspace_assignments (
                    workspace_id, workspace_name, l1_email, l2_email,
                    sla1_minutes, sla2_minutes, table_config_done, assigned_by, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    workspace_name=excluded.workspace_name,
                    l1_email=excluded.l1_email,
                    l2_email=excluded.l2_email,
                    sla1_minutes=excluded.sla1_minutes,
                    sla2_minutes=excluded.sla2_minutes,
                    table_config_done=excluded.table_config_done,
                    assigned_by=excluded.assigned_by,
                    updated_at=excluded.updated_at
            """, (
                data.get("workspace_id"),
                data.get("workspace_name"),
                (data.get("l1_email") or "").lower(),
                (data.get("l2_email") or "").lower(),
                int(data.get("sla1_minutes") or 30),
                int(data.get("sla2_minutes") or 60),
                1 if data.get("table_config_done") else 0,
                assigned_by,
                when,
            ))
            await db.commit()

    async def delete_assignment(self, workspace_id: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM workspace_assignments WHERE workspace_id = ?", (workspace_id,))
            await db.commit()



    async def get_known_cached_run_ids(self, workspace_id: str) -> Set[str]:
        """Returns run IDs that are completed/failed and already have activity runs stored with all child pipelines resolved."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT DISTINCT r.id 
                FROM pipeline_runs r
                INNER JOIN activity_runs a ON r.id = a.pipeline_run_id
                WHERE r.workspace_id = ? 
                  AND r.status IN ('Completed', 'Failed', 'Cancelled')
                  AND r.id NOT IN (
                      SELECT DISTINCT pipeline_run_id 
                      FROM activity_runs 
                      WHERE (LOWER(activity_type) LIKE '%executepipeline%' OR LOWER(activity_type) LIKE '%invokepipeline%')
                        AND child_pipeline_data IS NULL
                  )
            """, (workspace_id,))
            rows = await cursor.fetchall()
            return {row["id"] for row in rows}

    async def save_pipelines(self, workspace_id: str, pipelines: List[Dict[str, Any]], updated_at: str):
        """Saves pipelines from Fabric. Defaults to parent level (is_master=1) until dynamic child linking."""
        async with aiosqlite.connect(self.db_path) as db:
            for p in pipelines:
                pid = p.get("id")
                name = p.get("displayName") or p.get("name") or "Pipeline"
                parts = name.split("_")
                prefix = f"{parts[0]}_{parts[1]}".lower() if len(parts) >= 2 else ""

                await db.execute("""
                    INSERT INTO pipelines (id, workspace_id, displayName, is_master, prefix, updated_at)
                    VALUES (?, ?, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        displayName=excluded.displayName,
                        prefix=excluded.prefix,
                        updated_at=excluded.updated_at
                """, (pid, workspace_id, name, prefix, updated_at))
            await db.commit()

    async def update_child_pipeline_flags(self, workspace_id: str, invoked_child_ids: Set[str], invoked_child_names: Set[str]):
        """
        100% dynamic pipeline role resolution with ZERO hardcoded keywords:
        Any pipeline that is invoked by an ExecutePipeline activity (by ID or displayName)
        or has runs marked as is_child / parent_run_id is flagged as a child pipeline (is_master = 0).
        All other pipelines in the workspace are parent pipelines (is_master = 1) and will show
        on the parent level initial screen.
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            child_ids = {str(i).strip().lower() for i in invoked_child_ids if i}
            child_names = {str(n).strip().lower() for n in invoked_child_names if n}

            def extract_child_meta(data):
                if not data or not isinstance(data, dict):
                    return
                pid = data.get("pipelineId")
                pname = data.get("pipelineName")
                if pid:
                    child_ids.add(str(pid).strip().lower())
                if pname:
                    child_names.add(str(pname).strip().lower())
                for act in data.get("activities", []):
                    if isinstance(act, dict) and "childPipeline" in act and act["childPipeline"]:
                        extract_child_meta(act["childPipeline"])

            # 1. Discover child pipelines from activity_runs JSON
            cursor = await db.execute("""
                SELECT child_pipeline_data, output
                FROM activity_runs
                WHERE child_pipeline_data IS NOT NULL OR output LIKE '%pipeline%'
            """)
            act_rows = await cursor.fetchall()
            for r in act_rows:
                if r["child_pipeline_data"]:
                    try:
                        d = json.loads(r["child_pipeline_data"])
                        extract_child_meta(d)
                    except Exception:
                        pass
                if r["output"]:
                    try:
                        o = json.loads(r["output"])
                        if isinstance(o, dict):
                            p_ref = o.get("pipelineName") or o.get("pipelineId")
                            if p_ref:
                                p_ref_str = str(p_ref).strip().lower()
                                child_ids.add(p_ref_str)
                                child_names.add(p_ref_str)
                    except Exception:
                        pass

            # 2. Discover child runs from child_pipeline_run_id
            cursor = await db.execute("""
                SELECT DISTINCT child_pipeline_run_id FROM activity_runs
                WHERE child_pipeline_run_id IS NOT NULL
            """)
            run_rows = await cursor.fetchall()
            child_run_ids = {r["child_pipeline_run_id"] for r in run_rows if r["child_pipeline_run_id"]}
            if child_run_ids:
                placeholders = ",".join(["?"] * len(child_run_ids))
                cursor = await db.execute(f"""
                    SELECT DISTINCT pipeline_id, pipeline_name FROM pipeline_runs
                    WHERE id IN ({placeholders}) AND workspace_id = ?
                """, (*child_run_ids, workspace_id))
                found_pipes = await cursor.fetchall()
                for fp in found_pipes:
                    if fp["pipeline_id"]: child_ids.add(str(fp["pipeline_id"]).strip().lower())
                    if fp["pipeline_name"]: child_names.add(str(fp["pipeline_name"]).strip().lower())

            # 3. Check pipeline_runs where is_child = 1 or parent_run_id IS NOT NULL
            cursor = await db.execute("""
                SELECT DISTINCT pipeline_id, pipeline_name FROM pipeline_runs
                WHERE workspace_id = ? AND (is_child = 1 OR parent_run_id IS NOT NULL)
            """, (workspace_id,))
            invoked_rows = await cursor.fetchall()
            for ir in invoked_rows:
                if ir["pipeline_id"]: child_ids.add(str(ir["pipeline_id"]).strip().lower())
                if ir["pipeline_name"]: child_names.add(str(ir["pipeline_name"]).strip().lower())

            # 4. Update all pipelines for this workspace
            cursor = await db.execute("SELECT id, displayName FROM pipelines WHERE workspace_id = ?", (workspace_id,))
            all_pipes = await cursor.fetchall()

            for p in all_pipes:
                pid = str(p["id"]).strip().lower()
                pname = str(p["displayName"]).strip().lower()
                is_child = pid in child_ids or pname in child_names
                is_master = 0 if is_child else 1

                await db.execute("""
                    UPDATE pipelines SET is_master = ? WHERE id = ?
                """, (is_master, p["id"]))

            await db.commit()

    async def save_pipeline_runs(self, workspace_id: str, runs: List[Dict[str, Any]], updated_at: str):
        async with aiosqlite.connect(self.db_path) as db:
            for r in runs:
                run_id = r.get("id")
                pid = r.get("pipelineId") or r.get("itemId")
                pname = r.get("pipelineName") or r.get("itemDisplayName") or "Pipeline"
                status = r.get("status") or "Unknown"
                st = r.get("startTimeUtc") or r.get("startTime")
                et = r.get("endTimeUtc") or r.get("endTime")
                dur = r.get("durationInMs")
                invoke = r.get("invokeType", "Manual")
                is_child = 1 if r.get("isChild") else 0
                parent_run_id = r.get("parentRunId")
                parent_act = r.get("parentActivityName")
                fail_raw = r.get("failureReason") or r.get("error")
                fail_str = json.dumps(fail_raw) if fail_raw else None

                # Compute duration from start and end time if missing
                if (dur is None or dur == 0) and st and et:
                    try:
                        clean_st = str(st).replace("Z", "+00:00")
                        clean_et = str(et).replace("Z", "+00:00")
                        st_dt = datetime.datetime.fromisoformat(clean_st)
                        et_dt = datetime.datetime.fromisoformat(clean_et)
                        dur = int(max(0, (et_dt - st_dt).total_seconds() * 1000))
                    except Exception:
                        pass

                await db.execute("""
                    INSERT INTO pipeline_runs (
                        id, pipeline_id, workspace_id, pipeline_name, status,
                        start_time, end_time, duration_in_ms, invoke_type,
                        is_child, parent_run_id, parent_activity_name, failure_reason, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        status=excluded.status,
                        start_time=excluded.start_time,
                        end_time=excluded.end_time,
                        duration_in_ms=excluded.duration_in_ms,
                        is_child=excluded.is_child,
                        parent_run_id=excluded.parent_run_id,
                        parent_activity_name=excluded.parent_activity_name,
                        failure_reason=excluded.failure_reason,
                        updated_at=excluded.updated_at
                """, (
                    run_id, pid, workspace_id, pname, status,
                    st, et, dur, invoke,
                    is_child, parent_run_id, parent_act, fail_str, updated_at
                ))
            await db.commit()

    async def save_activity_runs(self, run_id: str, activities: List[Dict[str, Any]], updated_at: str):
        if not activities:
            return
        async with aiosqlite.connect(self.db_path) as db:
            for a in activities:
                act_id = a.get("activityRunId") or a.get("id") or f"{run_id}-{a.get('activityName')}"
                name = a.get("activityName", "Unknown Activity")
                atype = a.get("activityType", "General")
                status = a.get("status", "Unknown")
                st = a.get("activityRunStart") or a.get("startTime")
                et = a.get("activityRunEnd") or a.get("endTime")
                dur = a.get("durationInMs")
                err = a.get("error")
                err_str = json.dumps(err) if err else None
                out = a.get("output")
                out_str = json.dumps(out) if out else None
                
                # Check for child pipeline run id
                child_run_id = None
                if isinstance(out, dict):
                    child_run_id = out.get("pipelineRunId") or out.get("runId") or out.get("childPipelineRunId")

                child_pipe = a.get("childPipeline")
                child_pipe_str = json.dumps(child_pipe) if child_pipe else None

                await db.execute("""
                    INSERT INTO activity_runs (
                        activity_run_id, pipeline_run_id, activity_name, activity_type,
                        status, start_time, end_time, duration_in_ms, error, output,
                        child_pipeline_run_id, child_pipeline_data, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(activity_run_id) DO UPDATE SET
                        status=excluded.status,
                        start_time=excluded.start_time,
                        end_time=excluded.end_time,
                        duration_in_ms=excluded.duration_in_ms,
                        error=excluded.error,
                        output=excluded.output,
                        child_pipeline_run_id=excluded.child_pipeline_run_id,
                        child_pipeline_data=excluded.child_pipeline_data,
                        updated_at=excluded.updated_at
                """, (
                    act_id, run_id, name, atype,
                    status, st, et, dur, err_str, out_str,
                    str(child_run_id) if child_run_id else None,
                    child_pipe_str, updated_at
                ))
            await db.commit()

    async def get_activities_for_run(self, run_id: str) -> List[Dict[str, Any]]:
        """Fetches stored activities for a given run from SQLite with parsed childPipeline."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT activity_run_id, pipeline_run_id, activity_name, activity_type,
                       status, start_time, end_time, duration_in_ms, error, output,
                       child_pipeline_run_id, child_pipeline_data
                FROM activity_runs
                WHERE pipeline_run_id = ?
                ORDER BY start_time ASC
            """, (run_id,))
            rows = await cursor.fetchall()
            results = []
            for row in rows:
                err_val = None
                if row["error"]:
                    try:
                        err_val = json.loads(row["error"])
                    except Exception:
                        err_val = None
                out_val = None
                if row["output"]:
                    try:
                        out_val = json.loads(row["output"])
                    except Exception:
                        out_val = None

                child_pipe = None
                if row["child_pipeline_data"]:
                    try:
                        child_pipe = json.loads(row["child_pipeline_data"])
                    except Exception:
                        child_pipe = None

                results.append({
                    "activityRunId": row["activity_run_id"],
                    "pipelineRunId": row["pipeline_run_id"],
                    "activityName": row["activity_name"],
                    "activityType": row["activity_type"],
                    "status": row["status"],
                    "activityRunStart": row["start_time"],
                    "activityRunEnd": row["end_time"],
                    "durationInMs": row["duration_in_ms"],
                    "error": err_val,
                    "output": out_val,
                    "childPipelineRunId": row["child_pipeline_run_id"],
                    "childPipeline": child_pipe
                })
            return results

    async def get_pipeline_history(self, workspace_id: str, pipeline_id: str) -> List[Dict[str, Any]]:
        """Returns all historical runs for a specific pipeline with inner activities."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, workspace_id, pipeline_name, status,
                       start_time, end_time, duration_in_ms, invoke_type,
                       is_child, parent_run_id, parent_activity_name, failure_reason
                FROM pipeline_runs
                WHERE workspace_id = ? AND pipeline_id = ?
                ORDER BY start_time DESC
            """, (workspace_id, pipeline_id))
            runs = await cursor.fetchall()

        results = []
        for r in runs:
            run_id = r["id"]
            activities = await self.get_activities_for_run(run_id)
            
            fail_val = None
            if r["failure_reason"]:
                try:
                    fail_val = json.loads(r["failure_reason"])
                except Exception:
                    fail_val = None

            dur_ms = r["duration_in_ms"]
            if (dur_ms is None or dur_ms == 0) and r["start_time"] and r["end_time"]:
                try:
                    clean_st = str(r["start_time"]).replace("Z", "+00:00")
                    clean_et = str(r["end_time"]).replace("Z", "+00:00")
                    st_dt = datetime.datetime.fromisoformat(clean_st)
                    et_dt = datetime.datetime.fromisoformat(clean_et)
                    dur_ms = int(max(0, (et_dt - st_dt).total_seconds() * 1000))
                except Exception:
                    dur_ms = None
            if (dur_ms is None or dur_ms == 0) and activities:
                act_sum = sum(a.get("durationInMs") or 0 for a in activities)
                if act_sum > 0:
                    dur_ms = act_sum

            results.append({
                "id": r["id"],
                "pipelineId": r["pipeline_id"],
                "pipelineName": r["pipeline_name"],
                "workspaceId": r["workspace_id"],
                "status": r["status"],
                "startTime": r["start_time"],
                "endTime": r["end_time"],
                "durationInMs": dur_ms,
                "invokeType": r["invoke_type"],
                "isChild": bool(r["is_child"]),
                "parentRunId": r["parent_run_id"],
                "parentActivityName": r["parent_activity_name"],
                "error": fail_val,
                "activities": activities,
                "childPipelines": []
            })
        return results

    async def get_sla_config(self, workspace_id: str, pipeline_id: str) -> Dict[str, Any]:
        """Gets SLA configuration for a pipeline, or defaults if not configured."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, workspace_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs
                WHERE workspace_id = ? AND pipeline_id = ?
            """, (workspace_id, pipeline_id))
            row = await cursor.fetchone()
            if row:
                return {
                    "pipelineId": row["pipeline_id"],
                    "workspaceId": row["workspace_id"],
                    "l1Email": row["l1_email"],
                    "l1Name": row["l1_name"] or "",
                    "l2Email": row["l2_email"],
                    "l2Name": row["l2_name"] or "",
                    "slaMinutes": row["sla_minutes"],
                    "sla1Minutes": row["sla1_minutes"],
                    "sla2Minutes": row["sla2_minutes"]
                }
            return {
                "pipelineId": pipeline_id,
                "workspaceId": workspace_id,
                "l1Email": "uiaptracker@gmail.com",
                "l1Name": "",
                "l2Email": "uiaptracker@gmail.com",
                "l2Name": "",
                "slaMinutes": 30,
                "sla1Minutes": 30,
                "sla2Minutes": 60
            }

    async def save_sla_config(self, workspace_id: str, pipeline_id: str, l1_email: str, l2_email: str, sla_minutes: int, updated_at: str, sla1_minutes: Optional[int] = None, sla2_minutes: Optional[int] = None, l1_name: Optional[str] = None, l2_name: Optional[str] = None):
        # SLA1 (warning → L1) doubles as the legacy sla_minutes for the alert engine.
        s1 = sla1_minutes if sla1_minutes is not None else sla_minutes
        s2 = sla2_minutes if sla2_minutes is not None else sla_minutes
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO sla_configs (pipeline_id, workspace_id, l1_email, l2_email, l1_name, l2_name, sla_minutes, sla1_minutes, sla2_minutes, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pipeline_id) DO UPDATE SET
                    workspace_id=excluded.workspace_id,
                    l1_email=excluded.l1_email,
                    l2_email=excluded.l2_email,
                    l1_name=excluded.l1_name,
                    l2_name=excluded.l2_name,
                    sla_minutes=excluded.sla_minutes,
                    sla1_minutes=excluded.sla1_minutes,
                    sla2_minutes=excluded.sla2_minutes,
                    updated_at=excluded.updated_at
            """, (pipeline_id, workspace_id, l1_email, l2_email, l1_name or "", l2_name or "", s1, s1, s2, updated_at))
            await db.commit()

    async def get_parent_pipelines(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Returns parent (master) pipelines for a workspace from the pipelines cache."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, displayName FROM pipelines
                WHERE workspace_id = ? AND is_master = 1
                ORDER BY displayName
            """, (workspace_id,))
            rows = await cursor.fetchall()
            return [{"pipelineId": r["id"], "pipelineName": r["displayName"]} for r in rows]

    async def get_sla_configs_for_workspace(self, workspace_id: str) -> Dict[str, Any]:
        """Returns SLA configs keyed by pipeline id for a workspace (camelCase)."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs WHERE workspace_id = ?
            """, (workspace_id,))
            rows = await cursor.fetchall()
            return {
                r["pipeline_id"]: {
                    "l1Email": r["l1_email"],
                    "l1Name": r["l1_name"] or "",
                    "l2Email": r["l2_email"],
                    "l2Name": r["l2_name"] or "",
                    "sla1Minutes": r["sla1_minutes"],
                    "sla2Minutes": r["sla2_minutes"]
                } for r in rows
            }

    async def get_active_incident_for_run(self, pipeline_run_id: str) -> Optional[Dict[str, Any]]:
        """Gets active incident for a run if any exists."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                       status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                       resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE pipeline_run_id = ?
                ORDER BY failed_at DESC LIMIT 1
            """, (pipeline_run_id,))
            row = await cursor.fetchone()
            if row:
                return dict(row)
            return None

    async def get_active_incidents(self, workspace_id: str) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                       status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                       resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE workspace_id = ?
                ORDER BY failed_at DESC
            """, (workspace_id,))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_all_unresolved_incidents(self) -> List[Dict[str, Any]]:
        """Returns all ACTIVE and ESCALATED_L2 incidents across all workspaces."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                       status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                       resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE status IN ('ACTIVE', 'ESCALATED_L2')
            """)
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def create_incident(self, incident: Dict[str, Any]):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO sla_incidents (
                    id, pipeline_id, pipeline_name, pipeline_run_id, workspace_id,
                    status, failed_at, sla_target_time, l1_notified_at, l2_escalated_at,
                    resolved_at, resolved_by, error_message, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    sla_target_time=excluded.sla_target_time,
                    l1_notified_at=excluded.l1_notified_at,
                    l2_escalated_at=excluded.l2_escalated_at,
                    resolved_at=excluded.resolved_at,
                    resolved_by=excluded.resolved_by,
                    error_message=excluded.error_message,
                    updated_at=excluded.updated_at
            """, (
                incident["id"], incident["pipelineId"], incident["pipelineName"],
                incident["pipelineRunId"], incident["workspaceId"], incident.get("status", "ACTIVE"),
                incident["failedAt"], incident["slaTargetTime"], incident.get("l1NotifiedAt"),
                incident.get("l2EscalatedAt"), incident.get("resolvedAt"), incident.get("resolvedBy"),
                incident.get("errorMessage"), incident["updatedAt"]
            ))
            await db.commit()

    async def update_incident(self, incident_id: str, updates: Dict[str, Any]):
        fields = []
        values = []
        for k, v in updates.items():
            fields.append(f"{k} = ?")
            values.append(v)
        values.append(incident_id)

        query = f"UPDATE sla_incidents SET {', '.join(fields)} WHERE id = ?"
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(query, tuple(values))
            await db.commit()

    async def save_schedules(self, workspace_id: str, schedules: List[Dict[str, Any]], updated_at: str):
        async with aiosqlite.connect(self.db_path) as db:
            for s in schedules:
                pid = s.get("pipelineId")
                name = s.get("pipelineName", "")
                enabled = 1 if s.get("enabled") else 0
                stype = s.get("scheduleType", "None")
                next_run = s.get("nextRunTime")
                tz = s.get("timeZone", "UTC")
                raw = json.dumps(s.get("rawConfiguration", {}))

                await db.execute("""
                    INSERT INTO pipeline_schedules (
                        pipeline_id, workspace_id, pipeline_name, enabled,
                        schedule_type, next_run_time, time_zone, raw_configuration, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(pipeline_id) DO UPDATE SET
                        enabled=excluded.enabled,
                        schedule_type=excluded.schedule_type,
                        next_run_time=excluded.next_run_time,
                        time_zone=excluded.time_zone,
                        raw_configuration=excluded.raw_configuration,
                        updated_at=excluded.updated_at
                """, (pid, workspace_id, name, enabled, stype, next_run, tz, raw, updated_at))
            await db.commit()

    async def get_pipeline_schedules(self, workspace_id: str) -> List[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, workspace_id, pipeline_name, enabled,
                       schedule_type, next_run_time, time_zone, raw_configuration
                FROM pipeline_schedules
                WHERE workspace_id = ?
                ORDER BY pipeline_name ASC
            """, (workspace_id,))
            rows = await cursor.fetchall()
            results = []
            for r in rows:
                raw_cfg = {}
                if r["raw_configuration"]:
                    try:
                        raw_cfg = json.loads(r["raw_configuration"])
                    except Exception:
                        raw_cfg = {}
                results.append({
                    "pipelineId": r["pipeline_id"],
                    "pipelineName": r["pipeline_name"],
                    "enabled": bool(r["enabled"]),
                    "scheduleType": r["schedule_type"] or "Manual / None",
                    "nextRunTime": r["next_run_time"],
                    "timeZone": r["time_zone"] or "UTC",
                    "rawConfiguration": raw_cfg
                })
            return results

    async def get_schedule_for_pipeline(self, workspace_id: str, pipeline_id: str) -> Optional[Dict[str, Any]]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT pipeline_id, workspace_id, pipeline_name, enabled,
                       schedule_type, next_run_time, time_zone, raw_configuration
                FROM pipeline_schedules
                WHERE workspace_id = ? AND pipeline_id = ?
            """, (workspace_id, pipeline_id))
            r = await cursor.fetchone()
            if not r:
                return None
            raw_cfg = {}
            if r["raw_configuration"]:
                try:
                    raw_cfg = json.loads(r["raw_configuration"])
                except Exception:
                    raw_cfg = {}
            return {
                "pipelineId": r["pipeline_id"],
                "pipelineName": r["pipeline_name"],
                "enabled": bool(r["enabled"]),
                "scheduleType": r["schedule_type"] or "Manual / None",
                "nextRunTime": r["next_run_time"],
                "timeZone": r["time_zone"] or "UTC",
                "rawConfiguration": raw_cfg
            }

    async def get_workspace_latest_tree(self, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Builds the ultra-fast latest execution hierarchy directly from SQLite:
        - 1 row per master pipeline showing ONLY its latest run.
        - Sub-pipelines are strictly nested inside their parent activities.
        - Attaches SLA config, active incident, and schedule summary.
        - NEVER renders unlinked sub-pipelines at the bottom.
        """
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row

            # 1. Fetch only master / root pipelines
            cursor = await db.execute("""
                SELECT id, displayName, is_master, prefix
                FROM pipelines
                WHERE workspace_id = ? AND is_master = 1
                ORDER BY displayName ASC
            """, (workspace_id,))
            pipeline_rows = await cursor.fetchall()
            
            # Fallback if no pipeline was flagged: query all pipelines in workspace
            if not pipeline_rows:
                cursor = await db.execute("""
                    SELECT id, displayName, is_master, prefix
                    FROM pipelines
                    WHERE workspace_id = ?
                    ORDER BY displayName ASC
                """, (workspace_id,))
                pipeline_rows = await cursor.fetchall()

            if not pipeline_rows:
                return []

            # 2. For each master pipeline, fetch its latest run
            cursor = await db.execute("""
                SELECT r.id, r.pipeline_id, r.pipeline_name, r.workspace_id, r.status,
                       r.start_time, r.end_time, r.duration_in_ms, r.invoke_type,
                       r.is_child, r.parent_run_id, r.parent_activity_name, r.failure_reason
                FROM pipeline_runs r
                INNER JOIN (
                    SELECT pipeline_id, MAX(COALESCE(start_time, '1970-01-01')) as max_start
                    FROM pipeline_runs
                    WHERE workspace_id = ?
                    GROUP BY pipeline_id
                ) latest ON r.pipeline_id = latest.pipeline_id 
                         AND COALESCE(r.start_time, '1970-01-01') = latest.max_start
                WHERE r.workspace_id = ?
            """, (workspace_id, workspace_id))
            latest_run_rows = await cursor.fetchall()
            latest_runs_by_pid = {r["pipeline_id"]: dict(r) for r in latest_run_rows}

            # 3. Fetch SLA configs with L1 & L2 names
            cursor = await db.execute("""
                SELECT pipeline_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs
                WHERE workspace_id = ?
            """, (workspace_id,))
            sla_rows = await cursor.fetchall()
            sla_by_pid = {
                s["pipeline_id"]: {
                    "pipelineId": s["pipeline_id"],
                    "workspaceId": workspace_id,
                    "l1Email": s["l1_email"],
                    "l1Name": s["l1_name"] or "",
                    "l2Email": s["l2_email"],
                    "l2Name": s["l2_name"] or "",
                    "slaMinutes": s["sla_minutes"],
                    "sla1Minutes": s["sla1_minutes"],
                    "sla2Minutes": s["sla2_minutes"],
                } for s in sla_rows
            }

            # 4. Fetch Active/Recent Incidents
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, status, failed_at, sla_target_time,
                       l1_notified_at, l2_escalated_at, resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE workspace_id = ? AND status IN ('ACTIVE', 'ESCALATED_L2', 'RESOLVED')
                ORDER BY failed_at DESC
            """, (workspace_id,))
            incident_rows = await cursor.fetchall()
            incident_by_run_id = {}
            for inc in incident_rows:
                run_id = inc["pipeline_run_id"]
                if run_id not in incident_by_run_id:
                    incident_by_run_id[run_id] = dict(inc)

            # 5. Fetch Schedules
            cursor = await db.execute("""
                SELECT pipeline_id, enabled, schedule_type, next_run_time, time_zone
                FROM pipeline_schedules
                WHERE workspace_id = ?
            """, (workspace_id,))
            sched_rows = await cursor.fetchall()
            sched_by_pid = {s["pipeline_id"]: dict(s) for s in sched_rows}

        # Build pipeline objects for Master Pipelines
        run_objects_by_id: Dict[str, Dict[str, Any]] = {}
        top_level: List[Dict[str, Any]] = []

        for p in pipeline_rows:
            pid = p["id"]
            pname = p["displayName"]
            latest_run = latest_runs_by_pid.get(pid)

            sla_cfg = sla_by_pid.get(pid, {
                "pipelineId": pid,
                "workspaceId": workspace_id,
                "l1Email": "uiaptracker@gmail.com",
                "l2Email": "uiaptracker@gmail.com",
                "slaMinutes": 30
            })
            sched_info = sched_by_pid.get(pid)

            if latest_run:
                run_id = latest_run["id"]
                fail_err = None
                if latest_run["failure_reason"]:
                    try:
                        fail_err = json.loads(latest_run["failure_reason"])
                    except Exception:
                        fail_err = None

                inc = incident_by_run_id.get(run_id)

                dur_ms = latest_run["duration_in_ms"]
                if (dur_ms is None or dur_ms == 0) and latest_run["start_time"] and latest_run["end_time"]:
                    try:
                        clean_st = str(latest_run["start_time"]).replace("Z", "+00:00")
                        clean_et = str(latest_run["end_time"]).replace("Z", "+00:00")
                        st_dt = datetime.datetime.fromisoformat(clean_st)
                        et_dt = datetime.datetime.fromisoformat(clean_et)
                        dur_ms = int(max(0, (et_dt - st_dt).total_seconds() * 1000))
                    except Exception:
                        dur_ms = None

                run_obj = {
                    "id": run_id,
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "workspaceId": workspace_id,
                    "status": latest_run["status"],
                    "startTime": latest_run["start_time"],
                    "endTime": latest_run["end_time"],
                    "durationInMs": dur_ms,
                    "invokeType": latest_run["invoke_type"] or "Manual",
                    "isChild": False,
                    "parentRunId": None,
                    "parentActivityName": None,
                    "error": fail_err,
                    "activities": [],
                    "childPipelines": [],
                    "slaConfig": sla_cfg,
                    "incident": inc,
                    "schedule": sched_info
                }
                run_objects_by_id[run_id] = run_obj
                top_level.append(run_obj)
            else:
                run_obj = {
                    "id": f"norun-{pid}",
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "workspaceId": workspace_id,
                    "status": "No Runs",
                    "startTime": None,
                    "endTime": None,
                    "durationInMs": 0,
                    "invokeType": "None",
                    "isChild": False,
                    "parentRunId": None,
                    "parentActivityName": None,
                    "error": None,
                    "activities": [],
                    "childPipelines": [],
                    "slaConfig": sla_cfg,
                    "incident": None,
                    "schedule": sched_info
                }
                run_objects_by_id[run_obj["id"]] = run_obj
                top_level.append(run_obj)

        # Batch load activities for all master runs
        run_ids = [r["id"] for r in top_level if not r["id"].startswith("norun-")]
        if run_ids:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                placeholders = ",".join(["?"] * len(run_ids))
                cursor = await db.execute(f"""
                    SELECT activity_run_id, pipeline_run_id, activity_name, activity_type,
                           status, start_time, end_time, duration_in_ms, error, output,
                           child_pipeline_run_id, child_pipeline_data
                    FROM activity_runs
                    WHERE pipeline_run_id IN ({placeholders})
                    ORDER BY start_time ASC
                """, run_ids)
                act_rows = await cursor.fetchall()

                for a in act_rows:
                    prun_id = a["pipeline_run_id"]
                    if prun_id in run_objects_by_id:
                        err_val = None
                        if a["error"]:
                            try:
                                err_val = json.loads(a["error"])
                            except Exception:
                                pass
                        out_val = None
                        if a["output"]:
                            try:
                                out_val = json.loads(a["output"])
                            except Exception:
                                pass

                        child_pipe = None
                        if a["child_pipeline_data"]:
                            try:
                                child_pipe = json.loads(a["child_pipeline_data"])
                            except Exception:
                                pass

                        run_objects_by_id[prun_id]["activities"].append({
                            "activityRunId": a["activity_run_id"],
                            "pipelineRunId": prun_id,
                            "activityName": a["activity_name"],
                            "activityType": a["activity_type"],
                            "status": a["status"],
                            "activityRunStart": a["start_time"],
                            "activityRunEnd": a["end_time"],
                            "durationInMs": a["duration_in_ms"],
                            "error": err_val,
                            "output": out_val,
                            "childPipelineRunId": a["child_pipeline_run_id"],
                            "childPipeline": child_pipe
                        })

        # Ensure duration is populated: sum activity durations if still None or 0
        for r_obj in top_level:
            if (r_obj["durationInMs"] is None or r_obj["durationInMs"] == 0) and r_obj.get("activities"):
                act_sum = sum(a.get("durationInMs") or 0 for a in r_obj["activities"])
                if act_sum > 0:
                    r_obj["durationInMs"] = act_sum

        # Sort top-level by start time descending
        top_level.sort(
            key=lambda x: (x.get("startTime") is not None, x.get("startTime") or "", x.get("pipelineName", "")),
            reverse=True
        )
        return top_level

    @staticmethod
    def _is_schedule_active_in_range(sched_row: dict, start_date: datetime.date, end_date: datetime.date) -> tuple[bool, str]:
        if not sched_row or not sched_row.get("enabled"):
            return False, ""

        raw = {}
        if sched_row.get("raw_configuration"):
            try:
                raw = json.loads(sched_row["raw_configuration"])
            except Exception:
                raw = {}

        schedules_list = []
        if isinstance(raw, dict) and "value" in raw and isinstance(raw["value"], list):
            schedules_list = raw["value"]
        elif isinstance(raw, list):
            schedules_list = raw
        elif raw:
            schedules_list = [raw]
        else:
            schedules_list = [{
                "enabled": sched_row.get("enabled"),
                "configuration": {
                    "type": sched_row.get("schedule_type"),
                    "nextRunTime": sched_row.get("next_run_time")
                }
            }]

        curr = start_date
        while curr <= end_date:
            target_iso = curr.isoformat()
            target_weekday = curr.strftime("%A").lower()

            for item in schedules_list:
                if not item.get("enabled", True):
                    continue
                cfg = item.get("configuration") or item
                stype = (cfg.get("type") or item.get("scheduleType") or sched_row.get("schedule_type") or "").lower()
                times = cfg.get("times") or []
                time_str = times[0] if times else "08:00"

                start_dt_str = cfg.get("startDateTime") or item.get("startDate")
                end_dt_str = cfg.get("endDateTime") or item.get("endDate")
                if start_dt_str and str(start_dt_str)[:10] > target_iso:
                    continue
                if end_dt_str and str(end_dt_str)[:10] < target_iso:
                    continue

                next_run = cfg.get("nextRunTime") or item.get("nextRunTime") or sched_row.get("next_run_time")
                if next_run and str(next_run)[:10] == target_iso:
                    return True, f"{target_iso} {str(next_run)[11:16]}"

                if stype in ["daily", "day"]:
                    return True, f"{target_iso} {time_str}"
                elif stype in ["weekly", "week"]:
                    days = [str(d).lower() for d in (cfg.get("days") or [])]
                    if target_weekday in days:
                        return True, f"{target_iso} {time_str}"

            curr += datetime.timedelta(days=1)

        return False, ""

    async def get_workspace_tree_by_date(
        self,
        workspace_id: str,
        date_preset: str = "latest",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Builds the date-filtered execution hierarchy and forecast for a workspace.
        Supports presets: 'latest', 'yesterday' (last day), 'today', 'tomorrow' (next day), 'last_week', 'next_week', 'custom'.
        Computes accurate summary metrics (total, running, succeeded, failed, cancelled, notRun, scheduled, notScheduled).
        """
        today_date = datetime.datetime.now(datetime.timezone.utc).date()
        preset = (date_preset or "latest").lower().strip()
        is_future = False

        if preset in ("yesterday", "last_day", "lastday"):
            target_start = today_date - datetime.timedelta(days=1)
            target_end = target_start
        elif preset == "today":
            target_start = today_date
            target_end = today_date
        elif preset in ("tomorrow", "next_day", "nextday"):
            target_start = today_date + datetime.timedelta(days=1)
            target_end = target_start
            is_future = True
        elif preset in ("last_week", "lastweek"):
            target_start = today_date - datetime.timedelta(days=7)
            target_end = today_date - datetime.timedelta(days=1)
        elif preset in ("next_week", "nextweek"):
            target_start = today_date + datetime.timedelta(days=1)
            target_end = today_date + datetime.timedelta(days=7)
            is_future = True
        elif preset == "custom":
            try:
                target_start = datetime.date.fromisoformat(start_date) if start_date else today_date
            except Exception:
                target_start = today_date
            try:
                target_end = datetime.date.fromisoformat(end_date) if end_date else target_start
            except Exception:
                target_end = target_start
            if target_start > today_date:
                is_future = True
        else:
            target_start = None
            target_end = None

        # Fetch available run dates in DB for this workspace
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT DISTINCT substr(COALESCE(start_time, end_time), 1, 10) as run_date
                FROM pipeline_runs
                WHERE workspace_id = ? AND status != 'No Runs' AND start_time IS NOT NULL
                ORDER BY 1 DESC
            """, (workspace_id,))
            date_rows = await cursor.fetchall()
            available_dates = [r["run_date"] for r in date_rows if r["run_date"]]

        # 1. Latest preset delegates to get_workspace_latest_tree
        if target_start is None or target_end is None:
            latest_tree = await self.get_workspace_latest_tree(workspace_id)
            total = len(latest_tree)
            running = sum(1 for p in latest_tree if p.get("status", "").lower() in ("inprogress", "running"))
            succeeded = sum(1 for p in latest_tree if p.get("status", "").lower() in ("completed", "succeeded", "success"))
            failed = sum(1 for p in latest_tree if p.get("status", "").lower() == "failed")
            cancelled = sum(1 for p in latest_tree if p.get("status", "").lower() in ("cancelled", "canceled"))
            not_run = sum(1 for p in latest_tree if p.get("status", "").lower() in ("no runs", "noruns", "notstarted", "never executed", "not run"))

            return {
                "workspaceId": workspace_id,
                "dateFilter": {
                    "preset": "latest",
                    "startDate": None,
                    "endDate": None,
                    "isFuture": False,
                    "availableRunDates": available_dates
                },
                "metrics": {
                    "total": total,
                    "running": running,
                    "succeeded": succeeded,
                    "failed": failed,
                    "cancelled": cancelled,
                    "notRun": not_run,
                    "scheduled": 0,
                    "notScheduled": 0
                },
                "pipelines": latest_tree
            }

        # 2. Query master pipelines
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT id, displayName, is_master, prefix
                FROM pipelines
                WHERE workspace_id = ? AND is_master = 1
                ORDER BY displayName ASC
            """, (workspace_id,))
            pipeline_rows = await cursor.fetchall()
            if not pipeline_rows:
                cursor = await db.execute("""
                    SELECT id, displayName, is_master, prefix
                    FROM pipelines
                    WHERE workspace_id = ?
                    ORDER BY displayName ASC
                """, (workspace_id,))
                pipeline_rows = await cursor.fetchall()

            # SLA configs with L1 and L2 names
            cursor = await db.execute("""
                SELECT pipeline_id, l1_email, l2_email, l1_name, l2_name, sla_minutes,
                       COALESCE(sla1_minutes, sla_minutes) AS sla1_minutes,
                       COALESCE(sla2_minutes, sla_minutes) AS sla2_minutes
                FROM sla_configs
                WHERE workspace_id = ?
            """, (workspace_id,))
            sla_rows = await cursor.fetchall()
            sla_by_pid = {
                s["pipeline_id"]: {
                    "pipelineId": s["pipeline_id"],
                    "workspaceId": workspace_id,
                    "l1Email": s["l1_email"],
                    "l1Name": s["l1_name"] or "",
                    "l2Email": s["l2_email"],
                    "l2Name": s["l2_name"] or "",
                    "slaMinutes": s["sla_minutes"],
                    "sla1Minutes": s["sla1_minutes"],
                    "sla2Minutes": s["sla2_minutes"],
                } for s in sla_rows
            }

            # Schedules
            cursor = await db.execute("""
                SELECT pipeline_id, enabled, schedule_type, next_run_time, time_zone, raw_configuration
                FROM pipeline_schedules
                WHERE workspace_id = ?
            """, (workspace_id,))
            sched_rows = await cursor.fetchall()
            sched_by_pid = {s["pipeline_id"]: dict(s) for s in sched_rows}

        if is_future:
            # 3. Future Forecast Mode
            forecast_pipelines = []
            scheduled_count = 0
            not_scheduled_count = 0

            for p in pipeline_rows:
                pid = p["id"]
                pname = p["displayName"]
                sched_info = sched_by_pid.get(pid)
                is_sched, sched_time_str = self._is_schedule_active_in_range(sched_info, target_start, target_end)

                sla_cfg = sla_by_pid.get(pid, {
                    "pipelineId": pid,
                    "workspaceId": workspace_id,
                    "l1Email": "uiaptracker@gmail.com",
                    "l2Email": "uiaptracker@gmail.com",
                    "slaMinutes": 30
                })

                if is_sched:
                    status_str = "Scheduled"
                    scheduled_count += 1
                    start_time_val = f"{sched_time_str}Z" if "T" in sched_time_str else f"{sched_time_str}:00Z"
                    invoke_val = "Schedule"
                else:
                    status_str = "Not Scheduled"
                    not_scheduled_count += 1
                    start_time_val = None
                    invoke_val = "None"

                forecast_pipelines.append({
                    "id": f"sched-{pid}",
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "workspaceId": workspace_id,
                    "status": status_str,
                    "startTime": start_time_val,
                    "endTime": None,
                    "durationInMs": 0,
                    "invokeType": invoke_val,
                    "isChild": False,
                    "parentRunId": None,
                    "parentActivityName": None,
                    "error": None,
                    "activities": [],
                    "childPipelines": [],
                    "slaConfig": sla_cfg,
                    "incident": None,
                    "schedule": sched_info
                })

            forecast_pipelines.sort(
                key=lambda x: (x["status"] == "Scheduled", x["pipelineName"]),
                reverse=True
            )

            return {
                "workspaceId": workspace_id,
                "dateFilter": {
                    "preset": preset,
                    "startDate": target_start.isoformat(),
                    "endDate": target_end.isoformat(),
                    "isFuture": True,
                    "availableRunDates": available_dates
                },
                "metrics": {
                    "total": len(pipeline_rows),
                    "running": 0,
                    "succeeded": 0,
                    "failed": 0,
                    "cancelled": 0,
                    "notRun": not_scheduled_count,
                    "scheduled": scheduled_count,
                    "notScheduled": not_scheduled_count
                },
                "pipelines": forecast_pipelines
            }

        # 4. Past / Current Mode
        s_iso = target_start.isoformat()
        e_iso = target_end.isoformat()

        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT r.id, r.pipeline_id, r.pipeline_name, r.workspace_id, r.status,
                       r.start_time, r.end_time, r.duration_in_ms, r.invoke_type,
                       r.is_child, r.parent_run_id, r.parent_activity_name, r.failure_reason
                FROM pipeline_runs r
                INNER JOIN (
                    SELECT pipeline_id, MAX(COALESCE(start_time, '1970-01-01')) as max_start
                    FROM pipeline_runs
                    WHERE workspace_id = ?
                      AND substr(COALESCE(start_time, end_time), 1, 10) >= ?
                      AND substr(COALESCE(start_time, end_time), 1, 10) <= ?
                      AND status != 'No Runs'
                    GROUP BY pipeline_id
                ) win ON r.pipeline_id = win.pipeline_id AND COALESCE(r.start_time, '1970-01-01') = win.max_start
                WHERE r.workspace_id = ?
            """, (workspace_id, s_iso, e_iso, workspace_id))
            period_runs = await cursor.fetchall()
            runs_by_pid = {r["pipeline_id"]: dict(r) for r in period_runs}

            # Incidents in period
            cursor = await db.execute("""
                SELECT id, pipeline_id, pipeline_name, pipeline_run_id, status, failed_at, sla_target_time,
                       l1_notified_at, l2_escalated_at, resolved_at, resolved_by, error_message
                FROM sla_incidents
                WHERE workspace_id = ? AND status IN ('ACTIVE', 'ESCALATED_L2', 'RESOLVED')
                ORDER BY failed_at DESC
            """, (workspace_id,))
            inc_rows = await cursor.fetchall()
            incident_by_run_id = {}
            for inc in inc_rows:
                run_id = inc["pipeline_run_id"]
                if run_id not in incident_by_run_id:
                    incident_by_run_id[run_id] = dict(inc)

        period_pipelines = []
        run_objects_by_id: Dict[str, Dict[str, Any]] = {}

        for p in pipeline_rows:
            pid = p["id"]
            pname = p["displayName"]
            p_run = runs_by_pid.get(pid)

            sla_cfg = sla_by_pid.get(pid, {
                "pipelineId": pid,
                "workspaceId": workspace_id,
                "l1Email": "uiaptracker@gmail.com",
                "l2Email": "uiaptracker@gmail.com",
                "slaMinutes": 30
            })
            sched_info = sched_by_pid.get(pid)

            if p_run:
                run_id = p_run["id"]
                fail_err = None
                if p_run["failure_reason"]:
                    try:
                        fail_err = json.loads(p_run["failure_reason"])
                    except Exception:
                        fail_err = None

                inc = incident_by_run_id.get(run_id)

                dur_ms = p_run["duration_in_ms"]
                if (dur_ms is None or dur_ms == 0) and p_run["start_time"] and p_run["end_time"]:
                    try:
                        clean_st = str(p_run["start_time"]).replace("Z", "+00:00")
                        clean_et = str(p_run["end_time"]).replace("Z", "+00:00")
                        st_dt = datetime.datetime.fromisoformat(clean_st)
                        et_dt = datetime.datetime.fromisoformat(clean_et)
                        dur_ms = int(max(0, (et_dt - st_dt).total_seconds() * 1000))
                    except Exception:
                        dur_ms = None

                run_obj = {
                    "id": run_id,
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "workspaceId": workspace_id,
                    "status": p_run["status"],
                    "startTime": p_run["start_time"],
                    "endTime": p_run["end_time"],
                    "durationInMs": dur_ms,
                    "invokeType": p_run["invoke_type"] or "Manual",
                    "isChild": False,
                    "parentRunId": None,
                    "parentActivityName": None,
                    "error": fail_err,
                    "activities": [],
                    "childPipelines": [],
                    "slaConfig": sla_cfg,
                    "incident": inc,
                    "schedule": sched_info
                }
                run_objects_by_id[run_id] = run_obj
                period_pipelines.append(run_obj)
            else:
                run_obj = {
                    "id": f"norun-{pid}",
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "workspaceId": workspace_id,
                    "status": "Not Run",
                    "startTime": None,
                    "endTime": None,
                    "durationInMs": 0,
                    "invokeType": "None",
                    "isChild": False,
                    "parentRunId": None,
                    "parentActivityName": None,
                    "error": None,
                    "activities": [],
                    "childPipelines": [],
                    "slaConfig": sla_cfg,
                    "incident": None,
                    "schedule": sched_info
                }
                run_objects_by_id[run_obj["id"]] = run_obj
                period_pipelines.append(run_obj)

        # Batch load activities for all runs in period
        run_ids = [r["id"] for r in period_pipelines if not r["id"].startswith("norun-")]
        if run_ids:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = aiosqlite.Row
                placeholders = ",".join(["?"] * len(run_ids))
                cursor = await db.execute(f"""
                    SELECT activity_run_id, pipeline_run_id, activity_name, activity_type,
                           status, start_time, end_time, duration_in_ms, error, output,
                           child_pipeline_run_id, child_pipeline_data
                    FROM activity_runs
                    WHERE pipeline_run_id IN ({placeholders})
                    ORDER BY start_time ASC
                """, run_ids)
                act_rows = await cursor.fetchall()

                for a in act_rows:
                    prun_id = a["pipeline_run_id"]
                    if prun_id in run_objects_by_id:
                        err_val = None
                        if a["error"]:
                            try:
                                err_val = json.loads(a["error"])
                            except Exception:
                                pass
                        out_val = None
                        if a["output"]:
                            try:
                                out_val = json.loads(a["output"])
                            except Exception:
                                pass

                        child_pipe = None
                        if a["child_pipeline_data"]:
                            try:
                                child_pipe = json.loads(a["child_pipeline_data"])
                            except Exception:
                                pass

                        run_objects_by_id[prun_id]["activities"].append({
                            "activityRunId": a["activity_run_id"],
                            "pipelineRunId": prun_id,
                            "activityName": a["activity_name"],
                            "activityType": a["activity_type"],
                            "status": a["status"],
                            "activityRunStart": a["start_time"],
                            "activityRunEnd": a["end_time"],
                            "durationInMs": a["duration_in_ms"],
                            "error": err_val,
                            "output": out_val,
                            "childPipelineRunId": a["child_pipeline_run_id"],
                            "childPipeline": child_pipe
                        })

        for r_obj in period_pipelines:
            if (r_obj["durationInMs"] is None or r_obj["durationInMs"] == 0) and r_obj.get("activities"):
                act_sum = sum(a.get("durationInMs") or 0 for a in r_obj["activities"])
                if act_sum > 0:
                    r_obj["durationInMs"] = act_sum

        period_pipelines.sort(
            key=lambda x: (x.get("startTime") is not None, x.get("startTime") or "", x.get("pipelineName", "")),
            reverse=True
        )

        total = len(pipeline_rows)
        running = sum(1 for p in period_pipelines if p.get("status", "").lower() in ("inprogress", "running"))
        succeeded = sum(1 for p in period_pipelines if p.get("status", "").lower() in ("completed", "succeeded", "success"))
        failed = sum(1 for p in period_pipelines if p.get("status", "").lower() == "failed")
        cancelled = sum(1 for p in period_pipelines if p.get("status", "").lower() in ("cancelled", "canceled"))
        not_run = sum(1 for p in period_pipelines if p.get("status", "").lower() in ("no runs", "noruns", "notstarted", "never executed", "not run"))

        return {
            "workspaceId": workspace_id,
            "dateFilter": {
                "preset": preset,
                "startDate": s_iso,
                "endDate": e_iso,
                "isFuture": False,
                "availableRunDates": available_dates
            },
            "metrics": {
                "total": total,
                "running": running,
                "succeeded": succeeded,
                "failed": failed,
                "cancelled": cancelled,
                "notRun": not_run,
                "scheduled": 0,
                "notScheduled": 0
            },
            "pipelines": period_pipelines
        }

    async def get_table_log_mapping(self, workspace_id: str) -> Optional[Dict[str, Any]]:
        """Fetch saved table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM table_log_mappings WHERE workspace_id = ?;", (workspace_id,))
            row = await cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            for k in ["batch_header_mapping", "bronze_mapping", "silver_mapping"]:
                if res.get(k):
                    try:
                        res[k] = json.loads(res[k])
                    except Exception:
                        pass
            return res

    async def save_table_log_mapping(
        self,
        workspace_id: str,
        artifact_type: str,
        artifact_id: str,
        artifact_name: str,
        server_fqdn: str,
        database_name: str,
        batch_header_schema: str,
        batch_header_table: str,
        batch_header_mapping: Dict[str, Any],
        bronze_schema: str,
        bronze_table: str,
        bronze_mapping: Dict[str, Any],
        silver_schema: str,
        silver_table: str,
        silver_mapping: Dict[str, Any],
        updated_at: str
    ):
        """Save or update table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO table_log_mappings (
                    workspace_id, artifact_type, artifact_id, artifact_name,
                    server_fqdn, database_name,
                    batch_header_schema, batch_header_table, batch_header_mapping,
                    bronze_schema, bronze_table, bronze_mapping,
                    silver_schema, silver_table, silver_mapping,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(workspace_id) DO UPDATE SET
                    artifact_type=excluded.artifact_type,
                    artifact_id=excluded.artifact_id,
                    artifact_name=excluded.artifact_name,
                    server_fqdn=excluded.server_fqdn,
                    database_name=excluded.database_name,
                    batch_header_schema=excluded.batch_header_schema,
                    batch_header_table=excluded.batch_header_table,
                    batch_header_mapping=excluded.batch_header_mapping,
                    bronze_schema=excluded.bronze_schema,
                    bronze_table=excluded.bronze_table,
                    bronze_mapping=excluded.bronze_mapping,
                    silver_schema=excluded.silver_schema,
                    silver_table=excluded.silver_table,
                    silver_mapping=excluded.silver_mapping,
                    updated_at=excluded.updated_at;
            """, (
                workspace_id,
                artifact_type,
                artifact_id,
                artifact_name,
                server_fqdn,
                database_name,
                batch_header_schema,
                batch_header_table,
                json.dumps(batch_header_mapping),
                bronze_schema,
                bronze_table,
                json.dumps(bronze_mapping),
                silver_schema,
                silver_table,
                json.dumps(silver_mapping),
                updated_at
            ))
            await db.commit()

    async def delete_table_log_mapping(self, workspace_id: str):
        """Delete/reset table log mapping for a workspace."""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM table_log_mappings WHERE workspace_id = ?;", (workspace_id,))
            await db.commit()

    async def get_cached_ai_diagnosis(self, error_hash: str) -> Optional[Dict[str, Any]]:
        """Retrieves cached AI diagnosis by error signature hash."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT error_hash, error_code, error_message, activity_type, pipeline_name, diagnosis_json, created_at
                FROM ai_error_diagnostics
                WHERE error_hash = ?;
            """, (error_hash,))
            row = await cursor.fetchone()
            if row:
                try:
                    diag = json.loads(row["diagnosis_json"])
                    diag["cached"] = True
                    diag["cachedAt"] = row["created_at"]
                    return diag
                except Exception as ex:
                    logger.warning(f"Failed to parse cached diagnosis JSON for hash {error_hash}: {ex}")
            return None

    async def save_ai_diagnosis(
        self,
        error_hash: str,
        error_code: str,
        error_message: str,
        activity_type: str,
        pipeline_name: str,
        diagnosis: Dict[str, Any]
    ):
        """Stores AI diagnosis in SQLite cache."""
        async with aiosqlite.connect(self.db_path) as db:
            import datetime
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
            await db.execute("""
                INSERT INTO ai_error_diagnostics (
                    error_hash, error_code, error_message, activity_type, pipeline_name, diagnosis_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(error_hash) DO UPDATE SET
                    diagnosis_json=excluded.diagnosis_json,
                    created_at=excluded.created_at;
            """, (
                error_hash,
                error_code or "",
                error_message or "",
                activity_type or "",
                pipeline_name or "",
                json.dumps(diagnosis),
                now_iso
            ))
            await db.commit()

db_service = DatabaseService()
