import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  RefreshCw, 
  Database, 
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
  Wrench
} from 'lucide-react';

export default function TableLogDashboardModal({ 
  workspaceId, 
  pipeline, 
  isOpen, 
  onClose,
  onOpenConfig 
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
  
  // Debug modal for row inspection
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
      const res = await fetch(`/api/diagnostics/ai-fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineName: data?.batchHeader?.pipelineName || pipeline?.pipelineName || 'MasterPipeline',
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
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.batchHeader?.batchId && !selectedBatchId) {
          setSelectedBatchId(json.batchHeader.batchId);
        }
      } else {
        const errJson = await res.json().catch(() => ({ detail: 'Failed to fetch logs' }));
        setError(errJson.detail || 'Failed to fetch table logs.');
      }
    } catch (err) {
      console.error("Error loading table logs:", err);
      setError("Network error while connecting to table logging service.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedBatchId('');
      setData(null);
      fetchData('');
    }
  }, [isOpen, workspaceId, pipelineRunId]);

  const handleBatchSelect = (bId) => {
    setSelectedBatchId(bId);
    fetchData(bId);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!data?.tableDetails) return [];
    return data.tableDetails.filter(row => {
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
  }, [data, layerFilter, statusFilter, searchTerm]);

  const clearFilters = () => {
    setLayerFilter('All');
    setStatusFilter('All');
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-100 truncate">
                  {pipeline?.pipelineName || data?.batchHeader?.pipelineName || "Table Level Logging"}
                </h2>
                {data?.batchHeader?.status && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                    data.batchHeader.status.toLowerCase().includes('success')
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}>
                    {data.batchHeader.status}
                  </span>
                )}
                {data?.batchHeader?.batchId && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[11px]">
                    Batch #{data.batchHeader.batchId}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                {(pipelineRunId || data?.batchHeader?.pipelineRunId) && (
                  <button 
                    onClick={() => copyToClipboard(pipelineRunId || data?.batchHeader?.pipelineRunId)}
                    title="Click to copy Pipeline Run ID"
                    className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
                  >
                    <span>RunId: {(pipelineRunId || data?.batchHeader?.pipelineRunId).slice(0, 18)}...</span>
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                  </button>
                )}
                {data?.batchHeader?.startTime && (
                  <span>Started: {data.batchHeader.startTime.slice(0, 19)}</span>
                )}
                {data?.batchHeader?.duration && (
                  <span>Duration: {data.batchHeader.duration}m</span>
                )}
              </div>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Batch Switcher */}
            {data?.availableBatches && data.availableBatches.length > 0 && (
              <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-2.5 py-1.5 rounded-lg text-xs">
                <span className="text-slate-500">Batch:</span>
                <select
                  value={selectedBatchId || data?.batchHeader?.batchId || ''}
                  onChange={(e) => handleBatchSelect(e.target.value)}
                  className="bg-transparent text-slate-200 font-mono focus:outline-none cursor-pointer"
                >
                  {data.availableBatches.map(b => (
                    <option key={`batch-${b.batchId}`} value={b.batchId} className="bg-slate-900 text-slate-200">
                      #{b.batchId} ({b.pipelineName || 'Pipeline'}) - {b.status} {b.tablesCount !== undefined ? `• ${b.tablesCount} tables` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Configure Mapping button */}
            <button
              onClick={() => onOpenConfig && onOpenConfig()}
              title="Edit Data Source & Column Mappings"
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400" />
              <span>Map Columns</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              title="Refresh Data"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-cyan-400" : ""}`} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-200">
          {/* Unconfigured State */}
          {data?.configured === false && (
            <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">No Lakehouse/Warehouse Mapping Configured</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  To view table-level logging, select your Fabric Warehouse or Lakehouse and map the Batch Header, Bronze, and Silver log tables.
                </p>
              </div>
              <button
                onClick={() => onOpenConfig && onOpenConfig()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs shadow-lg shadow-cyan-600/20 transition"
              >
                Configure Lakehouse / Warehouse & Columns
              </button>
            </div>
          )}

          {/* Not Found State (e.g. Run ID not present in ETLBatchHeader) */}
          {data?.configured && data?.found === false && (
            <div className="p-8 text-center rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">No Table Logs Found for This Run ID</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  {data.message || "This execution run does not have a matching batch in the batch header table."}
                </p>
              </div>
              {data.availableBatches && data.availableBatches.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs text-slate-400 block mb-2 font-medium">
                    Select any recorded batch to view its table-level logs:
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                    {data.availableBatches.map(b => (
                      <button
                        key={`avail-${b.batchId}`}
                        onClick={() => handleBatchSelect(b.batchId)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-cyan-950/60 border border-slate-700 hover:border-cyan-500/50 text-slate-200 text-xs font-mono transition shadow-sm"
                      >
                        Batch #{b.batchId} ({b.pipelineName || 'Pipeline'}) {b.tablesCount !== undefined ? `• ${b.tablesCount} tables` : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {isLoading && !data && (
            <div className="p-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-xs text-slate-400">Querying Fabric SQL Endpoint table logs...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Loaded Dashboard */}
          {data?.configured && data?.kpis && (
            <>
              {/* Informational Banner if Active Batch Has 0 Tables Logged */}
              {data.tableDetails?.length === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-xs text-amber-300">
                      Batch #{data.batchHeader?.batchId || selectedBatchId} has 0 recorded table loads (Status: {data.batchHeader?.status || 'In Progress'}).
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      This batch run has not logged any tables to the Bronze or Silver log tables yet.
                      {data.availableBatches?.some(b => (b.tablesCount || 0) > 0) && (
                        <span className="text-slate-300 ml-1">
                          You can switch to another batch with recorded tables ({data.availableBatches.filter(b => (b.tablesCount || 0) > 0).slice(0, 3).map(b => `Batch #${b.batchId} [${b.tablesCount} tables]`).join(', ')}) using the Batch dropdown above.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 1: Top KPI Cards (5 Cards - Tables with Alerts REMOVED as requested) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Total Tables */}
                <KpiCard
                  title="Total Tables"
                  value={data.kpis.totalTables}
                  icon={<Database className="w-4 h-4 text-blue-400" />}
                  subtext="Loaded across all layers"
                  colorClass="border-slate-800 bg-slate-950/60"
                />

                {/* 2. Successfully Loaded */}
                <KpiCard
                  title="Successfully Loaded"
                  value={data.kpis.successfullyLoaded}
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  subtext="100% data integrity"
                  colorClass="border-emerald-500/20 bg-emerald-950/10"
                  badgeText="Success"
                  badgeColor="bg-emerald-500/15 text-emerald-400"
                />

                {/* 3. Failed Tables */}
                <KpiCard
                  title="Failed Tables"
                  value={data.kpis.failedTables}
                  icon={<XCircle className="w-4 h-4 text-rose-400" />}
                  subtext="Errors during ETL run"
                  colorClass={data.kpis.failedTables > 0 ? "border-rose-500/30 bg-rose-950/15" : "border-slate-800 bg-slate-950/60"}
                  badgeText={data.kpis.failedTables > 0 ? "Failures" : "Clean"}
                  badgeColor={data.kpis.failedTables > 0 ? "bg-rose-500/20 text-rose-400" : "bg-slate-800 text-slate-400"}
                />

                {/* 4. Avg. Load Duration */}
                <KpiCard
                  title="Avg. Load Duration"
                  value={data.kpis.avgLoadDuration}
                  icon={<Clock className="w-4 h-4 text-cyan-400" />}
                  subtext="Per table average execution"
                  colorClass="border-slate-800 bg-slate-950/60"
                />

                {/* 5. Rows Processed */}
                <KpiCard
                  title="Rows Processed"
                  value={data.kpis.rowsProcessed}
                  icon={<Layers className="w-4 h-4 text-purple-400" />}
                  subtext="Total records transferred"
                  colorClass="border-slate-800 bg-slate-950/60"
                />
              </div>

              {/* SECTION 2: Silver & Bronze Layer Overviews */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Silver Layer Overview */}
                <LayerOverviewCard
                  layer="Silver"
                  title="Silver Layer – Tables Overview"
                  overview={data.silverOverview}
                  accentColor="cyan"
                />

                {/* Bronze Layer Overview */}
                <LayerOverviewCard
                  layer="Bronze"
                  title="Bronze Layer – Tables Overview"
                  overview={data.bronzeOverview}
                  accentColor="amber"
                />
              </div>

              {/* SECTION 3: Table Loaded Details Table */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {/* Table Controls Bar */}
                <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      Table Loaded details
                    </h3>
                    <span className="text-slate-500 text-[11px] font-mono">
                      ({filteredRows.length} of {data.tableDetails?.length || 0} tables)
                    </span>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search tables or schemas..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-slate-900 border border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 sm:w-56"
                      />
                    </div>

                    {/* Layer Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs">
                      <span className="text-slate-500">Layer:</span>
                      <select
                        value={layerFilter}
                        onChange={(e) => setLayerFilter(e.target.value)}
                        className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
                      >
                        <option value="All" className="bg-slate-900">All Layers</option>
                        <option value="Bronze" className="bg-slate-900">Bronze</option>
                        <option value="Silver" className="bg-slate-900">Silver</option>
                      </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 px-2.5 py-1.5 rounded-lg text-xs">
                      <span className="text-slate-500">Status:</span>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-transparent text-slate-200 focus:outline-none cursor-pointer font-medium"
                      >
                        <option value="All" className="bg-slate-900">All Status</option>
                        <option value="Success" className="bg-slate-900">Success</option>
                        <option value="Failed" className="bg-slate-900">Failed</option>
                      </select>
                    </div>

                    {/* Clear Filters */}
                    {(layerFilter !== 'All' || statusFilter !== 'All' || searchTerm) && (
                      <button
                        onClick={clearFilters}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Table Name</th>
                        <th className="py-3 px-3">Schema</th>
                        <th className="py-3 px-3">Layer</th>
                        <th className="py-3 px-3">Operation</th>
                        <th className="py-3 px-3">Start Time</th>
                        <th className="py-3 px-3">Duration</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Rows Processed</th>
                        <th className="py-3 px-4">Error Message</th>
                        <th className="py-3 px-3 text-right">Debug</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono text-xs">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                            No table log details matching the active filters.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((r, idx) => {
                          const isSuccess = r.status === 'Success';
                          const isSilver = r.layer === 'Silver';
                          return (
                            <tr key={`tbl-${idx}`} className="hover:bg-slate-800/40 transition">
                              {/* Table Name */}
                              <td className="py-2.5 px-4 font-semibold text-slate-200">
                                <div className="flex items-center gap-2">
                                  <Code2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  <span className="truncate max-w-[200px]" title={r.tableName}>{r.tableName}</span>
                                </div>
                              </td>

                              {/* Schema */}
                              <td className="py-2.5 px-3 text-slate-400">
                                {r.schema}
                              </td>

                              {/* Layer Badge */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isSilver
                                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}>
                                  {r.layer}
                                </span>
                              </td>

                              {/* Operation */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60">
                                  {r.operation?.includes('Data Load') ? 'Data Load' : (r.operation || 'Data Load')}
                                </span>
                              </td>

                              {/* Start Time */}
                              <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap text-[11px]">
                                {r.startTime ? r.startTime.slice(0, 19) : "—"}
                              </td>

                              {/* Duration */}
                              <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                                {r.duration || "—"}
                              </td>

                              {/* Status Badge */}
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  isSuccess
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                }`}>
                                  {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  {isSuccess ? 'Success' : 'Failure'}
                                </span>
                              </td>

                              {/* Rows Processed */}
                              <td className="py-2.5 px-3 text-slate-200 font-semibold whitespace-nowrap">
                                {r.rowsProcessed != null ? r.rowsProcessed.toLocaleString() : "0"}
                              </td>

                              {/* Error Message */}
                              <td className="py-2.5 px-4 text-[11px]">
                                {r.errorMessage && r.errorMessage !== 'No Error' ? (
                                  <span className="text-rose-400 truncate block max-w-xs" title={r.errorMessage}>
                                    {r.errorMessage}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">No Error</span>
                                )}
                              </td>

                              {/* Debug Button */}
                              <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => handleOpenDebugRow(r)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-cyan-400 border border-slate-700 transition"
                                >
                                  Inspect
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Debug & AI Troubleshooting Modal */}
        {debugRow && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-100">
            <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4 max-h-[88vh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm">
                      {debugRow.schema}.{debugRow.tableName} ({debugRow.layer} Layer)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Status: <span className={debugRow.status === 'Success' ? 'text-emerald-400' : 'text-rose-400'}>{debugRow.status}</span> • Operation: {debugRow.operation}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDebugRow(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AI Diagnostic Section for Failed Tables */}
              {(debugRow.status !== 'Success' || (debugRow.errorMessage && debugRow.errorMessage !== 'No Error')) && (
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/25 to-slate-950/40 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span className="font-bold text-xs text-slate-100">AI Failure Diagnostics</span>
                      <span className="text-[10px] text-indigo-300 font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                        Gemini 3.6 Flash
                      </span>
                    </div>

                    {!tableAiData && !isLoadingTableAi && (
                      <button
                        onClick={() => fetchTableAiDiagnosis(debugRow)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold text-xs shadow-md flex items-center gap-1.5 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Diagnose Table Failure</span>
                      </button>
                    )}
                  </div>

                  {isLoadingTableAi && (
                    <div className="p-4 text-center space-y-2">
                      <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mx-auto" />
                      <p className="text-xs text-slate-300 font-medium">Gemini AI is analyzing table load failure...</p>
                    </div>
                  )}

                  {tableAiError && (
                    <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {tableAiError}
                    </div>
                  )}

                  {tableAiData && !isLoadingTableAi && (
                    <div className="space-y-2.5 text-xs animate-in fade-in duration-150">
                      <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/30 space-y-1">
                        <span className="text-[10px] font-bold uppercase text-indigo-400 block">Root Cause</span>
                        <p className="text-slate-200 leading-relaxed">{tableAiData.rootCause}</p>
                      </div>

                      {tableAiData.fixSteps && tableAiData.fixSteps.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-cyan-400 block">Resolution Steps:</span>
                          {tableAiData.fixSteps.map((s, idx) => (
                            <div key={`tablestep-${idx}`} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300 flex items-start gap-2">
                              <span className="font-bold text-cyan-400">{idx + 1}.</span>
                              <span>{s}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {tableAiData.fixScript && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 block">SQL / Fix Script:</span>
                          <pre className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-300 overflow-x-auto select-text">
                            {tableAiData.fixScript}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Raw Row Diagnostics */}
              <div className="space-y-1.5 flex-1 overflow-y-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Raw Telemetry Columns</span>
                <div className="space-y-1.5 pr-1 text-xs">
                  {debugRow.rawData ? (
                    Object.entries(debugRow.rawData).map(([k, v]) => (
                      <div key={k} className="p-2 rounded bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row justify-between gap-2">
                        <span className="font-mono text-cyan-400 font-semibold shrink-0">{k}:</span>
                        <span className="font-mono text-slate-300 break-all text-right">{v !== null ? String(v) : "<null>"}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic">No raw row telemetry available.</p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end border-t border-slate-800">
                <button
                  onClick={() => setDebugRow(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon, subtext, colorClass, badgeText, badgeColor }) {
  return (
    <div className={`p-4 rounded-xl border ${colorClass} shadow-md flex flex-col justify-between`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        {icon}
      </div>

      <div className="my-2">
        <span className="text-2xl font-extrabold text-slate-100 tracking-tight">{value}</span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span className="truncate">{subtext}</span>
        {badgeText && (
          <span className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${badgeColor}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
}

function LayerOverviewCard({ layer, title, overview, accentColor }) {
  if (!overview) return null;

  const isCyan = accentColor === 'cyan';
  const borderTone = isCyan ? 'border-cyan-500/20 bg-cyan-950/5' : 'border-amber-500/20 bg-amber-950/5';
  const textTone = isCyan ? 'text-cyan-400' : 'text-amber-400';

  return (
    <div className={`p-4 rounded-xl border ${borderTone} shadow-md space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isCyan ? 'bg-cyan-400' : 'bg-amber-400'}`}></span>
          <h4 className="font-bold text-slate-100 text-xs">{title}</h4>
        </div>
        <span className={`text-[11px] font-bold ${textTone}`}>
          {overview.successRate} Success
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Total Tables</span>
          <span className="text-base font-bold text-slate-100">{overview.totalTables}</span>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-emerald-400 block">Successfully Loaded</span>
          <span className="text-base font-bold text-emerald-400">{overview.successfullyLoaded}</span>
        </div>
        <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
          <span className="text-[10px] text-rose-400 block">Failed</span>
          <span className="text-base font-bold text-rose-400">{overview.failed}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60 font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>Avg. Load Duration:</span>
          <span className="text-slate-200 font-semibold">{overview.avgLoadDuration}</span>
        </div>
        <div className="flex items-center justify-between text-slate-400">
          <span>Rows Processed:</span>
          <span className="text-slate-200 font-semibold">{overview.rowsProcessed}</span>
        </div>
      </div>
    </div>
  );
}

