import React, { useState, useEffect } from 'react';
import { 
  X, 
  History, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  PlayCircle, 
  Layers, 
  Loader2 
} from 'lucide-react';
import { StatusBadge, formatDateTime, formatDuration, getActivityIcon, computeDuration } from './PipelineRow';

function HistoryActivityRow({ activity, depth = 1, onSelectError }) {
  const isFailed = activity.status?.toLowerCase() === 'failed';

  return (
    <tr className="border-b border-slate-800/40 bg-slate-950/40 hover:bg-slate-900/30 transition">
      <td className="py-2.5 px-4" style={{ paddingLeft: `${depth * 28 + 16}px` }}>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 inline-block shrink-0" />
          <div className="p-1 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
            {getActivityIcon(activity.activityType)}
          </div>
          <span className="text-xs text-slate-200 font-medium truncate">
            {activity.activityName}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({activity.activityType})
          </span>
        </div>
      </td>

      <td className="py-2.5 px-3 whitespace-nowrap">
        <StatusBadge status={activity.status} />
      </td>

      <td className="py-2.5 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
        {formatDateTime(activity.activityRunStart)}
      </td>

      <td className="py-2.5 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
        {formatDateTime(activity.activityRunEnd)}
      </td>

      <td className="py-2.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
        {formatDuration(computeDuration(activity))}
      </td>

      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        {isFailed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectError({
                activityName: activity.activityName,
                activityType: activity.activityType,
                status: activity.status,
                activityRunStart: activity.activityRunStart,
                activityRunEnd: activity.activityRunEnd,
                durationInMs: activity.durationInMs,
                error: activity.error,
                output: activity.output
              });
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Error</span>
          </button>
        )}
      </td>
    </tr>
  );
}

function HistorySubPipelineActivityRow({ activity, depth = 1, onSelectError }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const child = activity.childPipeline;
  const hasInnerActivities = child?.activities && child.activities.length > 0;
  const canExpand = hasInnerActivities;

  const startTime = activity.activityRunStart || child?.startTime;
  const endTime = activity.activityRunEnd || child?.endTime;
  const duration = computeDuration(activity) || (child ? computeDuration(child) : 0);
  const status = activity.status || child?.status || "Unknown";
  const isFailed = status?.toLowerCase() === 'failed';

  return (
    <>
      <tr 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`border-b border-slate-800/50 bg-purple-950/15 hover:bg-purple-950/30 transition ${canExpand ? "cursor-pointer" : ""}`}
      >
        <td className="py-2.5 px-4" style={{ paddingLeft: `${depth * 28 + 16}px` }}>
          <div className="flex items-center gap-2">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-0.5 rounded text-purple-300 hover:text-white shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-purple-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 inline-block shrink-0" />
            )}
            <div className="p-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-purple-200 font-medium truncate">
              {activity.activityName}
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Sub-pipeline
            </span>
            {child?.pipelineName && child.pipelineName !== activity.activityName && (
              <span className="text-[10px] text-purple-400/80 font-mono">
                ({child.pipelineName})
              </span>
            )}
          </div>
        </td>

        <td className="py-2.5 px-3 whitespace-nowrap">
          <StatusBadge status={status} />
        </td>

        <td className="py-2.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
          {formatDateTime(startTime)}
        </td>

        <td className="py-2.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
          {formatDateTime(endTime)}
        </td>

        <td className="py-2.5 px-3 font-mono text-xs text-slate-200 whitespace-nowrap">
          {formatDuration(duration)}
        </td>

        <td className="py-2.5 px-4 text-right whitespace-nowrap">
          {isFailed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const err = activity.error || child?.error;
                onSelectError({
                  activityName: activity.activityName,
                  activityType: activity.activityType || "Sub-pipeline",
                  status: status,
                  activityRunStart: startTime,
                  activityRunEnd: endTime,
                  durationInMs: duration,
                  error: err,
                  output: err?.rawError || activity.output
                });
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Error</span>
            </button>
          )}
        </td>
      </tr>

      {isExpanded && child && (
        <>
          {child.activities && child.activities.map((innerAct, idx) => {
            const isInnerSub = innerAct.childPipeline != null || ['executepipeline', 'invokepipeline'].includes(innerAct.activityType?.toLowerCase());
            if (isInnerSub) {
              return (
                <HistorySubPipelineActivityRow
                  key={innerAct.activityRunId || `hist-sub-${depth}-${idx}`}
                  activity={innerAct}
                  depth={depth + 1}
                  onSelectError={onSelectError}
                />
              );
            }
            return (
              <HistoryActivityRow
                key={innerAct.activityRunId || `hist-act-${depth}-${idx}`}
                activity={innerAct}
                depth={depth + 1}
                onSelectError={onSelectError}
              />
            );
          })}
        </>
      )}
    </>
  );
}

export default function RunHistoryModal({ workspaceId, pipeline, isOpen, onClose, onSelectError }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedRunIds, setExpandedRunIds] = useState(new Set());

  const fetchHistory = async () => {
    if (!isOpen || !pipeline || !workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipeline.pipelineId}/history`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
        // Automatically expand the first run
        if (data.runs && data.runs.length > 0) {
          setExpandedRunIds(new Set([data.runs[0].id]));
        }
      }
    } catch (err) {
      console.error('Failed to fetch run history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isOpen, pipeline, workspaceId]);

  if (!isOpen || !pipeline) return null;

  const toggleRun = (runId) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) {
        next.delete(runId);
      } else {
        next.add(runId);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-100 text-base">Pipeline Execution History</h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  {runs.length} Run{runs.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-lg">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchHistory}
              title="Refresh history"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && runs.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span>Loading execution history from database & Fabric...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-500 bg-slate-950/30 rounded-xl border border-slate-800">
              No historical execution runs recorded for this pipeline yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4 w-[35%]">Run ID / Invoke Type</th>
                    <th className="py-3 px-3 w-[15%]">Status</th>
                    <th className="py-3 px-3 w-[18%]">Start Time</th>
                    <th className="py-3 px-3 w-[18%]">End Time</th>
                    <th className="py-3 px-3 w-[10%]">Duration</th>
                    <th className="py-3 px-4 w-[4%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {runs.map((r) => {
                    const isExpanded = expandedRunIds.has(r.id);
                    const hasActs = r.activities && r.activities.length > 0;
                    const isFailed = r.status?.toLowerCase() === 'failed';

                    return (
                      <React.Fragment key={r.id}>
                        {/* Parent Run Row */}
                        <tr
                          onClick={() => hasActs && toggleRun(r.id)}
                          className={`border-b border-slate-800/60 bg-slate-900/60 hover:bg-slate-800/50 transition cursor-pointer`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              {hasActs ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRun(r.id);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-white"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-6 h-6 inline-block" />
                              )}
                              <div>
                                <span className="font-mono text-xs font-semibold text-slate-200">
                                  #{r.id?.slice(0, 8)}
                                </span>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  Trigger: {r.invokeType || 'Manual'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                            {formatDateTime(r.startTime)}
                          </td>

                          <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                            {formatDateTime(r.endTime)}
                          </td>

                          <td className="py-3 px-3 font-mono text-xs text-slate-200 font-medium whitespace-nowrap">
                            {formatDuration(computeDuration(r))}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {isFailed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  let errPayload = r.error;
                                  let actName = pipeline.pipelineName;
                                  let actType = 'Historical Pipeline Run';
                                  if (!errPayload || !errPayload.message) {
                                    const failedAct = r.activities?.find(a => a.status?.toLowerCase() === 'failed' && a.error?.message);
                                    if (failedAct) {
                                      errPayload = failedAct.error;
                                      actName = `${pipeline.pipelineName} → ${failedAct.activityName}`;
                                      actType = failedAct.activityType;
                                    }
                                  }
                                  onSelectError({
                                    activityName: actName,
                                    activityType: actType,
                                    status: r.status,
                                    activityRunStart: r.startTime,
                                    activityRunEnd: r.endTime,
                                    durationInMs: r.durationInMs,
                                    error: errPayload,
                                    output: errPayload?.rawError || r.error?.rawError
                                  });
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition shadow-sm"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Error</span>
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Inner Activities */}
                        {isExpanded && hasActs && (
                          r.activities.map((act, idx) => {
                            const isSub = act.childPipeline != null || ['executepipeline', 'invokepipeline'].includes(act.activityType?.toLowerCase());
                            if (isSub) {
                              return (
                                <HistorySubPipelineActivityRow
                                  key={act.activityRunId || `hist-sub-1-${idx}`}
                                  activity={act}
                                  depth={1}
                                  onSelectError={onSelectError}
                                />
                              );
                            }
                            return (
                              <HistoryActivityRow
                                key={act.activityRunId || `hist-act-1-${idx}`}
                                activity={act}
                                depth={1}
                                onSelectError={onSelectError}
                              />
                            );
                          })
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

