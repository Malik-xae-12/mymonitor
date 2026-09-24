import React, { useState, useEffect } from 'react';
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
  HelpCircle,
  History,
  Calendar,
  Database,
  CheckCircle2,
  XCircle,
  Users,
  Clock
} from 'lucide-react';
import { formatDateTime, formatDuration, getActivityIcon, computeDuration } from './PipelineRow';

export default function FabricDetailSidePane({ 
  item, 
  isOpen, 
  onClose,
  onOpenRunHistory,
  onOpenSchedule,
  onOpenSlaConfig,
  onOpenTableLogs
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'diagnostics'
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedFixGuide, setCopiedFixGuide] = useState(false);

  // Live SLA & Assignee Config State
  const [slaData, setSlaData] = useState(item?.slaConfig || null);

  useEffect(() => {
    setSlaData(item?.slaConfig || null);
    const wsId = item?.workspaceId;
    const pid = item?.pipelineId || (item?.activityType === 'Pipeline' ? item?.id : null);
    if (wsId && pid && !pid.startsWith('norun-')) {
      fetch(`/api/workspaces/${wsId}/pipelines/${pid}/sla`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setSlaData(prev => ({ ...prev, ...data }));
          }
        })
        .catch(() => {});
    }
  }, [item]);

  // AI State
  const [aiData, setAiData] = useState(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);

  const isFailed = item?.status?.toLowerCase() === 'failed';

  useEffect(() => {
    if (item) {
      if (item.status?.toLowerCase() === 'failed') {
        setActiveTab('diagnostics');
      } else {
        setActiveTab('overview');
      }
      setAiData(null);
      setAiError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const errorObj = item.error || {};
  const errorCode = errorObj.errorCode || (typeof errorObj === 'string' ? 'Error' : 'UserError');
  const errorMessage = errorObj.message || (typeof errorObj === 'string' ? errorObj : 'An execution error occurred.');
  const failureType = errorObj.failureType || 'ExecutionFailure';
  const target = errorObj.target || item.activityName || item.pipelineName;

  const duration = computeDuration(item);
  const startTime = item.startTime || item.activityRunStart;
  const endTime = item.endTime || item.activityRunEnd;

  const fullDiagnosticsJson = JSON.stringify({
    name: item.pipelineName || item.activityName,
    type: item.activityType || 'Pipeline',
    status: item.status,
    startTime: startTime,
    endTime: endTime,
    durationInMs: duration,
    error: item.error,
    output: item.output || errorObj.rawError
  }, null, 2);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(fullDiagnosticsJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyScript = (script) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleCopyFixGuide = () => {
    if (!aiData) return;
    const lines = [
      `*Microsoft Fabric AI Diagnosis: ${item.activityName || item.pipelineName}*`,
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
    setCopiedFixGuide(true);
    setTimeout(() => setCopiedFixGuide(false), 2000);
  };

  const fetchAiDiagnosis = async (forceRefresh = false) => {
    setIsLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/diagnostics/ai-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineName: item.pipelineName || 'Pipeline',
          activityName: item.activityName || item.pipelineName,
          activityType: item.activityType || 'Pipeline',
          errorCode: errorCode,
          errorMessage: errorMessage,
          failureType: failureType,
          target: target,
          rawError: item.output || item.error,
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
      console.error('AI diagnosis error:', err);
      setAiError('Network error while connecting to AI diagnostic service.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#ffffff] border-l border-[#edebe9] shadow-2xl flex flex-col select-none animate-in slide-in-from-right duration-200">
      {/* Pane Header */}
      <div className="px-4 py-3.5 border-b border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded bg-[#eff6fc] border border-[#d1d1d1] shrink-0 text-[#0f6cbd]">
            {getActivityIcon(item.activityType || 'Pipeline')}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#242424] truncate">
              {item.pipelineName || item.activityName}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[#605e5c] font-mono">
                {item.activityType || 'Pipeline'}
              </span>
              {item.id && !item.id.startsWith('norun-') && (
                <span className="text-[10px] text-[#797775] font-mono">
                  #{item.id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close pane"
          className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Fluent Pivot Tabs */}
      <div className="flex items-center px-4 border-b border-[#edebe9] bg-[#ffffff] text-xs font-medium space-x-4">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 border-b-2 transition ${
            activeTab === 'overview'
              ? 'border-[#0f6cbd] text-[#0f6cbd] font-semibold'
              : 'border-transparent text-[#605e5c] hover:text-[#242424]'
          }`}
        >
          Overview
        </button>

        {isFailed && (
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`py-2.5 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'border-[#c42b1c] text-[#c42b1c] font-semibold'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#c42b1c]" />
            <span>Diagnostics & AI Fix</span>
          </button>
        )}
      </div>

      {/* Pane Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Status Summary Banner */}
            <div className={`p-3 rounded border flex items-center justify-between ${
              isFailed 
                ? 'bg-[#fde7e9] border-[#f4b4b9] text-[#c42b1c]'
                : item.status?.toLowerCase() === 'completed' || item.status?.toLowerCase() === 'succeeded'
                ? 'bg-[#dff6dd] border-[#107c41]/30 text-[#107c41]'
                : 'bg-[#faf9f8] border-[#edebe9] text-[#242424]'
            }`}>
              <div className="flex items-center gap-2">
                {isFailed ? (
                  <XCircle className="w-4 h-4 text-[#c42b1c]" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-[#107c41]" />
                )}
                <div>
                  <div className="font-semibold text-xs">
                    Execution {item.status || 'Unknown'}
                  </div>
                  <div className="text-[11px] opacity-80 mt-0.5">
                    Duration: {formatDuration(duration)}
                  </div>
                </div>
              </div>

              {isFailed && (
                <button
                  onClick={() => setActiveTab('diagnostics')}
                  className="px-2.5 py-1 rounded bg-[#c42b1c] hover:bg-[#a80000] text-white text-[11px] font-medium transition shadow-sm"
                >
                  View Error
                </button>
              )}
            </div>

            {/* Properties List */}
            <div className="rounded border border-[#edebe9] bg-[#ffffff] overflow-hidden divide-y divide-[#edebe9] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">Activity Name</span>
                <span className="text-[#242424] font-medium">{item.pipelineName || item.activityName}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">Item Type</span>
                <span className="text-[#242424] font-mono">{item.activityType || 'Pipeline'}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">Run ID</span>
                <span className="text-[#323130] font-mono text-[11px]">
                  {item.id || item.activityRunId || 'N/A'}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">Start Time</span>
                <span className="text-[#323130] font-mono text-[11px]">{formatDateTime(startTime)}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">End Time</span>
                <span className="text-[#323130] font-mono text-[11px]">{formatDateTime(endTime)}</span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c]">Duration</span>
                <span className="text-[#242424] font-mono font-medium">{formatDuration(duration)}</span>
              </div>
              {/* L1 Support Lead */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c] flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${slaData?.l1Email ? 'bg-[#0f6cbd]' : 'bg-[#a19f9d]'}`} />
                  L1 Support Lead
                </span>
                {slaData?.l1Email ? (
                  <div className="text-right">
                    <span className="text-[#242424] font-semibold block">
                      {slaData.l1Name || slaData.l1Email}
                    </span>
                    {slaData.l1Name && (
                      <span className="text-[11px] text-[#605e5c] font-mono block">
                        {slaData.l1Email}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[#a19f9d] italic">Unassigned</span>
                )}
              </div>

              {/* L2 Escalation Owner */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c] flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${slaData?.l2Email ? 'bg-[#c45500]' : 'bg-[#a19f9d]'}`} />
                  L2 Escalation Owner
                </span>
                {slaData?.l2Email ? (
                  <div className="text-right">
                    <span className="text-[#242424] font-semibold block">
                      {slaData.l2Name || slaData.l2Email}
                    </span>
                    {slaData.l2Name && (
                      <span className="text-[11px] text-[#605e5c] font-mono block">
                        {slaData.l2Email}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[#a19f9d] italic">Unassigned</span>
                )}
              </div>

              {/* SLA 1 (Warning) */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#0f6cbd]" />
                  SLA 1 (Warning)
                </span>
                <span className="px-2 py-0.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/20 font-mono font-semibold">
                  {slaData?.sla1Minutes || slaData?.slaMinutes || 30} minutes
                </span>
              </div>

              {/* SLA 2 (Breach) */}
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-[#605e5c] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#c45500]" />
                  SLA 2 (Breach)
                </span>
                <span className="px-2 py-0.5 rounded bg-[#fdf3e7] text-[#c45500] border border-[#c45500]/20 font-mono font-semibold">
                  {slaData?.sla2Minutes || (slaData?.slaMinutes ? slaData.slaMinutes * 2 : 60)} minutes
                </span>
              </div>
            </div>

            {/* Direct Context Actions */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-[#605e5c] uppercase tracking-wider block">
                Related Workload Actions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {onOpenRunHistory && (
                  <button
                    onClick={() => onOpenRunHistory(item)}
                    className="flex items-center gap-2 p-2.5 rounded bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#edebe9] text-[#242424] transition text-left"
                  >
                    <History className="w-4 h-4 text-[#0f6cbd]" />
                    <div>
                      <div className="font-medium text-xs text-[#242424]">Run History</div>
                      <div className="text-[10px] text-[#605e5c]">Historical telemetry & runs</div>
                    </div>
                  </button>
                )}

                {onOpenSchedule && (
                  <button
                    onClick={() => onOpenSchedule(item)}
                    className="flex items-center gap-2 p-2.5 rounded bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#edebe9] text-[#242424] transition text-left"
                  >
                    <Calendar className="w-4 h-4 text-[#773adc]" />
                    <div>
                      <div className="font-medium text-xs text-[#242424]">Schedules</div>
                      <div className="text-[10px] text-[#605e5c]">View recurrence rules</div>
                    </div>
                  </button>
                )}

                {onOpenSlaConfig && (
                  <button
                    onClick={() => onOpenSlaConfig(item)}
                    className="flex items-center gap-2 p-2.5 rounded bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#edebe9] text-[#242424] transition text-left"
                  >
                    <Users className="w-4 h-4 text-[#0078d4]" />
                    <div>
                      <div className="font-medium text-xs text-[#242424]">Team &amp; SLA</div>
                      <div className="text-[10px] text-[#605e5c]">L1/L2 assignees &amp; thresholds</div>
                    </div>
                  </button>
                )}

                {onOpenTableLogs && (
                  <button
                    onClick={() => onOpenTableLogs(item)}
                    className="flex items-center gap-2 p-2.5 rounded bg-[#faf9f8] hover:bg-[#f3f2f1] border border-[#edebe9] text-[#242424] transition text-left"
                  >
                    <Database className="w-4 h-4 text-[#008272]" />
                    <div>
                      <div className="font-medium text-xs text-[#242424]">Lakehouse Logs</div>
                      <div className="text-[10px] text-[#605e5c]">Bronze/Silver ingestion</div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DIAGNOSTICS & AI FIX */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4">
            {/* Error Banner */}
            <div className="p-3.5 rounded bg-[#fde7e9] border border-[#f4b4b9] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#c42b1c] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Execution Failure
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#ffffff] text-[#c42b1c] border border-[#f4b4b9]">
                  {errorCode}
                </span>
              </div>
              <p className="text-[#323130] text-xs font-mono select-text leading-relaxed">
                {errorMessage}
              </p>
            </div>

            {/* AI Assistant Section */}
            <div className="rounded border border-[#c7e0f4] bg-[#f0f7ff] p-4 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-[#c7e0f4]">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-[#0f6cbd]/15 text-[#0f6cbd]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#242424] flex items-center gap-1.5">
                      Gemini AI Diagnostics
                      {aiData?.cached && (
                        <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-[#dff6dd] text-[#107c41] border border-[#107c41]/30">
                          ⚡ Instant Cached
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-[#605e5c]">Automated root cause & fix checklist</p>
                  </div>
                </div>

                {!aiData && !isLoadingAi && (
                  <button
                    onClick={() => fetchAiDiagnosis(false)}
                    className="px-3 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyze & Fix</span>
                  </button>
                )}

                {aiData && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleCopyFixGuide}
                      title="Copy fix checklist"
                      className="px-2 py-1 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#323130] text-[11px] border border-[#d1d1d1] transition flex items-center gap-1"
                    >
                      {copiedFixGuide ? <Check className="w-3 h-3 text-[#107c41]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedFixGuide ? "Copied" : "Copy Guide"}</span>
                    </button>
                    <button
                      onClick={() => fetchAiDiagnosis(true)}
                      title="Re-run AI analysis"
                      className="p-1 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ffffff] border border-transparent hover:border-[#d1d1d1]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAi ? "animate-spin text-[#0f6cbd]" : ""}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* AI Loading */}
              {isLoadingAi && (
                <div className="py-8 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-[#0f6cbd] animate-spin mx-auto" />
                  <div className="text-xs text-[#242424] font-medium">
                    Analyzing activity failure context...
                  </div>
                  <div className="text-[11px] text-[#605e5c]">
                    Formulating probable causes and actionable steps
                  </div>
                </div>
              )}

              {/* AI Error */}
              {aiError && (
                <div className="p-2.5 rounded bg-[#fde7e9] border border-[#f4b4b9] text-[#c42b1c] text-xs">
                  {aiError}
                </div>
              )}

              {/* AI Prompt state */}
              {!aiData && !isLoadingAi && !aiError && (
                <div className="py-4 text-center text-xs text-[#605e5c] space-y-1">
                  <p>Click <strong>Analyze & Fix</strong> to generate instant root cause diagnostics and step-by-step remediation commands.</p>
                </div>
              )}

              {/* AI Result View */}
              {aiData && !isLoadingAi && (
                <div className="space-y-3 pt-1">
                  {/* Root Cause */}
                  <div className="p-3 rounded bg-[#ffffff] border border-[#c7e0f4] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#0f6cbd] flex items-center gap-1">
                      <HelpCircle className="w-3 h-3" />
                      Root Cause
                    </span>
                    <p className="text-[#242424] text-xs leading-relaxed">
                      {aiData.rootCause}
                    </p>
                  </div>

                  {/* Fix Steps */}
                  {aiData.fixSteps && aiData.fixSteps.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-[#242424] flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-[#008272]" />
                        Resolution Checklist:
                      </span>
                      <div className="space-y-1">
                        {aiData.fixSteps.map((step, idx) => (
                          <div key={idx} className="p-2 rounded bg-[#ffffff] border border-[#edebe9] flex items-start gap-2">
                            <span className="w-4 h-4 rounded-full bg-[#eff6fc] text-[#0f6cbd] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="text-[#323130] text-xs leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fix Script */}
                  {aiData.fixScript && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#107c41] flex items-center gap-1">
                          <Code className="w-3.5 h-3.5" />
                          Remediation Script:
                        </span>
                        <button
                          onClick={() => handleCopyScript(aiData.fixScript)}
                          className="text-[11px] text-[#605e5c] hover:text-[#242424] flex items-center gap-1"
                        >
                          {copiedScript ? <Check className="w-3 h-3 text-[#107c41]" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedScript ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <pre className="p-2.5 rounded bg-[#f8f8f7] border border-[#edebe9] font-mono text-[11px] text-[#107c41] overflow-x-auto select-text leading-relaxed">
                        {aiData.fixScript}
                      </pre>
                    </div>
                  )}

                  {/* Prevention Tip */}
                  {aiData.preventionTip && (
                    <div className="p-2.5 rounded bg-[#ffffff] border border-[#edebe9] flex items-start gap-2 text-[11px] text-[#323130]">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#107c41] shrink-0 mt-0.5" />
                      <span>{aiData.preventionTip}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Raw JSON Trace */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#605e5c] flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#605e5c]" />
                  Raw Execution Diagnostics JSON
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#323130] text-[11px] border border-[#d1d1d1] transition"
                >
                  {copiedJson ? <Check className="w-3 h-3 text-[#107c41]" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
                </button>
              </div>
              <pre className="p-3 rounded bg-[#f8f8f7] border border-[#edebe9] text-[11px] font-mono text-[#242424] overflow-x-auto max-h-48 leading-relaxed select-text">
                {fullDiagnosticsJson}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Pane Footer */}
      <div className="p-3 border-t border-[#edebe9] bg-[#faf9f8] flex items-center justify-between">
        <div className="text-[10px] text-[#797775] font-mono">
          Microsoft Fabric Real-Time Diagnostics
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#323130] text-xs font-medium transition shadow-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
