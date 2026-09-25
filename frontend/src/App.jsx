import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FabricSuiteBar, FabricNavRail, FabricDetailSidePane } from './components/layout';
import { 
  WorkspaceSelector, 
  ErrorDetailModal, 
  SchedulesDrawer, 
  RunHistoryModal, 
  PipelineScheduleModal, 
  SlaConfigModal 
} from './components/shared';
import { PipelineTreeTable } from './features/monitoring';
import { TableLogsPage, TableLogConfigPage } from './features/table-logs';
import { AdminConsole } from './features/admin';
import { useAuth } from './features/auth';
import { useWorkspaceMonitoring } from './hooks/useWorkspaceMonitoring';

export default function App() {
  const { profile, role, isAdmin, logout } = useAuth();
  const [allWorkspaces, setAllWorkspaces] = useState([]);
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

  // 1. Fetch all available workspaces from backend
  useEffect(() => {
    async function initWorkspace() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            setAllWorkspaces(list);
          }
        }
      } catch (err) {
        console.warn('Could not auto-initialize workspace in App:', err);
      }
    }
    initWorkspace();
  }, []);

  // 2. Compute scoped workspaces based on user role and assignments:
  //    - Admins see ALL workspaces in the tenant.
  //    - L1 and L2 support users ONLY see workspaces they are assigned to.
  const scopedWorkspaces = useMemo(() => {
    if (isAdmin || !profile || role === 'admin') return allWorkspaces;
    const assignedIds = profile.assigned_workspace_ids || [];
    if (!assignedIds || assignedIds.length === 0) return [];
    return allWorkspaces.filter((w) => assignedIds.includes(w.id));
  }, [allWorkspaces, isAdmin, profile, role]);

  // 3. Auto-select active workspace based on user scope
  useEffect(() => {
    if (scopedWorkspaces.length > 0) {
      if (!workspaceId) {
        if (isAdmin) {
          const allConn = scopedWorkspaces.find((w) => w.displayName === 'AllConnChk' || w.name === 'AllConnChk');
          setWorkspaceId(allConn ? allConn.id : scopedWorkspaces[0].id);
        } else {
          setWorkspaceId(scopedWorkspaces[0].id);
        }
      } else if (!isAdmin) {
        // If an assigned user is on a workspace not assigned to them, steer them to their first assigned workspace
        const exists = scopedWorkspaces.some((w) => w.id === workspaceId);
        if (!exists) {
          setWorkspaceId(scopedWorkspaces[0].id);
        }
      }
    }
  }, [workspaceId, scopedWorkspaces, isAdmin]);

  const hasInitialLandedRef = useRef(false);

  // Admins land on the setup console on initial load, but can freely navigate to Monitoring hub.
  useEffect(() => {
    if (isAdmin && !hasInitialLandedRef.current) {
      hasInitialLandedRef.current = true;
      setCurrentView('admin');
    } else if (!isAdmin && (currentView === 'admin' || currentView === 'table-log-config')) {
      setCurrentView('monitoring');
    }
  }, [isAdmin, currentView]);

  // 4. Compute scoped pipeline tree and metrics for non-admin users:
  //    - Admins see all parent pipelines.
  //    - L1 users ONLY see pipelines where they are assigned as L1.
  //    - L2 users ONLY see pipelines where they are assigned as L2.
  const scopedPipelineTree = useMemo(() => {
    if (isAdmin || !role || role === 'none' || role === 'admin') {
      return pipelineTree;
    }
    const userEmail = (profile?.email || '').toLowerCase().trim();
    if (!userEmail) return pipelineTree;

    return pipelineTree.filter((p) => {
      const sla = p.slaConfig || {};
      if (role === 'l1') {
        const l1 = (sla.l1Email || '').toLowerCase().trim();
        return l1 === userEmail;
      }
      if (role === 'l2') {
        const l2 = (sla.l2Email || '').toLowerCase().trim();
        return l2 === userEmail;
      }
      return true;
    });
  }, [pipelineTree, isAdmin, role, profile]);

  const scopedMetrics = useMemo(() => {
    if (isAdmin || !role || role === 'none' || role === 'admin') {
      return metrics;
    }
    const running = scopedPipelineTree.filter((p) => ['inprogress', 'running'].includes((p.status || '').toLowerCase())).length;
    const succeeded = scopedPipelineTree.filter((p) => ['completed', 'succeeded', 'success'].includes((p.status || '').toLowerCase())).length;
    const failed = scopedPipelineTree.filter((p) => (p.status || '').toLowerCase() === 'failed').length;
    const cancelled = scopedPipelineTree.filter((p) => ['cancelled', 'canceled'].includes((p.status || '').toLowerCase())).length;
    const notRun = scopedPipelineTree.filter((p) => ['no runs', 'noruns', 'notstarted', 'never executed', 'not run'].includes((p.status || '').toLowerCase())).length;
    return {
      total: scopedPipelineTree.length,
      running,
      succeeded,
      failed,
      cancelled,
      notRun,
      scheduled: 0,
      notScheduled: 0,
    };
  }, [scopedPipelineTree, metrics, isAdmin, role]);

  // When an error is clicked, open the Fabric Detail Side Pane
  const handleSelectError = (errorItem) => {
    setSelectedSidePaneItem(errorItem);
  };

  const handleOpenTableLogs = (pipeline = null) => {
    if (pipeline) {
      setSelectedTableLogPipeline(pipeline);
    } else if (!selectedTableLogPipeline && scopedPipelineTree && scopedPipelineTree.length > 0) {
      setSelectedTableLogPipeline(scopedPipelineTree[0]);
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
    if (!isAdmin) return;
    // Close any open modals
    setSelectedSidePaneItem(null);
    setSelectedHistoryPipeline(null);
    setSelectedSchedulePipeline(null);
    setSelectedSlaPipeline(null);
    setSelectedErrorActivity(null);
    setIsSchedulesOpen(false);
    setCurrentView('table-log-config');
  };

  const currentWorkspaceName = scopedPipelineTree[0]?.workspaceName || 
    scopedWorkspaces.find(w => w.id === workspaceId)?.displayName || 
    scopedWorkspaces.find(w => w.id === workspaceId)?.name || 
    'Current Workspace';

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
        onOpenTableLogConfig={isAdmin ? handleOpenTableLogConfig : null}
        user={profile}
        role={role}
        isAdmin={isAdmin}
        onOpenAdmin={() => isAdmin && setCurrentView('admin')}
        onSignOut={logout}
      />

      {/* Dynamic View: Table Logging Wizard (full page - Admin only) vs Fabric Shell */}
      {currentView === 'table-log-config' && isAdmin ? (
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
            isAdmin={isAdmin}
            onNavigateAdmin={() => setCurrentView('admin')}
            workspaceName={currentWorkspaceName}
            userRole={isAdmin ? 'Admin' : (role ? role.toUpperCase() : 'L1')}
          />

          {currentView === 'admin' && isAdmin ? (
            <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
              <AdminConsole
                onOpenTableConfig={(wsId) => {
                  setWorkspaceId(wsId);
                  setCurrentView('table-log-config');
                }}
              />
            </div>
          ) : currentView === 'table-logs' ? (
            <TableLogsPage
              workspaceId={workspaceId}
              workspaceName={currentWorkspaceName}
              pipeline={selectedTableLogPipeline || scopedPipelineTree[0]}
              pipelines={scopedPipelineTree}
              onSelectPipeline={(p) => setSelectedTableLogPipeline(p)}
              onOpenConfig={isAdmin ? handleOpenTableLogConfig : null}
              onBackToMonitoring={() => setCurrentView('monitoring')}
            />
          ) : (
            <main className="flex-1 overflow-y-auto bg-[#faf9f8] p-4 lg:p-6 space-y-3.5 max-w-[1700px] w-full mx-auto min-h-0">
              {/* Fabric Header Title & Workspace Selector */}
              <div className="space-y-0.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-1">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-[#242424]">
                      Monitoring hub
                    </h1>
                    <p className="text-xs text-[#605e5c] mt-0.5">
                      Track pipeline execution runs, activity telemetry, SLA alerts, and lakehouse data ingestion.
                    </p>
                  </div>

                  {/* Beside Monitoring Hub right end: Workspace Selector & Live Telemetry timestamp */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#605e5c]">Workspace:</span>
                      <WorkspaceSelector
                        currentWorkspaceId={workspaceId}
                        onSelectWorkspace={setWorkspaceId}
                        workspaces={scopedWorkspaces}
                        isLoadingPipelines={isLoading}
                        align="right"
                      />
                    </div>

                    {lastUpdated && (
                      <div className="text-[11px] text-[#797775] font-mono pl-3 border-l border-[#edebe9]">
                        Telemetry synced: {new Date(lastUpdated).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Unified Pipeline Tree Table with Command Bar & Metric Cards */}
              <PipelineTreeTable
                workspaceId={workspaceId}
                pipelines={scopedPipelineTree}
                metrics={scopedMetrics}
                dateFilter={dateFilter}
                dateFilterInfo={dateFilterInfo}
                onDateFilterChange={setDateFilter}
                onSelectError={handleSelectError}
                isLoading={isLoading}
                onRefresh={refresh}
                lastUpdated={lastUpdated}
                onOpenRunHistory={(pipeline) => setSelectedHistoryPipeline(pipeline)}
                onOpenSchedule={(pipeline) => setSelectedSchedulePipeline(pipeline)}
                onOpenSlaConfig={isAdmin ? (pipeline) => setSelectedSlaPipeline(pipeline) : null}
                onResolveIncident={resolveIncident}
                onOpenTableLogs={(pipeline) => handleOpenTableLogs(pipeline)}
                onOpenTableLogConfig={isAdmin ? handleOpenTableLogConfig : null}
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
        onOpenSlaConfig={isAdmin ? (pipe) => setSelectedSlaPipeline(pipe) : null}
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
