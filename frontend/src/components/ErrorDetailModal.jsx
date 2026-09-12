import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  AlertTriangle, 
  Terminal, 
  Sparkles, 
  RefreshCw, 
  Wrench, 
  ShieldCheck, 
  Code, 
  CheckCircle2, 
  HelpCircle,
  ExternalLink,
  Share2
} from 'lucide-react';

export default function ErrorDetailModal({ activity, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedAllFix, setCopiedAllFix] = useState(false);
  
  // AI Diagnostics State
  const [aiData, setAiData] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

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

  const handleCopyDiagnostics = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyScript = (script) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyAllFix = () => {
    if (!aiData) return;
    const lines = [
      `*Fabric AI Diagnosis: ${activity.activityName}*`,
      `Root Cause: ${aiData.rootCause}`,
      '',
      `Likely Causes:`,
      ...(aiData.likelyCauses || []).map(c => `- ${c}`),
      '',
      `Fix Steps:`,
      ...(aiData.fixSteps || []).map((s, idx) => `${idx + 1}. ${s}`),
      '',
      aiData.fixScript ? `Fix Script:\n${aiData.fixScript}\n` : '',
      `Prevention Tip: ${aiData.preventionTip || 'N/A'}`
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(lines);
    setCopiedAllFix(true);
    setTimeout(() => setCopiedAllFix(false), 2000);
  };

  const fetchAiDiagnosis = async (forceRefresh = false) => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/diagnostics/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineName: activity.pipelineName || 'Pipeline',
          activityName: activity.activityName,
          activityType: activity.activityType,
          errorCode: errorCode,
          errorMessage: errorMessage,
          failureType: failureType,
          target: target,
          rawError: activity.output || activity.error,
          forceRefresh: forceRefresh
        })
      });

      if (res.ok) {
        const json = await res.json();
        setAiData(json);
      } else {
        const errJson = await res.json().catch(() => ({ detail: 'Failed to contact AI service' }));
        setAiError(errJson.detail || 'Could not retrieve AI diagnostic.');
      }
    } catch (err) {
      console.error("AI diagnostics error:", err);
      setAiError("Network error while connecting to AI diagnostic service.");
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100">
                  Activity Execution Failed
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                  {failureType}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Activity: <span className="text-slate-200 font-medium">{activity.activityName}</span> ({activity.activityType})
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
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-200">
          {/* Main Error Banner */}
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Error Description
              </span>
              <span className="px-2.5 py-0.5 text-xs font-mono rounded-md bg-red-500/20 text-red-300 border border-red-500/30">
                Code: {errorCode}
              </span>
            </div>
            <p className="text-slate-200 text-sm font-medium leading-relaxed select-text font-mono">
              {errorMessage}
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Target Object</div>
              <div className="text-xs font-mono text-slate-200 truncate mt-0.5 font-medium">{target}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Duration</div>
              <div className="text-xs font-mono text-slate-200 mt-0.5 font-medium">
                {activity.durationInMs ? `${(activity.durationInMs / 1000).toFixed(1)}s` : 'N/A'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <div className="text-[11px] text-slate-400">Failure Timestamp</div>
              <div className="text-xs font-mono text-slate-200 truncate mt-0.5 font-medium">
                {activity.activityRunEnd ? new Date(activity.activityRunEnd).toLocaleString() : 'N/A'}
              </div>
            </div>
          </div>

          {/* AI DIAGNOSTICS SECTION */}
          <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 via-slate-950/40 to-slate-950/40 p-5 space-y-4 shadow-xl shadow-indigo-950/20">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-indigo-500/20">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    AI Troubleshooting & Fix Assistant
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Gemini 3.6 Flash
                    </span>
                    {aiData?.cached && (
                      <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ⚡ Instant Cached
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Automated root cause analysis, probable causes, and step-by-step fix guide
                  </p>
                </div>
              </div>

              {!aiData && !isLoadingAi && (
                <button
                  onClick={() => fetchAiDiagnosis(false)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs transition shadow-lg shadow-indigo-500/25 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span>Analyze & Get Fix Steps</span>
                </button>
              )}

              {aiData && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyAllFix}
                    title="Copy full troubleshooting guide to clipboard"
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                  >
                    {copiedAllFix ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAllFix ? "Copied Guide!" : "Copy Fix Guide"}</span>
                  </button>
                  <button
                    onClick={() => fetchAiDiagnosis(true)}
                    disabled={isLoadingAi}
                    title="Re-analyze and refresh AI advice"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin text-cyan-400" : ""}`} />
                  </button>
                </div>
              )}
            </div>

            {/* AI Loading State */}
            {isLoadingAi && (
              <div className="p-8 text-center space-y-3">
                <div className="relative w-10 h-10 mx-auto">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
                  <Sparkles className="w-4 h-4 text-cyan-300 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-200">
                    Gemini AI is analyzing error diagnostics and pipeline context...
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Formulating root cause and step-by-step resolution checklist
                  </p>
                </div>
              </div>
            )}

            {/* AI Error */}
            {aiError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {/* AI Initial Prompt Card */}
            {!aiData && !isLoadingAi && !aiError && (
              <div className="p-6 text-center space-y-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Wrench className="w-5 h-5" />
                </div>
                <h5 className="font-semibold text-slate-200 text-xs">Need help resolving this failure?</h5>
                <p className="text-[11px] text-slate-400 max-w-lg mx-auto">
                  Click <strong>Analyze & Get Fix Steps</strong> to let Gemini AI review the error code, activity type, and execution context to generate an immediate root cause explanation and resolution checklist.
                </p>
              </div>
            )}

            {/* AI Result View */}
            {aiData && !isLoadingAi && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* 1. Root Cause */}
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" />
                      Root Cause Analysis
                    </span>
                    {aiData.severity && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        aiData.severity.toLowerCase() === 'critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        aiData.severity.toLowerCase() === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        Severity: {aiData.severity}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-100 text-xs leading-relaxed font-medium">
                    {aiData.rootCause}
                  </p>
                </div>

                {/* 2. Likely Causes */}
                {aiData.likelyCauses && aiData.likelyCauses.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      Likely Causes:
                    </span>
                    <ul className="grid grid-cols-1 gap-1.5">
                      {aiData.likelyCauses.map((cause, idx) => (
                        <li key={`cause-${idx}`} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                          <span>{cause}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Actionable Fix Steps */}
                {aiData.fixSteps && aiData.fixSteps.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      Step-by-Step Resolution Guide:
                    </span>
                    <div className="space-y-1.5">
                      {aiData.fixSteps.map((step, idx) => (
                        <div key={`step-${idx}`} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="text-xs text-slate-200 leading-relaxed font-medium">
                            {step}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Fix Script (if applicable) */}
                {aiData.fixScript && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5" />
                        Remediation Script / Command ({aiData.fixScriptLanguage || 'Code'})
                      </span>
                      <button
                        onClick={() => handleCopyScript(aiData.fixScript)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] border border-slate-700 transition"
                      >
                        {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedScript ? "Copied Script" : "Copy Code"}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto select-text leading-relaxed">
                      {aiData.fixScript}
                    </pre>
                  </div>
                )}

                {/* 5. Prevention Tip */}
                {aiData.preventionTip && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-200">Prevention Tip: </span>
                      <span>{aiData.preventionTip}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Raw JSON Trace */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Terminal className="w-4 h-4 text-blue-400" />
                Raw Execution Diagnostics & Output JSON
              </div>
              <button
                onClick={handleCopyDiagnostics}
                className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied!" : "Copy Diagnostics"}</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800/90 text-xs font-mono text-slate-300 overflow-x-auto max-h-48 leading-relaxed select-text">
              {jsonString}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            Powered by Google Gemini 3.6 Flash & Real-Time Fabric Diagnostics
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
