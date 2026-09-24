import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Search, 
  RefreshCw, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Edit3,
  Database,
  ExternalLink
} from 'lucide-react';
import SlaConfigModal from '../../components/SlaConfigModal';
import WorkspaceSelector from '../../components/WorkspaceSelector';

export default function PipelineTeamsPage({ onOpenTableConfig }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPipeline, setEditingPipeline] = useState(null);

  // 1. Fetch available workspaces
  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const res = await fetch('/api/workspaces');
        if (res.ok) {
          const list = await res.json();
          setWorkspaces(list);
          if (list.length > 0 && !selectedWorkspaceId) {
            setSelectedWorkspaceId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load workspaces:', err);
      }
    }
    loadWorkspaces();
  }, []);

  // 2. Fetch pipeline assignments for selected workspace
  const fetchPipelineAssignments = async (wsId) => {
    if (!wsId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${wsId}/pipeline-assignments`);
      if (res.ok) {
        const data = await res.json();
        setPipelines(data);
      } else {
        setPipelines([]);
      }
    } catch (err) {
      console.error('Failed to load pipeline assignments:', err);
      setPipelines([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedWorkspaceId) {
      fetchPipelineAssignments(selectedWorkspaceId);
    }
  }, [selectedWorkspaceId]);

  const filteredPipelines = pipelines.filter(p => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      p.pipelineName?.toLowerCase().includes(q) ||
      p.l1Name?.toLowerCase().includes(q) ||
      p.l1Email?.toLowerCase().includes(q) ||
      p.l2Name?.toLowerCase().includes(q) ||
      p.l2Email?.toLowerCase().includes(q)
    );
  });

  const selectedWorkspace = workspaces.find(w => w.id === selectedWorkspaceId);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] p-6 space-y-4 font-sans select-none overflow-y-auto">
      {/* Top Description & Controls */}
      <div className="bg-white border border-[#edebe9] rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#242424]">
                Pipeline L1 / L2 Team &amp; SLA Assignments
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/20">
                Admin Scope
              </span>
            </div>
            <p className="text-xs text-[#605e5c] mt-0.5">
              Select any workspace to configure and manage dedicated L1 Support and L2 Escalation personnel for individual pipelines.
            </p>
          </div>

          {/* Workspace Switcher & Table Log Config Action */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#605e5c]">Workspace:</span>
            <WorkspaceSelector
              currentWorkspaceId={selectedWorkspaceId}
              onSelectWorkspace={(id) => setSelectedWorkspaceId(id)}
              workspaces={workspaces}
              align="right"
            />

            <button
              onClick={() => fetchPipelineAssignments(selectedWorkspaceId)}
              title="Refresh assignments"
              className="p-1.5 rounded bg-white hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#605e5c] hover:text-[#242424] transition shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#0f6cbd]" : ""}`} />
            </button>

            {/* Table Log Config Button */}
            {onOpenTableConfig && selectedWorkspaceId && (
              <button
                type="button"
                onClick={() => onOpenTableConfig(selectedWorkspaceId)}
                title="Configure Lakehouse / Warehouse table logging for this workspace"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f3f2f1] hover:bg-[#edebe9] border border-[#d1d1d1] text-[#242424] hover:text-[#008272] transition text-xs font-semibold shadow-xs"
              >
                <Database className="w-3.5 h-3.5 text-[#008272]" />
                <span>Table Log Config</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="w-3.5 h-3.5 text-[#797775] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter pipelines or assigned personnel..."
            className="w-full bg-[#fafafa] border border-[#d1d1d1] rounded pl-9 pr-3 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#0f6cbd] focus:bg-white transition"
          />
        </div>
      </div>

      {/* Grid of Pipelines */}
      <div className="bg-white border border-[#edebe9] rounded-lg shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#faf9f8] text-[#605e5c] font-semibold border-b border-[#edebe9]">
              <tr>
                <th className="py-3 px-4 font-semibold w-[30%]">Pipeline Name</th>
                <th className="py-3 px-4 font-semibold w-[28%]">L1 Support Lead</th>
                <th className="py-3 px-4 font-semibold w-[24%]">L2 Escalation Owner</th>
                <th className="py-3 px-4 font-semibold w-[12%]">SLA (Warning / Breach)</th>
                <th className="py-3 px-4 text-right font-semibold w-[6%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edebe9]">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#605e5c]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[#0f6cbd]" />
                      <span>Loading pipeline assignments...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPipelines.length > 0 ? (
                filteredPipelines.map((p) => (
                  <tr key={p.pipelineId} className="hover:bg-[#faf9f8] transition">
                    {/* Pipeline Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/20 shrink-0">
                          <GitFork className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-[#242424] truncate" title={p.pipelineName}>
                          {p.pipelineName}
                        </span>
                      </div>
                    </td>

                    {/* L1 Support Person */}
                    <td className="py-3 px-4">
                      {p.l1Email ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#0f6cbd] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {p.l1Name ? p.l1Name.slice(0, 2).toUpperCase() : 'L1'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#242424] block truncate">
                              {p.l1Name || p.l1Email}
                            </span>
                            {p.l1Name && (
                              <span className="text-[11px] text-[#605e5c] font-mono block truncate">
                                {p.l1Email}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#a19f9d] italic">Unassigned</span>
                      )}
                    </td>

                    {/* L2 Escalation Person */}
                    <td className="py-3 px-4">
                      {p.l2Email ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#c45500] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                            {p.l2Name ? p.l2Name.slice(0, 2).toUpperCase() : 'L2'}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-[#242424] block truncate">
                              {p.l2Name || p.l2Email}
                            </span>
                            {p.l2Name && (
                              <span className="text-[11px] text-[#605e5c] font-mono block truncate">
                                {p.l2Email}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#a19f9d] italic">Unassigned</span>
                      )}
                    </td>

                    {/* SLA Thresholds */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/20" title="SLA1 Warning threshold">
                          {p.sla1Minutes || p.slaMinutes || 30}m
                        </span>
                        <span className="text-[#a19f9d]">/</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#fdf3e7] text-[#c45500] border border-[#c45500]/20" title="SLA2 Breach threshold">
                          {p.sla2Minutes || (p.slaMinutes ? p.slaMinutes * 2 : 60)}m
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setEditingPipeline(p)}
                        className="px-2.5 py-1 rounded text-xs font-semibold text-[#0f6cbd] hover:bg-[#eff6fc] border border-transparent hover:border-[#0f6cbd]/30 transition inline-flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Assign</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#605e5c]">
                    No pipelines found in {selectedWorkspace?.displayName || 'selected workspace'}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SLA & Team Assignment Modal */}
      {editingPipeline && (
        <SlaConfigModal
          workspaceId={selectedWorkspaceId}
          pipeline={editingPipeline}
          isOpen={!!editingPipeline}
          onClose={() => setEditingPipeline(null)}
          onSaved={() => {
            fetchPipelineAssignments(selectedWorkspaceId);
          }}
        />
      )}
    </div>
  );
}
