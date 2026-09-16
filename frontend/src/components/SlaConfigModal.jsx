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
        setStatusMessage({ type: 'success', text: 'SLA configuration saved. L1/L2 notification routes armed.' });
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-lg bg-[#ffffff] border border-[#edebe9] rounded shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#fff4ce] text-[#8a660a] border border-[#fed9cc]">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[#242424] text-sm">SLA & Escalation Alerting</h3>
              <p className="text-xs text-[#605e5c] truncate max-w-sm font-mono mt-0.5">
                {pipeline.pipelineName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#605e5c] flex items-center justify-center gap-2 bg-[#ffffff]">
            <Loader2 className="w-4 h-4 animate-spin text-[#0f6cbd]" />
            <span>Loading SLA settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4 text-xs bg-[#ffffff]">
            {statusMessage && (
              <div
                className={`p-3 rounded text-xs flex items-center gap-2 border ${
                  statusMessage.type === 'success'
                    ? 'bg-[#dff6dd] border-[#92c353] text-[#107c41]'
                    : 'bg-[#fde7e9] border-[#f19999] text-[#a80000]'
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
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">
                  L1 Support Email (Immediate Incident Alert)
                </label>
                <button
                  type="button"
                  disabled={testingEmailRole === 'L1 Support'}
                  onClick={() => handleTestEmail('L1 Support', l1Email)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#d1d1d1] transition flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmailRole === 'L1 Support' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-2.5 h-2.5 text-[#0f6cbd]" />
                      <span>Test L1 Email</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={l1Email}
                  onChange={(e) => setL1Email(e.target.value)}
                  placeholder="alerts@company.com"
                  className="w-full pl-9 pr-3 py-1.5 rounded bg-[#ffffff] border border-[#d1d1d1] text-xs text-[#242424] placeholder-[#8a8886] focus:outline-none focus:border-[#0f6cbd] transition"
                />
              </div>
              <p className="text-[10px] text-[#605e5c]">
                Dispatches immediate incident alert with failure diagnostics upon pipeline failure.
              </p>
            </div>

            {/* SLA Duration Minutes */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">
                SLA Target Resolution Time (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="1"
                  max="1440"
                  required
                  value={slaMinutes}
                  onChange={(e) => setSlaMinutes(e.target.value)}
                  placeholder="30"
                  className="w-full pl-9 pr-3 py-1.5 rounded bg-[#ffffff] border border-[#d1d1d1] text-xs text-[#242424] placeholder-[#8a8886] focus:outline-none focus:border-[#0f6cbd] transition"
                />
              </div>
              <p className="text-[10px] text-[#605e5c]">
                Time allotted for L1 operator to resolve the incident before automated L2 escalation triggers.
              </p>
            </div>

            {/* L2 Escalation Email */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#605e5c]">
                  L2 Escalation Email (Breach Alert)
                </label>
                <button
                  type="button"
                  disabled={testingEmailRole === 'L2 Escalation'}
                  onClick={() => handleTestEmail('L2 Escalation', l2Email)}
                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#d1d1d1] transition flex items-center gap-1 disabled:opacity-50"
                >
                  {testingEmailRole === 'L2 Escalation' ? (
                    <>
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-2.5 h-2.5 text-[#a80000]" />
                      <span>Test L2 Email</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={l2Email}
                  onChange={(e) => setL2Email(e.target.value)}
                  placeholder="l2-lead@company.com"
                  className="w-full pl-9 pr-3 py-1.5 rounded bg-[#ffffff] border border-[#d1d1d1] text-xs text-[#242424] placeholder-[#8a8886] focus:outline-none focus:border-[#0f6cbd] transition"
                />
              </div>
              <p className="text-[10px] text-[#605e5c]">
                Automatically receives urgent notification when SLA target duration is exceeded.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-[#edebe9] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] text-[#242424] border border-[#d1d1d1] text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Save Configuration</span>
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
