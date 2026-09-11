import React, { useState } from 'react';
import DashboardHeader from './components/DashboardHeader';
import PipelineTreeTable from './components/PipelineTreeTable';
import ErrorDetailModal from './components/ErrorDetailModal';
import SchedulesDrawer from './components/SchedulesDrawer';
import RunHistoryModal from './components/RunHistoryModal';
import PipelineScheduleModal from './components/PipelineScheduleModal';
import SlaConfigModal from './components/SlaConfigModal';
import { useWorkspaceMonitoring } from './hooks/useWorkspaceMonitoring';

export default function App() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [selectedErrorActivity, setSelectedErrorActivity] = useState(null);
  const [isSchedulesOpen, setIsSchedulesOpen] = useState(false);
  const [selectedHistoryPipeline, setSelectedHistoryPipeline] = useState(null);
  const [selectedSchedulePipeline, setSelectedSchedulePipeline] = useState(null);
  const [selectedSlaPipeline, setSelectedSlaPipeline] = useState(null);

  const {
    pipelineTree,
    isConnected,
    lastUpdated,
    viewersCount,
    isLoading,
    refresh,
    resolveIncident
  } = useWorkspaceMonitoring(workspaceId);

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
      />

      {/* Main dashboard content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Info Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            <span>
              Real-time synchronization active. Main view displays the latest execution for each master pipeline with nested child activities.
            </span>
          </div>
          <div className="text-slate-500 font-mono text-[11px]">
            Last sync: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "Connecting..."}
          </div>
        </div>

        {/* Pipeline Hierarchy Tree Table */}
        <PipelineTreeTable
          workspaceId={workspaceId}
          pipelines={pipelineTree}
          onSelectError={setSelectedErrorActivity}
          isLoading={isLoading}
          onOpenRunHistory={(pipeline) => setSelectedHistoryPipeline(pipeline)}
          onOpenSchedule={(pipeline) => setSelectedSchedulePipeline(pipeline)}
          onOpenSlaConfig={(pipeline) => setSelectedSlaPipeline(pipeline)}
          onResolveIncident={resolveIncident}
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
    </div>
  );
}
