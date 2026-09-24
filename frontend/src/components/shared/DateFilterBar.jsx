import React, { useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  PlayCircle, 
  Ban, 
  Layers, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CalendarDays
} from 'lucide-react';

export default function DateFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  metrics = {},
  dateFilter = {},
  dateFilterInfo = {},
  onDateFilterChange,
  workspaceId
}) {
  const isFuture = !!dateFilterInfo?.isFuture;
  const availableRunDates = new Set(dateFilterInfo?.availableRunDates || []);

  // Compute 15-day range: 7 days before today to 7 days after today (covers Last Week to Next Week)
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [today]);

  const daysList = useMemo(() => {
    const list = [];
    for (let i = -7; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      let label = weekday;
      if (i === -1) label = 'Yest';
      else if (i === 0) label = 'Today';
      else if (i === 1) label = 'Tom';

      list.push({
        offset: i,
        dateObj: d,
        iso,
        weekday,
        monthDay,
        dayNum: d.getDate(),
        label,
        isPast: i < 0,
        isToday: i === 0,
        isFuture: i > 0,
        hasRuns: availableRunDates.has(iso)
      });
    }
    return list;
  }, [today, availableRunDates]);

  // Determine current active preset / selected date
  const currentPreset = dateFilter?.preset || 'latest';
  const customSelectedIso = currentPreset === 'custom' ? dateFilter?.startDate : null;

  const handlePresetSelect = (presetKey) => {
    if (presetKey === 'custom') return;
    onDateFilterChange({
      preset: presetKey,
      startDate: null,
      endDate: null
    });
  };

  const handleDaySelect = (dayIso) => {
    onDateFilterChange({
      preset: 'custom',
      startDate: dayIso,
      endDate: dayIso
    });
  };

  const handleDateInput = (e) => {
    const val = e.target.value;
    if (val) {
      onDateFilterChange({
        preset: 'custom',
        startDate: val,
        endDate: val
      });
    }
  };

  // Human-readable caption
  const getContextCaption = () => {
    if (currentPreset === 'latest') {
      return "Live Main View: Displaying the latest execution for each master pipeline with nested child activities.";
    }
    if (currentPreset === 'yesterday') {
      return `Executions for Yesterday (${dateFilterInfo?.startDate || 'Previous Day'}): Showing pipelines that ran yesterday.`;
    }
    if (currentPreset === 'today') {
      return `Executions for Today (${todayIso}): Showing real-time executions triggered today.`;
    }
    if (currentPreset === 'tomorrow') {
      return `Schedule Forecast for Tomorrow (${dateFilterInfo?.startDate || 'Next Day'}): Showing pipelines scheduled to execute tomorrow.`;
    }
    if (currentPreset === 'last_week') {
      return `Historical Runs for Last Week (${dateFilterInfo?.startDate} to ${dateFilterInfo?.endDate}): Aggregate execution window.`;
    }
    if (currentPreset === 'next_week') {
      return `Schedule Forecast for Next Week (${dateFilterInfo?.startDate} to ${dateFilterInfo?.endDate}): Upcoming pipeline schedule triggers.`;
    }
    if (currentPreset === 'custom') {
      if (isFuture) {
        return `Schedule Forecast for ${dateFilter?.startDate}: Evaluated against pipeline recurrence rules.`;
      }
      return `Executions for ${dateFilter?.startDate}: Showing pipelines that executed on this date.`;
    }
    return "Filtered execution view.";
  };

  return (
    <div className="space-y-3.5 bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      {/* 1. Top Controls: Search by Name + Quick Presets + Date Picker */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search pipelines or activities by name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition shadow-inner"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-slate-300 transition"
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick Date Range Presets */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { id: 'last_week', label: 'Last Week' },
            { id: 'yesterday', label: 'Last Day (Yesterday)' },
            { id: 'today', label: 'Today' },
            { id: 'tomorrow', label: 'Next Day (Tomorrow)' },
            { id: 'next_week', label: 'Next Week' },
            { id: 'latest', label: 'Latest / All' }
          ].map((preset) => {
            const isActive = currentPreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handlePresetSelect(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 shadow-sm ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-blue-500/20 ring-1 ring-blue-400'
                    : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/80'
                }`}
              >
                {preset.id === 'tomorrow' || preset.id === 'next_week' ? (
                  <Sparkles className="w-3 h-3 text-cyan-300" />
                ) : (
                  <Calendar className="w-3 h-3" />
                )}
                <span>{preset.label}</span>
              </button>
            );
          })}

          {/* Direct Calendar Date Input */}
          <div className="flex items-center gap-1 pl-1">
            <input
              type="date"
              title="Pick any specific calendar date"
              value={customSelectedIso || ''}
              onChange={handleDateInput}
              className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. Interactive Day-by-Day Strip (Covering Last Week to Next Week) */}
      <div className="pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
            <span>Day-by-Day Navigator (Last Week → Next Week)</span>
          </span>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Recorded Runs
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              Future Forecast
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-1.5 overflow-x-auto py-1">
          {daysList.map((day) => {
            const isSelected = currentPreset === 'custom' && customSelectedIso === day.iso;
            return (
              <button
                key={day.iso}
                onClick={() => handleDaySelect(day.iso)}
                className={`flex flex-col items-center justify-center p-2 rounded-xl transition border text-center relative group min-w-[54px] ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                    : day.isToday
                    ? 'bg-slate-950 border-blue-500/50 text-blue-300 hover:bg-slate-800'
                    : day.hasRuns
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40'
                    : day.isFuture
                    ? 'bg-purple-950/10 border-purple-500/20 text-purple-300 hover:bg-purple-950/30'
                    : 'bg-slate-950/50 border-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className="text-[10px] font-semibold uppercase opacity-80">
                  {day.label}
                </span>
                <span className="text-sm font-bold font-mono">
                  {day.dayNum}
                </span>

                {/* Runs or forecast indicator dot */}
                {day.hasRuns && !isSelected && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-emerald-900 animate-pulse"></span>
                )}
                {day.isFuture && !day.hasRuns && !isSelected && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-400/80"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Context Caption Bar */}
      <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-slate-400">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isFuture ? 'bg-purple-400 animate-pulse' : 'bg-blue-400'}`}></span>
          <span>{getContextCaption()}</span>
        </div>
        {currentPreset !== 'latest' && (
          <button
            onClick={() => handlePresetSelect('latest')}
            className="flex items-center gap-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Live</span>
          </button>
        )}
      </div>

      {/* 4. Dynamic Metric Cards & Filter Tabs (Driven by Selected Date) */}
      <div className="pt-2 border-t border-slate-800/60">
        {!isFuture ? (
          /* Past / Present Metrics Row */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { id: 'ALL', label: 'All Pipelines', count: metrics.total ?? 0, color: 'slate', icon: Layers },
              { id: 'RUNNING', label: 'Running', count: metrics.running ?? 0, color: 'blue', icon: PlayCircle },
              { id: 'SUCCEEDED', label: 'Succeeded', count: metrics.succeeded ?? 0, color: 'emerald', icon: CheckCircle2 },
              { id: 'FAILED', label: 'Failed', count: metrics.failed ?? 0, color: 'rose', icon: XCircle },
              { id: 'CANCELLED', label: 'Cancelled', count: metrics.cancelled ?? 0, color: 'amber', icon: Ban },
              { id: 'NO_RUNS', label: 'Not Run', count: metrics.notRun ?? 0, color: 'slate-subtle', icon: Clock }
            ].map((tab) => {
              const isTabActive = statusFilter === tab.id;
              const Icon = tab.icon;

              let colorClasses = 'bg-slate-950/60 border-slate-800 text-slate-300';
              let badgeColor = 'text-slate-100';

              if (tab.color === 'blue') {
                colorClasses = isTabActive 
                  ? 'bg-blue-600/30 border-blue-500 text-blue-200 ring-1 ring-blue-400' 
                  : 'bg-blue-950/20 border-blue-500/20 text-blue-400 hover:bg-blue-900/30';
                badgeColor = 'text-blue-300';
              } else if (tab.color === 'emerald') {
                colorClasses = isTabActive 
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-200 ring-1 ring-emerald-400' 
                  : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 hover:bg-emerald-900/30';
                badgeColor = 'text-emerald-300';
              } else if (tab.color === 'rose') {
                colorClasses = isTabActive 
                  ? 'bg-rose-600/30 border-rose-500 text-rose-200 ring-1 ring-rose-400' 
                  : 'bg-rose-950/20 border-rose-500/20 text-rose-400 hover:bg-rose-900/30';
                badgeColor = 'text-rose-300';
              } else if (tab.color === 'amber') {
                colorClasses = isTabActive 
                  ? 'bg-amber-600/30 border-amber-500 text-amber-200 ring-1 ring-amber-400' 
                  : 'bg-amber-950/20 border-amber-500/20 text-amber-400 hover:bg-amber-900/30';
                badgeColor = 'text-amber-300';
              } else {
                colorClasses = isTabActive 
                  ? 'bg-slate-800 border-slate-600 text-white ring-1 ring-slate-400' 
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/80';
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition text-left ${colorClasses}`}
                >
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </span>
                  <span className={`text-sm font-mono font-bold ${badgeColor}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Future Forecast Metrics Row */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'ALL', label: 'Total Pipelines', count: metrics.total ?? 0, color: 'slate', icon: Layers },
              { id: 'SCHEDULED', label: 'Scheduled to Run', count: metrics.scheduled ?? 0, color: 'purple', icon: Sparkles },
              { id: 'NOT_SCHEDULED', label: 'Not Scheduled', count: metrics.notScheduled ?? 0, color: 'slate-subtle', icon: Clock }
            ].map((tab) => {
              const isTabActive = statusFilter === tab.id;
              const Icon = tab.icon;

              let colorClasses = 'bg-slate-950/60 border-slate-800 text-slate-300';
              let badgeColor = 'text-slate-100';

              if (tab.color === 'purple') {
                colorClasses = isTabActive 
                  ? 'bg-purple-600/30 border-purple-500 text-purple-200 ring-1 ring-purple-400' 
                  : 'bg-purple-950/20 border-purple-500/30 text-purple-400 hover:bg-purple-900/30';
                badgeColor = 'text-purple-300';
              } else {
                colorClasses = isTabActive 
                  ? 'bg-slate-800 border-slate-600 text-white ring-1 ring-slate-400' 
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/80';
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => onStatusFilterChange(tab.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition text-left ${colorClasses}`}
                >
                  <span className="text-xs font-semibold flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </span>
                  <span className={`text-base font-mono font-bold ${badgeColor}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

