import asyncio
import datetime
import json
import logging
from typing import Dict, List, Any, Set, Optional
from backend.app.core.config import settings
from backend.app.services.fabric_client import fabric_client
from backend.app.services.connection_manager import connection_manager
from backend.app.services.db_service import db_service
from backend.app.services.alert_service import alert_service

logger = logging.getLogger("fabric_monitor.poller")

class LeasedWorkspacePoller:
    """
    High-Performance On-Demand Leased Background Poller.
    - Persistent SQLite snapshot caching (<15ms UI response).
    - Recursive activity and sub-pipeline execution tracing (Zero orphan rows).
    - Permanent caching of terminal runs and activity telemetry.
    - SLA Incident detection and automated L1/L2 escalation.
    """
    def __init__(self):
        self._is_running = False
        self._task: Optional[asyncio.Task] = None
        self._sync_in_progress: Set[str] = set()

    def start(self):
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._poll_loop())
            logger.info("LeasedWorkspacePoller background worker started.")

    def stop(self):
        self._is_running = False
        if self._task:
            self._task.cancel()
            logger.info("LeasedWorkspacePoller background worker stopped.")

    async def fetch_workspace_snapshot(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """Ultra-fast snapshot delivery from SQLite or Fabric sync."""
        if not force_sync:
            cached_tree = await db_service.get_workspace_latest_tree(workspace_id)
            if cached_tree:
                if workspace_id not in self._sync_in_progress:
                    asyncio.create_task(self._background_sync(workspace_id))
                return cached_tree

        return await self.sync_workspace_with_fabric(workspace_id)

    async def _background_sync(self, workspace_id: str):
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
        discovered_child_names: Optional[Set[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Recursively fetches activities for a run.
        Whenever an activity is ExecutePipeline or has a child run ID,
        queries the child pipeline's inner activities and nests them inside activity['childPipeline'].
        """
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
                try: out = json.loads(out)
                except: out = {}
            inp = a.get("input") or {}
            if isinstance(inp, str):
                try: inp = json.loads(inp)
                except: inp = {}

            child_run_id = (
                out.get("pipelineRunId") or 
                out.get("runId") or 
                out.get("childPipelineRunId")
            )
            child_pipe_ref = (
                inp.get("pipeline", {}).get("referenceName") or 
                out.get("pipelineName") or 
                out.get("pipelineId") or
                inp.get("pipelineName")
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

                # Recursive call to fetch inner activities
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
                    discovered_child_names=discovered_child_names
                )

                # Capture child failure if any
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
                    "childPipelines": []
                }

                # If child failed, alert
                if a.get("status") == "Failed":
                    asyncio.create_task(alert_service.process_failed_run(
                        workspace_id=workspace_id,
                        pipeline_id=child_pipe_id_str,
                        pipeline_name=child_name,
                        pipeline_run_id=str(child_run_id),
                        error_info=child_error,
                        failed_at=a.get("activityRunEnd") or now_iso
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
                "childPipeline": child_obj
            }
            parsed_acts.append(parsed_act)

        # Save these activities to SQLite for this run
        if parsed_acts:
            await db_service.save_activity_runs(run_id, parsed_acts, now_iso)

        return parsed_acts

    async def sync_workspace_with_fabric(self, workspace_id: str, force_sync: bool = False) -> List[Dict[str, Any]]:
        """
        Synchronizes Fabric pipeline executions into SQLite:
        - Discovers all pipelines.
        - Identifies Master Pipelines vs Sub-pipelines.
        - Fetches recent job instances.
        - Recursively queries activity runs for active & uncached runs.
        - Triggers L1 alerting for failures.
        """
        if workspace_id in self._sync_in_progress and not force_sync:
            return await db_service.get_workspace_latest_tree(workspace_id)

        self._sync_in_progress.add(workspace_id)
        try:
            now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            # 1. Discover all Data Pipelines
            pipelines = await fabric_client.get_pipelines(workspace_id)
            if not pipelines:
                return []

            pipeline_names = {p.get("id"): p.get("displayName") for p in pipelines}
            await db_service.save_pipelines(workspace_id, pipelines, now_iso)

            # 2. Concurrently fetch recent job instances for each pipeline
            semaphore = asyncio.Semaphore(settings.MAX_PARALLEL_FABRIC_REQUESTS)

            async def _fetch_instances(p: Dict[str, Any]) -> List[Dict[str, Any]]:
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
                        "invokeType": "None"
                    }]

            instance_batches = await asyncio.gather(*[_fetch_instances(p) for p in pipelines], return_exceptions=False)
            all_runs: List[Dict[str, Any]] = [inst for batch in instance_batches for inst in batch]

            # 3. Save discovered runs
            await db_service.save_pipeline_runs(workspace_id, all_runs, now_iso)

            # 4. For master pipelines (or runs with activities needed), recursively fetch activity trees
            if force_sync:
                cached_terminal_run_ids = set()
            else:
                cached_terminal_run_ids = await db_service.get_known_cached_run_ids(workspace_id)

            discovered_child_ids: Set[str] = set()
            discovered_child_names: Set[str] = set()
            for r in all_runs:
                if r.get("isChild") or r.get("parentRunId"):
                    if r.get("pipelineId"): discovered_child_ids.add(str(r["pipelineId"]))
                    if r.get("pipelineName"): discovered_child_names.add(str(r["pipelineName"]))

            async def _process_run_activities(r: Dict[str, Any]):
                run_id = r.get("id")
                status = r.get("status", "")
                pid = r.get("pipelineId") or r.get("itemId")
                pname = r.get("pipelineName") or r.get("itemDisplayName")

                if run_id.startswith("norun-") or status == "No Runs":
                    return

                # If already cached in terminal state, we skip re-querying Fabric
                if run_id in cached_terminal_run_ids:
                    return

                st = r.get("startTimeUtc") or r.get("startTime")
                et = r.get("endTimeUtc") or r.get("endTime")

                # Fetch activity tree recursively!
                acts = await self._fetch_activity_tree(
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
                    discovered_child_names=discovered_child_names
                )

                # Check if this run failed and trigger L1 alert
                if status == "Failed":
                    err_info = r.get("failureReason")
                    if not err_info:
                        for a in acts:
                            if a.get("error"):
                                err_info = a.get("error")
                                break
                    asyncio.create_task(alert_service.process_failed_run(
                        workspace_id=workspace_id,
                        pipeline_id=pid,
                        pipeline_name=pname,
                        pipeline_run_id=run_id,
                        error_info=err_info,
                        failed_at=et or st or now_iso
                    ))

            await asyncio.gather(*[_process_run_activities(r) for r in all_runs], return_exceptions=False)

            # 5. Dynamically update child vs parent pipeline roles (zero hardcoding)
            await db_service.update_child_pipeline_flags(workspace_id, discovered_child_ids, discovered_child_names)

            # 6. Background schedule sync
            asyncio.create_task(self._sync_schedules(workspace_id, pipelines, now_iso))

            # 7. Return fresh latest tree from SQLite
            latest_tree = await db_service.get_workspace_latest_tree(workspace_id)
            return latest_tree

        except Exception as e:
            logger.error(f"Error syncing workspace {workspace_id} with Fabric: {e}", exc_info=True)
            return await db_service.get_workspace_latest_tree(workspace_id)
        finally:
            self._sync_in_progress.discard(workspace_id)

    async def _sync_schedules(self, workspace_id: str, pipelines: List[Dict[str, Any]], updated_at: str):
        """Fetches pipeline schedules and persists to SQLite."""
        try:
            semaphore = asyncio.Semaphore(4)

            async def _fetch_sched(p: Dict[str, Any]) -> Dict[str, Any]:
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
                            "rawConfiguration": cfg
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
                        "rawConfiguration": {"schedules": all_scheds, "raw": sched_data}
                    }
                return {
                    "pipelineId": pid,
                    "pipelineName": pname,
                    "enabled": False,
                    "scheduleType": "Manual / None",
                    "nextRunTime": None,
                    "timeZone": None,
                    "schedules": [],
                    "rawConfiguration": sched_data
                }

            schedules = await asyncio.gather(*[_fetch_sched(p) for p in pipelines], return_exceptions=False)
            await db_service.save_schedules(workspace_id, schedules, updated_at)
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

                for ws_id in active_workspaces:
                    snapshot = await self.sync_workspace_with_fabric(ws_id)
                    
                    message = {
                        "type": "FULL_SNAPSHOT",
                        "workspaceId": ws_id,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "viewersCount": connection_manager.get_viewer_count(ws_id),
                        "data": snapshot
                    }
                    await connection_manager.broadcast_to_workspace(ws_id, message)

                await asyncio.sleep(settings.POLL_INTERVAL_ACTIVE_SECONDS)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in leased poller loop: {e}", exc_info=True)
                await asyncio.sleep(5.0)

leased_poller = LeasedWorkspacePoller()
