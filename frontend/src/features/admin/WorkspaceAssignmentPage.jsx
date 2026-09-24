import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, ShieldCheck, Workflow, Table2, Save, Search, Loader2,
  CheckCircle2, AlertCircle, ArrowRight, RefreshCw,
} from 'lucide-react';
import {
  listWorkspaces, listAssignments, saveAssignment,
  listParentPipelines, savePipelineSla,
} from './api/adminApi';

const EMPTY_FORM = {
  l1_email: '',
  l2_email: '',
  sla1_minutes: 30,
  sla2_minutes: 60,
  table_config_done: false,
};

/**
 * Admin onboarding console.
 * Purpose (stated in the header): assign who (L1/L2) is responsible for a
 * workspace, set SLA1/SLA2 thresholds, then complete table-log config.
 */
export default function WorkspaceAssignmentPage({ onOpenTableConfig }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'ok'|'err', msg }
  const [pipelines, setPipelines] = useState([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [pipelineSla, setPipelineSla] = useState({}); // pipelineId -> { sla1, sla2 }
  const [savingPid, setSavingPid] = useState(null);
  const [pipelineNote, setPipelineNote] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const [ws, asgn] = await Promise.all([listWorkspaces(), listAssignments()]);
      setWorkspaces(Array.isArray(ws) ? ws : []);
      const map = {};
      (Array.isArray(asgn) ? asgn : []).forEach((a) => {
        map[a.workspace_id] = a;
      });
      setAssignments(map);
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'Failed to load workspaces.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const loadPipelines = async (workspaceId, forceSync = false) => {
    setPipelinesLoading(true);
    setPipelineNote(null);
    try {
      const list = await listParentPipelines(workspaceId, forceSync);
      const arr = Array.isArray(list) ? list : [];
      setPipelines(arr);
      const slaMap = {};
      arr.forEach((p) => {
        slaMap[p.pipelineId] = { sla1: p.sla1Minutes ?? 30, sla2: p.sla2Minutes ?? 60 };
      });
      setPipelineSla(slaMap);
      if (arr.length === 0) {
        setPipelineNote('No parent pipelines cached yet. Click “Sync from Fabric” to discover them.');
      }
    } catch (err) {
      setPipelineNote(err.message || 'Failed to load pipelines.');
    } finally {
      setPipelinesLoading(false);
    }
  };

  const selectedWorkspace = workspaces.find((w) => w.id === selectedId);

  const selectWorkspace = (ws) => {
    setSelectedId(ws.id);
    setStatus(null);
    setPipelines([]);
    setPipelineSla({});
    setPipelineNote(null);
    const existing = assignments[ws.id];
    setForm(
      existing
        ? {
            l1_email: existing.l1_email || '',
            l2_email: existing.l2_email || '',
            sla1_minutes: existing.sla1_minutes ?? 30,
            sla2_minutes: existing.sla2_minutes ?? 60,
            table_config_done: !!existing.table_config_done,
          }
        : EMPTY_FORM,
    );
    loadPipelines(ws.id, false);
  };

  const filtered = useMemo(
    () =>
      workspaces.filter((w) =>
        (w.displayName || '').toLowerCase().includes(search.toLowerCase()),
      ),
    [workspaces, search],
  );

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const emailsReady = validEmail(form.l1_email) && validEmail(form.l2_email);
  const canSave = !!selectedWorkspace && emailsReady;

  const handleSavePipelineSla = async (p) => {
    const s = pipelineSla[p.pipelineId] || { sla1: 30, sla2: 60 };
    const sla1 = Number(s.sla1);
    const sla2 = Number(s.sla2);
    if (!emailsReady || sla1 <= 0 || sla2 <= 0) return;
    setSavingPid(p.pipelineId);
    setStatus(null);
    try {
      await savePipelineSla(selectedWorkspace.id, p.pipelineId, {
        l1Email: form.l1_email.trim(),
        l2Email: form.l2_email.trim(),
        slaMinutes: sla1,
        sla1Minutes: sla1,
        sla2Minutes: sla2,
      });
      setStatus({ type: 'ok', msg: `SLA saved for ${p.pipelineName}.` });
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'SLA save failed.' });
    } finally {
      setSavingPid(null);
    }
  };

  const handleSave = async (openTableConfig = false) => {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        workspace_id: selectedWorkspace.id,
        workspace_name: selectedWorkspace.displayName,
        l1_email: form.l1_email.trim(),
        l2_email: form.l2_email.trim(),
        sla1_minutes: Number(form.sla1_minutes),
        sla2_minutes: Number(form.sla2_minutes),
        table_config_done: form.table_config_done,
      };
      const saved = await saveAssignment(payload);
      setAssignments((prev) => ({ ...prev, [saved.workspace_id]: saved }));
      setStatus({ type: 'ok', msg: 'Assignment saved.' });
      if (openTableConfig && onOpenTableConfig) {
        onOpenTableConfig(selectedWorkspace.id, selectedWorkspace.displayName);
      }
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const isAssigned = (id) => !!assignments[id];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] text-[#242424]">
      {/* Command bar / page header */}
      <div className="px-6 py-4 bg-white border-b border-[#edebe9]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#eff6fc] text-[#0f6cbd] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Workspace access & SLA setup</h1>
              <p className="text-xs text-[#605e5c]">
                Assign L1/L2 responsibility, set per-parent-pipeline SLA1/SLA2, then configure log tables.
              </p>
            </div>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#d1d1d1] hover:bg-[#f3f2f1] text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: workspace list */}
        <aside className="w-80 border-r border-[#edebe9] bg-white flex flex-col min-h-0">
          <div className="p-3 border-b border-[#edebe9] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#797775] shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="w-full bg-transparent text-xs text-[#242424] placeholder-[#797775] focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex items-center justify-center text-[#605e5c]">
                <Loader2 className="w-5 h-5 animate-spin text-[#0f6cbd]" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-xs text-[#797775] text-center">No workspaces found.</p>
            ) : (
              filtered.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => selectWorkspace(ws)}
                  className={`w-full text-left px-4 py-2.5 border-b border-[#f3f2f1] flex items-center justify-between gap-2 transition ${
                    selectedId === ws.id ? 'bg-[#eff6fc]' : 'hover:bg-[#f3f2f1]'
                  }`}
                >
                  <span className="truncate text-xs text-[#242424]">{ws.displayName}</span>
                  {isAssigned(ws.id) ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#107c10] shrink-0" title="Assigned" />
                  ) : (
                    <span className="text-[10px] text-[#797775] shrink-0">Unassigned</span>
                  )}
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right: assignment form */}
        <main className="flex-1 overflow-y-auto p-6">
          {!selectedWorkspace ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#eff6fc] text-[#0f6cbd] mx-auto flex items-center justify-center">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <h2 className="text-sm font-semibold">Select a workspace to begin</h2>
                <p className="text-xs text-[#605e5c]">
                  Choose a workspace on the left to assign its L1/L2 operators and SLA thresholds.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl space-y-6">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#797775]">Workspace</p>
                <h2 className="text-base font-semibold">{selectedWorkspace.displayName}</h2>
              </div>

              {/* Responsibility */}
              <section className="bg-white border border-[#edebe9] rounded-lg p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0f6cbd]" />
                  <h3 className="text-sm font-semibold">Responsibility</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-xs font-medium text-[#242424]">L1 support email</span>
                    <input
                      type="email"
                      value={form.l1_email}
                      onChange={(e) => setForm({ ...form, l1_email: e.target.value })}
                      placeholder="l1.operator@contoso.com"
                      className="mt-1 w-full px-3 py-2 rounded border border-[#d1d1d1] text-xs focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-[#242424]">L2 support email</span>
                    <input
                      type="email"
                      value={form.l2_email}
                      onChange={(e) => setForm({ ...form, l2_email: e.target.value })}
                      placeholder="l2.escalation@contoso.com"
                      className="mt-1 w-full px-3 py-2 rounded border border-[#d1d1d1] text-xs focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                    />
                  </label>
                </div>
              </section>

              {/* Parent pipelines & per-pipeline SLA */}
              <section className="bg-white border border-[#edebe9] rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Workflow className="w-4 h-4 text-[#0f6cbd]" />
                    <h3 className="text-sm font-semibold">Parent pipelines — SLA thresholds</h3>
                  </div>
                  <button
                    onClick={() => loadPipelines(selectedWorkspace.id, true)}
                    disabled={pipelinesLoading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[#d1d1d1] hover:bg-[#f3f2f1] text-xs font-medium transition disabled:opacity-50"
                  >
                    {pipelinesLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    Sync from Fabric
                  </button>
                </div>
                <p className="text-xs text-[#605e5c]">
                  SLA1 (warning → L1) and SLA2 (breach → L2) are defined per parent pipeline.
                  Sub-pipelines inherit from their parent.
                </p>

                {!emailsReady && (
                  <p className="text-[11px] text-[#8a6d00] bg-[#fff4ce] border border-[#f2c94c] rounded p-2">
                    Enter valid L1/L2 emails above (and Save assignment) before setting pipeline SLAs.
                  </p>
                )}

                {pipelinesLoading ? (
                  <div className="py-6 flex justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#0f6cbd]" />
                  </div>
                ) : pipelines.length > 0 ? (
                  <div className="border border-[#edebe9] rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#faf9f8] text-[#605e5c] text-left border-b border-[#edebe9]">
                          <th className="px-3 py-2 font-semibold">Parent pipeline</th>
                          <th className="px-3 py-2 font-semibold w-32">SLA1 → L1 (min)</th>
                          <th className="px-3 py-2 font-semibold w-32">SLA2 → L2 (min)</th>
                          <th className="px-3 py-2 font-semibold w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pipelines.map((p) => {
                          const s = pipelineSla[p.pipelineId] || { sla1: 30, sla2: 60 };
                          return (
                            <tr key={p.pipelineId} className="border-b border-[#f3f2f1]">
                              <td className="px-3 py-2 text-[#242424]">{p.pipelineName}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={s.sla1}
                                  onChange={(e) =>
                                    setPipelineSla((m) => ({
                                      ...m,
                                      [p.pipelineId]: { ...s, sla1: e.target.value },
                                    }))
                                  }
                                  className="w-24 px-2 py-1 rounded border border-[#d1d1d1] text-xs focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={s.sla2}
                                  onChange={(e) =>
                                    setPipelineSla((m) => ({
                                      ...m,
                                      [p.pipelineId]: { ...s, sla2: e.target.value },
                                    }))
                                  }
                                  className="w-24 px-2 py-1 rounded border border-[#d1d1d1] text-xs focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => handleSavePipelineSla(p)}
                                  disabled={!emailsReady || savingPid === p.pipelineId}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                  {savingPid === p.pipelineId ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Save className="w-3 h-3" />
                                  )}
                                  Save
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-[#797775]">
                    {pipelineNote || 'No parent pipelines to show.'}
                  </p>
                )}
              </section>

              {/* Table config */}
              <section className="bg-white border border-[#edebe9] rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-[#0f6cbd]" />
                  <h3 className="text-sm font-semibold">Table-level log configuration</h3>
                </div>
                <p className="text-xs text-[#605e5c]">
                  Select the Lakehouse/Warehouse log tables (Batch Header, Bronze, Silver) and map
                  their columns for this workspace.
                </p>
                <button
                  onClick={() => handleSave(true)}
                  disabled={!canSave || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#0f6cbd] text-[#0f6cbd] hover:bg-[#eff6fc] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition"
                >
                  Save & configure log tables <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </section>

              {/* Status + actions */}
              {status && (
                <div
                  className={`flex items-center gap-2 text-xs rounded p-2.5 border ${
                    status.type === 'ok'
                      ? 'bg-[#f1faf1] border-[#a7d8a7] text-[#107c10]'
                      : 'bg-[#fdf2f2] border-[#fecaca] text-[#a80000]'
                  }`}
                >
                  {status.type === 'ok' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="break-words">{status.msg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => handleSave(false)}
                  disabled={!canSave || saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded bg-[#0f6cbd] hover:bg-[#115ea3] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition shadow-sm"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save assignment
                </button>
                {!canSave && (
                  <span className="text-[11px] text-[#797775]">
                    Enter valid L1/L2 emails and positive SLA values to save.
                  </span>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
