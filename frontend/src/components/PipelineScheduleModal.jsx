import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Globe, 
  RefreshCw, 
  Loader2,
  Layers,
  Repeat
} from 'lucide-react';
import { formatDateTime } from './PipelineRow';

export default function PipelineScheduleModal({ workspaceId, pipeline, isOpen, onClose }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSchedule = async () => {
    if (!isOpen || !pipeline || !workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipeline.pipelineId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        setScheduleData(data);
      }
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [isOpen, pipeline, workspaceId]);

  if (!isOpen || !pipeline) return null;

  const allSchedules = scheduleData?.schedules || [];
  const hasMultiple = allSchedules.length > 1;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base truncate">
                  Pipeline Schedules
                </h3>
                {allSchedules.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {allSchedules.length} {allSchedules.length === 1 ? 'Schedule' : 'Schedules'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSchedule}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh schedules from Fabric"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              <span>Querying Microsoft Fabric for pipeline schedules...</span>
            </div>
          ) : allSchedules.length > 0 ? (
            <div className="space-y-4">
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  scheduleData.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {scheduleData.enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">
                      {scheduleData.enabled ? 'Schedules Active' : 'Schedules Disabled'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {scheduleData.enabled
                        ? `${allSchedules.filter(s => s.enabled).length} of ${allSchedules.length} automated execution triggers enabled in Fabric.`
                        : 'Configured triggers are currently paused in Fabric.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multiple Schedules List */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  {hasMultiple ? `All Configured Schedules (${allSchedules.length})` : 'Schedule Configuration'}
                </span>

                {allSchedules.map((s, idx) => (
                  <div 
                    key={s.id || `sched-${idx}`}
                    className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-sm text-slate-100">
                          {hasMultiple ? `Schedule #${idx + 1}` : 'Trigger Schedule'}: {s.scheduleType}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        s.enabled 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {s.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase text-slate-500 block font-sans">Type</span>
                        <span className="text-slate-200 font-semibold">{s.scheduleType}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] uppercase text-slate-500 block font-sans">Timezone</span>
                        <span className="text-slate-200 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-slate-400" />
                          <span>{s.timeZone || 'UTC'}</span>
                        </span>
                      </div>

                      {s.times && s.times.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-[10px] uppercase text-slate-500 block font-sans">Execution Times</span>
                          <span className="text-purple-300">{s.times.join(', ')}</span>
                        </div>
                      )}

                      {s.days && s.days.length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
                          <span className="text-[10px] uppercase text-slate-500 block font-sans">Days of Week</span>
                          <span className="text-cyan-300">{s.days.join(', ')}</span>
                        </div>
                      )}

                      {s.nextRunTime && (
                        <div className="col-span-2 p-2.5 rounded-lg bg-purple-950/20 border border-purple-500/30 text-purple-300 flex items-center justify-between">
                          <span className="text-[11px] font-sans">Next Scheduled Run:</span>
                          <span className="font-bold">{formatDateTime(s.nextRunTime)}</span>
                        </div>
                      )}

                      {(s.startDate || s.endDate) && (
                        <div className="col-span-2 text-[10px] text-slate-500 flex items-center justify-between px-1">
                          {s.startDate && <span>Starts: {s.startDate.slice(0, 10)}</span>}
                          {s.endDate && <span>Ends: {s.endDate.slice(0, 10)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw config summary */}
              {scheduleData.rawConfiguration && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Fabric Recurrence Payload
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-36">
                    {JSON.stringify(scheduleData.rawConfiguration, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
                <Clock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-200 text-sm">No Active Schedules Configured</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  This pipeline runs manually on-demand or when invoked by parent pipelines. To automate runs, configure schedules in the Microsoft Fabric pipeline settings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
