import React, { useState } from 'react';
import DashboardHeader from './components/DashboardHeader';
import PipelineTreeTable from './components/PipelineTreeTable';
import ErrorDetailModal from './components/ErrorDetailModal';
import SchedulesDrawer from './components/SchedulesDrawer';
import RunHistoryModal from './components/RunHistoryModal';
import PipelineScheduleModal from './components/PipelineScheduleModal';
import SlaConfigModal from './components/SlaConfigModal';
import TableLogConfigModal from './components/TableLogConfigModal';
import TableLogDashboardModal from './components/TableLogDashboardModal';
import { useWorkspaceMonitoring } from './hooks/useWorkspaceMonitoring';

export default function App() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [selectedErrorActivity, setSelectedErrorActivity] = useState(null);
  const [isSchedulesOpen, setIsSchedulesOpen] = useState(false);
  const [selectedHistoryPipeline, setSelectedHistoryPipeline] = useState(null);
  const [selectedSchedulePipeline, setSelectedSchedulePipeline] = useState(null);
  const [selectedSlaPipeline, setSelectedSlaPipeline] = useState(null);
  const [selectedTableLogPipeline, setSelectedTableLogPipeline] = useState(null);
  const [isTableLogConfigOpen, setIsTableLogConfigOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    preset: 'latest',
    startDate: null,
    endDate: null
  });

  const {
    pipelineTree,
    metrics,
    dateFilterInfo,
    isConnected,
    lastUpdated,
    viewersCount,
    isLoading,
    refresh,
    resolveIncident
  } = useWorkspaceMonitoring(workspaceId, dateFilter);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top sticky navigation & real-time telemetry header */}
      <DashboardHeader
        currentWorkspaceId={workspaceId}
        onSelectWorkspace={setWorkspaceId}
        isConnected={isConnected}
        viewersCount={viewersCount}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        pipelines={pipelineTree}
        onOpenTableLogConfig={() => setIsTableLogConfigOpen(true)}
      />

      {/* Main dashboard content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Pipeline Hierarchy Tree Table with Date & Execution Filter Bar */}
        <PipelineTreeTable
          workspaceId={workspaceId}
          pipelines={pipelineTree}
          metrics={metrics}
          dateFilter={dateFilter}
          dateFilterInfo={dateFilterInfo}
          onDateFilterChange={setDateFilter}
          onSelectError={setSelectedErrorActivity}
          isLoading={isLoading}
          onOpenRunHistory={(pipeline) => setSelectedHistoryPipeline(pipeline)}
          onOpenSchedule={(pipeline) => setSelectedSchedulePipeline(pipeline)}
          onOpenSlaConfig={(pipeline) => setSelectedSlaPipeline(pipeline)}
          onResolveIncident={resolveIncident}
          onOpenTableLogs={(pipeline) => setSelectedTableLogPipeline(pipeline)}
        />
      </main>

      {/* Pipeline Run History Modal */}
      {selectedHistoryPipeline && (
        <RunHistoryModal
          workspaceId={workspaceId}
          pipeline={selectedHistoryPipeline}
          isOpen={!!selectedHistoryPipeline}
          onClose={() => setSelectedHistoryPipeline(null)}
          onSelectError={setSelectedErrorActivity}
          onOpenTableLogs={(pipeline) => setSelectedTableLogPipeline(pipeline)}
        />
      )}

      {/* Error Diagnostics Modal (rendered on top of history modal) */}
      {selectedErrorActivity && (
        <ErrorDetailModal
          activity={selectedErrorActivity}
          onClose={() => setSelectedErrorActivity(null)}
        />
      )}

      {/* Single Pipeline Schedule Modal */}
      {selectedSchedulePipeline && (
        <PipelineScheduleModal
          workspaceId={workspaceId}
          pipeline={selectedSchedulePipeline}
          isOpen={!!selectedSchedulePipeline}
          onClose={() => setSelectedSchedulePipeline(null)}
        />
      )}

      {/* SLA Configuration Modal */}
      {selectedSlaPipeline && (
        <SlaConfigModal
          workspaceId={workspaceId}
          pipeline={selectedSlaPipeline}
          isOpen={!!selectedSlaPipeline}
          onClose={() => setSelectedSlaPipeline(null)}
          onSaved={() => refresh()}
        />
      )}

      {/* Workspace All Schedules Drawer */}
      <SchedulesDrawer
        workspaceId={workspaceId}
        isOpen={isSchedulesOpen}
        onClose={() => setIsSchedulesOpen(false)}
      />

      {/* Table-Level Logging Dashboard Modal */}
      {selectedTableLogPipeline && (
        <TableLogDashboardModal
          workspaceId={workspaceId}
          pipeline={selectedTableLogPipeline}
          isOpen={!!selectedTableLogPipeline}
          onClose={() => setSelectedTableLogPipeline(null)}
          onOpenConfig={() => setIsTableLogConfigOpen(true)}
        />
      )}

      {/* Lakehouse / Warehouse & Column Mapping Configuration Modal */}
      <TableLogConfigModal
        workspaceId={workspaceId}
        isOpen={isTableLogConfigOpen}
        onClose={() => setIsTableLogConfigOpen(false)}
        onSaved={() => {
          // If a table log dashboard is open, trigger its refresh by re-setting pipeline
          if (selectedTableLogPipeline) {
            setSelectedTableLogPipeline({ ...selectedTableLogPipeline });
          }
        }}
      />
    </div>
  );
}
