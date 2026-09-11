import React, { useState } from 'react';
import { X, Copy, Check, AlertTriangle, Terminal } from 'lucide-react';

export default function ErrorDetailModal({ activity, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!activity) return null;

  const errorObj = activity.error || {};
  const errorCode = errorObj.errorCode || "N/A";
  const errorMessage = errorObj.message || "An unspecified error occurred during activity execution.";
  const failureType = errorObj.failureType || "UserError";
  const target = errorObj.target || activity.activityName;

  const fullDiagnostics = {
    activityName: activity.activityName,
    activityType: activity.activityType,
    status: activity.status,
    startTime: activity.activityRunStart,
    endTime: activity.activityRunEnd,
    durationInMs: activity.durationInMs,
    error: errorObj,
    output: activity.output
  };

  const jsonString = JSON.stringify(fullDiagnostics, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Activity Execution Failed
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Activity: <span className="text-slate-200">{activity.activityName}</span> ({activity.activityType})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Main Error Banner */}
          <div className="p-4 rounded-lg bg-red-950/30 border border-red-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                {failureType}
              </span>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-red-500/20 text-red-300 border border-red-500/30">
                Code: {errorCode}
              </span>
            </div>
            <p className="text-slate-200 font-medium leading-relaxed select-text">
              {errorMessage}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400">Target</div>
              <div className="text-sm font-mono text-slate-200 truncate mt-0.5">{target}</div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400">Duration</div>
              <div className="text-sm font-mono text-slate-200 mt-0.5">
                {activity.durationInMs ? `${(activity.durationInMs / 1000).toFixed(1)}s` : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
              <div className="text-xs text-slate-400">Timestamp</div>
              <div className="text-sm font-mono text-slate-200 truncate mt-0.5">
                {activity.activityRunEnd ? new Date(activity.activityRunEnd).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* Raw JSON Trace */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Terminal className="w-4 h-4 text-blue-400" />
                Raw Execution Diagnostics & Output JSON
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy Diagnostics"}
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800/90 text-xs font-mono text-slate-300 overflow-x-auto max-h-56 leading-relaxed select-text">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

