import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  GitFork, 
  Clock, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Search,
  Filter,
  Repeat,
  GitBranch,
  Variable,
  ListPlus,
  AlertOctagon,
  Code2,
  Database,
  Cpu,
  ArrowRightCircle,
  History,
  Calendar,
  Bell,
  Ban,
  MoreHorizontal,
  PanelRightOpen
} from 'lucide-react';

export function getActivityIcon(type) {
  switch (type?.toLowerCase()) {
    case 'executepipeline':
    case 'invokepipeline':
      return <Layers className="w-3.5 h-3.5 text-[#773adc]" />;
    case 'lookup':
      return <Search className="w-3.5 h-3.5 text-[#008272]" />;
    case 'filter':
      return <Filter className="w-3.5 h-3.5 text-[#0f6cbd]" />;
    case 'foreach':
      return <Repeat className="w-3.5 h-3.5 text-[#107c41]" />;
    case 'switch':
      return <GitBranch className="w-3.5 h-3.5 text-[#d83b01]" />;
    case 'setvariable':
      return <Variable className="w-3.5 h-3.5 text-[#0078d4]" />;
    case 'appendvariable':
      return <ListPlus className="w-3.5 h-3.5 text-[#00b7c3]" />;
    case 'fail':
      return <AlertOctagon className="w-3.5 h-3.5 text-[#c42b1c]" />;
    case 'notebook':
    case 'synapsenotebook':
      return <Code2 className="w-3.5 h-3.5 text-[#d83b01]" />;
    case 'copy':
      return <Database className="w-3.5 h-3.5 text-[#0f6cbd]" />;
    case 'sql':
    case 'script':
    case 'storedprocedure':
      return <Cpu className="w-3.5 h-3.5 text-[#0f6cbd]" />;
    case 'web':
    case 'webhook':
      return <ArrowRightCircle className="w-3.5 h-3.5 text-[#773adc]" />;
    default:
      return <ArrowRightCircle className="w-3.5 h-3.5 text-[#605e5c]" />;
  }
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch {
    return "—";
  }
}

export function formatDuration(durationInMs) {
  if (durationInMs === null || durationInMs === undefined || isNaN(durationInMs)) return "—";
  if (durationInMs === 0) return "—";
  if (durationInMs < 1000) return `${durationInMs}ms`;
  const totalSeconds = Math.round(durationInMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s`;
}

export function computeDuration(item) {
  if (!item) return 0;
  if (item.durationInMs !== undefined && item.durationInMs !== null && item.durationInMs > 0) {
    return item.durationInMs;
  }
  if (item.startTime && item.endTime) {
    try {
      const s = new Date(item.startTime).getTime();
      const e = new Date(item.endTime).getTime();
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        return e - s;
      }
    } catch {}
  }
  if (item.activityRunStart && item.activityRunEnd) {
    try {
      const s = new Date(item.activityRunStart).getTime();
      const e = new Date(item.activityRunEnd).getTime();
      if (!isNaN(s) && !isNaN(e) && e >= s) {
        return e - s;
      }
    } catch {}
  }
  if (item.activities && item.activities.length > 0) {
    const sum = item.activities.reduce((acc, a) => {
      const d = computeDuration(a);
      return acc + (d > 0 ? d : 0);
    }, 0);
    if (sum > 0) return sum;
  }
  return 0;
}

export function StatusBadge({ status, onSelectError, errorData }) {
  const s = status?.toLowerCase() || '';

  if (s === 'inprogress' || s === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/30">
        <Loader2 className="w-3 h-3 animate-spin text-[#0f6cbd]" />
        <span>In Progress</span>
      </span>
    );
  }

  if (s === 'completed' || s === 'succeeded' || s === 'success') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#dff6dd] text-[#107c41] border border-[#107c41]/30">
        <CheckCircle2 className="w-3 h-3 text-[#107c41]" />
        <span>Completed</span>
      </span>
    );
  }

  if (s === 'failed' || s === 'failure') {
    if (onSelectError && errorData) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectError(errorData);
          }}
          title="Click to view error diagnostics & AI fix"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#fde7e9] hover:bg-[#fcd0d3] text-[#c42b1c] border border-[#c42b1c]/40 transition group cursor-pointer"
        >
          <XCircle className="w-3 h-3 text-[#c42b1c] group-hover:scale-110 transition-transform" />
          <span>Failed</span>
          <span className="text-[10px] underline underline-offset-2 opacity-80 group-hover:opacity-100 font-semibold">
            View error
          </span>
        </button>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#fde7e9] text-[#c42b1c] border border-[#c42b1c]/30">
        <XCircle className="w-3 h-3 text-[#c42b1c]" />
        <span>Failed</span>
      </span>
    );
  }

  if (s === 'cancelled' || s === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f3f2f1] text-[#605e5c] border border-[#d1d1d1]">
        <Ban className="w-3 h-3 text-[#797775]" />
        <span>Cancelled</span>
      </span>
    );
  }

  if (s === 'scheduled' || s === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f3e8ff] text-[#773adc] border border-[#773adc]/30">
        <Calendar className="w-3 h-3 text-[#773adc]" />
        <span>Scheduled</span>
      </span>
    );
  }

  if (s === 'not run' || s === 'not_run' || s === 'no runs' || s === 'noruns') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f3f2f1] text-[#797775] border border-[#e1dfdd]">
        <Clock className="w-3 h-3 text-[#797775]" />
        <span>Not run</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#f3f2f1] text-[#797775] border border-[#e1dfdd]">
      {status || "—"}
    </span>
  );
}

export function SlaCountdownBadge({ incident, onResolve }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!incident) return null;

  if (incident.status === 'RESOLVED') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#dff6dd] text-[#107c41] border border-[#107c41]/30">
        <CheckCircle2 className="w-2.5 h-2.5" />
        <span>SLA Resolved</span>
      </span>
    );
  }

  const targetTime = incident.sla_target_time || incident.slaTargetTime;
  const targetMs = targetTime ? new Date(targetTime).getTime() : 0;
  const diffMs = targetMs - now;

  if (incident.status === 'ESCALATED_L2' || diffMs <= 0) {
    const overdueMs = Math.abs(diffMs);
    const totalSec = Math.floor(overdueMs / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    let overdueText = '';
    if (days > 0) overdueText = `+${days}d ${hours}h`;
    else if (hours > 0) overdueText = `+${hours}h ${minutes}m`;
    else overdueText = `+${minutes}m`;

    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span 
          title="SLA Breached and escalated to L2 operations"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#fde7e9] text-[#c42b1c] border border-[#f4b4b9] shadow-sm"
        >
          <AlertOctagon className="w-2.5 h-2.5 text-[#c42b1c]" />
          <span>SLA Breached ({overdueText})</span>
        </span>
        {onResolve && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(incident.id);
            }}
            title="Acknowledge and mark incident resolved"
            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#107c41] hover:bg-[#0f703b] text-white transition shadow-sm"
          >
            Resolve
          </button>
        )}
      </div>
    );
  }

  const remMin = Math.floor(diffMs / 60000);
  const remSec = Math.floor((diffMs % 60000) / 1000);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fff8e1] text-[#b78103] border border-[#ffe082]">
        <Clock className="w-2.5 h-2.5 text-[#b78103]" />
        <span>SLA: {remMin}m {remSec}s</span>
      </span>
      {onResolve && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResolve(incident.id);
          }}
          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#107c41] hover:bg-[#0f703b] text-white transition shadow-sm"
        >
          Resolve
        </button>
      )}
    </div>
  );
}

function ActivityRow({ activity, depth, onSelectError, onOpenSidePane }) {
  const isFailed = activity.status?.toLowerCase() === 'failed';

  const errorData = isFailed ? {
    activityName: activity.activityName,
    activityType: activity.activityType,
    status: activity.status,
    activityRunStart: activity.activityRunStart,
    activityRunEnd: activity.activityRunEnd,
    durationInMs: activity.durationInMs,
    error: activity.error,
    output: activity.output
  } : null;

  return (
    <tr 
      onClick={() => onOpenSidePane && onOpenSidePane(activity)}
      className="border-b border-[#edebe9] bg-[#fafafa] hover:bg-[#f3f2f1] transition-colors group cursor-pointer text-xs"
    >
      {/* Activity Name */}
      <td className="py-2 px-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 inline-block" />
          <div className="p-1 rounded bg-[#ffffff] border border-[#edebe9] shrink-0">
            {getActivityIcon(activity.activityType)}
          </div>
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="font-medium text-[#242424] truncate">
              {activity.activityName}
            </span>
          </div>
        </div>
      </td>

      {/* Item Type */}
      <td className="py-2 px-3 text-[#605e5c] font-mono text-[11px] whitespace-nowrap">
        {activity.activityType || 'Activity'}
      </td>

      {/* Status */}
      <td className="py-2 px-3 whitespace-nowrap">
        <StatusBadge 
          status={activity.status} 
          onSelectError={onSelectError}
          errorData={errorData}
        />
      </td>

      {/* Start Time */}
      <td className="py-2 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
        {formatDateTime(activity.activityRunStart)}
      </td>

      {/* End Time */}
      <td className="py-2 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
        {formatDateTime(activity.activityRunEnd)}
      </td>

      {/* Duration */}
      <td className="py-2 px-3 font-mono text-[#323130] text-xs whitespace-nowrap">
        {formatDuration(computeDuration(activity))}
      </td>

      {/* Actions */}
      <td className="py-2 px-3 text-right whitespace-nowrap">
        {isFailed ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectError(errorData);
            }}
            title="Inspect error diagnostics"
            className="p-1 rounded text-[#797775] hover:text-[#c42b1c] hover:bg-[#fde7e9] transition"
          >
            <AlertCircle className="w-3.5 h-3.5 text-[#c42b1c]" />
          </button>
        ) : (
          <span className="text-[#a19f9d] font-mono text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

function SubPipelineActivityRow({ 
  activity, 
  depth, 
  onSelectError, 
  onOpenRunHistory, 
  onOpenSchedule, 
  onOpenSlaConfig, 
  onResolveIncident, 
  onOpenTableLogs,
  onOpenSidePane
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const child = activity.childPipeline;
  const hasInnerActivities = child?.activities && child.activities.length > 0;
  const hasInnerChildren = child?.childPipelines && child.childPipelines.length > 0;
  const canExpand = hasInnerActivities || hasInnerChildren;

  const startTime = activity.activityRunStart || child?.startTime;
  const endTime = activity.activityRunEnd || child?.endTime;
  const duration = computeDuration(activity) || (child ? computeDuration(child) : 0);
  const status = activity.status || child?.status || "Unknown";
  const isFailed = status?.toLowerCase() === 'failed';

  const err = activity.error || child?.error;
  const errorData = isFailed ? {
    activityName: activity.activityName,
    activityType: activity.activityType || "Sub-pipeline",
    status: status,
    activityRunStart: startTime,
    activityRunEnd: endTime,
    durationInMs: duration,
    error: err,
    output: err?.rawError || activity.output
  } : null;

  return (
    <>
      <tr 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`border-b border-[#edebe9] bg-[#faf8ff] hover:bg-[#f3edfc] transition-colors text-xs ${
          canExpand ? "cursor-pointer" : ""
        }`}
      >
        <td className="py-2.5 px-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-0.5 rounded text-[#605e5c] hover:text-[#242424] transition"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-[#773adc]" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-[#605e5c]" />
                )}
              </button>
            ) : (
              <span className="w-4 h-4 inline-block" />
            )}

            <div className="p-1 rounded bg-[#f3e8ff] text-[#773adc] border border-[#773adc]/30 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-[#242424] text-xs truncate">
                {activity.activityName}
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-[#f3e8ff] text-[#773adc] border border-[#773adc]/30">
                Sub-pipeline
              </span>
            </div>
          </div>
        </td>

        <td className="py-2.5 px-3 text-[#605e5c] font-mono text-[11px] whitespace-nowrap">
          ExecutePipeline
        </td>

        <td className="py-2.5 px-3 whitespace-nowrap">
          <StatusBadge 
            status={status} 
            onSelectError={onSelectError}
            errorData={errorData}
          />
        </td>

        <td className="py-2.5 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
          {formatDateTime(startTime)}
        </td>

        <td className="py-2.5 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
          {formatDateTime(endTime)}
        </td>

        <td className="py-2.5 px-3 font-mono text-[#323130] text-xs whitespace-nowrap">
          {formatDuration(duration)}
        </td>

        <td className="py-2.5 px-3 text-right whitespace-nowrap">
          {isFailed ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectError(errorData);
              }}
              title="Inspect error diagnostics"
              className="p-1 rounded text-[#797775] hover:text-[#c42b1c] hover:bg-[#fde7e9] transition"
            >
              <AlertCircle className="w-3.5 h-3.5 text-[#c42b1c]" />
            </button>
          ) : (
            <span className="text-[#a19f9d] font-mono text-xs">—</span>
          )}
        </td>
      </tr>

      {/* Expanded Inner Activities */}
      {isExpanded && child && (
        <>
          {child.activities && child.activities.map((innerAct, idx) => {
            const isInnerSub = innerAct.childPipeline != null || ['executepipeline', 'invokepipeline'].includes(innerAct.activityType?.toLowerCase());
            if (isInnerSub) {
              return (
                <SubPipelineActivityRow
                  key={innerAct.activityRunId || `sub-${depth}-${idx}`}
                  activity={innerAct}
                  depth={depth + 1}
                  onSelectError={onSelectError}
                  onOpenRunHistory={onOpenRunHistory}
                  onOpenSchedule={onOpenSchedule}
                  onOpenSlaConfig={onOpenSlaConfig}
                  onResolveIncident={onResolveIncident}
                  onOpenTableLogs={onOpenTableLogs}
                  onOpenSidePane={onOpenSidePane}
                />
              );
            }
            return (
              <ActivityRow
                key={innerAct.activityRunId || `inner-act-${idx}`}
                activity={innerAct}
                depth={depth + 1}
                onSelectError={onSelectError}
                onOpenSidePane={onOpenSidePane}
              />
            );
          })}

          {child.childPipelines && child.childPipelines.map((innerChild) => (
            <PipelineRow
              key={innerChild.id}
              pipeline={innerChild}
              depth={depth + 1}
              isChild={true}
              onSelectError={onSelectError}
              onOpenRunHistory={onOpenRunHistory}
              onOpenSchedule={onOpenSchedule}
              onOpenSlaConfig={onOpenSlaConfig}
              onResolveIncident={onResolveIncident}
              onOpenTableLogs={onOpenTableLogs}
              onOpenSidePane={onOpenSidePane}
            />
          ))}

          {!hasInnerActivities && !hasInnerChildren && (
            <tr className="bg-[#f8f8f7] border-b border-[#edebe9]">
              <td 
                colSpan={7} 
                style={{ paddingLeft: `${(depth + 1) * 24 + 16}px` }}
                className="py-2 px-4 text-xs text-[#797775] italic"
              >
                No inner activity telemetry recorded for this sub-pipeline.
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

export default function PipelineRow({ 
  pipeline, 
  depth = 0, 
  isChild = false, 
  onSelectError,
  onOpenRunHistory,
  onOpenSchedule,
  onOpenSlaConfig,
  onResolveIncident,
  onOpenTableLogs,
  onOpenSidePane
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const hasActivities = pipeline.activities && pipeline.activities.length > 0;
  const canExpand = hasActivities;
  const isFailed = pipeline.status?.toLowerCase() === 'failed';

  // Close context menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const errorData = isFailed ? {
    activityName: pipeline.pipelineName,
    activityType: "Pipeline",
    status: pipeline.status,
    activityRunStart: pipeline.startTime,
    activityRunEnd: pipeline.endTime,
    durationInMs: pipeline.durationInMs,
    error: pipeline.error,
    output: pipeline.error?.rawError
  } : null;

  return (
    <>
      <tr 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`border-b border-[#edebe9] transition-colors group select-none ${
          canExpand ? "cursor-pointer" : ""
        } ${
          isChild 
            ? "bg-[#faf8ff] hover:bg-[#f3edfc]" 
            : "bg-[#ffffff] hover:bg-[#f8f9fa]"
        }`}
      >
        {/* Name Column */}
        <td className="py-2.5 px-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <div className="flex items-center gap-2 min-w-0">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-0.5 rounded text-[#605e5c] hover:text-[#242424] transition"
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

            {/* Item Icon */}
            <div className={`p-1 rounded shrink-0 ${
              isChild 
                ? 'bg-[#f3e8ff] text-[#773adc] border border-[#773adc]/25' 
                : 'bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/25'
            }`}>
              <GitFork className="w-3.5 h-3.5" />
            </div>

            {/* Pipeline Title & Run Metadata */}
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-[#242424] text-xs tracking-tight truncate">
                  {pipeline.pipelineName}
                </span>

                {isChild && (
                  <span className="px-1.5 py-0.2 text-[9px] font-medium rounded bg-[#f3e8ff] text-[#773adc] border border-[#773adc]/30">
                    Sub-pipeline
                  </span>
                )}

                {!pipeline.id?.startsWith("norun-") && (
                  <span className="px-1 py-0.2 text-[9px] font-mono text-[#605e5c] bg-[#f3f2f1] border border-[#edebe9] rounded">
                    #{pipeline.id?.slice(0, 8)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Item Type Column */}
        <td className="py-2.5 px-3 text-[#605e5c] font-mono text-[11px] whitespace-nowrap">
          Pipeline
        </td>

        {/* Status & SLA Column */}
        <td className="py-2.5 px-3 whitespace-nowrap">
          <div className="flex flex-col gap-1 items-start">
            <StatusBadge 
              status={pipeline.status} 
              onSelectError={onSelectError}
              errorData={errorData}
            />

            {isFailed && pipeline.incident && (
              <SlaCountdownBadge
                incident={pipeline.incident}
                onResolve={onResolveIncident}
              />
            )}
          </div>
        </td>

        {/* Start Time Column */}
        <td className="py-2.5 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
          {formatDateTime(pipeline.startTime)}
        </td>

        {/* End Time Column */}
        <td className="py-2.5 px-3 font-mono text-[#605e5c] text-xs whitespace-nowrap">
          {formatDateTime(pipeline.endTime)}
        </td>

        {/* Duration Column */}
        <td className="py-2.5 px-3 font-mono text-[#323130] text-xs whitespace-nowrap font-medium">
          {pipeline.status?.toLowerCase() === 'scheduled' ? (
            <span className="text-[#773adc] text-xs">Upcoming</span>
          ) : pipeline.status?.toLowerCase() === 'not run' ? (
            <span className="text-[#797775]">—</span>
          ) : (
            formatDuration(computeDuration(pipeline))
          )}
        </td>

        {/* Actions Column (Unified Fluent Context Menu - NO REPETITIVE BUTTONS!) */}
        <td className="py-2.5 px-3 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Hover Trigger for Side Pane Details */}
            {onOpenSidePane && (
              <button
                type="button"
                onClick={() => onOpenSidePane(pipeline)}
                title="Open detail pane"
                className="p-1 rounded text-[#797775] hover:text-[#242424] hover:bg-[#f3f2f1] transition opacity-0 group-hover:opacity-100"
              >
                <PanelRightOpen className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Standard Fluent More Options Dropdown (...) */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="More options"
                className="p-1 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-1 w-52 rounded bg-[#ffffff] border border-[#edebe9] shadow-xl z-50 overflow-hidden py-1 text-left">
                  {/* View Details / Side Pane */}
                  {onOpenSidePane && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSidePane(pipeline);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424] transition"
                    >
                      <PanelRightOpen className="w-3.5 h-3.5 text-[#0f6cbd]" />
                      <span>View details</span>
                    </button>
                  )}

                  {/* Run History */}
                  {!isChild && onOpenRunHistory && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenRunHistory(pipeline);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424] transition"
                    >
                      <History className="w-3.5 h-3.5 text-[#0f6cbd]" />
                      <span>View run history</span>
                    </button>
                  )}

                  {/* Schedules */}
                  {!isChild && onOpenSchedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSchedule(pipeline);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424] transition"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#773adc]" />
                      <span>View schedules & triggers</span>
                    </button>
                  )}

                  {/* SLA Config */}
                  {!isChild && onOpenSlaConfig && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSlaConfig(pipeline);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424] transition"
                    >
                      <Bell className="w-3.5 h-3.5 text-[#b78103]" />
                      <span>Configure SLA & alerts</span>
                    </button>
                  )}

                  {/* Lakehouse Table Logs */}
                  {onOpenTableLogs && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenTableLogs(pipeline);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424] transition"
                    >
                      <Database className="w-3.5 h-3.5 text-[#008272]" />
                      <span>Table-level logs</span>
                    </button>
                  )}

                  {/* Error Diagnostics (if failed) */}
                  {isFailed && onSelectError && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onSelectError(errorData);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#c42b1c] hover:bg-[#fde7e9] transition border-t border-[#edebe9] mt-1 pt-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>View error diagnostics</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>

      {/* Expanded Child Activities & Sub-Pipelines */}
      {isExpanded && (
        <>
          {hasActivities && pipeline.activities.map((act, index) => {
            const isSubPipeline = act.childPipeline != null || ['executepipeline', 'invokepipeline'].includes(act.activityType?.toLowerCase());
            if (isSubPipeline) {
              return (
                <SubPipelineActivityRow
                  key={act.activityRunId || `act-sub-${index}`}
                  activity={act}
                  depth={depth + 1}
                  onSelectError={onSelectError}
                  onOpenRunHistory={onOpenRunHistory}
                  onOpenSchedule={onOpenSchedule}
                  onOpenSlaConfig={onOpenSlaConfig}
                  onResolveIncident={onResolveIncident}
                  onOpenTableLogs={onOpenTableLogs}
                  onOpenSidePane={onOpenSidePane}
                />
              );
            }
            return (
              <ActivityRow
                key={act.activityRunId || `act-${index}`}
                activity={act}
                depth={depth + 1}
                onSelectError={onSelectError}
                onOpenSidePane={onOpenSidePane}
              />
            );
          })}

          {!hasActivities && (
            <tr className="bg-[#f8f8f7] border-b border-[#edebe9]">
              <td 
                colSpan={7} 
                style={{ paddingLeft: `${(depth + 1) * 24 + 16}px` }}
                className="py-2.5 px-4 text-xs text-[#797775] italic"
              >
                No activity telemetry recorded yet for this pipeline run.
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
