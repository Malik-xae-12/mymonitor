import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Database,
  Search,
  Settings,
  Bell,
  HelpCircle,
  MessageSquareQuote
} from 'lucide-react';
import WorkspaceSelector from './WorkspaceSelector';

export default function FabricSuiteBar({
  currentWorkspaceId,
  onSelectWorkspace,
  isConnected,
  viewersCount,
  lastUpdated,
  onRefresh,
  isLoading,
  onOpenTableLogConfig
}) {
  return (
    <header className="h-12 bg-[#ffffff] border-b border-[#edebe9] text-[#242424] flex items-center justify-between px-3 sticky top-0 z-40 select-none shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Left: 365 Waffle + Microsoft Fabric Branding */}
      <div className="flex items-center gap-2.5">
        {/* Microsoft 365 Waffle (9-dots) */}
        <button 
          title="App launcher"
          className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition"
        >
          <div className="grid grid-cols-3 gap-[3px] w-4 h-4 p-0.5">
            {[...Array(9)].map((_, i) => (
              <span key={i} className="w-[3px] h-[3px] rounded-[0.5px] bg-current"></span>
            ))}
          </div>
        </button>

        {/* Microsoft Fabric Logo Glyph */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="fabric_grad_light1" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1177D7" />
                <stop offset="50%" stopColor="#00A2ED" />
                <stop offset="100%" stopColor="#00B7C3" />
              </linearGradient>
              <linearGradient id="fabric_grad_light2" x1="16" y1="4" x2="16" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path d="M16 3 L29 16 L16 29 L3 16 Z" fill="url(#fabric_grad_light1)" />
            <path d="M16 7 L25 16 L16 25 L7 16 Z" fill="url(#fabric_grad_light2)" />
          </svg>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#242424] tracking-tight">
              Microsoft Fabric
            </span>
            <span className="text-[#d1d1d1] font-light text-sm hidden sm:inline">|</span>
            <span className="text-sm text-[#605e5c] font-normal hidden sm:inline">
              Monitoring hub
            </span>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-lg mx-4">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-[#797775] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Microsoft Fabric"
            className="w-full bg-[#f3f2f1] hover:bg-[#ebebeb] focus:bg-[#ffffff] border border-transparent focus:border-[#0f6cbd] focus:ring-1 focus:ring-[#0f6cbd] text-xs text-[#242424] placeholder-[#797775] rounded pl-8 pr-14 py-1.5 transition focus:outline-none"
          />
          <span className="absolute right-2.5 top-2 text-[10px] text-[#797775] font-mono border border-[#d1d1d1] rounded px-1.5 py-0.2 bg-[#ffffff]">
            Ctrl+/
          </span>
        </div>
      </div>

      {/* Right Controls: Workspace Selector + Live Telemetry + Suite Actions */}
      <div className="flex items-center gap-2">
        {/* Workspace Selector */}
        <WorkspaceSelector
          currentWorkspaceId={currentWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
        />

        {/* Live Sync telemetry status badge */}
        {currentWorkspaceId && (
          <div 
            title={isConnected ? `Live WebSocket Telemetry connected • ${viewersCount} active viewer(s)` : "Reconnecting to live telemetry..."}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
              isConnected 
                ? 'bg-[#dff6dd] text-[#107c41] border-[#107c41]/30'
                : 'bg-[#fde7e9] text-[#a4262c] border-[#a4262c]/30'
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#107c41] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#107c41]"></span>
                </span>
                <span>Live</span>
                {viewersCount > 0 && (
                  <span className="text-[#605e5c] text-[10px] ml-0.5 font-mono">
                    ({viewersCount})
                  </span>
                )}
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-[#a4262c]" />
                <span>Offline</span>
              </>
            )}
          </div>
        )}

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title={lastUpdated ? `Sync with Fabric • Last synced: ${new Date(lastUpdated).toLocaleTimeString()}` : "Manual Fabric Poll Sync"}
          className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition flex items-center justify-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#0f6cbd]" : ""}`} />
        </button>

        {/* Lakehouse Table Log Configuration */}
        {currentWorkspaceId && onOpenTableLogConfig && (
          <button
            onClick={onOpenTableLogConfig}
            title="Configure Lakehouse/Warehouse table-level logging"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-[#f3f2f1] text-[#323130] hover:text-[#008272] transition text-xs font-normal border border-transparent hover:border-[#edebe9]"
          >
            <Database className="w-3.5 h-3.5 text-[#008272]" />
            <span className="hidden xl:inline">Table Log Config</span>
          </button>
        )}

        {/* Fluent Suite Icons */}
        <div className="flex items-center border-l border-[#edebe9] pl-1 ml-0.5 space-x-0.5">
          <button 
            title="Feedback" 
            className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition hidden sm:flex"
          >
            <MessageSquareQuote className="w-4 h-4" />
          </button>
          
          <button 
            title="Settings" 
            onClick={onOpenTableLogConfig}
            className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button 
            title="Help" 
            className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition hidden sm:flex"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div 
            title="Signed in as Fabric Administrator"
            className="w-7 h-7 rounded-full bg-[#0f6cbd] hover:bg-[#115ea3] text-white flex items-center justify-center text-[11px] font-semibold border border-[#0f6cbd]/40 ml-1 cursor-pointer transition shadow-sm"
          >
            FA
          </div>
        </div>
      </div>
    </header>
  );
}
