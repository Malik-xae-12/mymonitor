import React from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Users, 
  RefreshCw, 
  CheckCircle2,
  XCircle,
  PlayCircle,
  Ban,
  Clock
} from 'lucide-react';
import WorkspaceSelector from './WorkspaceSelector';

export default function DashboardHeader({
  currentWorkspaceId,
  onSelectWorkspace,
  isConnected,
  viewersCount,
  lastUpdated,
  onRefresh,
  pipelines
}) {
  const total = pipelines.length;
  const running = pipelines.filter(p => ['inprogress', 'running'].includes(p.status?.toLowerCase())).length;
  const failed = pipelines.filter(p => p.status?.toLowerCase() === 'failed').length;
  const succeeded = pipelines.filter(p => ['completed', 'succeeded', 'success'].includes(p.status?.toLowerCase())).length;
  const cancelled = pipelines.filter(p => ['cancelled', 'canceled'].includes(p.status?.toLowerCase())).length;
  const neverRun = pipelines.filter(p => ['no runs', 'notstarted', 'never executed', 'noruns'].includes(p.status?.toLowerCase())).length;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-100 tracking-tight">
                  Microsoft Fabric Job Monitor
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Real-Time
                </span>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  SQLite Cache
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sub-50ms hierarchy telemetry, SLA alerting & automated L1/L2 escalation
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <WorkspaceSelector
              currentWorkspaceId={currentWorkspaceId}
              onSelectWorkspace={onSelectWorkspace}
            />

            {/* Connection badge */}
            {!currentWorkspaceId ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                <span>No Workspace Selected</span>
              </div>
            ) : isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live Sync</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Reconnecting...</span>
              </div>
            )}

            {/* Viewers Counter */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>{viewersCount} viewer{viewersCount > 1 ? 's' : ''}</span>
            </div>

            {/* Refresh */}
            <button
              onClick={onRefresh}
              title="Manual Fabric Poll Sync"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-100 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Row with 6 Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-800/60">
          <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total</span>
            <span className="text-sm font-mono font-bold text-slate-100">{total}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-blue-950/20 border border-blue-500/20 flex items-center justify-between">
            <span className="text-xs text-blue-400 font-medium flex items-center gap-1.5">
              <PlayCircle className="w-3.5 h-3.5" />
              Running
            </span>
            <span className="text-sm font-mono font-bold text-blue-300">{running}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Succeeded
            </span>
            <span className="text-sm font-mono font-bold text-emerald-300">{succeeded}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-rose-950/20 border border-rose-500/20 flex items-center justify-between">
            <span className="text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />
              Failed
            </span>
            <span className="text-sm font-mono font-bold text-rose-300">{failed}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-between">
            <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              Cancelled
            </span>
            <span className="text-sm font-mono font-bold text-amber-300">{cancelled}</span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Never Run
            </span>
            <span className="text-sm font-mono font-bold text-slate-400">{neverRun}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
