import React from 'react';
import { 
  Home, 
  Box, 
  Activity, 
  GitFork, 
  Database,
  Radio
} from 'lucide-react';

export default function FabricNavRail({ onOpenTableLogConfig, currentView = 'monitoring', onNavigateMonitoring }) {
  const isMonitoringActive = currentView === 'monitoring';
  const isConfigActive = currentView === 'table-log-config';

  return (
    <aside className="w-12 bg-[#f5f5f5] border-r border-[#edebe9] flex flex-col justify-between items-center py-2 shrink-0 z-30 select-none">
      {/* Top Nav Items */}
      <nav className="flex flex-col items-center space-y-1 w-full">
        {/* Home */}
        <button
          onClick={onNavigateMonitoring}
          title="Home"
          className="w-10 h-10 flex items-center justify-center rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb] transition relative group"
        >
          <Home className="w-5 h-5" />
          <span className="sr-only">Home</span>
        </button>

        {/* Workspaces */}
        <button
          onClick={onNavigateMonitoring}
          title="Workspaces"
          className="w-10 h-10 flex items-center justify-center rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb] transition relative group"
        >
          <Box className="w-5 h-5" />
          <span className="sr-only">Workspaces</span>
        </button>

        {/* Monitoring Hub */}
        <button
          onClick={onNavigateMonitoring}
          title={isMonitoringActive ? "Monitoring hub (Active)" : "Monitoring hub"}
          className={`w-10 h-10 flex items-center justify-center rounded transition relative group ${
            isMonitoringActive
              ? "bg-[#ffffff] text-[#0f6cbd] shadow-sm"
              : "text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb]"
          }`}
        >
          {isMonitoringActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0f6cbd]"></span>
          )}
          <Activity className={`w-5 h-5 ${isMonitoringActive ? "text-[#0f6cbd]" : ""}`} />
          <span className="sr-only">Monitoring hub</span>
        </button>

        {/* Real-Time Hub */}
        <button
          title="Real-Time hub"
          className="w-10 h-10 flex items-center justify-center rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb] transition relative group"
        >
          <Radio className="w-5 h-5" />
          <span className="sr-only">Real-Time hub</span>
        </button>

        {/* Data Pipelines */}
        <button
          onClick={onNavigateMonitoring}
          title="Data Pipelines"
          className="w-10 h-10 flex items-center justify-center rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb] transition relative group"
        >
          <GitFork className="w-5 h-5" />
          <span className="sr-only">Pipelines</span>
        </button>

        {/* Lakehouse / Warehouse Ingestion */}
        {onOpenTableLogConfig && (
          <button
            onClick={onOpenTableLogConfig}
            title={isConfigActive ? "Lakehouse Table Logs Configuration (Active)" : "Lakehouse Table Logs Configuration"}
            className={`w-10 h-10 flex items-center justify-center rounded transition relative group ${
              isConfigActive
                ? "bg-[#ffffff] text-[#0f6cbd] shadow-sm"
                : "text-[#605e5c] hover:text-[#0f6cbd] hover:bg-[#ebebeb]"
            }`}
          >
            {isConfigActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0f6cbd]"></span>
            )}
            <Database className={`w-5 h-5 ${isConfigActive ? "text-[#0f6cbd]" : ""}`} />
            <span className="sr-only">Lakehouse Logs</span>
          </button>
        )}
      </nav>

      {/* Bottom: Fabric Workload Experience Switcher */}
      <div className="flex flex-col items-center w-full pt-2 border-t border-[#edebe9]">
        <button
          title="Fabric Experience: Data Factory"
          className="w-10 h-10 flex items-center justify-center rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#008272] transition border border-[#e1dfdd] shadow-sm"
        >
          {/* Data Factory / Synapse stylized icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" fill="#008272" fillOpacity="0.2" />
            <rect x="14" y="3" width="7" height="7" rx="1" fill="#0f6cbd" fillOpacity="0.2" />
            <rect x="14" y="14" width="7" height="7" rx="1" fill="#008272" fillOpacity="0.2" />
            <path d="M7 10v4a2 2 0 0 0 2 2h5" />
          </svg>
          <span className="sr-only">Data Factory</span>
        </button>
      </div>
    </aside>
  );
}
