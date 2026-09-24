import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-[#ffffff] border-l border-[#edebe9] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#c7e0f4]">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[#242424] text-sm">Pipeline Schedules</h3>
                <p className="text-xs text-[#605e5c]">Workspace automated execution triggers</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchSchedules}
                className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
                title="Refresh schedules"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#0f6cbd]" : ""}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-2.5 bg-[#faf9f8]">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#605e5c]">
                Loading schedules...
              </div>
            ) : schedules.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#605e5c] bg-[#ffffff] rounded border border-[#edebe9]">
                No pipelines found in this workspace.
              </div>
            ) : (
              schedules.map((s) => (
                <div 
                  key={s.pipelineId}
                  className="p-3 rounded border border-[#edebe9] bg-[#ffffff] space-y-2 shadow-sm hover:border-[#c7e0f4] transition"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-[#242424] text-xs truncate max-w-[240px]">{s.pipelineName}</h4>
                    {s.enabled ? (
                      <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-[#dff6dd] text-[#107c41] border border-[#92c353] flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.2 rounded text-[10px] font-medium bg-[#f3f2f1] text-[#605e5c] border border-[#d1d1d1]">
                        No Schedule
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[#605e5c] font-mono">
                    <div className="p-1.5 rounded bg-[#faf9f8] border border-[#edebe9]">
                      <span className="text-[#605e5c] text-[9px] uppercase block font-sans">Type</span>
                      <span className="text-[#242424] text-[11px] font-medium">{s.scheduleType}</span>
                    </div>
                    <div className="p-1.5 rounded bg-[#faf9f8] border border-[#edebe9]">
                      <span className="text-[#605e5c] text-[9px] uppercase block font-sans">Timezone</span>
                      <span className="text-[#242424] text-[11px] font-medium truncate block">{s.timeZone || "UTC"}</span>
                    </div>
                  </div>

                  {s.nextRunTime && (
                    <div className="mt-1 pt-1.5 border-t border-[#edebe9] flex items-center gap-1.5 text-[11px] font-mono text-[#0f6cbd]">
                      <Clock className="w-3 h-3" />
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
