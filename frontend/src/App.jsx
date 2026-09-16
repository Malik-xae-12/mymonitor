import React, { useState } from 'react';
import FabricSuiteBar from './components/FabricSuiteBar';
import FabricNavRail from './components/FabricNavRail';
import PipelineTreeTable from './components/PipelineTreeTable';
import FabricDetailSidePane from './components/FabricDetailSidePane';
import ErrorDetailModal from './components/ErrorDetailModal';
import SchedulesDrawer from './components/SchedulesDrawer';
import RunHistoryModal from './components/RunHistoryModal';
import PipelineScheduleModal from './components/PipelineScheduleModal';
import SlaConfigModal from './components/SlaConfigModal';
import TableLogDashboardModal from './components/TableLogDashboardModal';
import TableLogConfigPage from './components/TableLogConfigPage';
import { useWorkspaceMonitoring } from './hooks/useWorkspaceMonitoring';
import { ChevronRight } from 'lucide-react';

export default function App() {
  const [workspaceId, setWorkspaceId] = useState('');
  const [currentView, setCurrentView] = useState('monitoring'); // 'monitoring' | 'table-log-config'
  const [selectedErrorActivity, setSelectedErrorActivity] = useState(null);
  const [selectedSidePaneItem, setSelectedSidePaneItem] = useState(null);
  const [isSchedulesOpen, setIsSchedulesOpen] = useState(false);
  const [selectedHistoryPipeline, setSelectedHistoryPipeline] = useState(null);
  const [selectedSchedulePipeline, setSelectedSchedulePipeline] = useState(null);
  const [selectedSlaPipeline, setSelectedSlaPipeline] = useState(null);
  const [selectedTableLogPipeline, setSelectedTableLogPipeline] = useState(null);
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

  // When an error is clicked, open the Fabric Detail Side Pane
  const handleSelectError = (errorItem) => {
    setSelectedSidePaneItem(errorItem);
  };

  const handleOpenTableLogConfig = () => {
    // Close any open modals
    setSelectedTableLogPipeline(null);
    setSelectedSidePaneItem(null);
    setSelectedHistoryPipeline(null);
    setSelectedSchedulePipeline(null);
    setSelectedSlaPipeline(null);
    setSelectedErrorActivity(null);
    setIsSchedulesOpen(false);
    setCurrentView('table-log-config');
  };

  const currentWorkspaceName = pipelineTree[0]?.workspaceName || 'Current Workspace';

  return (
    <div className="min-h-screen bg-[#faf9f8] text-[#242424] flex flex-col font-sans select-none overflow-x-hidden">
      {/* 1. Microsoft Fabric Global Suite Bar (Top Bar - White Theme) */}
      <FabricSuiteBar
        currentWorkspaceId={workspaceId}
        onSelectWorkspace={setWorkspaceId}
        isConnected={isConnected}
        viewersCount={viewersCount}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isLoading={isLoading}
        onOpenTableLogConfig={handleOpenTableLogConfig}
      />

      {/* 2. Fabric Shell: Nav Rail + Main Work Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Fabric Left Icon Rail */}
        <FabricNavRail 
          onOpenTableLogConfig={handleOpenTableLogConfig} 
          currentView={currentView}
          onNavigateMonitoring={() => setCurrentView('monitoring')}
        />

        {/* Dynamic View: Monitoring Hub vs Full-Page Table Logging Configuration */}
        {currentView === 'table-log-config' ? (
          <TableLogConfigPage
            workspaceId={workspaceId}
            workspaceName={currentWorkspaceName}
            onBackToMonitoring={() => setCurrentView('monitoring')}
            onSaved={() => {
              refresh();
            }}
          />
        ) : (
          <main className="flex-1 overflow-y-auto bg-[#faf9f8] p-4 lg:p-6 space-y-3.5 max-w-[1700px] w-full mx-auto">
            {/* Fabric Breadcrumb & Header Title */}
            <div className="space-y-0.5">
              <nav className="flex items-center gap-1 text-xs text-[#605e5c]">
                <span className="hover:text-[#0f6cbd] cursor-pointer">Workspaces</span>
                <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d]" />
                <span className="text-[#323130] font-medium">
                  {workspaceId ? currentWorkspaceName : 'No workspace'}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d]" />
                <span className="text-[#242424] font-semibold">Monitoring hub</span>
              </nav>

              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pt-1">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-[#242424]">
                    Monitoring hub
                  </h1>
                  <p className="text-xs text-[#605e5c] mt-0.5">
                    Track pipeline execution runs, activity telemetry, SLA alerts, and lakehouse data ingestion.
                  </p>
                </div>

                {lastUpdated && (
                  <div className="text-[11px] text-[#797775] font-mono">
                    Telemetry synced: {new Date(lastUpdated).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>

            {/* Unified Pipeline Tree Table with Command Bar & Metric Cards */}
            <PipelineTreeTable
              workspaceId={workspaceId}
              pipelines={pipelineTree}
              metrics={metrics}
              dateFilter={dateFilter}
              dateFilterInfo={dateFilterInfo}
              onDateFilterChange={setDateFilter}
              onSelectError={handleSelectError}
              isLoading={isLoading}
              onRefresh={refresh}
              lastUpdated={lastUpdated}
              onOpenRunHistory={(pipeline) => setSelectedHistoryPipeline(pipeline)}
              onOpenSchedule={(pipeline) => setSelectedSchedulePipeline(pipeline)}
              onOpenSlaConfig={(pipeline) => setSelectedSlaPipeline(pipeline)}
              onResolveIncident={resolveIncident}
              onOpenTableLogs={(pipeline) => setSelectedTableLogPipeline(pipeline)}
              onOpenTableLogConfig={handleOpenTableLogConfig}
              onOpenSidePane={(item) => setSelectedSidePaneItem(item)}
            />
          </main>
        )}
      </div>

      {/* 3. Microsoft Fabric Right Detail Side Pane */}
      <FabricDetailSidePane
        item={selectedSidePaneItem}
        isOpen={!!selectedSidePaneItem}
        onClose={() => setSelectedSidePaneItem(null)}
        onOpenRunHistory={(pipe) => setSelectedHistoryPipeline(pipe)}
        onOpenSchedule={(pipe) => setSelectedSchedulePipeline(pipe)}
        onOpenTableLogs={(pipe) => setSelectedTableLogPipeline(pipe)}
      />

      {/* 4. Modal Dialogs */}
      {/* Pipeline Run History Modal */}
      {selectedHistoryPipeline && (
        <RunHistoryModal
          workspaceId={workspaceId}
          pipeline={selectedHistoryPipeline}
          isOpen={!!selectedHistoryPipeline}
          onClose={() => setSelectedHistoryPipeline(null)}
          onSelectError={handleSelectError}
          onOpenTableLogs={(pipeline) => setSelectedTableLogPipeline(pipeline)}
        />
      )}

      {/* Error Diagnostics Modal fallback */}
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
          onOpenConfig={handleOpenTableLogConfig}
        />
      )}
    </div>
  );
}
