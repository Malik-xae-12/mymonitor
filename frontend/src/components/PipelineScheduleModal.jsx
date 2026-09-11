import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, AlertCircle, Globe, RefreshCw, Loader2 } from 'lucide-react';
import { formatDateTime } from './PipelineRow';

export default function PipelineScheduleModal({ workspaceId, pipeline, isOpen, onClose }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchSchedule = async () => {
    if (!isOpen || !pipeline || !workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipeline.pipelineId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">Pipeline Schedule</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSchedule}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh schedule"
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
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span>Checking schedule status from Microsoft Fabric...</span>
            </div>
          ) : schedule ? (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between ${
                  schedule.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800/40 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  {schedule.enabled ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-slate-500" />
                  )}
                  <div>
                    <div className="text-sm font-semibold">
                      {schedule.enabled ? 'Schedule Active' : 'No Active Schedule'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {schedule.enabled
                        ? 'Automated execution trigger is currently enabled.'
                        : 'This pipeline only runs manually or via parent triggers.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Info Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Schedule Type</div>
                  <div className="text-sm font-semibold text-slate-200 mt-0.5">
                    {schedule.scheduleType || 'Manual / None'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Timezone</div>
                  <div className="text-sm font-mono text-slate-200 mt-0.5 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    <span>{schedule.timeZone || 'UTC'}</span>
                  </div>
                </div>

                <div className="col-span-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="text-[10px] uppercase font-semibold text-slate-500">Next Scheduled Execution</div>
                  <div className="text-sm font-mono text-purple-300 mt-0.5 font-semibold">
                    {formatDateTime(schedule.nextRunTime)}
                  </div>
                </div>
              </div>

              {/* Raw config summary */}
              {schedule.rawConfiguration && Object.keys(schedule.rawConfiguration).length > 0 && (
                <div className="pt-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-1">
                    Recurrence Details
                  </span>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 overflow-x-auto max-h-40">
                    {JSON.stringify(schedule.rawConfiguration, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No schedule details found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

