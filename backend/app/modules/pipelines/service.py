"""Data Pipelines Domain Service & Telemetry Engine.

Consolidates pipeline hierarchy tree construction, background leased polling,
real-time Fabric synchronization, and pipeline scheduling operations.
"""

import asyncio
import datetime
import json
import logging
import time
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings
from app.modules.pipelines.repository import pipeline_repository
from app.modules.pipelines.schema import ActivityError, ActivityRun, PipelineRun, PipelineSchedule
from app.modules.sla.repository import sla_repository
from app.modules.sla.service import alert_service
from app.modules.websocket.connection_manager import connection_manager
from app.shared.clients.fabric_client import fabric_client
from app.shared.constants import (
    DEFAULT_PIPELINE_NAME,
    DEFAULT_SLA1_MINUTES,
    DEFAULT_SLA2_MINUTES,
)

logger = logging.getLogger("fabric_monitor.pipelines.service")


# ---------------------------------------------------------------------------
# 1. Telemetry Hierarchy Tree Builder
# ---------------------------------------------------------------------------

class HierarchyTreeBuilder:
    """Builds a purely dynamic hierarchical tree of pipeline executions directly
    from Microsoft Fabric's runtime telemetry.
    """

    @staticmethod
    def parse_activity(raw_act: Dict[str, Any]) -> ActivityRun:
        """Parses a raw Fabric activity execution payload into a structured ActivityRun model."""
        raw_error = raw_act.get("error")
        parsed_error = None
        if raw_error and isinstance(raw_error, dict) and (raw_error.get("errorCode") or raw_error.get("message")):
            parsed_error = ActivityError(
                errorCode=str(raw_error.get("errorCode") or "Failed"),
                message=raw_error.get("message") or "Activity execution failed.",
                failureType=raw_error.get("failureType") or "UserError",
                target=raw_error.get("target") or raw_act.get("activityName"),
                rawError=raw_error,
            )
        elif raw_act.get("status") == "Failed":
            output = raw_act.get("output") or {}
            if isinstance(output, str):
                try:
                    output = json.loads(output)
                except Exception:
                    output = {}
            errors = output.get("errors", []) if isinstance(output, dict) else []
            msg = errors[0].get("Message") if errors and isinstance(errors[0], dict) else "Activity execution failed."
            code = str(errors[0].get("Code")) if errors and isinstance(errors[0], dict) else "Unknown"
            parsed_error = ActivityError(errorCode=code, message=msg, failureType="UserError", rawError=output)

        output_val = raw_act.get("output")
        if isinstance(output_val, str):
            try:
                output_val = json.loads(output_val)
            except Exception:
                pass

        return ActivityRun(
            activityRunId=raw_act.get("activityRunId") or raw_act.get("id"),
            activityName=raw_act.get("activityName", "Unknown Activity"),
            activityType=raw_act.get("activityType", "General"),
            status=raw_act.get("status", "Unknown"),
            activityRunStart=raw_act.get("activityRunStart") or raw_act.get("startTime"),
            activityRunEnd=raw_act.get("activityRunEnd") or raw_act.get("endTime"),
            durationInMs=raw_act.get("durationInMs"),
            error=parsed_error,
            output=output_val,
        )

    @classmethod
    def assemble_pipeline_tree(
        cls,
        workspace_id: str,
        raw_runs: List[Dict[str, Any]],
        activity_map: Dict[str, List[Dict[str, Any]]],
    ) -> List[PipelineRun]:
        """Assembles a nested hierarchical execution tree of parent and child pipeline runs."""
        runs_by_id: Dict[str, PipelineRun] = {}
        child_to_parent_meta: Dict[str, Dict[str, str]] = {}
        child_refs_to_parent: Dict[str, Dict[str, str]] = {}

        for r in raw_runs:
            run_id = r.get("id")
            raw_activities = list(activity_map.get(run_id, []))
            parsed_activities = [cls.parse_activity(a) for a in raw_activities]

            raw_fail = r.get("failureReason")
            pipe_error = None
            if raw_fail and isinstance(raw_fail, dict):
                pipe_error = ActivityError(
                    errorCode=str(raw_fail.get("errorCode") or "Failed"),
                    message=raw_fail.get("message") or "Pipeline execution failed.",
                    failureType=raw_fail.get("failureType") or "UserError",
                    target=raw_fail.get("target") or r.get("itemDisplayName") or r.get("pipelineName"),
                    rawError=raw_fail,
                )
            elif r.get("status") == "Failed":
                for pa in parsed_activities:
                    if pa.error:
                        pipe_error = pa.error
                        break

            for act in raw_activities:
                act_type = str(act.get("activityType") or "").lower()
                act_name = act.get("activityName", "ExecutePipeline")

                output = act.get("output") or {}
                if isinstance(output, str):
                    try:
                        output = json.loads(output)
                    except Exception:
                        output = {}

                input_data = act.get("input") or {}
                if isinstance(input_data, str):
                    try:
                        input_data = json.loads(input_data)
                    except Exception:
                        input_data = {}

                if any(kw in act_type for kw in ["executepipeline", "invokepipeline", "pipeline"]):
                    child_run_id = (
                        output.get("pipelineRunId")
                        or output.get("runId")
                        or output.get("childPipelineRunId")
                    )
                    if child_run_id:
                        child_to_parent_meta[str(child_run_id).strip().lower()] = {
                            "parentRunId": run_id,
                            "parentActivityName": act_name,
                        }

                    child_ref = (
                        input_data.get("pipeline", {}).get("referenceName")
                        or output.get("pipelineName")
                        or output.get("pipelineId")
                        or input_data.get("pipelineName")
                    )
                    if child_ref:
                        child_refs_to_parent[str(child_ref).strip().lower()] = {
                            "parentRunId": run_id,
                            "parentActivityName": act_name,
                        }

            pipeline_run = PipelineRun(
                id=run_id,
                pipelineId=r.get("itemId") or r.get("pipelineId", ""),
                pipelineName=r.get("itemDisplayName") or r.get("pipelineName", DEFAULT_PIPELINE_NAME),
                workspaceId=workspace_id,
                status=r.get("status", "NotStarted"),
                startTime=r.get("startTimeUtc") or r.get("startTime"),
                endTime=r.get("endTimeUtc") or r.get("endTime"),
                durationInMs=r.get("durationInMs"),
                invokeType=r.get("invokeType", "Manual"),
                error=pipe_error,
                activities=parsed_activities,
                childPipelines=[],
            )
            runs_by_id[run_id] = pipeline_run

        for run_id, run_obj in runs_by_id.items():
            run_id_lower = str(run_id).strip().lower()
            pipe_id_lower = str(run_obj.pipelineId).strip().lower()
            pipe_name_lower = str(run_obj.pipelineName).strip().lower()

            parent_id = None
            parent_act_name = "ExecutePipeline"

            if run_id_lower in child_to_parent_meta:
                meta = child_to_parent_meta[run_id_lower]
                parent_id = meta["parentRunId"]
                parent_act_name = meta["parentActivityName"]
            elif pipe_id_lower in child_refs_to_parent:
                meta = child_refs_to_parent[pipe_id_lower]
                parent_id = meta["parentRunId"]
                parent_act_name = meta["parentActivityName"]
            elif pipe_name_lower in child_refs_to_parent:
                meta = child_refs_to_parent[pipe_name_lower]
                parent_id = meta["parentRunId"]
                parent_act_name = meta["parentActivityName"]

            if parent_id and parent_id in runs_by_id and parent_id != run_id:
                run_obj.isChild = True
                run_obj.parentRunId = parent_id
                run_obj.parentActivityName = parent_act_name
                parent_pipe = runs_by_id[parent_id]
                parent_pipe.childPipelines.append(run_obj)

                attached = False
                for act in parent_pipe.activities:
                    act_child_run_id = (
                        (act.output or {}).get("pipelineRunId")
                        or (act.output or {}).get("runId")
                        or (act.output or {}).get("childPipelineRunId")
                    )
                    if act_child_run_id and str(act_child_run_id).strip().lower() == run_id_lower:
                        act.childPipeline = run_obj
                        attached = True
                        break
                    if act.activityName.strip().lower() == parent_act_name.strip().lower():
                        act.childPipeline = run_obj
                        attached = True
                        break

                if not attached:
                    for act in parent_pipe.activities:
                        act_type = str(act.activityType).lower()
                        if any(kw in act_type for kw in ["executepipeline", "invokepipeline"]) and not act.childPipeline:
                            act.childPipeline = run_obj
                            break

        top_level_runs: List[PipelineRun] = [
            run_obj for run_obj in runs_by_id.values() if not run_obj.isChild
        ]

        top_level_runs.sort(
            key=lambda x: (x.startTime is not None, x.startTime or "", x.pipelineName),
            reverse=True,
        )
        return top_level_runs


tree_builder = HierarchyTreeBuilder()


# ---------------------------------------------------------------------------
# 2. Schedule Parsing Helper
# ---------------------------------------------------------------------------

def _parse_schedules_payload(sched_data: Any) -> List[Dict[str, Any]]:
    """Parses and normalizes raw Fabric schedule payload into a standard list of schedule dicts."""
    if not sched_data:
        return []
    raw_list = []
    if isinstance(sched_data, dict):
        if "value" in sched_data and isinstance(sched_data["value"], list):
            raw_list = sched_data["value"]
        elif "schedules" in sched_data and isinstance(sched_data["schedules"], list):
            raw_list = sched_data["schedules"]
        elif "configuration" in sched_data or "enabled" in sched_data:
            raw_list = [sched_data]
    elif isinstance(sched_data, list):
        raw_list = sched_data

    all_scheds = []
    for item in raw_list:
        if isinstance(item, dict):
            cfg = item.get("configuration") or {}
            all_scheds.append({
                "id": item.get("id") or "",
                "enabled": bool(item.get("enabled", True)),
                "scheduleType": cfg.get("type") or item.get("scheduleType") or item.get("type") or "Custom",
                "timeZone": cfg.get("localTimeZoneId") or item.get("timeZone") or "UTC",
                "nextRunTime": cfg.get("nextRunTime") or item.get("nextRunTime") or cfg.get("startDateTime"),
                "times": cfg.get("times", []) or item.get("times", []),
                "days": cfg.get("days", []) or item.get("days", []),
                "startDate": cfg.get("startDateTime") or item.get("startDate"),
                "endDate": cfg.get("endDateTime") or item.get("endDate"),
                "rawConfiguration": cfg or item,
            })
    return all_scheds


# ---------------------------------------------------------------------------
# 3. Leased Workspace Background Poller Engine
# ---------------------------------------------------------------------------

class LeasedWorkspacePoller:
    """High-Performance On-Demand Leased Background Poller.
    - Persistent SQLite snapshot caching (<15ms response).
    - Recursive activity and sub-pipeline execution tracing (Zero orphan rows).
    - Permanent caching of terminal runs and activity telemetry.
    - SLA Incident detection and automated L1/L2 escalation.
    - Differential per-pipeline polling: Active for running, Relaxed for idle.
    """

    def __init__(self):
        """Initializes the background poller worker with tracking sets and synchronization state."""
        self._is_running = False
        self._task: Optional[asyncio.Task] = None
        self._sync_in_progress: Set[str] = set()
        self._active_sync_tasks: Dict[str, asyncio.Task] = {}
        self._last_instance_check: Dict[str, float] = {}

    def start(self):
        """Starts the background worker polling loop."""
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._poll_loop())
            logger.info("LeasedWorkspacePoller background worker started.")

    def stop(self):
        """Stops the background worker polling loop and cancels the runner task."""
        self._is_running = False
        if self._task:
            self._task.cancel()
            logger.info("LeasedWorkspacePoller background worker stopped.")

    async def fetch_workspace_snapshot(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """Ultra-fast snapshot delivery from SQLite or Fabric sync."""
        if not force_sync:
            cached_tree = await pipeline_repository.get_workspace_latest_tree(workspace_id)
            if cached_tree:
                if workspace_id not in self._sync_in_progress:
                    asyncio.create_task(self._background_sync(workspace_id))
                return cached_tree

        return await self.sync_workspace_with_fabric(workspace_id)

    async def _background_sync(self, workspace_id: str):
        """Dispatches an asynchronous background synchronization without blocking the caller."""
        try:
            await self.sync_workspace_with_fabric(workspace_id)
        except Exception as e:
            logger.error(f"Error in background sync for {workspace_id}: {e}", exc_info=True)

    async def _fetch_activity_tree(
        self,
        workspace_id: str,
        pipeline_id: str,
        run_id: str,
        start_utc: Optional[str],
        end_utc: Optional[str],
        pipeline_names: Dict[str, str],
        semaphore: asyncio.Semaphore,
        now_iso: str,
        depth: int = 0,
        max_depth: int = 3,
        discovered_child_ids: Optional[Set[str]] = None,
        discovered_child_names: Optional[Set[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Recursively queries and nests activities for an execution run."""
        if depth > max_depth or not run_id:
            return []

        async with semaphore:
            acts = await fabric_client.query_activity_runs(
                workspace_id, pipeline_id, run_id, start_utc, end_utc
            )

        parsed_acts: List[Dict[str, Any]] = []
        for a in acts:
            act_type = str(a.get("activityType") or "").lower()
            out = a.get("output") or {}
            if isinstance(out, str):
                try:
                    out = json.loads(out)
                except Exception:
                    out = {}
            inp = a.get("input") or {}
            if isinstance(inp, str):
                try:
                    inp = json.loads(inp)
                except Exception:
                    inp = {}

            child_run_id = (
                out.get("pipelineRunId")
                or out.get("runId")
                or out.get("childPipelineRunId")
            )
            child_pipe_ref = (
                inp.get("pipeline", {}).get("referenceName")
                or out.get("pipelineName")
                or out.get("pipelineId")
                or inp.get("pipelineName")
            )

            is_sub_pipe = child_run_id is not None or any(k in act_type for k in ["executepipeline", "invokepipeline"])

            child_obj = None
            if is_sub_pipe and child_run_id:
                child_pipe_id_str = str(child_pipe_ref or pipeline_id)
                child_name = pipeline_names.get(child_pipe_id_str) or a.get("activityName") or "Sub-pipeline"

                if discovered_child_ids is not None:
                    discovered_child_ids.add(child_pipe_id_str)
                if discovered_child_names is not None:
                    discovered_child_names.add(child_name)

                inner_acts = await self._fetch_activity_tree(
                    workspace_id=workspace_id,
                    pipeline_id=child_pipe_id_str,
                    run_id=str(child_run_id),
                    start_utc=start_utc,
                    end_utc=end_utc,
                    pipeline_names=pipeline_names,
                    semaphore=semaphore,
                    now_iso=now_iso,
                    depth=depth + 1,
                    max_depth=max_depth,
                    discovered_child_ids=discovered_child_ids,
                    discovered_child_names=discovered_child_names,
                )

                child_error = a.get("error")
                if not child_error and a.get("status") == "Failed":
                    for ia in inner_acts:
                        if ia.get("error"):
                            child_error = ia.get("error")
                            break

                child_obj = {
                    "id": str(child_run_id),
                    "pipelineId": child_pipe_id_str,
                    "pipelineName": child_name,
                    "status": a.get("status", "Unknown"),
                    "startTime": a.get("activityRunStart"),
                    "endTime": a.get("activityRunEnd"),
                    "durationInMs": a.get("durationInMs"),
                    "error": child_error,
                    "activities": inner_acts,
                    "childPipelines": [],
                }

                if a.get("status") == "Failed":
                    asyncio.create_task(alert_service.process_failed_run(
                        workspace_id=workspace_id,
                        pipeline_id=child_pipe_id_str,
                        pipeline_name=child_name,
                        pipeline_run_id=str(child_run_id),
                        error_info=child_error,
                        failed_at=a.get("activityRunEnd") or now_iso,
                    ))

            parsed_act = {
                "activityRunId": a.get("activityRunId") or a.get("id"),
                "pipelineRunId": run_id,
                "activityName": a.get("activityName", "Activity"),
                "activityType": a.get("activityType", "General"),
                "status": a.get("status", "Unknown"),
                "activityRunStart": a.get("activityRunStart") or a.get("startTime"),
                "activityRunEnd": a.get("activityRunEnd") or a.get("endTime"),
                "durationInMs": a.get("durationInMs"),
                "error": a.get("error"),
                "output": out,
                "childPipelineRunId": str(child_run_id) if child_run_id else None,
                "childPipeline": child_obj,
            }
            parsed_acts.append(parsed_act)

        if parsed_acts:
            await pipeline_repository.save_activity_runs(run_id, parsed_acts, now_iso)

        return parsed_acts

    async def sync_workspace_with_fabric(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """Synchronizes Fabric pipeline executions into SQLite:
        - Discovers all pipelines.
        - Identifies Master Pipelines vs Sub-pipelines.
        - Fetches recent job instances.
        - Recursively queries activity runs for active & uncached runs.
        - Triggers L1 alerting for failures.
        """
        if workspace_id in self._sync_in_progress and not force_sync:
            if workspace_id in self._active_sync_tasks:
                try:
                    await self._active_sync_tasks[workspace_id]
                except Exception:
                    pass
            return await pipeline_repository.get_workspace_latest_tree(workspace_id)

        cur_task = asyncio.current_task()
        if cur_task:
            self._active_sync_tasks[workspace_id] = cur_task
        self._sync_in_progress.add(workspace_id)
        try:
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            # 1. Discover all Data Pipelines
            pipelines = await fabric_client.get_pipelines(workspace_id)
            if not pipelines:
                logger.warning(f"No pipelines returned by Fabric for {workspace_id}, preserving SQLite cache")
                return await pipeline_repository.get_workspace_latest_tree(workspace_id)

            pipeline_names = {p.get("id"): p.get("displayName") for p in pipelines}
            await pipeline_repository.save_pipelines(workspace_id, pipelines, now_iso)

            # 2. Concurrently fetch recent job instances
            latest_cached = await pipeline_repository.get_workspace_latest_tree(workspace_id)
            known_status_by_pid = {p.get("pipelineId"): str(p.get("status") or "").lower() for p in latest_cached}

            semaphore = asyncio.Semaphore(settings.MAX_PARALLEL_FABRIC_REQUESTS)
            now_ts = time.time()

            pipelines_to_query = []
            for p in pipelines:
                pid = p.get("id")
                last_st = known_status_by_pid.get(pid, "")
                is_running = last_st in ("inprogress", "running")
                last_chk = self._last_instance_check.get(f"{workspace_id}:{pid}", 0)
                elapsed = now_ts - last_chk

                if force_sync or is_running or (elapsed >= settings.POLL_INTERVAL_IDLE_SECONDS):
                    pipelines_to_query.append(p)
                    self._last_instance_check[f"{workspace_id}:{pid}"] = now_ts

            all_runs: List[Dict[str, Any]] = []
            if pipelines_to_query:
                async def _fetch_instances(p: Dict[str, Any]) -> List[Dict[str, Any]]:
                    """Fetches recent executions for a single pipeline from Fabric."""
                    pid = p.get("id")
                    p_name = p.get("displayName")
                    async with semaphore:
                        instances = await fabric_client.get_job_instances(workspace_id, pid)
                    if instances:
                        for inst in instances:
                            inst["pipelineId"] = pid
                            inst["pipelineName"] = p_name
                        return instances
                    else:
                        return [{
                            "id": f"norun-{pid}",
                            "pipelineId": pid,
                            "pipelineName": p_name,
                            "itemId": pid,
                            "itemDisplayName": p_name,
                            "status": "No Runs",
                            "startTime": None,
                            "endTime": None,
                            "durationInMs": 0,
                            "invokeType": "None",
                        }]

                instance_batches = await asyncio.gather(*[_fetch_instances(p) for p in pipelines_to_query], return_exceptions=False)
                all_runs = [inst for batch in instance_batches for inst in batch]

                await pipeline_repository.save_pipeline_runs(workspace_id, all_runs, now_iso)

            # 3. Recursively fetch activity trees
            if force_sync:
                cached_terminal_run_ids = set()
            else:
                cached_terminal_run_ids = await pipeline_repository.get_known_cached_run_ids(workspace_id)

            discovered_child_ids: Set[str] = set()
            discovered_child_names: Set[str] = set()
            for r in all_runs:
                if r.get("isChild") or r.get("parentRunId"):
                    if r.get("pipelineId"):
                        discovered_child_ids.add(str(r["pipelineId"]))
                    if r.get("pipelineName"):
                        discovered_child_names.add(str(r["pipelineName"]))

            async def _process_run_activities(r: Dict[str, Any]):
                """Fetches and parses inner activity runs for an execution."""
                run_id = r.get("id")
                status = r.get("status", "")
                pid = r.get("pipelineId") or r.get("itemId")
                pname = r.get("pipelineName") or r.get("itemDisplayName")

                if run_id.startswith("norun-") or status == "No Runs":
                    return

                if run_id in cached_terminal_run_ids:
                    return

                st = r.get("startTimeUtc") or r.get("startTime")
                et = r.get("endTimeUtc") or r.get("endTime")

                if str(status).lower() in ("failed", "cancelled"):
                    asyncio.create_task(alert_service.process_failed_run(
                        workspace_id=workspace_id,
                        pipeline_id=pid,
                        pipeline_name=pname,
                        pipeline_run_id=run_id,
                        error_info=r.get("failureReason"),
                        failed_at=et or now_iso,
                    ))

                await self._fetch_activity_tree(
                    workspace_id=workspace_id,
                    pipeline_id=pid,
                    run_id=run_id,
                    start_utc=st,
                    end_utc=et,
                    pipeline_names=pipeline_names,
                    semaphore=semaphore,
                    now_iso=now_iso,
                    depth=0,
                    max_depth=3,
                    discovered_child_ids=discovered_child_ids,
                    discovered_child_names=discovered_child_names,
                )

            if all_runs:
                await asyncio.gather(*[_process_run_activities(r) for r in all_runs], return_exceptions=True)

            if discovered_child_ids or discovered_child_names:
                await pipeline_repository.update_child_pipeline_flags(
                    workspace_id, discovered_child_ids, discovered_child_names
                )

            # 4. Background schedule sync
            asyncio.create_task(self._sync_schedules(workspace_id, pipelines, now_iso))

            return await pipeline_repository.get_workspace_latest_tree(workspace_id)
        except Exception as e:
            logger.error(f"Error syncing workspace {workspace_id} with Fabric: {e}", exc_info=True)
            return await pipeline_repository.get_workspace_latest_tree(workspace_id)
        finally:
            self._sync_in_progress.discard(workspace_id)
            self._active_sync_tasks.pop(workspace_id, None)

    async def _sync_schedules(self, workspace_id: str, pipelines: List[Dict[str, Any]], updated_at: str):
        """Fetches pipeline schedules and persists to SQLite."""
        try:
            semaphore = asyncio.Semaphore(4)

            async def _fetch_sched(p: Dict[str, Any]) -> Dict[str, Any]:
                """Fetches schedule metadata for a single pipeline."""
                pid = p.get("id")
                pname = p.get("displayName")
                async with semaphore:
                    sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pid)
                raw_list = []
                if isinstance(sched_data, dict):
                    if "value" in sched_data and isinstance(sched_data["value"], list):
                        raw_list = sched_data["value"]
                    elif "configuration" in sched_data or "enabled" in sched_data:
                        raw_list = [sched_data]
                elif isinstance(sched_data, list):
                    raw_list = sched_data

                all_scheds = []
                for item in raw_list:
                    if isinstance(item, dict):
                        cfg = item.get("configuration") or {}
                        all_scheds.append({
                            "id": item.get("id") or "",
                            "enabled": bool(item.get("enabled", True)),
                            "scheduleType": cfg.get("type") or item.get("type") or "Custom",
                            "timeZone": cfg.get("localTimeZoneId") or cfg.get("timeZone") or "UTC",
                            "nextRunTime": cfg.get("nextRunTime") or cfg.get("startDateTime"),
                            "times": cfg.get("times", []),
                            "days": cfg.get("days", []),
                            "startDate": cfg.get("startDateTime"),
                            "endDate": cfg.get("endDateTime"),
                            "rawConfiguration": cfg,
                        })

                active = [s for s in all_scheds if s.get("enabled")]
                primary = active[0] if active else (all_scheds[0] if all_scheds else None)

                if primary:
                    return {
                        "pipelineId": pid,
                        "pipelineName": pname,
                        "enabled": bool(active),
                        "scheduleType": primary.get("scheduleType", "Custom"),
                        "nextRunTime": primary.get("nextRunTime"),
                        "timeZone": primary.get("timeZone", "UTC"),
                        "schedules": all_scheds,
                        "rawConfiguration": {"schedules": all_scheds, "raw": sched_data},
                    }
                return {
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "enabled": False,
                    "scheduleType": "Manual / None",
                    "nextRunTime": None,
                    "timeZone": None,
                    "schedules": [],
                    "rawConfiguration": sched_data,
                }

            schedules = await asyncio.gather(*[_fetch_sched(p) for p in pipelines], return_exceptions=False)
            await pipeline_repository.save_schedules(workspace_id, schedules, updated_at)
        except Exception as e:
            logger.error(f"Error syncing schedules for workspace {workspace_id}: {e}")

    async def _poll_loop(self):
        """Leased poller loop: only polls workspaces with active viewers."""
        while self._is_running:
            try:
                active_workspaces = connection_manager.get_active_workspace_ids()
                if not active_workspaces:
                    await asyncio.sleep(2.0)
                    continue

                has_any_running = False
                for ws_id in active_workspaces:
                    snapshot = await self.sync_workspace_with_fabric(ws_id)
                    if not snapshot:
                        snapshot = await pipeline_repository.get_workspace_latest_tree(ws_id)

                    if any(str(p.get("status", "")).lower() in ("inprogress", "running") for p in (snapshot or [])):
                        has_any_running = True

                    message = {
                        "type": "FULL_SNAPSHOT",
                        "workspaceId": ws_id,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "viewersCount": connection_manager.get_viewer_count(ws_id),
                        "data": snapshot,
                    }
                    await connection_manager.broadcast_to_workspace(ws_id, message)

                sleep_interval = settings.POLL_INTERVAL_ACTIVE_SECONDS if has_any_running else settings.POLL_INTERVAL_IDLE_SECONDS
                await asyncio.sleep(sleep_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in LeasedWorkspacePoller main loop: {e}", exc_info=True)
                await asyncio.sleep(5.0)


leased_poller = LeasedWorkspacePoller()


# ---------------------------------------------------------------------------
# 4. Pipeline Service Facade
# ---------------------------------------------------------------------------

class PipelineService:
    """Core domain service for pipeline catalog, execution history,
    real-time tree snapshots, and schedule lookups.
    """

    async def list_pipelines(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Returns all Data Pipelines inside the selected workspace."""
        return await fabric_client.get_pipelines(workspace_id)

    async def get_workspace_snapshot(
        self,
        workspace_id: str,
        force_sync: bool = False,
        date_preset: Optional[str] = "latest",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Returns the real-time hierarchical pipeline and activity runs tree with date filtering."""
        preset = (date_preset or "latest").lower().strip()
        if (preset == "latest") and force_sync:
            await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=True)

        date_tree = await pipeline_repository.get_workspace_tree_by_date(
            workspace_id=workspace_id,
            date_preset=preset,
            start_date=start_date,
            end_date=end_date,
        )

        if (preset == "latest") and not date_tree.get("pipelines"):
            await leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=False)
            date_tree = await pipeline_repository.get_workspace_tree_by_date(
                workspace_id=workspace_id,
                date_preset=preset,
                start_date=start_date,
                end_date=end_date,
            )

        return date_tree

    async def get_workspace_tree(self, workspace_id: str) -> Dict[str, Any]:
        """Get the latest parent-child pipeline tree with 0 orphan rows."""
        return await self.get_workspace_snapshot(workspace_id, force_sync=False, date_preset="latest")

    async def get_pipeline_history(self, workspace_id: str, pipeline_id: str) -> Dict[str, Any]:
        """Get the chronological execution history for a pipeline."""
        runs = await pipeline_repository.get_pipeline_history(workspace_id, pipeline_id)
        if not runs:
            instances = await fabric_client.get_job_instances(workspace_id, pipeline_id)
            return {
                "workspaceId": workspace_id,
                "pipelineId": pipeline_id,
                "runs": instances,
            }
        return {
            "workspaceId": workspace_id,
            "pipelineId": pipeline_id,
            "runs": runs,
        }

    async def get_pipeline_schedule(self, workspace_id: str, pipeline_id: str) -> Dict[str, Any]:
        """Returns all schedule configurations for a single pipeline."""
        sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pipeline_id)
        all_schedules = _parse_schedules_payload(sched_data)

        if not all_schedules:
            cached = await pipeline_repository.get_schedule_for_pipeline(workspace_id, pipeline_id)
            if cached:
                cached_raw = cached.get("rawConfiguration") or {}
                all_schedules = _parse_schedules_payload(cached_raw)
                if not all_schedules and cached.get("enabled"):
                    all_schedules = [{
                        "id": "cached_sched",
                        "enabled": cached.get("enabled", False),
                        "scheduleType": cached.get("scheduleType", "Manual / None"),
                        "timeZone": cached.get("timeZone", "UTC"),
                        "nextRunTime": cached.get("nextRunTime"),
                        "times": [],
                        "days": [],
                        "rawConfiguration": cached_raw,
                    }]

        active_schedules = [s for s in all_schedules if s.get("enabled")]
        primary = active_schedules[0] if active_schedules else (all_schedules[0] if all_schedules else None)

        return {
            "pipelineId": pipeline_id,
            "enabled": bool(active_schedules),
            "totalSchedules": len(all_schedules),
            "scheduleType": primary.get("scheduleType") if primary else "Manual / None",
            "nextRunTime": primary.get("nextRunTime") if primary else None,
            "timeZone": primary.get("timeZone") if primary else "UTC",
            "schedules": all_schedules,
            "rawConfiguration": sched_data,
        }

    async def get_workspace_schedules(self, workspace_id: str) -> List[PipelineSchedule]:
        """Returns upcoming schedules and next execution times for pipelines in the workspace."""
        cached = await pipeline_repository.get_pipeline_schedules(workspace_id)
        if cached:
            return [PipelineSchedule(**c) for c in cached]

        pipelines = await fabric_client.get_pipelines(workspace_id)
        schedules: List[PipelineSchedule] = []

        for p in pipelines:
            pid = p.get("id")
            p_name = p.get("displayName") or p.get("name") or DEFAULT_PIPELINE_NAME
            sched_data = await fabric_client.get_pipeline_schedules(workspace_id, pid)
            all_s = _parse_schedules_payload(sched_data)
            active = [s for s in all_s if s.get("enabled")]
            primary = active[0] if active else (all_s[0] if all_s else None)

            if primary:
                schedules.append(PipelineSchedule(
                    pipelineId=pid,
                    pipelineName=p_name,
                    enabled=bool(active),
                    scheduleType=primary.get("scheduleType", "Custom"),
                    nextRunTime=primary.get("nextRunTime"),
                    timeZone=primary.get("timeZone", "UTC"),
                    schedules=all_s,
                    rawConfiguration={"schedules": all_s, "raw": sched_data},
                ))
            else:
                schedules.append(PipelineSchedule(
                    pipelineId=pid,
                    pipelineName=p_name,
                    enabled=False,
                    scheduleType="Manual / None",
                    nextRunTime=None,
                    timeZone=None,
                    schedules=[],
                    rawConfiguration=sched_data,
                ))

        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        await pipeline_repository.save_schedules(workspace_id, [s.model_dump() for s in schedules], now_iso)
        return schedules

    async def list_parent_pipelines(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """Returns parent (master) pipelines for a workspace with their SLA1/SLA2 config."""
        parents = await pipeline_repository.get_parent_pipelines(workspace_id)
        if not parents or force_sync:
            try:
                fabric_pipes = await fabric_client.get_pipelines(workspace_id)
                if fabric_pipes:
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    await pipeline_repository.save_pipelines(workspace_id, fabric_pipes, now_iso)
                    parents = await pipeline_repository.get_parent_pipelines(workspace_id)
                    if not parents:
                        parents = [
                            {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or DEFAULT_PIPELINE_NAME}
                            for p in fabric_pipes
                        ]
                    asyncio.create_task(leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=force_sync))
            except Exception as exc:
                logger.error(f"Error syncing parent pipelines from Fabric: {exc}")

        sla_by_pid = await sla_repository.get_sla_configs_for_workspace(workspace_id)
        for p in parents:
            cfg = sla_by_pid.get(p["pipelineId"])
            p["sla1Minutes"] = cfg["sla1Minutes"] if cfg else None
            p["sla2Minutes"] = cfg["sla2Minutes"] if cfg else None
        return parents

    async def get_workspace_pipeline_assignments(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """Returns all parent pipelines for the workspace along with their per-pipeline L1 and L2 assignees."""
        pipelines = await pipeline_repository.get_parent_pipelines(workspace_id)
        if not pipelines or force_sync:
            try:
                fabric_pipes = await fabric_client.get_pipelines(workspace_id)
                if fabric_pipes:
                    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    await pipeline_repository.save_pipelines(workspace_id, fabric_pipes, now_iso)
                    pipelines = await pipeline_repository.get_parent_pipelines(workspace_id)
                    if not pipelines:
                        pipelines = [
                            {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or DEFAULT_PIPELINE_NAME}
                            for p in fabric_pipes
                        ]
                    asyncio.create_task(leased_poller.fetch_workspace_snapshot(workspace_id, force_sync=force_sync))
            except Exception as exc:
                logger.error(f"Error syncing pipelines from Fabric for workspace {workspace_id}: {exc}")

        sla_map = await sla_repository.get_sla_configs_for_workspace(workspace_id)
        results = []
        for p in pipelines:
            pid = p["pipelineId"]
            sla_info = sla_map.get(pid, {})
            results.append({
                "pipelineId": pid,
                "pipelineName": p["pipelineName"],
                "workspaceId": workspace_id,
                "l1Email": sla_info.get("l1Email") or "",
                "l1Name": sla_info.get("l1Name") or "",
                "l2Email": sla_info.get("l2Email") or "",
                "l2Name": sla_info.get("l2Name") or "",
                "sla1Minutes": sla_info.get("sla1Minutes", DEFAULT_SLA1_MINUTES),
                "sla2Minutes": sla_info.get("sla2Minutes", DEFAULT_SLA2_MINUTES),
            })
        return results


pipeline_service = PipelineService()

__all__ = [
    "HierarchyTreeBuilder",
    "tree_builder",
    "LeasedWorkspacePoller",
    "leased_poller",
    "PipelineService",
    "pipeline_service",
]
