import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  PlayCircle, 
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
  ShieldAlert
} from 'lucide-react';

export function getActivityIcon(type) {
  switch (type?.toLowerCase()) {
    case 'executepipeline':
    case 'invokepipeline':
      return <Layers className="w-3.5 h-3.5 text-purple-400" />;
    case 'lookup':
      return <Search className="w-3.5 h-3.5 text-cyan-400" />;
    case 'filter':
      return <Filter className="w-3.5 h-3.5 text-indigo-400" />;
    case 'foreach':
      return <Repeat className="w-3.5 h-3.5 text-emerald-400" />;
    case 'switch':
      return <GitBranch className="w-3.5 h-3.5 text-amber-400" />;
    case 'setvariable':
      return <Variable className="w-3.5 h-3.5 text-sky-400" />;
    case 'appendvariable':
      return <ListPlus className="w-3.5 h-3.5 text-teal-400" />;
    case 'fail':
      return <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />;
    case 'notebook':
    case 'synapsenotebook':
      return <Code2 className="w-3.5 h-3.5 text-amber-400" />;
    case 'copy':
      return <Database className="w-3.5 h-3.5 text-blue-400" />;
    case 'sql':
    case 'script':
    case 'storedprocedure':
      return <Cpu className="w-3.5 h-3.5 text-blue-400" />;
    case 'web':
    case 'webhook':
      return <ArrowRightCircle className="w-3.5 h-3.5 text-purple-400" />;
    default:
      return <ArrowRightCircle className="w-3.5 h-3.5 text-slate-400" />;
  }
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

export function StatusBadge({ status }) {
  const s = status?.toLowerCase() || '';
  if (s === 'inprogress' || s === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
        <Loader2 className="w-3 h-3 animate-spin" />
        Running
      </span>
    );
  }
  if (s === 'completed' || s === 'succeeded' || s === 'success') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" />
        Success
      </span>
    );
  }
  if (s === 'failed' || s === 'failure') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3.5 h-3.5" />
        Failed
      </span>
    );
  }
  if (s === 'cancelled' || s === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Ban className="w-3 h-3" />
        Cancelled
      </span>
    );
  }
  if (s === 'scheduled' || s === 'upcoming') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
        <Calendar className="w-3 h-3 text-purple-400" />
        Scheduled
      </span>
    );
  }
  if (s === 'not scheduled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-500">
        <Clock className="w-3 h-3 text-slate-600" />
        Not Scheduled
      </span>
    );
  }
  if (s === 'not run' || s === 'not_run' || s === 'no runs' || s === 'noruns') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
        <Clock className="w-3 h-3 text-slate-500" />
        Not Run
      </span>
    );
  }
  if (s === 'notstarted' || s === 'not started' || s === 'queued') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
        Not Started
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
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
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" />
        SLA Resolved
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
    const seconds = totalSec % 60;

    let overdueText = '';
    if (days > 0) {
      overdueText = `+${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      overdueText = `+${hours}h ${minutes}m ${seconds}s`;
    } else {
      overdueText = `+${minutes}m ${seconds}s`;
    }

    const totalOverdueMinutes = Math.floor(overdueMs / 60000);

    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span 
          title={`SLA breach overdue by ${totalOverdueMinutes.toLocaleString()} minutes (${overdueText}). Incident is awaiting operator resolution.`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/20 animate-pulse cursor-help"
        >
          <AlertOctagon className="w-3 h-3 text-rose-400 shrink-0" />
          <span>SLA Breached ({overdueText})</span>
        </span>
        {onResolve && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(incident.id);
            }}
            title="Acknowledge and mark incident resolved"
            className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            Resolve
          </button>
        )}
      </div>
    );
  }

  // Active countdown
  const remMin = Math.floor(diffMs / 60000);
  const remSec = Math.floor((diffMs % 60000) / 1000);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-spin" />
        <span>SLA: {remMin}m {remSec}s left</span>
      </span>
      {onResolve && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResolve(incident.id);
          }}
          title="Acknowledge and mark incident resolved"
          className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
        >
          Resolve
        </button>
      )}
    </div>
  );
}

function ActivityRow({ activity, depth, onSelectError }) {
  const isFailed = activity.status?.toLowerCase() === 'failed';

  return (
    <tr className="border-b border-slate-800/40 bg-slate-950/30 hover:bg-slate-900/40 transition-colors">
      <td className="py-2.5 px-4" style={{ paddingLeft: `${depth * 28 + 16}px` }}>
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 inline-block" />
          <div className="p-1 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
            {getActivityIcon(activity.activityType)}
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono text-xs text-slate-200 truncate">
              {activity.activityName}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              ({activity.activityType})
            </span>
          </div>
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

      <td className="py-2.5 px-3 font-mono text-xs text-slate-300 font-medium whitespace-nowrap">
        {formatDuration(computeDuration(activity))}
      </td>

      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        {isFailed ? (
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
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition shadow-sm"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Error</span>
          </button>
        ) : (
          <span className="text-slate-600 font-mono text-xs">—</span>
        )}
      </td>
    </tr>
  );
}

function SubPipelineActivityRow({ activity, depth, onSelectError, onOpenRunHistory, onOpenSchedule, onOpenSlaConfig, onResolveIncident, onOpenTableLogs }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const child = activity.childPipeline;
  const hasInnerActivities = child?.activities && child.activities.length > 0;
  const hasInnerChildren = child?.childPipelines && child.childPipelines.length > 0;
  const canExpand = hasInnerActivities || hasInnerChildren;

  const startTime = activity.activityRunStart || child?.startTime;
  const endTime = activity.activityRunEnd || child?.endTime;
  const duration = computeDuration(activity) || (child ? computeDuration(child) : 0);
  const status = activity.status || child?.status || "Unknown";

  return (
    <>
      <tr 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`group border-b border-slate-800/60 bg-purple-950/15 hover:bg-purple-950/30 transition-colors ${
          canExpand ? "cursor-pointer" : ""
        }`}
      >
        <td className="py-2.5 px-4" style={{ paddingLeft: `${depth * 28 + 16}px` }}>
          <div className="flex items-center gap-2.5">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 rounded text-purple-300 group-hover:text-white hover:bg-purple-900/40 transition"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-purple-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-purple-400" />
                )}
              </button>
            ) : (
              <span className="w-6 h-6 inline-block" />
            )}

            <div className="p-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-slate-200 text-xs truncate">
                {activity.activityName}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Sub-pipeline
              </span>
              {child?.pipelineName && child.pipelineName !== activity.activityName && (
                <span className="text-[11px] text-purple-400/80 font-mono">
                  ({child.pipelineName})
                </span>
              )}
            </div>
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

        <td className="py-2.5 px-3 font-mono text-xs text-slate-200 font-medium whitespace-nowrap">
          {formatDuration(duration)}
        </td>

        <td className="py-2.5 px-4 text-right whitespace-nowrap">
          {status.toLowerCase() === 'failed' ? (
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
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition shadow-sm"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Error</span>
            </button>
          ) : (
            <span className="text-slate-600 font-mono text-xs">—</span>
          )}
        </td>
      </tr>

      {/* Expanded Inner Activities of Sub-Pipeline */}
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
                />
              );
            }
            return (
              <ActivityRow
                key={innerAct.activityRunId || `inner-act-${idx}`}
                activity={innerAct}
                depth={depth + 1}
                onSelectError={onSelectError}
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
            />
          ))}

          {!hasInnerActivities && !hasInnerChildren && (
            <tr className="bg-slate-950/40 border-b border-slate-800/40">
              <td 
                colSpan={6} 
                style={{ paddingLeft: `${(depth + 1) * 28 + 16}px` }}
                className="py-2 px-4 text-xs text-slate-500 italic"
              >
                No inner activity runs found for this sub-pipeline.
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
  onOpenTableLogs
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasActivities = pipeline.activities && pipeline.activities.length > 0;
  const canExpand = hasActivities;
  const isFailed = pipeline.status?.toLowerCase() === 'failed';

  return (
    <>
      <tr 
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className={`group border-b border-slate-800/60 transition-colors ${
          canExpand ? "cursor-pointer" : ""
        } ${
          isChild 
            ? "bg-purple-950/20 hover:bg-purple-950/35" 
            : "bg-slate-900/80 hover:bg-slate-800/60"
        }`}
      >
        {/* Name Column */}
        <td className="py-3 px-4" style={{ paddingLeft: `${depth * 28 + 16}px` }}>
          <div className="flex items-center gap-2.5">
            {canExpand ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 rounded text-slate-400 group-hover:text-white hover:bg-slate-800 transition"
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

            {/* Icon */}
            {isChild ? (
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
                <GitFork className="w-4 h-4" />
              </div>
            ) : (
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <PlayCircle className="w-4 h-4" />
              </div>
            )}

            {/* Title & Metadata */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-100 text-sm tracking-tight truncate">
                  {pipeline.pipelineName}
                </span>
                {isChild && (
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Sub-pipeline
                  </span>
                )}
                {pipeline.status?.toLowerCase() === 'scheduled' ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-purple-950/40 text-purple-300 border border-purple-500/30">
                    Scheduled Trigger
                  </span>
                ) : !pipeline.id?.startsWith("norun-") && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-400 border border-slate-700">
                    Latest Run #{pipeline.id?.slice(0, 8)}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                {pipeline.status?.toLowerCase() === 'scheduled' ? (
                  <span className="text-purple-400">
                    Trigger: {pipeline.startTime ? formatDateTime(pipeline.startTime) : 'Configured Recurrence'}
                  </span>
                ) : pipeline.status?.toLowerCase() === 'not run' ? (
                  <span>Did not execute on this date</span>
                ) : pipeline.id?.startsWith("norun-") ? (
                  "Never executed"
                ) : (
                  <span>
                    Invoked: {pipeline.invokeType || "Manual"}
                    {pipeline.parentActivityName && ` • Triggered by ${pipeline.parentActivityName}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Status & SLA Column */}
        <td className="py-3 px-3">
          <div className="flex flex-col gap-1.5 items-start">
            <StatusBadge status={pipeline.status} />
            {isFailed && (
              pipeline.incident ? (
                <SlaCountdownBadge
                  incident={pipeline.incident}
                  onResolve={onResolveIncident}
                />
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0 animate-spin" />
                  <span>SLA: {pipeline.slaConfig?.slaMinutes || 30}m Target</span>
                </span>
              )
            )}
            {!isChild && pipeline.slaConfig && !isFailed && !['no runs', 'notstarted', 'noruns'].includes(pipeline.status?.toLowerCase()) && (
              <span className="text-[10px] text-slate-500 font-mono">
                SLA: {pipeline.slaConfig.slaMinutes}m
              </span>
            )}
          </div>
        </td>

        {/* Start Time */}
        <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
          {formatDateTime(pipeline.startTime)}
        </td>

        {/* End Time */}
        <td className="py-3 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
          {formatDateTime(pipeline.endTime)}
        </td>

        {/* Duration */}
        <td className="py-3 px-3 font-mono text-xs text-slate-200 font-medium whitespace-nowrap">
          {pipeline.status?.toLowerCase() === 'scheduled' ? (
            <span className="text-purple-400 font-sans text-xs font-semibold">Upcoming</span>
          ) : pipeline.status?.toLowerCase() === 'not run' ? (
            <span className="text-slate-500 font-sans text-xs">—</span>
          ) : (
            formatDuration(computeDuration(pipeline))
          )}
        </td>

        {/* Actions Column */}
        <td className="py-3 px-4 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            {/* Run History Button */}
            {!isChild && onOpenRunHistory && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRunHistory(pipeline);
                }}
                title="View Execution History & Telemetry"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition hover:text-white"
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden xl:inline">History</span>
              </button>
            )}

            {/* Schedules Button */}
            {!isChild && onOpenSchedule && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSchedule(pipeline);
                }}
                title="View Pipeline Schedules"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition hover:text-white"
              >
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden xl:inline">Schedule</span>
              </button>
            )}

            {/* SLA Configuration Button */}
            {!isChild && onOpenSlaConfig && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSlaConfig(pipeline);
                }}
                title="Configure SLA & L1/L2 Alerting"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition hover:text-white"
              >
                <Bell className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xl:inline">SLA</span>
              </button>
            )}

            {/* Table Logs Button */}
            {onOpenTableLogs && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenTableLogs(pipeline);
                }}
                title="View Lakehouse/Warehouse Table Level Logging"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/30 transition hover:text-white shadow-sm"
              >
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden xl:inline">Table Logs</span>
              </button>
            )}

            {/* Diagnostics Error Button */}
            {isFailed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const err = pipeline.error;
                  onSelectError({
                    activityName: pipeline.pipelineName,
                    activityType: "Pipeline",
                    status: pipeline.status,
                    activityRunStart: pipeline.startTime,
                    activityRunEnd: pipeline.endTime,
                    durationInMs: pipeline.durationInMs,
                    error: err,
                    output: err?.rawError
                  });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Error</span>
              </button>
            )}
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
                />
              );
            }
            return (
              <ActivityRow
                key={act.activityRunId || `act-${index}`}
                activity={act}
                depth={depth + 1}
                onSelectError={onSelectError}
              />
            );
          })}

          {!hasActivities && (
            <tr className="bg-slate-950/40 border-b border-slate-800/40">
              <td 
                colSpan={6} 
                style={{ paddingLeft: `${(depth + 1) * 28 + 16}px` }}
                className="py-3 px-4 text-xs text-slate-500 italic"
              >
                No activity telemetry recorded yet.
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}
