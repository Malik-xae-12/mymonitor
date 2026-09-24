import React from 'react';
import FabricSuiteBar from './FabricSuiteBar';
import FabricNavRail from './FabricNavRail';
import FabricDetailSidePane from './FabricDetailSidePane';

export default function DashboardLayout({
  profile,
  role,
  isAdmin,
  onLogout,
  currentView,
  onViewChange,
  workspaces = [],
  selectedWorkspaceId,
  onSelectWorkspace,
  isConnected,
  lastUpdated,
  viewersCount,
  onRefresh,
  selectedSidePaneItem,
  onCloseSidePane,
  onOpenTableLogs,
  onOpenSchedules,
  onOpenHistory,
  onOpenSlaConfig,
  children
}) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#faf9f8] text-[#242424]">
      {/* Top Suite Bar */}
      <FabricSuiteBar 
        profile={profile} 
        onLogout={onLogout} 
        isAdmin={isAdmin}
        currentView={currentView}
        onViewChange={onViewChange}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left Navigation Rail */}
        <FabricNavRail 
          currentView={currentView} 
          onViewChange={onViewChange} 
          isAdmin={isAdmin}
        />

        {/* View Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {children}
        </main>

        {/* Optional Right Slide-over Side Pane */}
        {selectedSidePaneItem && (
          <FabricDetailSidePane
            item={selectedSidePaneItem}
            onClose={onCloseSidePane}
            onOpenTableLogs={onOpenTableLogs}
            onOpenSchedules={onOpenSchedules}
            onOpenHistory={onOpenHistory}
            onOpenSlaConfig={onOpenSlaConfig}
          />
        )}
      </div>
    </div>
  );
}
