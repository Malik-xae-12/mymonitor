import asyncio
import datetime
import logging
from typing import Any, Dict, List, Optional

from app.modules.pipelines.schema import PipelineSchedule
from app.modules.pipelines.repository import pipeline_repository
from app.modules.pipelines.poller import leased_poller
from app.modules.sla.repository import sla_repository
from app.shared.clients.fabric_client import fabric_client

logger = logging.getLogger("fabric_monitor.pipelines")


def _parse_schedules_payload(sched_data: Any) -> List[Dict[str, Any]]:
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


class PipelineService:
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
            p_name = p.get("displayName") or p.get("name") or "Pipeline"
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
                            {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or "Pipeline"}
                            for p in fabric_pipes
                        ]
                    # Asynchronously fetch runs to update hierarchy in the background without blocking the UI
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
                            {"pipelineId": p["id"], "pipelineName": p.get("displayName") or p.get("name") or "Pipeline"}
                            for p in fabric_pipes
                        ]
                    # Asynchronously fetch runs to update hierarchy in the background without blocking the UI
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
                "sla1Minutes": sla_info.get("sla1Minutes", 30),
                "sla2Minutes": sla_info.get("sla2Minutes", 60),
            })
        return results


pipeline_service = PipelineService()
