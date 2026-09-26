import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, AlertCircle, Send, Loader2, Users, UserCheck } from 'lucide-react';
import { listUsers } from '../../features/admin/api/adminApi';
import { useAuth } from '../../features/auth';

function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'US';
}

export default function SlaConfigModal({ workspaceId, pipeline, isOpen, onClose, onSaved }) {
  const { profile } = useAuth();
  const [l1Email, setL1Email] = useState('');
  const [l1Name, setL1Name] = useState('');
  const [l2Email, setL2Email] = useState('');
  const [l2Name, setL2Name] = useState('');
  const [sla1Minutes, setSla1Minutes] = useState(30);
  const [sla2Minutes, setSla2Minutes] = useState(60);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [testingEmailRole, setTestingEmailRole] = useState(null);

  // Available configured users from DB
  const [configuredUsers, setConfiguredUsers] = useState([]);

  const pipelineId = pipeline?.pipelineId || pipeline?.id;

  useEffect(() => {
    if (!isOpen) return;

    // Load available configured users for dropdown selection
    listUsers()
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          setConfiguredUsers(data.users);
        }
      })
      .catch((err) => console.warn('Could not load configured users for picker:', err));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !pipeline || !workspaceId || !pipelineId) return;

    // Load current SLA & Assignee config for this specific pipeline
    const loadConfig = async () => {
      setLoading(true);
      setStatusMessage(null);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`);
        if (res.ok) {
          const data = await res.json();
          setL1Email(data.l1Email || '');
          setL1Name(data.l1Name || '');
          setL2Email(data.l2Email || '');
          setL2Name(data.l2Name || '');
          setSla1Minutes(data.sla1Minutes || data.slaMinutes || 30);
          setSla2Minutes(data.sla2Minutes || (data.slaMinutes ? data.slaMinutes * 2 : 60));
        } else {
          setL1Email('');
          setL1Name('');
          setL2Email('');
          setL2Name('');
          setSla1Minutes(30);
          setSla2Minutes(60);
        }
      } catch (err) {
        console.error('Failed to load SLA config:', err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [isOpen, pipeline, workspaceId, pipelineId]);

  if (!isOpen || !pipeline) return null;

  const handleSelectPreconfiguredL1 = (email) => {
    if (!email) {
      setL1Email('');
      setL1Name('');
      return;
    }
    const user = configuredUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setL1Email(user.email);
      setL1Name(user.display_name || user.email);
    } else {
      setL1Email(email);
      setL1Name('');
    }
  };

  const handleSelectPreconfiguredL2 = (email) => {
    if (!email) {
      setL2Email('');
      setL2Name('');
      return;
    }
    const user = configuredUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
      setL2Email(user.email);
      setL2Name(user.display_name || user.email);
    } else {
      setL2Email(email);
      setL2Name('');
    }
  };

  const handleTestEmail = async (role, email) => {
    if (!email || !email.trim()) {
      setStatusMessage({ type: 'error', text: `Please assign a valid ${role} first.` });
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
          pipelineName: pipeline.pipelineName,
        }),
      });
      if (res.ok) {
        setStatusMessage({ type: 'success', text: `Verification alert successfully sent to ${email}!` });
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: errData.detail || `Failed to send test email to ${role}.` });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Network error sending test notification.' });
    } finally {
      setTestingEmailRole(null);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!l1Email.trim() || !l2Email.trim()) {
      setStatusMessage({ type: 'error', text: 'Both L1 Support Lead and L2 Escalation Owner are required.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineName: pipeline?.pipelineName || pipeline?.name || pipeline?.displayName || '',
          l1Email: l1Email.trim(),
          l1Name: l1Name.trim(),
          l2Email: l2Email.trim(),
          l2Name: l2Name.trim(),
          slaMinutes: parseInt(sla1Minutes, 10) || 30,
          sla1Minutes: parseInt(sla1Minutes, 10) || 30,
          sla2Minutes: parseInt(sla2Minutes, 10) || 60,
          assignedBy: profile?.email || '',
        }),
      });

      if (res.ok) {
        setStatusMessage({ type: 'success', text: 'Pipeline team & SLA escalation saved successfully.' });
        if (onSaved) onSaved();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setStatusMessage({ type: 'error', text: errData.detail || 'Failed to save pipeline configuration.' });
      }
    } catch (err) {
      console.error('Save SLA error:', err);
      setStatusMessage({ type: 'error', text: 'Network error saving configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedL1User = configuredUsers.find((u) => u.email.toLowerCase() === l1Email.toLowerCase());
  const selectedL2User = configuredUsers.find((u) => u.email.toLowerCase() === l2Email.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 select-none font-sans">
      {/* Increased width: max-w-2xl */}
      <div className="relative w-full max-w-2xl bg-[#ffffff] border border-[#edebe9] rounded-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Fabric Header */}
        <div className="px-6 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#eff6fc] text-[#0f6cbd] flex items-center justify-center border border-[#0f6cbd]/20 shrink-0">
              <Users className="w-5 h-5 text-[#0f6cbd]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#242424]">
                  Assign L1 &amp; L2 Team &amp; SLA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/30">
                  Per-Pipeline
                </span>
              </div>
              <p className="text-xs text-[#605e5c] truncate max-w-lg font-mono mt-0.5" title={pipeline.pipelineName}>
                {pipeline.pipelineName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#ebebeb] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#605e5c] flex items-center justify-center gap-2 bg-[#ffffff]">
            <Loader2 className="w-4 h-4 animate-spin text-[#0f6cbd]" />
            <span>Loading pipeline team assignments...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-3 text-xs bg-[#ffffff] max-h-[85vh] overflow-y-auto">
            {statusMessage && (
              <div
                className={`p-2.5 rounded text-xs flex items-center gap-2 border ${
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
                <span className="font-medium">{statusMessage.text}</span>
              </div>
            )}

            {/* L1 Support Person Selection */}
            <div className="space-y-2 p-3 bg-[#faf9f8] border border-[#edebe9] rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#0f6cbd] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  L1 Support Lead (First Responder)
                </span>
                {l1Email && (
                  <button
                    type="button"
                    disabled={testingEmailRole === 'L1 Support'}
                    onClick={() => handleTestEmail('L1 Support', l1Email)}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#ffffff] hover:bg-[#f3f2f1] text-[#0f6cbd] border border-[#d1d1d1] transition flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                  >
                    {testingEmailRole === 'L1 Support' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending alert...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 text-[#0f6cbd]" />
                        <span>Test Alert</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Single Select Dropdown */}
              <div>
                <select
                  value={l1Email}
                  onChange={(e) => handleSelectPreconfiguredL1(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-[#8a8886] hover:border-[#242424] rounded font-medium text-[#242424] focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                >
                  <option value="">-- Choose L1 Support Lead --</option>
                  {configuredUsers.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.display_name ? `${u.display_name} (${u.email}) [${u.role_id?.toUpperCase() || 'USER'}]` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clean Single Persona Card (No repetition) */}
              {l1Email && (
                <div className="flex items-center gap-2.5 p-2 bg-white rounded border border-[#edebe9]">
                  <div className="w-6 h-6 rounded-full bg-[#0f6cbd] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {getInitials(selectedL1User?.display_name || l1Name, l1Email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#242424] truncate leading-tight">
                      {selectedL1User?.display_name || l1Name || l1Email}
                    </div>
                    <div className="text-[11px] text-[#605e5c] font-mono truncate leading-tight">
                      {l1Email}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/30 shrink-0">
                    L1 Responder
                  </span>
                </div>
              )}
            </div>

            {/* L2 Escalation Person Selection */}
            <div className="space-y-2 p-3 bg-[#faf9f8] border border-[#edebe9] rounded-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#c45500] uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  L2 Escalation Owner (Secondary / Lead)
                </span>
                {l2Email && (
                  <button
                    type="button"
                    disabled={testingEmailRole === 'L2 Escalation'}
                    onClick={() => handleTestEmail('L2 Escalation', l2Email)}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#ffffff] hover:bg-[#f3f2f1] text-[#c45500] border border-[#d1d1d1] transition flex items-center gap-1.5 disabled:opacity-50 shadow-2xs"
                  >
                    {testingEmailRole === 'L2 Escalation' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Sending alert...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3 text-[#c45500]" />
                        <span>Test Alert</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Single Select Dropdown */}
              <div>
                <select
                  value={l2Email}
                  onChange={(e) => handleSelectPreconfiguredL2(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white border border-[#8a8886] hover:border-[#242424] rounded font-medium text-[#242424] focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                >
                  <option value="">-- Choose L2 Escalation Owner --</option>
                  {configuredUsers.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.display_name ? `${u.display_name} (${u.email}) [${u.role_id?.toUpperCase() || 'USER'}]` : u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clean Single Persona Card (No repetition) */}
              {l2Email && (
                <div className="flex items-center gap-2.5 p-2 bg-white rounded border border-[#edebe9]">
                  <div className="w-6 h-6 rounded-full bg-[#c45500] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    {getInitials(selectedL2User?.display_name || l2Name, l2Email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[#242424] truncate leading-tight">
                      {selectedL2User?.display_name || l2Name || l2Email}
                    </div>
                    <div className="text-[11px] text-[#605e5c] font-mono truncate leading-tight">
                      {l2Email}
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#fdf3e7] text-[#c45500] border border-[#c45500]/30 shrink-0">
                    L2 Escalation
                  </span>
                </div>
              )}
            </div>

            {/* SLA Escalation Thresholds */}
            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#242424] uppercase tracking-wider block">
                  SLA1 Warning (Min)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    required
                    value={sla1Minutes}
                    onChange={(e) => setSla1Minutes(e.target.value)}
                    placeholder="30"
                    className="w-full pl-9 pr-2.5 py-1.5 rounded bg-[#ffffff] border border-[#d1d1d1] text-xs text-[#242424] font-mono focus:outline-none focus:border-[#0f6cbd]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#242424] uppercase tracking-wider block">
                  SLA2 Escalation (Min)
                </label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-[#605e5c] absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    required
                    value={sla2Minutes}
                    onChange={(e) => setSla2Minutes(e.target.value)}
                    placeholder="60"
                    className="w-full pl-9 pr-2.5 py-1.5 rounded bg-[#ffffff] border border-[#d1d1d1] text-xs text-[#242424] font-mono focus:outline-none focus:border-[#0f6cbd]"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-[#edebe9] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded border border-[#d1d1d1] hover:bg-[#f3f2f1] text-xs font-semibold text-[#242424] transition shadow-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Team &amp; SLA</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
