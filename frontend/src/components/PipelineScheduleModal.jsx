import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Globe, 
  RefreshCw, 
  Loader2,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-xl bg-[#ffffff] border border-[#edebe9] rounded shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#c7e0f4] shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[#242424] text-sm truncate">
                  Pipeline Schedules
                </h3>
                {allSchedules.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#eff6fc] text-[#0f6cbd] border border-[#c7e0f4]">
                    {allSchedules.length} {allSchedules.length === 1 ? 'Schedule' : 'Schedules'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#605e5c] font-mono mt-0.5 truncate">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchSchedule}
              className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
              title="Refresh schedules from Fabric"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0f6cbd]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 bg-[#faf9f8]">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#605e5c] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#0f6cbd]" />
              <span>Querying Microsoft Fabric for pipeline recurrence rules...</span>
            </div>
          ) : allSchedules.length > 0 ? (
            <div className="space-y-3">
              {/* Overall Status Banner */}
              <div
                className={`p-3 rounded border flex items-center justify-between ${
                  scheduleData.enabled
                    ? 'bg-[#dff6dd] border-[#92c353] text-[#107c41]'
                    : 'bg-[#ffffff] border-[#edebe9] text-[#605e5c]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {scheduleData.enabled ? (
                    <CheckCircle2 className="w-4 h-4 text-[#107c41] shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#605e5c] shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold">
                      {scheduleData.enabled ? 'Schedules Active' : 'Schedules Disabled'}
                    </div>
                    <div className="text-[11px] opacity-85">
                      {scheduleData.enabled
                        ? `${allSchedules.filter(s => s.enabled).length} of ${allSchedules.length} automated execution triggers enabled in Fabric.`
                        : 'Configured triggers are currently paused in Fabric.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Multiple Schedules List */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider block">
                  {hasMultiple ? `Configured Schedules (${allSchedules.length})` : 'Schedule Configuration'}
                </span>

                {allSchedules.map((s, idx) => (
                  <div 
                    key={s.id || `sched-${idx}`}
                    className="p-3 rounded border border-[#edebe9] bg-[#ffffff] space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Repeat className="w-3.5 h-3.5 text-[#0f6cbd]" />
                        <span className="font-semibold text-xs text-[#242424]">
                          {hasMultiple ? `Schedule #${idx + 1}` : 'Trigger Schedule'}: {s.scheduleType}
                        </span>
                      </div>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-medium ${
                        s.enabled 
                          ? 'bg-[#dff6dd] text-[#107c41] border border-[#92c353]'
                          : 'bg-[#f3f2f1] text-[#605e5c] border border-[#d1d1d1]'
                      }`}>
                        {s.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                        <span className="text-[10px] uppercase text-[#605e5c] block font-sans">Type</span>
                        <span className="text-[#242424] font-medium">{s.scheduleType}</span>
                      </div>

                      <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                        <span className="text-[10px] uppercase text-[#605e5c] block font-sans">Timezone</span>
                        <span className="text-[#242424] flex items-center gap-1 font-medium">
                          <Globe className="w-3 h-3 text-[#605e5c]" />
                          <span>{s.timeZone || 'UTC'}</span>
                        </span>
                      </div>

                      {s.times && s.times.length > 0 && (
                        <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                          <span className="text-[10px] uppercase text-[#605e5c] block font-sans">Times</span>
                          <span className="text-[#0f6cbd] font-semibold">{s.times.join(', ')}</span>
                        </div>
                      )}

                      {s.days && s.days.length > 0 && (
                        <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                          <span className="text-[10px] uppercase text-[#605e5c] block font-sans">Days</span>
                          <span className="text-[#0078d4] font-semibold">{s.days.join(', ')}</span>
                        </div>
                      )}

                      {s.nextRunTime && (
                        <div className="col-span-2 p-2 rounded bg-[#eff6fc] border border-[#c7e0f4] text-[#0f6cbd] flex items-center justify-between">
                          <span className="text-[11px] font-sans font-medium text-[#242424]">Next Scheduled Run:</span>
                          <span className="font-semibold font-mono">{formatDateTime(s.nextRunTime)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center space-y-2 bg-[#ffffff] rounded border border-[#edebe9]">
              <div className="w-10 h-10 rounded-full bg-[#f3f2f1] border border-[#d1d1d1] flex items-center justify-center mx-auto text-[#605e5c]">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-[#242424] text-xs">No Active Schedules Configured</h4>
                <p className="text-[11px] text-[#605e5c] max-w-sm mx-auto">
                  This pipeline runs manually on-demand or when invoked by parent master pipelines.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#d1d1d1] text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
