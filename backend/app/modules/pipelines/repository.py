import datetime
import json
import logging
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert

from app.db.session import async_session_maker
from app.modules.pipelines.models.activity_run import ActivityRun
from app.modules.pipelines.models.pipeline import Pipeline
from app.modules.pipelines.models.pipeline_run import PipelineRun
from app.modules.pipelines.models.pipeline_schedule import PipelineSchedule
from app.modules.sla.models.sla_config import SLAConfig
from app.modules.sla.models.sla_incident import SLAIncident
from app.shared.constants import DEFAULT_PIPELINE_NAME

logger = logging.getLogger("fabric_monitor.pipelines.repo")


class PipelineRepository:
    def __init__(self):
        """Initializes the pipeline repository backed by SQLAlchemy Async ORM."""
        pass

    async def get_known_cached_run_ids(self, workspace_id: str) -> Set[str]:
        """Returns run IDs that are completed/failed and already have activity runs stored with all child pipelines resolved."""
        async with async_session_maker() as session:
            # Subquery for runs that have unresolved child pipeline data
            unresolved_subq = (
                select(ActivityRun.pipeline_run_id)
                .where(
                    or_(
                        func.lower(ActivityRun.activity_type).like("%executepipeline%"),
                        func.lower(ActivityRun.activity_type).like("%invokepipeline%"),
                    ),
                    ActivityRun.child_pipeline_data.is_(None),
                )
                .distinct()
            )

            stmt = (
                select(PipelineRun.id)
                .join(ActivityRun, PipelineRun.id == ActivityRun.pipeline_run_id)
                .where(
                    PipelineRun.workspace_id == workspace_id,
                    PipelineRun.status.in_(["Completed", "Failed", "Cancelled"]),
                    PipelineRun.id.not_in(unresolved_subq),
                )
                .distinct()
            )

            result = await session.execute(stmt)
            return {row[0] for row in result.all() if row[0]}

    async def save_pipelines(self, workspace_id: str, pipelines: List[Dict[str, Any]], updated_at: Optional[str] = None) -> None:
        """Saves pipelines from Fabric. Defaults to parent level (is_master=1) until dynamic child linking."""
        if not pipelines:
            return
        if not updated_at:
            updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        async with async_session_maker() as session:
            for p in pipelines:
                pid = p.get("id")
                name = p.get("displayName") or p.get("name") or DEFAULT_PIPELINE_NAME
                parts = name.split("_")
                prefix = f"{parts[0]}_{parts[1]}".lower() if len(parts) >= 2 else ""

                is_m = int(p.get("is_master", 1))
                stmt = sqlite_upsert(Pipeline).values(
                    id=pid,
                    workspace_id=workspace_id,
                    displayName=name,
                    is_master=is_m,
                    prefix=prefix,
                    updated_at=updated_at,
                ).on_conflict_do_update(
                    index_elements=[Pipeline.id],
                    set_={
                        "displayName": name,
                        "prefix": prefix,
                        "is_master": is_m,
                        "updated_at": updated_at,
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def update_child_pipeline_flags(
        self, workspace_id: str, invoked_child_ids: Set[str], invoked_child_names: Set[str]
    ) -> None:
        """
        Dynamic pipeline role resolution:
        Any pipeline that is invoked by an ExecutePipeline activity or has runs marked
        as is_child / parent_run_id is flagged as a child pipeline (is_master = 0).
        """
        child_ids = {str(i).strip().lower() for i in invoked_child_ids if i}
        child_names = {str(n).strip().lower() for n in invoked_child_names if n}

        def extract_child_meta(data: Any) -> None:
            """Recursively extracts child pipeline identifiers and names from nested activity JSON."""
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

        async with async_session_maker() as session:
            # 1. Discover child pipelines from activity_runs JSON
            stmt1 = select(ActivityRun.child_pipeline_data, ActivityRun.output).where(
                or_(
                    ActivityRun.child_pipeline_data.isnot(None),
                    ActivityRun.output.like("%pipeline%"),
                )
            )
            act_rows = (await session.execute(stmt1)).all()
            for r_data, r_out in act_rows:
                if r_data:
                    try:
                        d = json.loads(r_data)
                        extract_child_meta(d)
                    except Exception:
                        pass
                if r_out:
                    try:
                        o = json.loads(r_out)
                        if isinstance(o, dict):
                            p_ref = o.get("pipelineName") or o.get("pipelineId")
                            if p_ref:
                                p_ref_str = str(p_ref).strip().lower()
                                child_ids.add(p_ref_str)
                                child_names.add(p_ref_str)
                    except Exception:
                        pass

            # 2. Discover child runs from child_pipeline_run_id
            stmt2 = select(ActivityRun.child_pipeline_run_id).where(
                ActivityRun.child_pipeline_run_id.isnot(None)
            ).distinct()
            child_run_ids = {row[0] for row in (await session.execute(stmt2)).all() if row[0]}

            if child_run_ids:
                stmt_pipes = select(PipelineRun.pipeline_id, PipelineRun.pipeline_name).where(
                    PipelineRun.id.in_(child_run_ids),
                    PipelineRun.workspace_id == workspace_id,
                )
                found_pipes = (await session.execute(stmt_pipes)).all()
                for f_pid, f_pname in found_pipes:
                    if f_pid:
                        child_ids.add(str(f_pid).strip().lower())
                    if f_pname:
                        child_names.add(str(f_pname).strip().lower())

            # 3. Check pipeline_runs where is_child = 1 or parent_run_id IS NOT NULL
            stmt3 = select(PipelineRun.pipeline_id, PipelineRun.pipeline_name).where(
                PipelineRun.workspace_id == workspace_id,
                or_(PipelineRun.is_child == 1, PipelineRun.parent_run_id.isnot(None)),
            ).distinct()
            invoked_rows = (await session.execute(stmt3)).all()
            for i_pid, i_pname in invoked_rows:
                if i_pid:
                    child_ids.add(str(i_pid).strip().lower())
                if i_pname:
                    child_names.add(str(i_pname).strip().lower())

            # 4. Update all pipelines for this workspace
            stmt_all = select(Pipeline).where(Pipeline.workspace_id == workspace_id)
            all_pipes = (await session.execute(stmt_all)).scalars().all()

            for p in all_pipes:
                pid_clean = str(p.id).strip().lower()
                pname_clean = str(p.displayName or "").strip().lower()
                is_child = pid_clean in child_ids or pname_clean in child_names
                p.is_master = 0 if is_child else 1

            await session.commit()

    async def save_pipeline_runs(self, workspace_id: str, runs: List[Dict[str, Any]], updated_at: Optional[str] = None) -> None:
        """Persists pipeline run executions into local SQLite cache using SQLAlchemy ORM upsert."""
        if not runs:
            return
        if not updated_at:
            updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        async with async_session_maker() as session:
            for r in runs:
                run_id = r.get("id")
                pid = r.get("pipelineId") or r.get("itemId")
                pname = r.get("pipelineName") or r.get("itemDisplayName") or DEFAULT_PIPELINE_NAME
                status = r.get("status") or "Unknown"
                st = r.get("startTimeUtc") or r.get("startTime") or (
                    updated_at if str(status).lower() in ("inprogress", "running", "notstarted") else None
                )
                et = r.get("endTimeUtc") or r.get("endTime")
                dur = r.get("durationInMs")
                invoke = r.get("invokeType", "Manual")
                is_child = 1 if r.get("isChild") else 0
                parent_run_id = r.get("parentRunId")
                parent_act = r.get("parentActivityName")
                fail_raw = r.get("failureReason") or r.get("error")
                fail_str = json.dumps(fail_raw) if fail_raw else None

                if (dur is None or dur == 0) and st and et:
                    try:
                        clean_st = str(st).replace("Z", "+00:00")
                        clean_et = str(et).replace("Z", "+00:00")
                        st_dt = datetime.datetime.fromisoformat(clean_st)
                        et_dt = datetime.datetime.fromisoformat(clean_et)
                        dur = int(max(0, (et_dt - st_dt).total_seconds() * 1000))
                    except Exception:
                        pass

                stmt = sqlite_upsert(PipelineRun).values(
                    id=run_id,
                    pipeline_id=pid,
                    workspace_id=workspace_id,
                    pipeline_name=pname,
                    status=status,
                    start_time=st,
                    end_time=et,
                    duration_in_ms=dur,
                    invoke_type=invoke,
                    is_child=is_child,
                    parent_run_id=parent_run_id,
                    parent_activity_name=parent_act,
                    failure_reason=fail_str,
                    updated_at=updated_at,
                ).on_conflict_do_update(
                    index_elements=[PipelineRun.id],
                    set_={
                        "status": status,
                        "start_time": st,
                        "end_time": et,
                        "duration_in_ms": dur,
                        "is_child": is_child,
                        "parent_run_id": parent_run_id,
                        "parent_activity_name": parent_act,
                        "failure_reason": fail_str,
                        "updated_at": updated_at,
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def save_activity_runs(self, run_id: str, activities: List[Dict[str, Any]], updated_at: Optional[str] = None) -> None:
        """Persists granular activity run records and child pipeline linkage for a pipeline run."""
        if not activities:
            return
        if not updated_at:
            updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        async with async_session_maker() as session:
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

                child_run_id = None
                if isinstance(out, dict):
                    child_run_id = out.get("pipelineRunId") or out.get("runId") or out.get("childPipelineRunId")

                child_pipe = a.get("childPipeline")
                child_pipe_str = json.dumps(child_pipe) if child_pipe else None

                p_run_id = a.get("pipelineRunId") or run_id
                stmt = sqlite_upsert(ActivityRun).values(
                    activity_run_id=act_id,
                    pipeline_run_id=p_run_id,
                    activity_name=name,
                    activity_type=atype,
                    status=status,
                    start_time=st,
                    end_time=et,
                    duration_in_ms=dur,
                    error=err_str,
                    output=out_str,
                    child_pipeline_run_id=str(child_run_id) if child_run_id else None,
                    child_pipeline_data=child_pipe_str,
                    updated_at=updated_at,
                ).on_conflict_do_update(
                    index_elements=[ActivityRun.activity_run_id],
                    set_={
                        "pipeline_run_id": p_run_id,
                        "status": status,
                        "start_time": st,
                        "end_time": et,
                        "duration_in_ms": dur,
                        "error": err_str,
                        "output": out_str,
                        "child_pipeline_run_id": str(child_run_id) if child_run_id else None,
                        "child_pipeline_data": child_pipe_str,
                        "updated_at": updated_at,
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def get_activities_for_run(self, run_id: str) -> List[Dict[str, Any]]:
        """Fetches stored activities for a given run from SQLite with parsed childPipeline."""
        async with async_session_maker() as session:
            stmt = select(ActivityRun).where(ActivityRun.pipeline_run_id == run_id).order_by(ActivityRun.start_time.asc())
            rows = (await session.execute(stmt)).scalars().all()
            results = []
            for row in rows:
                err_val = None
                if row.error:
                    try:
                        err_val = json.loads(row.error)
                    except Exception:
                        err_val = None
                out_val = None
                if row.output:
                    try:
                        out_val = json.loads(row.output)
                    except Exception:
                        out_val = None

                child_pipe = None
                if row.child_pipeline_data:
                    try:
                        child_pipe = json.loads(row.child_pipeline_data)
                    except Exception:
                        child_pipe = None

                results.append({
                    "activityRunId": row.activity_run_id,
                    "pipelineRunId": row.pipeline_run_id,
                    "activityName": row.activity_name,
                    "activityType": row.activity_type,
                    "status": row.status,
                    "activityRunStart": row.start_time,
                    "activityRunEnd": row.end_time,
                    "durationInMs": row.duration_in_ms,
                    "error": err_val,
                    "output": out_val,
                    "childPipelineRunId": row.child_pipeline_run_id,
                    "childPipeline": child_pipe,
                })
            return results

    async def get_pipeline_history(self, workspace_id: str, pipeline_id: str) -> List[Dict[str, Any]]:
        """Returns all historical runs for a specific pipeline with inner activities."""
        async with async_session_maker() as session:
            stmt = (
                select(PipelineRun)
                .where(
                    PipelineRun.workspace_id == workspace_id,
                    PipelineRun.pipeline_id == pipeline_id,
                )
                .order_by(PipelineRun.start_time.desc())
            )
            runs = (await session.execute(stmt)).scalars().all()

        results = []
        for r in runs:
            run_id = r.id
            activities = await self.get_activities_for_run(run_id)

            fail_val = None
            if r.failure_reason:
                try:
                    fail_val = json.loads(r.failure_reason)
                except Exception:
                    fail_val = None

            dur_ms = r.duration_in_ms
            if (dur_ms is None or dur_ms == 0) and r.start_time and r.end_time:
                try:
                    clean_st = str(r.start_time).replace("Z", "+00:00")
                    clean_et = str(r.end_time).replace("Z", "+00:00")
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
                "id": r.id,
                "pipelineId": r.pipeline_id,
                "pipelineName": r.pipeline_name,
                "workspaceId": r.workspace_id,
                "status": r.status,
                "startTime": r.start_time,
                "endTime": r.end_time,
                "durationInMs": dur_ms,
                "invokeType": r.invoke_type,
                "isChild": bool(r.is_child),
                "parentRunId": r.parent_run_id,
                "parentActivityName": r.parent_activity_name,
                "error": fail_val,
                "activities": activities,
                "childPipelines": [],
            })
        return results

    async def get_parent_pipelines(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Returns parent (master) pipelines for a workspace from the pipelines cache."""
        async with async_session_maker() as session:
            stmt = select(Pipeline).where(
                Pipeline.workspace_id == workspace_id,
                Pipeline.is_master == 1,
            ).order_by(Pipeline.displayName.asc())
            rows = (await session.execute(stmt)).scalars().all()
            if not rows:
                stmt_all = select(Pipeline).where(Pipeline.workspace_id == workspace_id).order_by(Pipeline.displayName.asc())
                rows = (await session.execute(stmt_all)).scalars().all()
            return [{"pipelineId": r.id, "pipelineName": r.displayName} for r in rows]

    async def save_schedules(self, workspace_id: str, schedules: List[Dict[str, Any]], updated_at: Optional[str] = None) -> None:
        """Persists pipeline schedule and trigger configurations into local SQLite cache."""
        if not schedules:
            return
        if not updated_at:
            updated_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        async with async_session_maker() as session:
            for s in schedules:
                pid = s.get("pipelineId")
                name = s.get("pipelineName", "")
                enabled = 1 if s.get("enabled") else 0
                stype = s.get("scheduleType", "None")
                next_run = s.get("nextRunTime")
                tz = s.get("timeZone", "UTC")
                raw = json.dumps(s.get("rawConfiguration", {}))

                stmt = sqlite_upsert(PipelineSchedule).values(
                    pipeline_id=pid,
                    workspace_id=workspace_id,
                    pipeline_name=name,
                    enabled=enabled,
                    schedule_type=stype,
                    next_run_time=next_run,
                    time_zone=tz,
                    raw_configuration=raw,
                    updated_at=updated_at,
                ).on_conflict_do_update(
                    index_elements=[PipelineSchedule.pipeline_id],
                    set_={
                        "enabled": enabled,
                        "schedule_type": stype,
                        "next_run_time": next_run,
                        "time_zone": tz,
                        "raw_configuration": raw,
                        "updated_at": updated_at,
                    },
                )
                await session.execute(stmt)
            await session.commit()

    async def get_pipeline_schedules(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Retrieves all pipeline schedule definitions cached for a workspace."""
        async with async_session_maker() as session:
            stmt = select(PipelineSchedule).where(PipelineSchedule.workspace_id == workspace_id).order_by(PipelineSchedule.pipeline_name.asc())
            rows = (await session.execute(stmt)).scalars().all()
            results = []
            for r in rows:
                raw_cfg = {}
                if r.raw_configuration:
                    try:
                        raw_cfg = json.loads(r.raw_configuration)
                    except Exception:
                        raw_cfg = {}
                results.append({
                    "pipelineId": r.pipeline_id,
                    "pipelineName": r.pipeline_name,
                    "enabled": bool(r.enabled),
                    "scheduleType": r.schedule_type or "Manual / None",
                    "nextRunTime": r.next_run_time,
                    "timeZone": r.time_zone or "UTC",
                    "rawConfiguration": raw_cfg,
                })
            return results

    async def get_schedule_for_pipeline(self, workspace_id: str, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves the schedule definition for a specific pipeline ID."""
        async with async_session_maker() as session:
            stmt = select(PipelineSchedule).where(
                PipelineSchedule.workspace_id == workspace_id,
                PipelineSchedule.pipeline_id == pipeline_id,
            )
            r = (await session.execute(stmt)).scalar_one_or_none()
            if not r:
                return None
            raw_cfg = {}
            if r.raw_configuration:
                try:
                    raw_cfg = json.loads(r.raw_configuration)
                except Exception:
                    raw_cfg = {}
            return {
                "pipelineId": r.pipeline_id,
                "pipelineName": r.pipeline_name,
                "enabled": bool(r.enabled),
                "scheduleType": r.schedule_type or "Manual / None",
                "nextRunTime": r.next_run_time,
                "timeZone": r.time_zone or "UTC",
                "rawConfiguration": raw_cfg,
            }

    async def get_workspace_latest_tree(self, workspace_id: str) -> List[Dict[str, Any]]:
        """
        Builds the latest execution hierarchy directly from SQLite:
        - 1 row per master pipeline showing ONLY its latest run.
        - Sub-pipelines are strictly nested inside parent activities.
        - Attaches SLA config, active incident, and schedule summary.
        """
        async with async_session_maker() as session:
            # 1. Fetch pipelines for workspace
            stmt_pipes = select(Pipeline).where(
                Pipeline.workspace_id == workspace_id,
                Pipeline.is_master == 1,
            ).order_by(Pipeline.displayName.asc())
            pipeline_rows = (await session.execute(stmt_pipes)).scalars().all()

            if not pipeline_rows:
                stmt_pipes_all = select(Pipeline).where(Pipeline.workspace_id == workspace_id).order_by(Pipeline.displayName.asc())
                pipeline_rows = (await session.execute(stmt_pipes_all)).scalars().all()

            if not pipeline_rows:
                return []

            # 2. Subquery for latest run per pipeline
            latest_sub = (
                select(
                    PipelineRun.pipeline_id,
                    func.max(func.coalesce(PipelineRun.start_time, "1970-01-01")).label("max_start"),
                )
                .where(PipelineRun.workspace_id == workspace_id)
                .group_by(PipelineRun.pipeline_id)
                .subquery()
            )

            latest_runs_stmt = (
                select(PipelineRun)
                .join(
                    latest_sub,
                    and_(
                        PipelineRun.pipeline_id == latest_sub.c.pipeline_id,
                        func.coalesce(PipelineRun.start_time, "1970-01-01") == latest_sub.c.max_start,
                    ),
                )
                .where(PipelineRun.workspace_id == workspace_id)
            )
            latest_run_rows = (await session.execute(latest_runs_stmt)).scalars().all()
            latest_runs_by_pid = {
                r.pipeline_id: {
                    "id": r.id,
                    "pipeline_id": r.pipeline_id,
                    "pipeline_name": r.pipeline_name,
                    "workspace_id": r.workspace_id,
                    "status": r.status,
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "duration_in_ms": r.duration_in_ms,
                    "invoke_type": r.invoke_type,
                    "is_child": r.is_child,
                    "parent_run_id": r.parent_run_id,
                    "parent_activity_name": r.parent_activity_name,
                    "failure_reason": r.failure_reason,
                }
                for r in latest_run_rows
            }

            # 3. SLA configs
            sla_stmt = select(SLAConfig).where(SLAConfig.workspace_id == workspace_id)
            sla_rows = (await session.execute(sla_stmt)).scalars().all()
            sla_by_pid = {
                s.pipeline_id: {
                    "pipelineId": s.pipeline_id,
                    "workspaceId": workspace_id,
                    "l1Email": s.l1_email or "",
                    "l1Name": s.l1_name or "",
                    "l2Email": s.l2_email or "",
                    "l2Name": s.l2_name or "",
                    "slaMinutes": s.sla_minutes,
                    "sla1Minutes": s.sla1_minutes if s.sla1_minutes is not None else s.sla_minutes,
                    "sla2Minutes": s.sla2_minutes if s.sla2_minutes is not None else s.sla_minutes,
                }
                for s in sla_rows
            }

            # 4. Incidents
            inc_stmt = (
                select(SLAIncident)
                .where(
                    SLAIncident.workspace_id == workspace_id,
                    SLAIncident.status.in_(["ACTIVE", "ESCALATED_L2", "CRITICAL_UNRESOLVED", "RESOLVED"]),
                )
                .order_by(SLAIncident.failed_at.desc())
            )
            incident_rows = (await session.execute(inc_stmt)).scalars().all()
            incident_by_run_id = {}
            for inc in incident_rows:
                run_id = inc.pipeline_run_id
                if run_id not in incident_by_run_id:
                    incident_by_run_id[run_id] = {
                        "id": inc.id,
                        "pipeline_id": inc.pipeline_id,
                        "pipeline_name": inc.pipeline_name,
                        "pipeline_run_id": inc.pipeline_run_id,
                        "status": inc.status,
                        "failed_at": inc.failed_at,
                        "sla_target_time": inc.sla_target_time,
                        "l1_notified_at": inc.l1_notified_at,
                        "l2_escalated_at": inc.l2_escalated_at,
                        "resolved_at": inc.resolved_at,
                        "resolved_by": inc.resolved_by,
                        "error_message": inc.error_message,
                    }

            # 5. Schedules
            sched_stmt = select(PipelineSchedule).where(PipelineSchedule.workspace_id == workspace_id)
            sched_rows = (await session.execute(sched_stmt)).scalars().all()
            sched_by_pid = {
                s.pipeline_id: {
                    "pipeline_id": s.pipeline_id,
                    "enabled": s.enabled,
                    "schedule_type": s.schedule_type,
                    "next_run_time": s.next_run_time,
                    "time_zone": s.time_zone,
                }
                for s in sched_rows
            }

        run_objects_by_id: Dict[str, Dict[str, Any]] = {}
        top_level: List[Dict[str, Any]] = []

        for p in pipeline_rows:
            pid = p.id
            pname = p.displayName
            latest_run = latest_runs_by_pid.get(pid)

            sla_cfg = sla_by_pid.get(pid, {
                "pipelineId": pid,
                "workspaceId": workspace_id,
                "l1Email": "",
                "l2Email": "",
                "slaMinutes": 30,
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
                    "schedule": sched_info,
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
                    "schedule": sched_info,
                }
                run_objects_by_id[run_obj["id"]] = run_obj
                top_level.append(run_obj)

        active_run_ids = [r["id"] for r in top_level if not r["id"].startswith("norun-")]
        if active_run_ids:
            async with async_session_maker() as session:
                act_stmt = (
                    select(ActivityRun)
                    .where(ActivityRun.pipeline_run_id.in_(active_run_ids))
                    .order_by(ActivityRun.start_time.asc())
                )
                act_rows = (await session.execute(act_stmt)).scalars().all()

                for a in act_rows:
                    prun_id = a.pipeline_run_id
                    if prun_id in run_objects_by_id:
                        err_val = None
                        if a.error:
                            try:
                                err_val = json.loads(a.error)
                            except Exception:
                                pass
                        out_val = None
                        if a.output:
                            try:
                                out_val = json.loads(a.output)
                            except Exception:
                                pass

                        child_pipe = None
                        if a.child_pipeline_data:
                            try:
                                child_pipe = json.loads(a.child_pipeline_data)
                            except Exception:
                                pass

                        run_objects_by_id[prun_id]["activities"].append({
                            "activityRunId": a.activity_run_id,
                            "pipelineRunId": prun_id,
                            "activityName": a.activity_name,
                            "activityType": a.activity_type,
                            "status": a.status,
                            "activityRunStart": a.start_time,
                            "activityRunEnd": a.end_time,
                            "durationInMs": a.duration_in_ms,
                            "error": err_val,
                            "output": out_val,
                            "childPipelineRunId": a.child_pipeline_run_id,
                            "childPipeline": child_pipe,
                        })

        for r_obj in top_level:
            if (r_obj["durationInMs"] is None or r_obj["durationInMs"] == 0) and r_obj.get("activities"):
                act_sum = sum(a.get("durationInMs") or 0 for a in r_obj["activities"])
                if act_sum > 0:
                    r_obj["durationInMs"] = act_sum

        top_level.sort(
            key=lambda x: (
                x.get("startTime") is not None,
                x.get("startTime") or "",
                x.get("pipelineName", ""),
            ),
            reverse=True,
        )
        return top_level

    @staticmethod
    def _is_schedule_active_in_range(sched_row: Optional[dict], start_date: datetime.date, end_date: datetime.date) -> tuple[bool, str]:
        """Determines whether a pipeline schedule pattern is active within the specified date range."""
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
                    "nextRunTime": sched_row.get("next_run_time"),
                },
            }]

        curr = start_date
        while curr <= end_date:
            target_iso = curr.isoformat()
            target_weekday = curr.strftime("%A").lower()

            for item in schedules_list:
                if not item.get("enabled", True):
                    continue
                cfg = item.get("configuration") or {}
                stype = str(cfg.get("type") or sched_row.get("schedule_type") or "").lower()

                times = cfg.get("times") or []
                time_str = str(times[0]) if times else "00:00"

                next_run = sched_row.get("next_run_time") or cfg.get("nextRunTime")
                if next_run and str(next_run).startswith(target_iso):
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
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds the date-filtered execution hierarchy and forecast for a workspace.
        Supports presets: 'latest', 'yesterday', 'today', 'tomorrow', 'last_week', 'next_week', 'custom'.
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

        async with async_session_maker() as session:
            # Available dates query
            date_stmt = (
                select(
                    func.substr(func.coalesce(PipelineRun.start_time, PipelineRun.end_time), 1, 10).label("run_date")
                )
                .where(
                    PipelineRun.workspace_id == workspace_id,
                    PipelineRun.status != "No Runs",
                    PipelineRun.start_time.isnot(None),
                )
                .distinct()
                .order_by(func.substr(func.coalesce(PipelineRun.start_time, PipelineRun.end_time), 1, 10).desc())
            )
            date_rows = (await session.execute(date_stmt)).all()
            available_dates = [r[0] for r in date_rows if r[0]]

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
                    "availableRunDates": available_dates,
                },
                "metrics": {
                    "total": total,
                    "running": running,
                    "succeeded": succeeded,
                    "failed": failed,
                    "cancelled": cancelled,
                    "notRun": not_run,
                    "scheduled": 0,
                    "notScheduled": 0,
                },
                "pipelines": latest_tree,
            }

        async with async_session_maker() as session:
            # 1. Fetch pipelines
            stmt_pipes = select(Pipeline).where(
                Pipeline.workspace_id == workspace_id,
                Pipeline.is_master == 1,
            ).order_by(Pipeline.displayName.asc())
            pipeline_rows = (await session.execute(stmt_pipes)).scalars().all()
            if not pipeline_rows:
                stmt_pipes_all = select(Pipeline).where(Pipeline.workspace_id == workspace_id).order_by(Pipeline.displayName.asc())
                pipeline_rows = (await session.execute(stmt_pipes_all)).scalars().all()

            # 2. SLA configs
            sla_stmt = select(SLAConfig).where(SLAConfig.workspace_id == workspace_id)
            sla_rows = (await session.execute(sla_stmt)).scalars().all()
            sla_by_pid = {
                s.pipeline_id: {
                    "pipelineId": s.pipeline_id,
                    "workspaceId": workspace_id,
                    "l1Email": s.l1_email or "",
                    "l1Name": s.l1_name or "",
                    "l2Email": s.l2_email or "",
                    "l2Name": s.l2_name or "",
                    "slaMinutes": s.sla_minutes,
                    "sla1Minutes": s.sla1_minutes if s.sla1_minutes is not None else s.sla_minutes,
                    "sla2Minutes": s.sla2_minutes if s.sla2_minutes is not None else s.sla_minutes,
                }
                for s in sla_rows
            }

            # 3. Schedules
            sched_stmt = select(PipelineSchedule).where(PipelineSchedule.workspace_id == workspace_id)
            sched_rows = (await session.execute(sched_stmt)).scalars().all()
            sched_by_pid = {
                s.pipeline_id: {
                    "pipeline_id": s.pipeline_id,
                    "enabled": s.enabled,
                    "schedule_type": s.schedule_type,
                    "next_run_time": s.next_run_time,
                    "time_zone": s.time_zone,
                    "raw_configuration": s.raw_configuration,
                }
                for s in sched_rows
            }

        if is_future:
            forecast_pipelines = []
            scheduled_count = 0
            not_scheduled_count = 0

            for p in pipeline_rows:
                pid = p.id
                pname = p.displayName
                sched_info = sched_by_pid.get(pid)
                is_sched, sched_time_str = self._is_schedule_active_in_range(sched_info, target_start, target_end)

                sla_cfg = sla_by_pid.get(pid, {
                    "pipelineId": pid,
                    "workspaceId": workspace_id,
                    "l1Email": "",
                    "l2Email": "",
                    "slaMinutes": 30,
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
                    "schedule": sched_info,
                })

            forecast_pipelines.sort(
                key=lambda x: (x["status"] == "Scheduled", x["pipelineName"]),
                reverse=True,
            )

            return {
                "workspaceId": workspace_id,
                "dateFilter": {
                    "preset": preset,
                    "startDate": target_start.isoformat(),
                    "endDate": target_end.isoformat(),
                    "isFuture": True,
                    "availableRunDates": available_dates,
                },
                "metrics": {
                    "total": len(pipeline_rows),
                    "running": 0,
                    "succeeded": 0,
                    "failed": 0,
                    "cancelled": 0,
                    "notRun": not_scheduled_count,
                    "scheduled": scheduled_count,
                    "notScheduled": not_scheduled_count,
                },
                "pipelines": forecast_pipelines,
            }

        s_iso = target_start.isoformat()
        e_iso = target_end.isoformat()

        async with async_session_maker() as session:
            # Subquery for maximum start_time within the date window
            win_sub = (
                select(
                    PipelineRun.pipeline_id,
                    func.max(func.coalesce(PipelineRun.start_time, "1970-01-01")).label("max_start"),
                )
                .where(
                    PipelineRun.workspace_id == workspace_id,
                    func.substr(func.coalesce(PipelineRun.start_time, PipelineRun.end_time), 1, 10) >= s_iso,
                    func.substr(func.coalesce(PipelineRun.start_time, PipelineRun.end_time), 1, 10) <= e_iso,
                    PipelineRun.status != "No Runs",
                )
                .group_by(PipelineRun.pipeline_id)
                .subquery()
            )

            period_runs_stmt = (
                select(PipelineRun)
                .join(
                    win_sub,
                    and_(
                        PipelineRun.pipeline_id == win_sub.c.pipeline_id,
                        func.coalesce(PipelineRun.start_time, "1970-01-01") == win_sub.c.max_start,
                    ),
                )
                .where(PipelineRun.workspace_id == workspace_id)
            )
            period_runs = (await session.execute(period_runs_stmt)).scalars().all()
            runs_by_pid = {
                r.pipeline_id: {
                    "id": r.id,
                    "pipeline_id": r.pipeline_id,
                    "pipeline_name": r.pipeline_name,
                    "workspace_id": r.workspace_id,
                    "status": r.status,
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "duration_in_ms": r.duration_in_ms,
                    "invoke_type": r.invoke_type,
                    "is_child": r.is_child,
                    "parent_run_id": r.parent_run_id,
                    "parent_activity_name": r.parent_activity_name,
                    "failure_reason": r.failure_reason,
                }
                for r in period_runs
            }

            # SLA incidents for period
            inc_stmt = (
                select(SLAIncident)
                .where(
                    SLAIncident.workspace_id == workspace_id,
                    SLAIncident.status.in_(["ACTIVE", "ESCALATED_L2", "CRITICAL_UNRESOLVED", "RESOLVED"]),
                )
                .order_by(SLAIncident.failed_at.desc())
            )
            inc_rows = (await session.execute(inc_stmt)).scalars().all()
            incident_by_run_id = {}
            for inc in inc_rows:
                run_id = inc.pipeline_run_id
                if run_id not in incident_by_run_id:
                    incident_by_run_id[run_id] = {
                        "id": inc.id,
                        "pipeline_id": inc.pipeline_id,
                        "pipeline_name": inc.pipeline_name,
                        "pipeline_run_id": inc.pipeline_run_id,
                        "status": inc.status,
                        "failed_at": inc.failed_at,
                        "sla_target_time": inc.sla_target_time,
                        "l1_notified_at": inc.l1_notified_at,
                        "l2_escalated_at": inc.l2_escalated_at,
                        "resolved_at": inc.resolved_at,
                        "resolved_by": inc.resolved_by,
                        "error_message": inc.error_message,
                    }

        period_pipelines = []
        run_objects_by_id: Dict[str, Dict[str, Any]] = {}

        for p in pipeline_rows:
            pid = p.id
            pname = p.displayName
            p_run = runs_by_pid.get(pid)

            sla_cfg = sla_by_pid.get(pid, {
                "pipelineId": pid,
                "workspaceId": workspace_id,
                "l1Email": "",
                "l2Email": "",
                "slaMinutes": 30,
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
                    "schedule": sched_info,
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
                    "schedule": sched_info,
                }
                run_objects_by_id[run_obj["id"]] = run_obj
                period_pipelines.append(run_obj)

        run_ids = [r["id"] for r in period_pipelines if not r["id"].startswith("norun-")]
        if run_ids:
            async with async_session_maker() as session:
                act_stmt = (
                    select(ActivityRun)
                    .where(ActivityRun.pipeline_run_id.in_(run_ids))
                    .order_by(ActivityRun.start_time.asc())
                )
                act_rows = (await session.execute(act_stmt)).scalars().all()

                for a in act_rows:
                    prun_id = a.pipeline_run_id
                    if prun_id in run_objects_by_id:
                        err_val = None
                        if a.error:
                            try:
                                err_val = json.loads(a.error)
                            except Exception:
                                pass
                        out_val = None
                        if a.output:
                            try:
                                out_val = json.loads(a.output)
                            except Exception:
                                pass

                        child_pipe = None
                        if a.child_pipeline_data:
                            try:
                                child_pipe = json.loads(a.child_pipeline_data)
                            except Exception:
                                pass

                        run_objects_by_id[prun_id]["activities"].append({
                            "activityRunId": a.activity_run_id,
                            "pipelineRunId": prun_id,
                            "activityName": a.activity_name,
                            "activityType": a.activity_type,
                            "status": a.status,
                            "activityRunStart": a.start_time,
                            "activityRunEnd": a.end_time,
                            "durationInMs": a.duration_in_ms,
                            "error": err_val,
                            "output": out_val,
                            "childPipelineRunId": a.child_pipeline_run_id,
                            "childPipeline": child_pipe,
                        })

        for r_obj in period_pipelines:
            if (r_obj["durationInMs"] is None or r_obj["durationInMs"] == 0) and r_obj.get("activities"):
                act_sum = sum(a.get("durationInMs") or 0 for a in r_obj["activities"])
                if act_sum > 0:
                    r_obj["durationInMs"] = act_sum

        period_pipelines.sort(
            key=lambda x: (
                x.get("startTime") is not None,
                x.get("startTime") or "",
                x.get("pipelineName", ""),
            ),
            reverse=True,
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
                "availableRunDates": available_dates,
            },
            "metrics": {
                "total": total,
                "running": running,
                "succeeded": succeeded,
                "failed": failed,
                "cancelled": cancelled,
                "notRun": not_run,
                "scheduled": 0,
                "notScheduled": 0,
            },
            "pipelines": period_pipelines,
        }


pipeline_repository = PipelineRepository()
