import React, { useState, useEffect } from 'react';
import { 
  X, 
  History, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  Loader2,
  Database
} from 'lucide-react';
import { StatusBadge, formatDateTime, formatDuration, getActivityIcon, computeDuration } from '../../features/monitoring/components/PipelineRow';

function HistoryActivityRow({ activity, depth = 1, onSelectError }) {
  const isFailed = activity.status?.toLowerCase() === 'failed';

  return (
    <tr className="border-b border-[#edebe9] bg-[#faf9f8]/60 hover:bg-[#f3f2f1] transition text-xs">
      <td className="py-2 px-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 inline-block shrink-0" />
          <div className="p-1 rounded bg-[#ffffff] text-[#605e5c] border border-[#d1d1d1] shrink-0">
            {getActivityIcon(activity.activityType)}
          </div>
          <span className="text-xs text-[#242424] font-medium truncate">
            {activity.activityName}
          </span>
          <span className="text-[10px] text-[#605e5c] font-mono">
            ({activity.activityType})
          </span>
        </div>
      </td>

      <td className="py-2 px-3 whitespace-nowrap">
        <StatusBadge status={activity.status} />
      </td>

      <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
        {formatDateTime(activity.activityRunStart)}
      </td>

      <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
        {formatDateTime(activity.activityRunEnd)}
      </td>

      <td className="py-2 px-3 font-mono text-xs text-[#242424] whitespace-nowrap">
        {formatDuration(computeDuration(activity))}
      </td>

      <td className="py-2 px-3 text-right whitespace-nowrap">
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
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-[#fde7e9] hover:bg-[#fbd0d5] text-[#a80000] border border-[#f19999] transition"
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
        className={`border-b border-[#edebe9] bg-[#faf5ff] hover:bg-[#f3e8ff] transition text-xs ${canExpand ? "cursor-pointer" : ""}`}
      >
        <td className="py-2 px-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-0.5 rounded text-[#605e5c] hover:text-[#242424]"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#6b21a8]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#605e5c]" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            <div className="p-1 rounded bg-[#f3e8ff] text-[#6b21a8] border border-[#d8b4fe] shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs text-[#242424] font-semibold truncate">
                {activity.activityName}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-[#f3e8ff] text-[#6b21a8] border border-[#d8b4fe]">
                Sub-pipeline
              </span>
            </div>
          </div>
        </td>

        <td className="py-2 px-3 whitespace-nowrap">
          <StatusBadge status={status} />
        </td>

        <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
          {formatDateTime(startTime)}
        </td>

        <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
          {formatDateTime(endTime)}
        </td>

        <td className="py-2 px-3 font-mono text-xs text-[#242424] whitespace-nowrap">
          {formatDuration(duration)}
        </td>

        <td className="py-2 px-3 text-right whitespace-nowrap">
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
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-[#fde7e9] hover:bg-[#fbd0d5] text-[#a80000] border border-[#f19999] transition"
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

export default function RunHistoryModal({ workspaceId, pipeline, isOpen, onClose, onSelectError, onOpenTableLogs }) {
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
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-5xl bg-[#ffffff] border border-[#edebe9] rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#d1d1d1]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#242424] text-sm">
                  Run History
                </h3>
                <span className="px-2 py-0.2 text-[10px] font-mono rounded bg-[#f3f2f1] text-[#323130] border border-[#d1d1d1]">
                  {runs.length} runs recorded
                </span>
              </div>
              <p className="text-xs text-[#605e5c] font-mono mt-0.5">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchHistory}
              title="Refresh history"
              className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0f6cbd]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#faf9f8]">
          {loading && runs.length === 0 ? (
            <div className="py-16 text-center text-xs text-[#605e5c] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0f6cbd]" />
              <span>Loading execution history from Fabric...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#605e5c] bg-[#ffffff] rounded border border-[#edebe9]">
              No historical execution runs recorded for this pipeline yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-[#edebe9] bg-[#ffffff]">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-[#faf9f8] text-[#605e5c] text-[11px] font-semibold uppercase tracking-wider border-b border-[#edebe9]">
                    <th className="py-2 px-3 w-[35%]">Run ID / Invoke Type</th>
                    <th className="py-2 px-3 w-[15%]">Status</th>
                    <th className="py-2 px-3 w-[18%]">Start Time</th>
                    <th className="py-2 px-3 w-[18%]">End Time</th>
                    <th className="py-2 px-3 w-[10%]">Duration</th>
                    <th className="py-2 px-3 w-[4%] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edebe9]">
                  {runs.map((r) => {
                    const isExpanded = expandedRunIds.has(r.id);
                    const hasActs = r.activities && r.activities.length > 0;
                    const isFailed = r.status?.toLowerCase() === 'failed';

                    return (
                      <React.Fragment key={r.id}>
                        {/* Parent Run Row */}
                        <tr
                          onClick={() => hasActs && toggleRun(r.id)}
                          className="border-b border-[#edebe9] bg-[#ffffff] hover:bg-[#f3f2f1] transition cursor-pointer text-xs"
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {hasActs ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRun(r.id);
                                  }}
                                  className="p-0.5 rounded text-[#605e5c] hover:text-[#242424]"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-[#0f6cbd]" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-[#605e5c]" />
                                  )}
                                </button>
                              ) : (
                                <span className="w-4 h-4 inline-block" />
                              )}
                              <div>
                                <span className="font-mono text-xs font-semibold text-[#0f6cbd]">
                                  #{r.id?.slice(0, 8)}
                                </span>
                                <div className="text-[10px] text-[#605e5c] font-mono">
                                  Trigger: {r.invokeType || 'Manual'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2 px-3 whitespace-nowrap">
                            <StatusBadge status={r.status} />
                          </td>

                          <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
                            {formatDateTime(r.startTime)}
                          </td>

                          <td className="py-2 px-3 font-mono text-xs text-[#605e5c] whitespace-nowrap">
                            {formatDateTime(r.endTime)}
                          </td>

                          <td className="py-2 px-3 font-mono text-xs text-[#242424] font-medium whitespace-nowrap">
                            {formatDuration(computeDuration(r))}
                          </td>

                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {onOpenTableLogs && (
                                <button
                                  type="button"
                                  onClick={() => onOpenTableLogs(r)}
                                  title="View Table Logs"
                                  className="p-1 rounded text-[#605e5c] hover:text-[#0f6cbd] hover:bg-[#eff6fc] transition"
                                >
                                  <Database className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isFailed && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectError({
                                      activityName: pipeline.pipelineName,
                                      activityType: 'Pipeline',
                                      status: r.status,
                                      activityRunStart: r.startTime,
                                      activityRunEnd: r.endTime,
                                      durationInMs: r.durationInMs,
                                      error: r.error,
                                      output: r.error?.rawError
                                    });
                                  }}
                                  className="p-1 rounded text-[#605e5c] hover:text-[#a80000] hover:bg-[#fde7e9] transition"
                                  title="View Error Details"
                                >
                                  <AlertCircle className="w-3.5 h-3.5 text-[#a80000]" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Activities for this run */}
                        {isExpanded && hasActs && r.activities.map((act, index) => {
                          const isSub = act.childPipeline != null || ['executepipeline', 'invokepipeline'].includes(act.activityType?.toLowerCase());
                          if (isSub) {
                            return (
                              <HistorySubPipelineActivityRow
                                key={act.activityRunId || `sub-act-${index}`}
                                activity={act}
                                depth={1}
                                onSelectError={onSelectError}
                              />
                            );
                          }
                          return (
                            <HistoryActivityRow
                              key={act.activityRunId || `act-${index}`}
                              activity={act}
                              depth={1}
                              onSelectError={onSelectError}
                            />
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
          <div className="text-[11px] text-[#605e5c] font-mono">
            Pipeline ID: {pipeline.pipelineId}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#d1d1d1] text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
