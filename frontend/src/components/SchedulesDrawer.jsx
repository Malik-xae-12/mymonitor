import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function SchedulesDrawer({ workspaceId, isOpen, onClose }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = async () => {
    if (!workspaceId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/workspaces/${workspaceId}/schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && workspaceId) {
      fetchSchedules();
    }
  }, [isOpen, workspaceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100 text-base">Pipeline Schedules</h3>
                <p className="text-xs text-slate-400">Scheduled runs & triggers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchSchedules}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Refresh schedules"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading schedules...
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No pipelines found in this workspace.
              </div>
            ) : (
              schedules.map((s) => (
                <div 
                  key={s.pipelineId}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-2 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-200 text-sm">{s.pipelineName}</h4>
                    {s.enabled ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                        No Schedule
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-400 font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Type</span>
                      <span className="text-slate-300">{s.scheduleType}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase block">Timezone</span>
                      <span className="text-slate-300 truncate block">{s.timeZone || "UTC"}</span>
                    </div>
                  </div>

                  {s.nextRunTime && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-xs font-mono text-blue-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Next Run: {new Date(s.nextRunTime).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

