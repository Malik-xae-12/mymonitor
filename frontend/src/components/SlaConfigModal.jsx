import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Mail, Clock, CheckCircle2, AlertCircle, Send, Loader2 } from 'lucide-react';

export default function SlaConfigModal({ workspaceId, pipeline, isOpen, onClose, onSaved }) {
  const [l1Email, setL1Email] = useState('');
  const [l2Email, setL2Email] = useState('');
  const [slaMinutes, setSlaMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [testingEmailRole, setTestingEmailRole] = useState(null);

  const pipelineId = pipeline?.pipelineId || pipeline?.id;

  useEffect(() => {
    if (!isOpen || !pipeline || !workspaceId || !pipelineId) return;

    // Load current SLA config
    const loadConfig = async () => {
      setLoading(true);
      setStatusMessage(null);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`);
        if (res.ok) {
          const data = await res.json();
          setL1Email(data.l1Email || 'uiaptracker@gmail.com');
          setL2Email(data.l2Email || 'uiaptracker@gmail.com');
          setSlaMinutes(data.slaMinutes || 30);
        } else {
          setL1Email('uiaptracker@gmail.com');
          setL2Email('uiaptracker@gmail.com');
          setSlaMinutes(30);
        }
      } catch (err) {
        console.error('Failed to load SLA config:', err);
        setL1Email('uiaptracker@gmail.com');
        setL2Email('uiaptracker@gmail.com');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen, pipeline, workspaceId]);

  if (!isOpen || !pipeline) return null;

  const handleTestEmail = async (role, email) => {
    if (!email || !email.trim()) {
      setStatusMessage({ type: 'error', text: `Please enter a valid ${role} email address first.` });
      return;
    }
    setTestingEmailRole(role);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          role: role,
          pipelineName: pipeline.pipelineName
        })
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Test email sent to ${email} from uiaptracker@gmail.com!` });
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: errData.detail || `Failed to send test email to ${role}.` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Network error sending test email.' });
    } finally {
      setTestingEmailRole(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          l1Email: l1Email.trim(),
          l2Email: l2Email.trim(),
          slaMinutes: parseInt(slaMinutes, 10) || 30
        })
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'SLA saved! L1 alert triggered from uiaptracker@gmail.com and active timer armed.' });
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setStatusMessage({ type: 'error', text: 'Failed to save SLA configuration.' });
      }
    } catch (err) {
      console.error('Save SLA error:', err);
      setStatusMessage({ type: 'error', text: 'Network error saving SLA configuration.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">SLA & Escalation Alerting</h3>
              <p className="text-xs text-slate-400 truncate max-w-sm">
                Configure notifications for <span className="text-slate-200 font-mono">{pipeline.pipelineName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading SLA settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {statusMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* L1 Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  L1 Support Email (Immediate Alert)
                </label>
                <button
                  type="button"
                  disabled={testingEmailRole === 'L1 Support'}
                  onClick={() => handleTestEmail('L1 Support', l1Email)}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmailRole === 'L1 Support' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-2.5 h-2.5" />
                      <span>Test L1 Email</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={l1Email}
                  onChange={(e) => setL1Email(e.target.value)}
                  placeholder="alerts@company.com, colleague@company.com"
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Dispatches immediate incident alert with failure diagnostics upon pipeline failure. Multiple emails allowed (comma or semicolon separated).
              </p>
            </div>

            {/* SLA Duration Minutes */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                SLA Target Resolution Time (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="number"
                  min="1"
                  max="1440"
                  required
                  value={slaMinutes}
                  onChange={(e) => setSlaMinutes(e.target.value)}
                  placeholder="30"
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Time allotted for L1 to resolve the failure before automatic L2 escalation triggers.
              </p>
            </div>

            {/* L2 Escalation Email */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  L2 Escalation Email (Breach Alert)
                </label>
                <button
                  type="button"
                  disabled={testingEmailRole === 'L2 Escalation'}
                  onClick={() => handleTestEmail('L2 Escalation', l2Email)}
                  className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 transition flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmailRole === 'L2 Escalation' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-2.5 h-2.5" />
                      <span>Test L2 Email</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={l2Email}
                  onChange={(e) => setL2Email(e.target.value)}
                  placeholder="l2-lead@company.com, manager@company.com"
                  className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Automatically receives urgent escalation email when SLA is breached without resolution. Multiple emails allowed (comma or semicolon separated).
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Save SLA Configuration</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

