import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import PipelineRow from './PipelineRow';
import DateFilterBar from './DateFilterBar';

export default function PipelineTreeTable({ 
  workspaceId, 
  pipelines = [], 
  metrics = {},
  dateFilter = {},
  dateFilterInfo = {},
  onDateFilterChange,
  onSelectError, 
  isLoading,
  onOpenRunHistory,
  onOpenSchedule,
  onOpenSlaConfig,
  onResolveIncident,
  onOpenTableLogs
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredPipelines = pipelines.filter((pipe) => {
    // 1. Search filter by pipeline or activity name
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || 
      pipe.pipelineName?.toLowerCase().includes(term) ||
      (pipe.activities && pipe.activities.some(a => a.activityName?.toLowerCase().includes(term)));
    
    // 2. Status filter
    const s = pipe.status?.toLowerCase() || '';
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'RUNNING') return matchesSearch && ['inprogress', 'running'].includes(s);
    if (statusFilter === 'FAILED') return matchesSearch && s === 'failed';
    if (statusFilter === 'CANCELLED') return matchesSearch && ['cancelled', 'canceled'].includes(s);
    if (statusFilter === 'SUCCEEDED') return matchesSearch && ['completed', 'succeeded', 'success'].includes(s);
    if (statusFilter === 'NO_RUNS') return matchesSearch && ['no runs', 'notstarted', 'never executed', 'noruns', 'not run', 'not_run'].includes(s);
    if (statusFilter === 'SCHEDULED') return matchesSearch && ['scheduled', 'upcoming'].includes(s);
    if (statusFilter === 'NOT_SCHEDULED') return matchesSearch && ['not scheduled', 'not run', 'no runs'].includes(s);
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Dynamic Date-Based Telemetry & Execution Filter Bar */}
      <DateFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        metrics={metrics}
        dateFilter={dateFilter}
        dateFilterInfo={dateFilterInfo}
        onDateFilterChange={(newFilter) => {
          setStatusFilter('ALL'); // Reset status tab on date change for clarity
          if (onDateFilterChange) onDateFilterChange(newFilter);
        }}
        workspaceId={workspaceId}
      />

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
                    onOpenTableLogs={onOpenTableLogs}
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
