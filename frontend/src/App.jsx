import React, { useState, useEffect } from 'react';
import FabricSuiteBar from './components/FabricSuiteBar';
import FabricNavRail from './components/FabricNavRail';
import PipelineTreeTable from './components/PipelineTreeTable';
import FabricDetailSidePane from './components/FabricDetailSidePane';
import ErrorDetailModal from './components/ErrorDetailModal';
import SchedulesDrawer from './components/SchedulesDrawer';
import RunHistoryModal from './components/RunHistoryModal';
import PipelineScheduleModal from './components/PipelineScheduleModal';
import SlaConfigModal from './components/SlaConfigModal';
import TableLogsPage from './components/TableLogsPage';
import TableLogConfigPage from './components/TableLogConfigPage';
import AdminConsole from './features/admin/AdminConsole';
import { useAuth } from './features/auth';
import { useWorkspaceMonitoring } from './hooks/useWorkspaceMonitoring';

export default function App() {
  const { profile, role, isAdmin, logout } = useAuth();
  const [workspaceId, setWorkspaceId] = useState('');
  const [currentView, setCurrentView] = useState('monitoring'); // 'monitoring' | 'table-logs' | 'table-log-config' | 'admin'
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

  // Auto-initialize workspaceId to AllConnChk or first available workspace
  useEffect(() => {
    async function initWorkspace() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) {
            setWorkspaceId((prev) => {
              if (prev) return prev;
              const allConn = list.find((w) => w.displayName === 'AllConnChk' || w.name === 'AllConnChk');
              return allConn ? allConn.id : list[0].id;
            });
          }
        }
      } catch (err) {
        console.warn('Could not auto-initialize workspace in App:', err);
      }
    }
    initWorkspace();
  }, []);

  // Admins land on the setup console the first time their role resolves.
  useEffect(() => {
    if (isAdmin) {
      setCurrentView((v) => (v === 'monitoring' ? 'admin' : v));
    }
  }, [isAdmin]);

  // When an error is clicked, open the Fabric Detail Side Pane
  const handleSelectError = (errorItem) => {
    setSelectedSidePaneItem(errorItem);
  };

  const handleOpenTableLogs = (pipeline = null) => {
    if (pipeline) {
      setSelectedTableLogPipeline(pipeline);
    } else if (!selectedTableLogPipeline && pipelineTree && pipelineTree.length > 0) {
      setSelectedTableLogPipeline(pipelineTree[0]);
    }
    setSelectedSidePaneItem(null);
    setSelectedHistoryPipeline(null);
    setSelectedSchedulePipeline(null);
    setSelectedSlaPipeline(null);
    setSelectedErrorActivity(null);
    setIsSchedulesOpen(false);
    setCurrentView('table-logs');
  };

  const handleOpenTableLogConfig = () => {
    // Close any open modals
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
    <div className="h-screen w-screen flex flex-col bg-[#faf9f8] text-[#242424] font-sans select-none overflow-hidden">
      {/* 1. Microsoft Fabric Global Suite Bar (Top Bar - White Theme) */}
      <FabricSuiteBar
        currentView={currentView}
        currentWorkspaceId={workspaceId}
        onSelectWorkspace={setWorkspaceId}
        isConnected={isConnected}
        viewersCount={viewersCount}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        isLoading={isLoading}
        onOpenTableLogConfig={handleOpenTableLogConfig}
        user={profile}
        role={role}
        isAdmin={isAdmin}
        onOpenAdmin={() => setCurrentView('admin')}
        onSignOut={logout}
      />

      {/* Dynamic View: Table Logging Wizard (full page) vs Fabric Shell */}
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
        /* 2. Fabric Shell: Nav Rail + Main Work Area */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Fabric Left Nav Rail with L1, L2 & Admin Navigation */}
          <FabricNavRail 
            currentView={currentView}
            onNavigateMonitoring={() => setCurrentView('monitoring')}
            onNavigateTableLogs={() => handleOpenTableLogs()}
            isAdmin={isAdmin}
            onNavigateAdmin={() => setCurrentView('admin')}
            workspaceName={currentWorkspaceName}
          />

          {currentView === 'admin' && isAdmin ? (
            <AdminConsole
              onOpenTableConfig={(wsId) => {
                setWorkspaceId(wsId);
                setCurrentView('table-log-config');
              }}
            />
          ) : currentView === 'table-logs' ? (
            <TableLogsPage
              workspaceId={workspaceId}
              workspaceName={currentWorkspaceName}
              pipeline={selectedTableLogPipeline || pipelineTree[0]}
              pipelines={pipelineTree}
              onSelectPipeline={(p) => setSelectedTableLogPipeline(p)}
              onOpenConfig={handleOpenTableLogConfig}
              onBackToMonitoring={() => setCurrentView('monitoring')}
            />
          ) : (
            <main className="flex-1 overflow-y-auto bg-[#faf9f8] p-4 lg:p-6 space-y-3.5 max-w-[1700px] w-full mx-auto min-h-0">
              {/* Fabric Header Title (Breadcrumbs Removed) */}
              <div className="space-y-0.5">
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
                onOpenTableLogs={(pipeline) => handleOpenTableLogs(pipeline)}
                onOpenTableLogConfig={handleOpenTableLogConfig}
                onOpenSidePane={(item) => setSelectedSidePaneItem(item)}
              />
            </main>
          )}
        </div>
      )}

      {/* 3. Microsoft Fabric Right Detail Side Pane */}
      <FabricDetailSidePane
        item={selectedSidePaneItem}
        isOpen={!!selectedSidePaneItem}
        onClose={() => setSelectedSidePaneItem(null)}
        onOpenRunHistory={(pipe) => setSelectedHistoryPipeline(pipe)}
        onOpenSchedule={(pipe) => setSelectedSchedulePipeline(pipe)}
        onOpenTableLogs={(pipe) => handleOpenTableLogs(pipe)}
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
          onOpenTableLogs={(pipeline) => handleOpenTableLogs(pipeline)}
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
    </div>
  );
}
