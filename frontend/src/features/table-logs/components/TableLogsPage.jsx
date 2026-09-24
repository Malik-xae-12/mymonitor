import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Search, 
  Filter, 
  Settings, 
  AlertOctagon, 
  ChevronDown, 
  Copy, 
  Check, 
  Info,
  ExternalLink,
  Code2,
  Sparkles,
  Wrench,
  TableProperties,
  ArrowLeft,
  X,
  FileSpreadsheet
} from 'lucide-react';

export default function TableLogsPage({ 
  workspaceId, 
  workspaceName,
  pipeline, 
  pipelines = [],
  onSelectPipeline,
  onOpenConfig,
  onBackToMonitoring
}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [copied, setCopied] = useState(false);

  // Filters
  const [layerFilter, setLayerFilter] = useState('All'); // 'All' | 'Bronze' | 'Silver'
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Success' | 'Failed'
  const [searchTerm, setSearchTerm] = useState('');
  
  // Inspection / AI diagnostics
  const [debugRow, setDebugRow] = useState(null);
  const [tableAiData, setTableAiData] = useState(null);
  const [isLoadingTableAi, setIsLoadingTableAi] = useState(false);
  const [tableAiError, setTableAiError] = useState(null);

  const rawRunId = pipeline?.id || pipeline?.pipelineRunId || pipeline?.runId || '';
  const pipelineRunId = rawRunId && !rawRunId.startsWith('norun-') ? rawRunId : '';

  const handleOpenDebugRow = (row) => {
    setDebugRow(row);
    setTableAiData(null);
    setTableAiError(null);
  };

  const fetchTableAiDiagnosis = async (row) => {
    if (!row) return;
    setIsLoadingTableAi(true);
    setTableAiError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/diagnostics/ai-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineName: data?.batchHeader?.pipelineName || pipeline?.pipelineName || 'Pipeline',
          activityName: `${row.layer}_${row.tableName}`,
          activityType: `${row.layer} Layer Ingestion (${row.operation || 'Data Load'})`,
          errorCode: 'TableLoadFailure',
          errorMessage: row.errorMessage || 'Table extraction or loading failed.',
          failureType: 'DataLoadError',
          target: `${row.schema}.${row.tableName}`,
          rawError: row.rawData
        })
      });

      if (res.ok) {
        const json = await res.json();
        setTableAiData(json);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed to contact AI service' }));
        setTableAiError(err.detail || 'Could not retrieve AI diagnostic.');
      }
    } catch (err) {
      console.error("Table AI diagnostics error:", err);
      setTableAiError("Network error while connecting to AI diagnostic service.");
    } finally {
      setIsLoadingTableAi(false);
    }
  };

  const fetchData = async (overrideBatchId = null) => {
    if (!workspaceId) return;
    setIsLoading(true);
    setError(null);

    let url = `/api/workspaces/${workspaceId}/table-logs?`;
    const targetBatch = overrideBatchId !== null ? overrideBatchId : selectedBatchId;
    if (targetBatch) {
      url += `batch_id=${encodeURIComponent(targetBatch)}`;
    } else if (pipelineRunId) {
      url += `pipeline_run_id=${encodeURIComponent(pipelineRunId)}`;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: 'Failed to fetch table logs' }));
        throw new Error(errJson.detail || 'Network error fetching table logs');
      }
      const json = await res.json();
      setData(json);
      if (json?.batchHeader?.batchId && !overrideBatchId && !selectedBatchId) {
        setSelectedBatchId(json.batchHeader.batchId);
      }
    } catch (err) {
      console.error("Table Logs fetch failed:", err);
      setError(err.message || 'Error loading table logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [workspaceId, pipelineRunId]);

  const handleBatchSelect = (batchId) => {
    setSelectedBatchId(batchId);
    fetchData(batchId);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDuration = (dur, start, end) => {
    if (!dur && !end) return '—';
    const durStr = String(dur || '').trim();

    const parseMs = (t) => {
      if (!t) return null;
      try {
        const parts = String(t).trim().replace(' ', 'T').split('.');
        const iso = parts[0] + (parts[1] ? '.' + parts[1].slice(0, 3) : '');
        const ms = new Date(iso).getTime();
        return isNaN(ms) ? null : ms;
      } catch {
        return null;
      }
    };

    if (durStr.includes('-') && durStr.includes(':')) {
      if (start) {
        const s = parseMs(start);
        const e = parseMs(durStr);
        if (s && e && e >= s) {
          const diffSec = Math.max(0, Math.round((e - s) / 1000));
          const m = Math.floor(diffSec / 60);
          const sec = diffSec % 60;
          return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
        }
      }
    }
    if (durStr && !durStr.includes('-')) return durStr;
    if (start && end) {
      const s = parseMs(start);
      const e = parseMs(end);
      if (s && e && e >= s) {
        const diffSec = Math.max(0, Math.round((e - s) / 1000));
        const m = Math.floor(diffSec / 60);
        const sec = diffSec % 60;
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
      }
    }
    return durStr || '—';
  };

  const allTableRows = useMemo(() => {
    return data?.tableDetails || data?.tables || [];
  }, [data]);

  // Filtered table rows
  const filteredRows = useMemo(() => {
    if (!allTableRows || allTableRows.length === 0) return [];
    return allTableRows.filter(row => {
      const matchLayer = layerFilter === 'All' || row.layer?.toLowerCase() === layerFilter.toLowerCase();
      const matchStatus = statusFilter === 'All' || 
        (statusFilter === 'Success' && row.status?.toLowerCase() === 'success') ||
        (statusFilter === 'Failed' && row.status?.toLowerCase() !== 'success');
      const matchSearch = !searchTerm || 
        row.tableName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.schema?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.operation?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchLayer && matchStatus && matchSearch;
    });
  }, [allTableRows, layerFilter, statusFilter, searchTerm]);

  const clearFilters = () => {
    setLayerFilter('All');
    setStatusFilter('All');
    setSearchTerm('');
  };

  const batches = data?.availableBatches || data?.recentBatches || [];
  const currentBatchHeader = data?.batchHeader;
  const silverData = data?.silverOverview || data?.layerOverviews?.silver;
  const bronzeData = data?.bronzeOverview || data?.layerOverviews?.bronze;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] text-[#242424] font-sans overflow-hidden">
      {/* 1. Page Header & Command Ribbon */}
      <div className="bg-white border-b border-[#edebe9] px-6 py-3.5 shrink-0 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Page Title & Pipeline Selector */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMonitoring}
              title="Back to Monitoring Hub"
              className="p-1.5 rounded hover:bg-[#f3f2f1] text-[#605e5c] hover:text-[#242424] transition border border-[#edebe9]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-[#242424]">
                  Table logs
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e3f7ef] text-[#117865]">
                  L2
                </span>
                
                {/* Pipeline Selector if multiple pipelines exist */}
                {pipelines && pipelines.length > 0 && (
                  <div className="relative inline-block ml-2">
                    <select
                      value={pipeline?.id || pipeline?.pipelineId || ''}
                      onChange={(e) => {
                        const sel = pipelines.find(p => p.id === e.target.value || p.pipelineId === e.target.value);
                        if (sel && onSelectPipeline) {
                          onSelectPipeline(sel);
                        }
                      }}
                      className="bg-[#f5f5f5] hover:bg-[#edebe9] border border-[#d1d1d1] rounded px-2.5 py-1 text-xs font-semibold text-[#242424] focus:outline-none focus:border-[#117865] cursor-pointer"
                    >
                      {pipelines.map(p => (
                        <option key={p.id || p.pipelineId} value={p.id || p.pipelineId}>
                          {p.pipelineName || p.name || 'Pipeline'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#605e5c] mt-0.5">
                Lakehouse & Warehouse bronze/silver ingestion telemetry, batch execution details, and AI diagnostics.
              </p>
            </div>
          </div>

          {/* Right: Batch Switcher & Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Batch Selector Dropdown */}
            {batches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-[#ffffff] border border-[#d1d1d1] px-2.5 py-1 rounded text-xs">
                <span className="text-[#605e5c] font-medium">Batch:</span>
                <select
                  value={selectedBatchId || currentBatchHeader?.batchId || ''}
                  onChange={(e) => handleBatchSelect(e.target.value)}
                  className="bg-transparent text-[#242424] font-mono focus:outline-none cursor-pointer max-w-[280px] truncate font-medium"
                >
                  {batches.map(b => (
                    <option key={`batch-${b.batchId}`} value={b.batchId}>
                      #{b.batchId} ({b.pipelineName || 'Pipeline'}) - {b.status} {b.tablesCount !== undefined ? `• ${b.tablesCount} tables` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Map Columns Configuration */}
            {onOpenConfig && (
              <button
                type="button"
                onClick={onOpenConfig}
                title="Configure Lakehouse/Warehouse table catalog and audit column mappings"
                className="px-3 py-1.5 rounded bg-white hover:bg-[#f3f2f1] border border-[#d1d1d1] hover:border-[#117865] text-[#242424] hover:text-[#117865] text-xs font-medium flex items-center gap-1.5 transition shadow-2xs"
              >
                <Settings className="w-3.5 h-3.5 text-[#117865]" />
                <span>Map Columns</span>
              </button>
            )}

            {/* Refresh */}
            <button
              type="button"
              onClick={() => fetchData()}
              title="Refresh Table Logs"
              className="p-1.5 rounded bg-white hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#605e5c] hover:text-[#242424] transition shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#117865]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Sub-strip: Active Batch Run Information */}
        {currentBatchHeader && (
          <div className="flex items-center gap-4 text-xs pt-2 border-t border-[#edebe9] flex-wrap">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#242424]">
                {currentBatchHeader.pipelineName || pipeline?.pipelineName || "Pipeline"}
              </span>
              {currentBatchHeader.batchId && (
                <span className="px-2 py-0.5 rounded bg-[#f3f2f1] text-[#323130] border border-[#e1dfdd] font-mono text-[11px] font-semibold">
                  Batch #{currentBatchHeader.batchId}
                </span>
              )}
              {currentBatchHeader.status && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                  currentBatchHeader.status.toLowerCase().includes('success') || currentBatchHeader.status.toLowerCase().includes('completed')
                    ? 'bg-[#dff6dd] text-[#107c41] border-[#92c353]'
                    : currentBatchHeader.status.toLowerCase().includes('fail')
                    ? 'bg-[#fde7e9] text-[#a80000] border-[#f19999]'
                    : 'bg-[#fff4ce] text-[#8a660a] border-[#fed9cc]'
                }`}>
                  {currentBatchHeader.status}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#605e5c] font-mono">
              {(pipelineRunId || currentBatchHeader.pipelineRunId) && (
                <button 
                  type="button"
                  onClick={() => copyToClipboard(pipelineRunId || currentBatchHeader.pipelineRunId)}
                  title="Click to copy Pipeline Run ID"
                  className="flex items-center gap-1 text-[#605e5c] hover:text-[#0f6cbd] transition"
                >
                  <span>RunId: {(pipelineRunId || currentBatchHeader.pipelineRunId).slice(0, 20)}...</span>
                  {copied ? <Check className="w-3 h-3 text-[#107c41]" /> : <Copy className="w-3 h-3 text-[#a19f9d]" />}
                </button>
              )}
              {currentBatchHeader.startTime && (
                <span>Started: {currentBatchHeader.startTime.slice(0, 19)}</span>
              )}
              {(currentBatchHeader.duration || currentBatchHeader.endTime) && (
                <span>Duration: {formatDuration(currentBatchHeader.duration, currentBatchHeader.startTime, currentBatchHeader.endTime)}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Main Scrollable Workspace Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Unconfigured State */}
        {data?.configured === false && (
          <div className="p-8 text-center rounded-lg bg-white border border-[#edebe9] space-y-4 shadow-sm max-w-2xl mx-auto mt-8">
            <div className="w-12 h-12 rounded bg-[#e3f7ef] border border-[#117865]/20 text-[#117865] flex items-center justify-center mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#242424]">No Lakehouse/Warehouse Mapping Configured</h3>
              <p className="text-xs text-[#605e5c] max-w-md mx-auto">
                To view table-level logging, select your Fabric Warehouse or Lakehouse and map the Batch Header, Bronze, and Silver log tables.
              </p>
            </div>
            {onOpenConfig && (
              <button
                type="button"
                onClick={onOpenConfig}
                className="px-4 py-2 rounded-md bg-[#117865] hover:bg-[#0c5e4f] text-white font-medium text-xs shadow-sm transition"
              >
                Configure Lakehouse / Warehouse & Columns
              </button>
            )}
          </div>
        )}

        {/* Alert Banner for 0 Recorded Table Loads */}
        {data?.configured && allTableRows.length === 0 && (
          <div className="p-4 rounded-lg bg-[#fff4ce] border border-[#f3d97f] text-[#242424] flex items-start gap-3 shadow-2xs">
            <Info className="w-5 h-5 text-[#8a660a] shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-[#8a660a]">
                Batch #{currentBatchHeader?.batchId || selectedBatchId || "N/A"} has 0 recorded table loads
                {currentBatchHeader?.status ? ` (Status: ${currentBatchHeader.status})` : ''}.
              </p>
              <p className="text-[#605e5c]">
                This batch run has not logged any tables to the Bronze or Silver log tables yet. 
                {batches.length > 1 && (
                  <span> You can switch to another batch with recorded tables using the Batch dropdown above.</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* 3. Top KPI Metric Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="bg-white border border-[#edebe9] rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#605e5c] font-medium">Total Tables</span>
              <Database className="w-4 h-4 text-[#0f6cbd]" />
            </div>
            <div className="text-2xl font-bold text-[#242424] mt-1.5">
              {data?.kpis?.totalTables ?? allTableRows.length}
            </div>
            <span className="text-[11px] text-[#605e5c] mt-0.5 block">Loaded across all layers</span>
          </div>

          <div className="bg-white border border-[#edebe9] rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#605e5c] font-medium">Successfully Loaded</span>
              <CheckCircle2 className="w-4 h-4 text-[#107c41]" />
            </div>
            <div className="text-2xl font-bold text-[#107c41] mt-1.5">
              {data?.kpis?.successfullyLoaded ?? data?.kpis?.successCount ?? 0}
            </div>
            <span className="text-[11px] text-[#107c41] font-semibold mt-0.5 block">100% data integrity</span>
          </div>

          <div className="bg-white border border-[#edebe9] rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#605e5c] font-medium">Failed Tables</span>
              <XCircle className="w-4 h-4 text-[#a80000]" />
            </div>
            <div className={`text-2xl font-bold mt-1.5 ${
              (data?.kpis?.failedTables ?? data?.kpis?.failedCount ?? 0) > 0 ? 'text-[#a80000]' : 'text-[#242424]'
            }`}>
              {data?.kpis?.failedTables ?? data?.kpis?.failedCount ?? 0}
            </div>
            <span className="text-[11px] text-[#605e5c] mt-0.5 block">Errors during ETL run</span>
          </div>

          <div className="bg-white border border-[#edebe9] rounded-lg p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#605e5c] font-medium">Avg. Load Duration</span>
              <Clock className="w-4 h-4 text-[#008272]" />
            </div>
            <div className="text-2xl font-bold text-[#242424] mt-1.5">
              {data?.kpis?.avgLoadDuration || data?.kpis?.avgDurationFormatted || "0.00s"}
            </div>
            <span className="text-[11px] text-[#605e5c] mt-0.5 block">Per table average execution</span>
          </div>

          <div className="bg-white border border-[#edebe9] rounded-lg p-3.5 shadow-2xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#605e5c] font-medium">Rows Processed</span>
              <Layers className="w-4 h-4 text-[#8764b8]" />
            </div>
            <div className="text-2xl font-bold text-[#242424] mt-1.5 font-mono">
              {data?.kpis?.rowsProcessed || data?.kpis?.totalRowsFormatted || (data?.kpis?.totalRows ? data.kpis.totalRows.toLocaleString() : "0")}
            </div>
            <span className="text-[11px] text-[#605e5c] mt-0.5 block">Total records transferred</span>
          </div>
        </div>

        {/* 4. Layer Overview Dual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Silver Layer Overview (L2) */}
          <div className="bg-white border border-[#edebe9] rounded-lg p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0f6cbd]" />
                <span className="text-xs font-semibold text-[#242424]">Silver Layer – Tables Overview</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#ebf3fc] text-[#0f6cbd]">L2</span>
              </div>
              <span className="text-xs font-semibold text-[#107c41]">
                {silverData?.successRate || "100.0%"} Success
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Total Tables</span>
                <span className="text-sm font-bold text-[#242424]">{silverData?.totalTables ?? 0}</span>
              </div>
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Successfully Loaded</span>
                <span className="text-sm font-bold text-[#107c41]">{silverData?.successfullyLoaded ?? silverData?.successCount ?? 0}</span>
              </div>
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Failed</span>
                <span className={`text-sm font-bold ${
                  (silverData?.failed ?? silverData?.failedCount ?? 0) > 0 ? 'text-[#a80000]' : 'text-[#242424]'
                }`}>
                  {silverData?.failed ?? silverData?.failedCount ?? 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#605e5c] pt-1">
              <span>Avg. Load Duration: <strong className="text-[#242424]">{silverData?.avgLoadDuration || silverData?.avgDurationFormatted || "0.00s"}</strong></span>
              <span>Rows Processed: <strong className="text-[#242424]">{silverData?.rowsProcessed || silverData?.totalRowsFormatted || "0"}</strong></span>
            </div>
          </div>

          {/* Bronze Layer Overview (L1) */}
          <div className="bg-white border border-[#edebe9] rounded-lg p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c19c00]" />
                <span className="text-xs font-semibold text-[#242424]">Bronze Layer – Tables Overview</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#fff4ce] text-[#8a660a]">L1</span>
              </div>
              <span className="text-xs font-semibold text-[#107c41]">
                {bronzeData?.successRate || "100.0%"} Success
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Total Tables</span>
                <span className="text-sm font-bold text-[#242424]">{bronzeData?.totalTables ?? 0}</span>
              </div>
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Successfully Loaded</span>
                <span className="text-sm font-bold text-[#107c41]">{bronzeData?.successfullyLoaded ?? bronzeData?.successCount ?? 0}</span>
              </div>
              <div className="p-2 rounded bg-[#faf9f8] border border-[#edebe9]">
                <span className="text-[11px] text-[#605e5c] block">Failed</span>
                <span className={`text-sm font-bold ${
                  (bronzeData?.failed ?? bronzeData?.failedCount ?? 0) > 0 ? 'text-[#a80000]' : 'text-[#242424]'
                }`}>
                  {bronzeData?.failed ?? bronzeData?.failedCount ?? 0}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#605e5c] pt-1">
              <span>Avg. Load Duration: <strong className="text-[#242424]">{bronzeData?.avgLoadDuration || bronzeData?.avgDurationFormatted || "0.00s"}</strong></span>
              <span>Rows Processed: <strong className="text-[#242424]">{bronzeData?.rowsProcessed || bronzeData?.totalRowsFormatted || "0"}</strong></span>
            </div>
          </div>
        </div>

        {/* 5. Filter & Search Toolbar */}
        <div className="bg-white border border-[#edebe9] rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          {/* Left: Layer & Status Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Layer tabs */}
            <div className="flex items-center bg-[#f5f5f5] p-0.5 rounded border border-[#edebe9] text-xs">
              <button
                type="button"
                onClick={() => setLayerFilter('All')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  layerFilter === 'All'
                    ? 'bg-white text-[#242424] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                All Layers ({allTableRows.length})
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('Silver')}
                className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                  layerFilter === 'Silver'
                    ? 'bg-white text-[#0f6cbd] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#0f6cbd]" />
                <span>Silver (L2) ({allTableRows.filter(r => r.layer?.toLowerCase() === 'silver').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLayerFilter('Bronze')}
                className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                  layerFilter === 'Bronze'
                    ? 'bg-white text-[#c19c00] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#c19c00]" />
                <span>Bronze (L1) ({allTableRows.filter(r => r.layer?.toLowerCase() === 'bronze').length})</span>
              </button>
            </div>

            {/* Status tabs */}
            <div className="flex items-center bg-[#f5f5f5] p-0.5 rounded border border-[#edebe9] text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('All')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  statusFilter === 'All'
                    ? 'bg-white text-[#242424] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Success')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  statusFilter === 'Success'
                    ? 'bg-white text-[#107c41] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                Success
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('Failed')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  statusFilter === 'Failed'
                    ? 'bg-white text-[#a80000] shadow-xs font-semibold'
                    : 'text-[#605e5c] hover:text-[#242424]'
                }`}
              >
                Failed
              </button>
            </div>
          </div>

          {/* Right: Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-[#797775] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search table or schema..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#fafafa] border border-[#d1d1d1] rounded pl-9 pr-3 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#117865] focus:bg-white transition"
            />
          </div>
        </div>

        {/* 6. Telemetry Table Grid */}
        <div className="bg-white border border-[#edebe9] rounded-lg shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f5f5f5] text-[#605e5c] font-semibold border-b border-[#edebe9]">
                <tr>
                  <th className="py-2.5 px-4">Layer</th>
                  <th className="py-2.5 px-4">Table Name</th>
                  <th className="py-2.5 px-4">Schema</th>
                  <th className="py-2.5 px-4">Operation</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Rows Processed</th>
                  <th className="py-2.5 px-4">Duration</th>
                  <th className="py-2.5 px-4">Execution Time</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {filteredRows.length > 0 ? (
                  filteredRows.map((row, idx) => {
                    const isSuccess = row.status?.toLowerCase() === 'success';
                    return (
                      <tr key={`row-${idx}`} className="hover:bg-[#faf9f8] transition">
                        {/* Layer */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.layer?.toLowerCase() === 'silver'
                              ? 'bg-[#ebf3fc] text-[#0f6cbd]'
                              : 'bg-[#fff4ce] text-[#8a660a]'
                          }`}>
                            {row.layer?.toUpperCase()}
                          </span>
                        </td>

                        {/* Table Name */}
                        <td className="py-3 px-4 font-semibold text-[#242424]">
                          {row.tableName}
                        </td>

                        {/* Schema */}
                        <td className="py-3 px-4 font-mono text-[#605e5c]">
                          {row.schema || 'dbo'}
                        </td>

                        {/* Operation */}
                        <td className="py-3 px-4 text-[#605e5c]">
                          {row.operation || 'Data Load'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 border ${
                            isSuccess
                              ? 'bg-[#dff6dd] text-[#107c41] border-[#92c353]'
                              : 'bg-[#fde7e9] text-[#a80000] border-[#f19999]'
                          }`}>
                            {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span>{row.status}</span>
                          </span>
                        </td>

                        {/* Rows Processed */}
                        <td className="py-3 px-4 font-mono text-[#242424]">
                          {typeof row.rowsProcessed === 'number' 
                            ? row.rowsProcessed.toLocaleString() 
                            : (row.rowsProcessed || '0')}
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-4 text-[#605e5c]">
                          {row.duration || '—'}
                        </td>

                        {/* Execution Time */}
                        <td className="py-3 px-4 text-[11px] text-[#605e5c] font-mono">
                          {row.startTime ? row.startTime.slice(0, 19) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenDebugRow(row)}
                            className="px-2 py-1 rounded text-xs font-medium text-[#0f6cbd] hover:bg-[#eff6fc] transition"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#605e5c]">
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-[#117865]" />
                          <span>Loading table logs...</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-[#242424]">No table logs found</p>
                          <p className="text-xs text-[#605e5c]">
                            {searchTerm || layerFilter !== 'All' || statusFilter !== 'All'
                              ? 'Try clearing active filters to see all recorded table logs.'
                              : 'No tables were recorded for this batch execution.'}
                          </p>
                          {(searchTerm || layerFilter !== 'All' || statusFilter !== 'All') && (
                            <button
                              type="button"
                              onClick={clearFilters}
                              className="text-xs font-semibold text-[#117865] hover:underline mt-2 inline-block"
                            >
                              Reset filters
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. Detailed Row Inspection & Google Gemini AI Diagnostic Modal */}
      {debugRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none">
          <div className="relative w-full max-w-2xl bg-white border border-[#edebe9] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#edebe9] flex items-center justify-between bg-[#faf9f8]">
              <div>
                <h3 className="text-sm font-semibold text-[#242424]">
                  Table Telemetry Details: {debugRow.schema}.{debugRow.tableName}
                </h3>
                <span className="text-xs text-[#605e5c]">
                  Layer: {debugRow.layer} • Status: {debugRow.status}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDebugRow(null)}
                className="p-1.5 rounded hover:bg-[#ebebeb] text-[#605e5c] hover:text-[#242424]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Row attributes summary */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-[#fafafa] border border-[#edebe9]">
                <div>
                  <span className="text-[#605e5c] block text-[11px]">Table Name</span>
                  <span className="font-semibold text-[#242424]">{debugRow.tableName}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] block text-[11px]">Schema</span>
                  <span className="font-semibold text-[#242424]">{debugRow.schema || 'dbo'}</span>
                </div>
                <div>
                  <span className="text-[#605e5c] block text-[11px]">Rows Processed</span>
                  <span className="font-mono font-semibold text-[#242424]">
                    {debugRow.rowsProcessed?.toLocaleString() || '0'}
                  </span>
                </div>
                <div>
                  <span className="text-[#605e5c] block text-[11px]">Duration</span>
                  <span className="font-semibold text-[#242424]">{debugRow.duration || '—'}</span>
                </div>
              </div>

              {/* Error Details if Failed */}
              {debugRow.errorMessage && (
                <div className="p-3.5 rounded-md bg-[#fde7e9] border border-[#f19999] text-[#a80000] space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertOctagon className="w-4 h-4" />
                    <span>Table Load Error</span>
                  </div>
                  <p className="font-mono text-[11px] whitespace-pre-wrap">{debugRow.errorMessage}</p>
                </div>
              )}

              {/* AI Diagnostic Trigger */}
              {debugRow.status?.toLowerCase() !== 'success' && (
                <div className="p-4 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#15803d]">
                      <Sparkles className="w-4 h-4" />
                      <span>Google Gemini AI Failure Diagnostics</span>
                    </div>
                    {!tableAiData && (
                      <button
                        type="button"
                        onClick={() => fetchTableAiDiagnosis(debugRow)}
                        disabled={isLoadingTableAi}
                        className="px-3 py-1 rounded bg-[#15803d] hover:bg-[#166534] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        {isLoadingTableAi ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Diagnose Failure</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {tableAiError && (
                    <p className="text-xs text-[#a80000]">{tableAiError}</p>
                  )}

                  {tableAiData && (
                    <div className="space-y-2 text-xs text-[#242424] pt-2 border-t border-[#bbf7d0]">
                      <div>
                        <span className="font-bold text-[#15803d]">Root Cause Analysis:</span>
                        <p className="mt-0.5">{tableAiData.rootCause || tableAiData.explanation}</p>
                      </div>
                      {tableAiData.recommendedFix && (
                        <div>
                          <span className="font-bold text-[#15803d]">Recommended Fix:</span>
                          <p className="mt-0.5">{tableAiData.recommendedFix}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON Data */}
              <div>
                <span className="text-[11px] font-semibold text-[#605e5c] block mb-1">
                  Raw Record Payload
                </span>
                <pre className="p-3 bg-[#f5f5f5] rounded border border-[#edebe9] text-[11px] font-mono overflow-x-auto text-[#242424]">
                  {JSON.stringify(debugRow, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-[#edebe9] bg-[#faf9f8] flex justify-end">
              <button
                type="button"
                onClick={() => setDebugRow(null)}
                className="px-4 py-1.5 rounded-md border border-[#d1d1d1] bg-white text-xs font-medium hover:bg-[#f3f2f1]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

