import React from 'react';
import { 
  WifiOff, 
  RefreshCw, 
  Search,
  ShieldCheck,
  LogOut
} from 'lucide-react';

const ROLE_LABELS = { admin: 'Admin', l1: 'L1 Support', l2: 'L2 Support', none: 'No access' };

function initialsFor(user) {
  const source = user?.name || user?.email || 'User';
  const parts = source.replace(/@.*/, '').split(/[.\s_-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] || 'U') + (parts[1]?.[0] || '');
  return letters.toUpperCase();
}

export default function FabricSuiteBar({
  currentView = 'monitoring',
  currentWorkspaceId,
  onSelectWorkspace,
  isConnected,
  viewersCount,
  lastUpdated,
  onRefresh,
  isLoading,
  onOpenTableLogConfig,
  user = null,
  role = 'none',
  isAdmin = false,
  onOpenAdmin,
  onSignOut
}) {
  return (
    <header className="h-12 bg-[#ffffff] border-b border-[#edebe9] text-[#242424] flex items-center justify-between px-4 sticky top-0 z-40 select-none shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Left: Microsoft Fabric Branding */}
      <div className="flex items-center gap-3">
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
          
          <span className="text-sm font-semibold text-[#242424] tracking-tight">
            Microsoft Fabric
          </span>
          <span className="text-[#d1d1d1] font-light text-sm hidden sm:inline">|</span>
          <span className="text-sm text-[#605e5c] font-normal hidden sm:inline">
            {currentView === 'table-logs' ? 'Table logs' : currentView === 'table-log-config' ? 'Table log configuration' : currentView === 'admin' ? 'Admin console' : 'Monitoring hub'}
          </span>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-lg mx-6">
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

      {/* Right Controls: Live Telemetry + Refresh + User Profile */}
      <div className="flex items-center gap-2">
        {/* Live Sync telemetry status badge */}
        {currentWorkspaceId && (
          <div 
            title={isConnected ? `Live WebSocket Telemetry connected • ${viewersCount} active viewer(s)` : "Reconnecting to live telemetry..."}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
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
          className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition flex items-center justify-center border border-transparent hover:border-[#edebe9]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#0f6cbd]" : ""}`} />
        </button>

        {/* User Info & Admin Badge */}
        <div className="flex items-center border-l border-[#edebe9] pl-2 ml-1 space-x-1.5">
          {/* Role badge */}
          <span
            title={`Signed in as ${ROLE_LABELS[role] || 'User'}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/30"
          >
            <ShieldCheck className="w-3 h-3" />
            {ROLE_LABELS[role] || 'User'}
          </span>

          {/* User Profile Avatar */}
          <div 
            title={user?.email ? `Signed in as ${user.email}` : 'Signed in'}
            className="w-7 h-7 rounded-full bg-[#0f6cbd] text-white flex items-center justify-center text-[11px] font-semibold border border-[#0f6cbd]/40 shadow-xs"
          >
            {initialsFor(user)}
          </div>

          {/* Sign out */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              title="Sign out"
              className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#a4262c] transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
