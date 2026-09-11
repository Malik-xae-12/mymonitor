import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  AlertCircle, 
  Layers, 
  Code2, 
  Database, 
  ArrowRightCircle,
  Cpu,
  Search,
  Filter,
  Repeat,
  GitBranch,
  Variable,
  ListPlus,
  AlertOctagon
} from 'lucide-react';

function getActivityIcon(type) {
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
      return <Cpu className="w-3.5 h-3.5 text-blue-400" />;
    default:
      return <ArrowRightCircle className="w-3.5 h-3.5 text-slate-400" />;
  }
}

function StatusBadge({ status }) {
  switch (status?.toLowerCase()) {
    case 'inprogress':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Loader2 className="w-3 h-3 animate-spin" />
          InProgress
        </span>
      );
    case 'succeeded':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Succeeded
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3 h-3" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
          <Clock className="w-3 h-3" />
          {status || "Queued"}
        </span>
      );
  }
}

function formatDuration(durationInMs) {
  if (!durationInMs && durationInMs !== 0) return "--";
  if (durationInMs < 1000) return `${durationInMs}ms`;
  const seconds = (durationInMs / 1000).toFixed(1);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(isoString) {
  if (!isoString) return "--";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return isoString;
  }
}

export default function ActivityList({ activities, onSelectError, childPipelines }) {
  if (!activities || activities.length === 0) {
    return (
      <div className="py-4 px-6 text-center text-xs text-slate-400 bg-slate-900/40 rounded-lg border border-slate-800/80 space-y-1">
        <p className="font-medium text-slate-300">No activity execution records found yet.</p>
        <p className="text-[11px] text-slate-500">
          Click &apos;Run&apos; on this pipeline in Microsoft Fabric to trigger execution and stream live activity telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 shadow-inner">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
          <tr>
            <th className="py-2.5 px-4">Activity Name</th>
            <th className="py-2.5 px-3">Type</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Start Time</th>
            <th className="py-2.5 px-3">End Time</th>
            <th className="py-2.5 px-3">Duration</th>
            <th className="py-2.5 px-4 text-right">Diagnostics</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {activities.map((activity, index) => {
            const isFailed = activity.status?.toLowerCase() === 'failed';
            const isExecutePipeline = activity.activityType === 'ExecutePipeline';

            return (
              <tr 
                key={activity.activityRunId || index} 
                className="hover:bg-slate-800/30 transition duration-75"
              >
                <td className="py-2.5 px-4 font-medium text-slate-200 flex items-center gap-2">
                  <span className="p-1 rounded bg-slate-800/80 border border-slate-700/60">
                    {getActivityIcon(activity.activityType)}
                  </span>
                  <span>{activity.activityName}</span>
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                  {activity.activityType}
                </td>
                <td className="py-2.5 px-3">
                  <StatusBadge status={activity.status} />
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-mono">
                  {formatTime(activity.activityRunStart)}
                </td>
                <td className="py-2.5 px-3 text-slate-400 font-mono">
                  {formatTime(activity.activityRunEnd)}
                </td>
                <td className="py-2.5 px-3 text-slate-300 font-mono">
                  {formatDuration(activity.durationInMs)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {isFailed ? (
                    <button
                      onClick={() => onSelectError(activity)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition shadow-sm"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      View Error
                    </button>
                  ) : (
                    <span className="text-slate-600 font-mono text-[11px]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

