import React, { useState, useRef, useEffect } from 'react';
import { 
  RefreshCw, 
  Calendar, 
  Filter, 
  Search, 
  ChevronDown, 
  Check, 
  RotateCcw,
  Sparkles,
  Database
} from 'lucide-react';

export default function FabricCommandBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFilter = {},
  dateFilterInfo = {},
  onDateFilterChange,
  onRefresh,
  isLoading,
  lastUpdated,
  onOpenTableLogConfig
}) {
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const timeMenuRef = useRef(null);
  const statusMenuRef = useRef(null);

  const currentPreset = dateFilter?.preset || 'latest';
  const customDate = currentPreset === 'custom' ? dateFilter?.startDate : null;

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (timeMenuRef.current && !timeMenuRef.current.contains(e.target)) {
        setIsTimeDropdownOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timePresets = [
    { id: 'latest', label: 'Latest runs' },
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'tomorrow', label: 'Tomorrow (Upcoming forecast)', isForecast: true },
    { id: 'last_week', label: 'Last 7 days' },
    { id: 'next_week', label: 'Next 7 days (Upcoming forecast)', isForecast: true }
  ];

  const statusOptions = [
    { id: 'ALL', label: 'All statuses' },
    { id: 'RUNNING', label: 'In progress' },
    { id: 'SUCCEEDED', label: 'Completed' },
    { id: 'FAILED', label: 'Failed' },
    { id: 'CANCELLED', label: 'Cancelled' },
    { id: 'NO_RUNS', label: 'Not run' }
  ];

  const getTimeLabel = () => {
    if (currentPreset === 'custom') {
      return `Date: ${customDate || 'Custom'}`;
    }
    const found = timePresets.find(p => p.id === currentPreset);
    return found ? found.label : 'Time range';
  };

  const getStatusLabel = () => {
    const found = statusOptions.find(s => s.id === statusFilter);
    return found ? found.label : 'Status';
  };

  return (
    <div className="bg-[#ffffff] border border-[#edebe9] rounded px-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 select-none shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      {/* Left Command Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Refresh Command */}
        <button
          onClick={onRefresh}
          title="Refresh activities from Fabric"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-[#323130] hover:text-[#242424] hover:bg-[#f3f2f1] transition border border-transparent hover:border-[#edebe9]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#0f6cbd]" : "text-[#605e5c]"}`} />
          <span>Refresh</span>
        </button>

        <div className="h-4 w-[1px] bg-[#edebe9] hidden sm:block mx-0.5"></div>

        {/* Time Window Dropdown */}
        <div className="relative" ref={timeMenuRef}>
          <button
            onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition border ${
              currentPreset !== 'latest'
                ? 'bg-[#eff6fc] border-[#0f6cbd]/40 text-[#0f6cbd]'
                : 'text-[#323130] hover:text-[#242424] hover:bg-[#f3f2f1] border-transparent hover:border-[#edebe9]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>{getTimeLabel()}</span>
            <ChevronDown className={`w-3 h-3 text-[#605e5c] transition-transform ${isTimeDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {isTimeDropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 rounded bg-[#ffffff] border border-[#edebe9] shadow-xl z-50 overflow-hidden py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] border-b border-[#edebe9] bg-[#faf9f8]">
                Execution Time Window
              </div>
              {timePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onDateFilterChange({ preset: preset.id, startDate: null, endDate: null });
                    setIsTimeDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition ${
                    currentPreset === preset.id
                      ? 'bg-[#eff6fc] text-[#0f6cbd] font-medium'
                      : 'text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {preset.isForecast ? (
                      <Sparkles className="w-3 h-3 text-[#008272]" />
                    ) : (
                      <span className="w-3 h-3"></span>
                    )}
                    <span>{preset.label}</span>
                  </div>
                  {currentPreset === preset.id && <Check className="w-3.5 h-3.5 text-[#0f6cbd]" />}
                </button>
              ))}

              <div className="border-t border-[#edebe9] pt-1.5 mt-1 px-3 pb-2 bg-[#faf9f8]">
                <span className="text-[11px] text-[#605e5c] block mb-1">Specific calendar date:</span>
                <input
                  type="date"
                  value={customDate || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      onDateFilterChange({ preset: 'custom', startDate: v, endDate: v });
                      setIsTimeDropdownOpen(false);
                    }
                  }}
                  className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-2 py-1 text-xs text-[#242424] focus:outline-none focus:border-[#0f6cbd] cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative" ref={statusMenuRef}>
          <button
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-medium transition border ${
              statusFilter !== 'ALL'
                ? 'bg-[#eff6fc] border-[#0f6cbd]/40 text-[#0f6cbd]'
                : 'text-[#323130] hover:text-[#242424] hover:bg-[#f3f2f1] border-transparent hover:border-[#edebe9]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-[#605e5c]" />
            <span>{getStatusLabel()}</span>
            <ChevronDown className={`w-3 h-3 text-[#605e5c] transition-transform ${isStatusDropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute left-0 mt-1 w-48 rounded bg-[#ffffff] border border-[#edebe9] shadow-xl z-50 overflow-hidden py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#605e5c] border-b border-[#edebe9] bg-[#faf9f8]">
                Filter by Status
              </div>
              {statusOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onStatusFilterChange(opt.id);
                    setIsStatusDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition ${
                    statusFilter === opt.id
                      ? 'bg-[#eff6fc] text-[#0f6cbd] font-medium'
                      : 'text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {statusFilter === opt.id && <Check className="w-3.5 h-3.5 text-[#0f6cbd]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset Filter Button if active */}
        {(currentPreset !== 'latest' || statusFilter !== 'ALL' || search) && (
          <button
            onClick={() => {
              onDateFilterChange({ preset: 'latest', startDate: null, endDate: null });
              onStatusFilterChange('ALL');
              onSearchChange('');
            }}
            title="Reset filters to default"
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
          >
            <RotateCcw className="w-3 h-3 text-[#0f6cbd]" />
            <span>Reset filters</span>
          </button>
        )}

      </div>

      {/* Right: Table Keyword Search */}
      <div className="relative w-full md:w-64">
        <Search className="w-3.5 h-3.5 text-[#797775] absolute left-2.5 top-2.5" />
        <input
          type="text"
          placeholder="Filter by keyword..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#ffffff] border border-[#d1d1d1] focus:border-[#0f6cbd] text-xs text-[#242424] placeholder-[#797775] rounded pl-8 pr-7 py-1.5 transition focus:outline-none"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            title="Clear filter"
            className="absolute right-2 top-1.5 text-xs text-[#797775] hover:text-[#242424]"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
