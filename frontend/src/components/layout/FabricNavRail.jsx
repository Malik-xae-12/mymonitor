import React from 'react';
import { 
  Activity, 
  Database,
  ShieldCheck
} from 'lucide-react';

export default function FabricNavRail({ 
  currentView = 'monitoring', 
  onNavigateMonitoring,
  isAdmin = false,
  onNavigateAdmin,
  workspaceName = 'Current Workspace'
}) {
  const isMonitoringActive = currentView === 'monitoring' || currentView === 'table-logs';
  const isAdminActive = currentView === 'admin';

  return (
    <aside className="w-52 bg-[#f5f5f5] border-r border-[#edebe9] flex flex-col justify-between p-2.5 shrink-0 z-30 select-none font-sans">
      {/* Top Nav: App Sections */}
      <div className="space-y-3">
        {/* Navigation Category Header */}
        <div className="px-2 pt-1">
          <span className="text-[10px] font-bold text-[#797775] uppercase tracking-wider block">
            Navigation
          </span>
        </div>

        <nav className="space-y-1">
          {/* L1: Monitoring Hub (Pipelines Telemetry) */}
          <button
            type="button"
            onClick={onNavigateMonitoring}
            title="Monitoring hub (Data Pipelines Telemetry)"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition relative group text-left ${
              isMonitoringActive
                ? "bg-white text-[#0f6cbd] font-semibold shadow-xs border border-[#edebe9]"
                : "text-[#323130] hover:text-[#242424] hover:bg-[#ebebeb] font-medium"
            }`}
          >
            {isMonitoringActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#0f6cbd]" />
            )}
            <Activity className={`w-4 h-4 shrink-0 ${isMonitoringActive ? "text-[#0f6cbd]" : "text-[#605e5c]"}`} />
            <span className="truncate flex-1">Monitoring hub</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
              isMonitoringActive 
                ? "bg-[#ebf3fc] text-[#0f6cbd]" 
                : "bg-[#e1dfdd] text-[#605e5c]"
            }`}>
              L1
            </span>
          </button>

          {/* Admin Console (Pipeline L1/L2 Teams, Access & Users) */}
          {isAdmin && (
            <button
              type="button"
              onClick={onNavigateAdmin}
              title="Admin console (Pipeline Teams & User Roles)"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition relative group text-left ${
                isAdminActive
                  ? "bg-white text-[#773adc] font-semibold shadow-xs border border-[#edebe9]"
                  : "text-[#323130] hover:text-[#242424] hover:bg-[#ebebeb] font-medium"
              }`}
            >
              {isAdminActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#773adc]" />
              )}
              <ShieldCheck className={`w-4 h-4 shrink-0 ${isAdminActive ? "text-[#773adc]" : "text-[#605e5c]"}`} />
              <span className="truncate flex-1">Admin console</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                isAdminActive 
                  ? "bg-[#f3e8ff] text-[#773adc]" 
                  : "bg-[#e1dfdd] text-[#605e5c]"
              }`}>
                Admin
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Bottom: Current Scope Indicator */}
      <div className="pt-2 border-t border-[#edebe9] px-2">
        <div className="flex items-center gap-1.5 text-[11px] text-[#605e5c]">
          <Database className="w-3.5 h-3.5 text-[#008272] shrink-0" />
          <span className="truncate font-medium text-[#242424]" title={workspaceName}>
            {workspaceName}
          </span>
        </div>
      </div>
    </aside>
  );
}

