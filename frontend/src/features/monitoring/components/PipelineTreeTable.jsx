import React, { useState } from 'react';
import { Loader2, Info } from 'lucide-react';
import PipelineRow from './PipelineRow';
import FabricCommandBar from './FabricCommandBar';
import FabricMetricCards from './FabricMetricCards';

export default function PipelineTreeTable({ 
  workspaceId, 
  pipelines = [], 
  metrics = {},
  dateFilter = {},
  dateFilterInfo = {},
  onDateFilterChange,
  onSelectError, 
  isLoading,
  onRefresh,
  lastUpdated,
  onOpenRunHistory,
  onOpenSchedule,
  onOpenSlaConfig,
  onResolveIncident,
  onOpenTableLogs,
  onOpenTableLogConfig,
  onOpenSidePane
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
    <div className="space-y-3 select-none">
      {/* Fluent Command Bar */}
      <FabricCommandBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFilter={dateFilter}
        dateFilterInfo={dateFilterInfo}
        onDateFilterChange={(newFilter) => {
          setStatusFilter('ALL');
          if (onDateFilterChange) onDateFilterChange(newFilter);
        }}
        onRefresh={onRefresh}
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        onOpenTableLogConfig={onOpenTableLogConfig}
      />

      {/* Fluent 2 KPI Metric Summary Cards */}
      <FabricMetricCards
        metrics={metrics}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        isFuture={!!dateFilterInfo?.isFuture}
        isLoading={isLoading}
      />

      {/* Data Table Grid (Microsoft Fluent DetailsList Pattern - White Theme) */}
      <div className="rounded border border-[#edebe9] bg-[#ffffff] overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        {!workspaceId ? (
          <div className="py-16 text-center text-xs text-[#605e5c] space-y-2 bg-[#ffffff]">
            <div className="w-10 h-10 rounded-full bg-[#eff6fc] border border-[#d1d1d1] flex items-center justify-center mx-auto text-[#0f6cbd]">
              <Info className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-[#242424]">No workspace selected</div>
            <p className="text-[#605e5c] max-w-sm mx-auto text-xs">
              Select a workspace from the Microsoft Fabric top suite bar to load and monitor pipeline activities.
            </p>
          </div>
        ) : isLoading ? (
          <div className="bg-[#ffffff]">
            {/* Indeterminate top shimmer line */}
            <div className="h-0.5 w-full bg-[#eff6fc] overflow-hidden">
              <div className="h-full w-1/3 bg-[#0f6cbd] rounded-full animate-indeterminate" />
            </div>

            {/* Spinner and loading message (no skeleton table below) */}
            <div className="py-20 text-center text-xs text-[#605e5c] space-y-3">
              <div className="relative w-10 h-10 mx-auto">
                <div className="w-10 h-10 rounded-full border-2 border-[#eff6fc] border-t-[#0f6cbd] animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-[#0f6cbd] animate-spin" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[#242424]">
                  Loading Fabric pipeline execution hierarchy...
                </div>
                <p className="text-xs text-[#605e5c]">
                  Retrieving pipelines, runs, and telemetry for the selected workspace
                </p>
              </div>
            </div>
          </div>
        ) : pipelines.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#605e5c] bg-[#ffffff] space-y-2">
            <div className="w-10 h-10 rounded-full bg-[#f3f2f1] border border-[#edebe9] flex items-center justify-center mx-auto text-[#605e5c]">
              <Info className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-[#242424]">No pipelines found in this workspace</div>
            <p className="text-[#605e5c] max-w-sm mx-auto text-xs">
              This Microsoft Fabric workspace currently does not have any data pipelines.
            </p>
          </div>
        ) : filteredPipelines.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#605e5c] bg-[#ffffff] space-y-1.5">
            <div className="text-[#242424] font-semibold text-sm">No items match the current filter criteria</div>
            <p className="text-[#797775] text-xs">
              Try resetting the date range or status filter in the command bar above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[950px]">
              <thead>
                <tr className="bg-[#faf9f8] text-[#605e5c] text-[11px] font-semibold uppercase tracking-wider border-b border-[#edebe9]">
                  <th className="py-2.5 px-3 w-[34%] font-semibold">Activity name</th>
                  <th className="py-2.5 px-3 w-[12%] font-semibold">Item type</th>
                  <th className="py-2.5 px-3 w-[16%] font-semibold">Status & SLA</th>
                  <th className="py-2.5 px-3 w-[14%] font-semibold">Start time</th>
                  <th className="py-2.5 px-3 w-[14%] font-semibold">End time</th>
                  <th className="py-2.5 px-3 w-[6%] font-semibold">Duration</th>
                  <th className="py-2.5 px-3 w-[4%] text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
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
                    onOpenSidePane={onOpenSidePane}
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
