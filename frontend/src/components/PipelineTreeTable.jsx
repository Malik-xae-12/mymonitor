import React, { useState } from 'react';
import { Search, Layers, Activity } from 'lucide-react';
import PipelineRow from './PipelineRow';

export default function PipelineTreeTable({ 
  workspaceId, 
  pipelines, 
  onSelectError, 
  isLoading,
  onOpenRunHistory,
  onOpenSchedule,
  onOpenSlaConfig,
  onResolveIncident
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Exact counts across all pipelines
  const totalCount = pipelines.length;
  const runningCount = pipelines.filter(p => ['inprogress', 'running'].includes(p.status?.toLowerCase())).length;
  const failedCount = pipelines.filter(p => p.status?.toLowerCase() === 'failed').length;
  const succeededCount = pipelines.filter(p => ['completed', 'succeeded', 'success'].includes(p.status?.toLowerCase())).length;
  const cancelledCount = pipelines.filter(p => ['cancelled', 'canceled'].includes(p.status?.toLowerCase())).length;
  const neverRunCount = pipelines.filter(p => ['no runs', 'notstarted', 'never executed', 'noruns'].includes(p.status?.toLowerCase())).length;

  const filteredPipelines = pipelines.filter((pipe) => {
    // Name filter
    const matchesSearch = pipe.pipelineName?.toLowerCase().includes(search.toLowerCase());
    
    // Status filter
    const s = pipe.status?.toLowerCase() || '';
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'RUNNING') return matchesSearch && ['inprogress', 'running'].includes(s);
    if (statusFilter === 'FAILED') return matchesSearch && s === 'failed';
    if (statusFilter === 'CANCELLED') return matchesSearch && ['cancelled', 'canceled'].includes(s);
    if (statusFilter === 'SUCCEEDED') return matchesSearch && ['completed', 'succeeded', 'success'].includes(s);
    if (statusFilter === 'NO_RUNS') return matchesSearch && ['no runs', 'notstarted', 'never executed', 'noruns'].includes(s);
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Table Filter Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm backdrop-blur-sm">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search pipelines or activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Status Pill Filters with Dynamic Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'ALL', label: `All (${totalCount})` },
            { id: 'RUNNING', label: `Running (${runningCount})` },
            { id: 'FAILED', label: `Failed (${failedCount})` },
            { id: 'CANCELLED', label: `Cancelled (${cancelledCount})` },
            { id: 'SUCCEEDED', label: `Succeeded (${succeededCount})` },
            { id: 'NO_RUNS', label: `Never Run (${neverRunCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Unified Tree-Grid Data Table */}
      <div>
        {!workspaceId ? (
          <div className="py-20 text-center text-xs text-slate-400 space-y-2 bg-slate-900/30 rounded-xl border border-slate-800">
            <div className="text-sm font-medium text-slate-200">No workspace selected</div>
            <p className="text-slate-500">Please select a workspace from the top bar to view its live pipeline execution hierarchy.</p>
          </div>
        ) : isLoading && pipelines.length === 0 ? (
          <div className="py-20 text-center text-xs text-slate-400 animate-pulse space-y-2 bg-slate-900/30 rounded-xl border border-slate-800">
            <div className="inline-block p-3 rounded-full bg-slate-900 border border-slate-800">
              <Layers className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
            <div>Loading workspace pipeline telemetry...</div>
          </div>
        ) : filteredPipelines.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/80">
            No pipelines match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-2xl backdrop-blur-sm">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
                  <th className="py-3 px-4 w-[32%]">Name</th>
                  <th className="py-3 px-3 w-[16%]">Status & SLA</th>
                  <th className="py-3 px-3 w-[14%]">Start Time</th>
                  <th className="py-3 px-3 w-[14%]">End Time</th>
                  <th className="py-3 px-3 w-[8%]">Duration</th>
                  <th className="py-3 px-4 w-[16%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredPipelines.map((pipe) => (
                  <PipelineRow
                    key={pipe.id}
                    pipeline={pipe}
                    depth={0}
                    onSelectError={onSelectError}
                    onOpenRunHistory={onOpenRunHistory}
                    onOpenSchedule={onOpenSchedule}
                    onOpenSlaConfig={onOpenSlaConfig}
                    onResolveIncident={onResolveIncident}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
