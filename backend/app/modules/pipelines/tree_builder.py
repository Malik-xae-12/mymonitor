from typing import List, Dict, Any, Optional
from app.modules.pipelines.schema import PipelineRun, ActivityRun, ActivityError

import json
import logging

logger = logging.getLogger("fabric_monitor.tree")


class HierarchyTreeBuilder:
    """
    Builds a purely dynamic hierarchical tree of pipeline executions directly from
    Microsoft Fabric's runtime telemetry (/jobs/instances and /queryActivityRuns).
    Zero hardcoding. All activities, statuses, errors, start/end times, and durations
    are retrieved live from Microsoft Fabric APIs.
    """

    @staticmethod
    def parse_activity(raw_act: Dict[str, Any]) -> ActivityRun:
        raw_error = raw_act.get("error")
        parsed_error = None
        if raw_error and isinstance(raw_error, dict) and (raw_error.get("errorCode") or raw_error.get("message")):
            parsed_error = ActivityError(
                errorCode=str(raw_error.get("errorCode") or "Failed"),
                message=raw_error.get("message") or "Activity execution failed.",
                failureType=raw_error.get("failureType") or "UserError",
                target=raw_error.get("target") or raw_act.get("activityName"),
                rawError=raw_error
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
            output=output_val
        )

    @classmethod
    def assemble_pipeline_tree(
        cls,
        workspace_id: str,
        raw_runs: List[Dict[str, Any]],
        activity_map: Dict[str, List[Dict[str, Any]]]
    ) -> List[PipelineRun]:
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
                    rawError=raw_fail
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
                        output.get("pipelineRunId") or 
                        output.get("runId") or 
                        output.get("childPipelineRunId")
                    )
                    if child_run_id:
                        child_to_parent_meta[str(child_run_id).strip().lower()] = {
                            "parentRunId": run_id,
                            "parentActivityName": act_name
                        }

                    child_ref = (
                        input_data.get("pipeline", {}).get("referenceName") or
                        output.get("pipelineName") or 
                        output.get("pipelineId") or
                        input_data.get("pipelineName")
                    )
                    if child_ref:
                        child_refs_to_parent[str(child_ref).strip().lower()] = {
                            "parentRunId": run_id,
                            "parentActivityName": act_name
                        }

            pipeline_run = PipelineRun(
                id=run_id,
                pipelineId=r.get("itemId") or r.get("pipelineId", ""),
                pipelineName=r.get("itemDisplayName") or r.get("pipelineName", "Unknown Pipeline"),
                workspaceId=workspace_id,
                status=r.get("status", "NotStarted"),
                startTime=r.get("startTimeUtc") or r.get("startTime"),
                endTime=r.get("endTimeUtc") or r.get("endTime"),
                durationInMs=r.get("durationInMs"),
                invokeType=r.get("invokeType", "Manual"),
                error=pipe_error,
                activities=parsed_activities,
                childPipelines=[]
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
                        (act.output or {}).get("pipelineRunId") or 
                        (act.output or {}).get("runId") or 
                        (act.output or {}).get("childPipelineRunId")
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
            reverse=True
        )
        return top_level_runs


tree_builder = HierarchyTreeBuilder()
