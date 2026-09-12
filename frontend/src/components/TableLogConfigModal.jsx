import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Layers, 
  Check, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  ChevronRight,
  TableProperties,
  Trash2,
  CheckCircle2
} from 'lucide-react';

export default function TableLogConfigModal({ workspaceId, isOpen, onClose, onSaved }) {
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [availableTables, setAvailableTables] = useState([]);
  
  // Table Selections (Schema.Table) - completely dynamic, NO hardcoding!
  const [batchHeaderTable, setBatchHeaderTable] = useState('');
  const [bronzeTable, setBronzeTable] = useState('');
  const [silverTable, setSilverTable] = useState('');

  // Column Lists per selected table
  const [batchHeaderCols, setBatchHeaderCols] = useState([]);
  const [bronzeCols, setBronzeCols] = useState([]);
  const [silverCols, setSilverCols] = useState([]);

  // Column Mappings - completely dynamic, NO pre-filled hardcoded column names!
  const [batchHeaderMapping, setBatchHeaderMapping] = useState({});
  const [bronzeMapping, setBronzeMapping] = useState({});
  const [silverMapping, setSilverMapping] = useState({});

  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('source'); // 'source' | 'batch_header' | 'bronze' | 'silver'

  // Load existing mapping and workspace artifacts
  useEffect(() => {
    if (!isOpen || !workspaceId) return;

    const loadData = async () => {
      setIsLoadingArtifacts(true);
      setStatusMsg(null);
      try {
        // 1. Fetch artifacts (warehouses & lakehouses)
        const artRes = await fetch(`/api/workspaces/${workspaceId}/data-artifacts`);
        let artList = [];
        if (artRes.ok) {
          const artJson = await artRes.json();
          artList = artJson.artifacts || [];
          setArtifacts(artList);
        }

        // 2. Fetch existing mapping from database if previously configured
        const mapRes = await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`);
        if (mapRes.ok) {
          const mapJson = await mapRes.json();
          if (mapJson.mapping) {
            const m = mapJson.mapping;
            setSelectedArtifactId(m.artifact_id || '');
            const bhFull = (m.batch_header_schema && m.batch_header_table) ? `${m.batch_header_schema}.${m.batch_header_table}` : '';
            const brFull = (m.bronze_schema && m.bronze_table) ? `${m.bronze_schema}.${m.bronze_table}` : '';
            const slFull = (m.silver_schema && m.silver_table) ? `${m.silver_schema}.${m.silver_table}` : '';
            
            setBatchHeaderTable(bhFull);
            setBronzeTable(brFull);
            setSilverTable(slFull);

            setBatchHeaderMapping(m.batch_header_mapping || {});
            setBronzeMapping(m.bronze_mapping || {});
            setSilverMapping(m.silver_mapping || {});

            // Fetch tables for this artifact
            if (m.server_fqdn && m.database_name) {
              await fetchTables(m.server_fqdn, m.database_name, bhFull, brFull, slFull);
            }
            return;
          }
        }

        // If no existing mapping saved in database, leave everything empty for dynamic setup!
        setSelectedArtifactId('');
        setBatchHeaderTable('');
        setBronzeTable('');
        setSilverTable('');
        setBatchHeaderMapping({});
        setBronzeMapping({});
        setSilverMapping({});
        setAvailableTables([]);
      } catch (err) {
        console.error("Error loading config:", err);
        setStatusMsg({ type: 'error', text: 'Failed to load workspace data sources.' });
      } finally {
        setIsLoadingArtifacts(false);
      }
    };

    loadData();
  }, [isOpen, workspaceId]);

  const fetchTables = async (serverFqdn, databaseName, preBH = '', preBR = '', preSL = '') => {
    setIsLoadingTables(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sql-metadata/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverFqdn, databaseName })
      });
      if (res.ok) {
        const json = await res.json();
        const tbls = json.tables || [];
        setAvailableTables(tbls);

        // Only pre-populate if previously saved mapping exists
        if (preBH) {
          setBatchHeaderTable(preBH);
          const [s, t] = preBH.split('.');
          fetchCols(serverFqdn, databaseName, s, t, setBatchHeaderCols);
        }
        if (preBR) {
          setBronzeTable(preBR);
          const [s, t] = preBR.split('.');
          fetchCols(serverFqdn, databaseName, s, t, setBronzeCols);
        }
        if (preSL) {
          setSilverTable(preSL);
          const [s, t] = preSL.split('.');
          fetchCols(serverFqdn, databaseName, s, t, setSilverCols);
        }
      }
    } catch (e) {
      console.error("Failed to fetch tables:", e);
      setStatusMsg({ type: 'error', text: 'Could not connect to SQL Endpoint to fetch tables.' });
    } finally {
      setIsLoadingTables(false);
    }
  };

  const fetchCols = async (serverFqdn, databaseName, schemaName, tableName, setColState) => {
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sql-metadata/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverFqdn, databaseName, schemaName, tableName })
      });
      if (res.ok) {
        const json = await res.json();
        setColState(json.columns || []);
      }
    } catch (e) {
      console.error(`Failed to fetch columns for ${schemaName}.${tableName}:`, e);
    }
  };

  const handleArtifactChange = (artId) => {
    setSelectedArtifactId(artId);
    const art = artifacts.find(a => a.id === artId);
    if (art && art.serverFqdn && art.databaseName) {
      setBatchHeaderTable('');
      setBronzeTable('');
      setSilverTable('');
      setBatchHeaderCols([]);
      setBronzeCols([]);
      setSilverCols([]);
      setBatchHeaderMapping({});
      setBronzeMapping({});
      setSilverMapping({});
      fetchTables(art.serverFqdn, art.databaseName);
    }
  };

  const handleTableChange = (tableType, fullTableName) => {
    const art = artifacts.find(a => a.id === selectedArtifactId);
    if (!art || !fullTableName) return;
    const [s, t] = fullTableName.split('.');

    if (tableType === 'batch_header') {
      setBatchHeaderTable(fullTableName);
      fetchCols(art.serverFqdn, art.databaseName, s, t, setBatchHeaderCols);
    } else if (tableType === 'bronze') {
      setBronzeTable(fullTableName);
      fetchCols(art.serverFqdn, art.databaseName, s, t, setBronzeCols);
    } else if (tableType === 'silver') {
      setSilverTable(fullTableName);
      fetchCols(art.serverFqdn, art.databaseName, s, t, setSilverCols);
    }
  };

  const handleResetMapping = async () => {
    if (!window.confirm("Are you sure you want to clear and reset the table log mapping for this workspace? Everything will be reset for dynamic setup.")) {
      return;
    }
    try {
      await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`, { method: 'DELETE' });
      setSelectedArtifactId('');
      setBatchHeaderTable('');
      setBronzeTable('');
      setSilverTable('');
      setBatchHeaderCols([]);
      setBronzeCols([]);
      setSilverCols([]);
      setBatchHeaderMapping({});
      setBronzeMapping({});
      setSilverMapping({});
      setAvailableTables([]);
      setStatusMsg({ type: 'success', text: 'All mappings cleared. Everything is ready for fresh dynamic configuration.' });
      if (onSaved) onSaved();
    } catch (err) {
      console.error("Reset error:", err);
      setStatusMsg({ type: 'error', text: 'Failed to reset mapping.' });
    }
  };

  const handleSave = async () => {
    const art = artifacts.find(a => a.id === selectedArtifactId);
    if (!art) {
      setStatusMsg({ type: 'error', text: 'Please select a Warehouse or Lakehouse.' });
      return;
    }
    if (!batchHeaderTable || !bronzeTable || !silverTable) {
      setStatusMsg({ type: 'error', text: 'Please select all 3 tables (Batch Header, Bronze Details, Silver Details).' });
      return;
    }

    const [bhSchema, bhTbl] = batchHeaderTable.split('.');
    const [brSchema, brTbl] = bronzeTable.split('.');
    const [slSchema, slTbl] = silverTable.split('.');

    setIsSaving(true);
    setStatusMsg(null);

    const payload = {
      artifactType: art.type,
      artifactId: art.id,
      artifactName: art.displayName,
      serverFqdn: art.serverFqdn,
      databaseName: art.databaseName,
      batchHeaderSchema: bhSchema,
      batchHeaderTable: bhTbl,
      batchHeaderMapping,
      bronzeSchema: brSchema,
      bronzeTable: brTbl,
      bronzeMapping,
      silverSchema: slSchema,
      silverTable: slTbl,
      silverMapping
    };

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Mapping successfully saved to database! Closing window...' });
        if (onSaved) onSaved();
        // Automatically close modal after 1.2s
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        const err = await res.json();
        setStatusMsg({ type: 'error', text: err.detail || 'Failed to save mapping.' });
      }
    } catch (e) {
      console.error("Save error:", e);
      setStatusMsg({ type: 'error', text: 'Network error saving mapping.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                Lakehouse / Warehouse & Dynamic Column Mapping
              </h2>
              <p className="text-xs text-slate-400">
                Connect dynamically to your Fabric SQL Endpoint and map table logging schemas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-6 gap-2 text-xs">
          <button
            onClick={() => setActiveTab('source')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'source'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            1. Source & Tables
          </button>
          <button
            onClick={() => setActiveTab('batch_header')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'batch_header'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableProperties className="w-4 h-4" />
            2. Batch Header Mapping
          </button>
          <button
            onClick={() => setActiveTab('bronze')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'bronze'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            3. Bronze Log Mapping
          </button>
          <button
            onClick={() => setActiveTab('silver')}
            className={`py-3 px-4 font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'silver'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            4. Silver Log Mapping
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-200">
          {/* Status feedback */}
          {statusMsg && (
            <div className={`p-3 rounded-xl flex items-center gap-2 border ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span className="font-medium">{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: Source & Tables */}
          {activeTab === 'source' && (
            <div className="space-y-6">
              {/* Step 1: Warehouse / Lakehouse */}
              <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-200 flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    Select Warehouse or Lakehouse
                  </label>
                  {isLoadingArtifacts && (
                    <span className="flex items-center gap-1.5 text-[11px] text-cyan-400 animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Querying Fabric API...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {artifacts.length === 0 && !isLoadingArtifacts && (
                    <p className="text-slate-500 italic col-span-2">
                      No Lakehouse or Warehouse found in this workspace. Please ensure the workspace contains Lakehouses or Warehouses and the Service Principal has access.
                    </p>
                  )}
                  {artifacts.map((art) => {
                    const isSel = art.id === selectedArtifactId;
                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => handleArtifactChange(art.id)}
                        className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                          isSel
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-lg shadow-cyan-500/10'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800/80'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${
                          art.type === 'Lakehouse' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm truncate">{art.displayName}</span>
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded bg-slate-800 text-slate-400">
                              {art.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {art.serverFqdn || "No SQL Endpoint"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Select Tables */}
              {selectedArtifactId && (
                <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-200 flex items-center gap-2">
                      <TableProperties className="w-4 h-4 text-cyan-400" />
                      Select Log Tables from {currentArtifact?.displayName}
                    </label>
                    {isLoadingTables && (
                      <span className="flex items-center gap-1.5 text-[11px] text-cyan-400 animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Querying SQL Endpoint tables...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Batch Header Table */}
                    <div className="space-y-1.5">
                      <span className="font-medium text-slate-300 block">1. Batch Header Table</span>
                      <p className="text-[11px] text-slate-500">Contains PipelineRunId, BatchId, PipelineName, Status</p>
                      <select
                        value={batchHeaderTable}
                        onChange={(e) => handleTableChange('batch_header', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value="">-- Select Batch Header Table --</option>
                        {availableTables.map(t => (
                          <option key={`bh-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bronze Table */}
                    <div className="space-y-1.5">
                      <span className="font-medium text-amber-400 block">2. Bronze Log Table</span>
                      <p className="text-[11px] text-slate-500">Contains BatchId, TableName, SchemaName, Rows</p>
                      <select
                        value={bronzeTable}
                        onChange={(e) => handleTableChange('bronze', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                      >
                        <option value="">-- Select Bronze Table --</option>
                        {availableTables.map(t => (
                          <option key={`br-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Silver Table */}
                    <div className="space-y-1.5">
                      <span className="font-medium text-cyan-400 block">3. Silver Log Table</span>
                      <p className="text-[11px] text-slate-500">Contains BatchId, TableName, SchemaName, Duration, Counts</p>
                      <select
                        value={silverTable}
                        onChange={(e) => handleTableChange('silver', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value="">-- Select Silver Table --</option>
                        {availableTables.map(t => (
                          <option key={`sl-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab('batch_header')}
                      className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition flex items-center gap-2 text-xs"
                    >
                      Next: Map Columns <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Batch Header Mapping */}
          {activeTab === 'batch_header' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Batch Header Table Column Mapping</h3>
                  <p className="text-slate-400 text-xs">Selected Table: <span className="font-mono text-cyan-400">{batchHeaderTable || "None selected"}</span></p>
                </div>
              </div>

              {!batchHeaderTable ? (
                <div className="p-8 text-center text-slate-500 italic bg-slate-950/30 rounded-xl border border-slate-800">
                  Please select a Batch Header table in Tab 1 (Source & Tables) first.
                </div>
              ) : (
                <div className="space-y-2">
                  <MappingRow
                    label="Pipeline Run ID"
                    description="Links Fabric pipeline run ID to this batch header record to filter table logs."
                    currentVal={batchHeaderMapping.pipeline_run_id_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, pipeline_run_id_col: val }))}
                  />
                  <MappingRow
                    label="Batch ID (PK)"
                    description="Unique batch run identifier (Primary Key). Used to join header with Bronze & Silver log tables."
                    currentVal={batchHeaderMapping.batch_id_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, batch_id_col: val }))}
                  />
                  <MappingRow
                    label="Pipeline Name"
                    description="Pipeline name column. Displayed in the header and in the batch switcher dropdown."
                    currentVal={batchHeaderMapping.pipeline_name_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, pipeline_name_col: val }))}
                  />
                  <MappingRow
                    label="Status"
                    description="Batch execution status (e.g. Success, Failure). Displayed in header status badge."
                    currentVal={batchHeaderMapping.status_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, status_col: val }))}
                  />
                  <MappingRow
                    label="Start Time"
                    description="Batch run start timestamp. Displayed in header summary."
                    currentVal={batchHeaderMapping.start_time_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, start_time_col: val }))}
                  />
                  <MappingRow
                    label="Duration"
                    description="Overall batch execution duration in minutes or seconds. Displayed in header."
                    currentVal={batchHeaderMapping.duration_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, duration_col: val }))}
                  />
                  <MappingRow
                    label="Error Message"
                    description="Batch error description if overall execution failed."
                    currentVal={batchHeaderMapping.error_message_col}
                    columns={batchHeaderCols}
                    onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, error_message_col: val }))}
                  />
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('source')}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('bronze')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5"
                >
                  Next: Bronze Mapping <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Bronze Mapping */}
          {activeTab === 'bronze' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-amber-400">Bronze Details Column Mapping</h3>
                  <p className="text-slate-400 text-xs">Selected Table: <span className="font-mono text-amber-400">{bronzeTable || "None selected"}</span></p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Tip: In tables with both "Data Load" and "Source Delete" records (such as <code className="text-amber-300">SourceName</code>), the dashboard automatically filters and calculates counts from the <strong>Data Load</strong> operations to avoid duplicate table counts.
                </span>
              </div>

              {!bronzeTable ? (
                <div className="p-8 text-center text-slate-500 italic bg-slate-950/30 rounded-xl border border-slate-800">
                  Please select a Bronze table in Tab 1 (Source & Tables) first.
                </div>
              ) : (
                <div className="space-y-2">
                  <MappingRow
                    label="Batch ID (FK)"
                    description="Foreign key column matching the Batch Header BatchId to filter logs for this batch."
                    currentVal={bronzeMapping.batch_id_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, batch_id_col: val }))}
                  />
                  <MappingRow
                    label="Table Name"
                    description="Name of the loaded table. Used for table listing and Total Tables KPI count."
                    currentVal={bronzeMapping.table_name_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, table_name_col: val }))}
                  />
                  <MappingRow
                    label="Schema Name"
                    description="Database schema of the bronze table (e.g. dbo, public, fabricacctest)."
                    currentVal={bronzeMapping.schema_name_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, schema_name_col: val }))}
                  />
                  <MappingRow
                    label="Source Name / Operation"
                    description="Operation / step column (e.g. SourceName). Used to filter Data Load from Source Delete for accurate table and row count calculations."
                    currentVal={bronzeMapping.source_name_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, source_name_col: val }))}
                  />
                  <MappingRow
                    label="Rows Processed"
                    description="Extracted row count (e.g. ExtractedRowCount). Used to calculate total Rows Processed KPI."
                    currentVal={bronzeMapping.rows_processed_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, rows_processed_col: val }))}
                  />
                  <MappingRow
                    label="Status"
                    description="Table execution status (e.g. Success, Failure). Used to calculate Successfully Loaded and Failed Tables KPIs."
                    currentVal={bronzeMapping.status_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, status_col: val }))}
                  />
                  <MappingRow
                    label="Start Time"
                    description="Table load start timestamp. Displayed in table details."
                    currentVal={bronzeMapping.start_time_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, start_time_col: val }))}
                  />
                  <MappingRow
                    label="End Time"
                    description="Table load end timestamp. Used with Start Time to calculate duration and Avg. Load Duration KPI."
                    currentVal={bronzeMapping.end_time_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, end_time_col: val }))}
                  />
                  <MappingRow
                    label="Error Message"
                    description="Error description if table extraction or loading failed."
                    currentVal={bronzeMapping.error_message_col}
                    columns={bronzeCols}
                    onChange={(val) => setBronzeMapping(prev => ({ ...prev, error_message_col: val }))}
                  />
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('batch_header')}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('silver')}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center gap-1.5"
                >
                  Next: Silver Mapping <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Silver Mapping */}
          {activeTab === 'silver' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-cyan-400">Silver Log Details Column Mapping</h3>
                  <p className="text-slate-400 text-xs">Selected Table: <span className="font-mono text-cyan-400">{silverTable || "None selected"}</span></p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-cyan-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Tip: If your database table has column values swapped (e.g. column <code className="text-cyan-300">SchemaName</code> contains table names and <code className="text-cyan-300">TableName</code> contains schemas), simply map <strong>Table Name</strong> and <strong>Schema Name</strong> to their respective database columns. The system also automatically detects and resolves swapped names.
                </span>
              </div>

              {!silverTable ? (
                <div className="p-8 text-center text-slate-500 italic bg-slate-950/30 rounded-xl border border-slate-800">
                  Please select a Silver table in Tab 1 (Source & Tables) first.
                </div>
              ) : (
                <div className="space-y-2">
                  <MappingRow
                    label="Batch ID (FK)"
                    description="Foreign key column matching the Batch Header BatchId to filter logs for this batch."
                    currentVal={silverMapping.batch_id_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, batch_id_col: val }))}
                  />
                  <MappingRow
                    label="Table Name"
                    description="Name of the transformed/loaded Silver table. Used for table listing and Total Tables KPI count."
                    currentVal={silverMapping.table_name_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, table_name_col: val }))}
                  />
                  <MappingRow
                    label="Schema Name"
                    description="Database schema of the silver table (e.g. dbo, public, fabricacctest)."
                    currentVal={silverMapping.schema_name_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, schema_name_col: val }))}
                  />
                  <MappingRow
                    label="Rows Processed / Count"
                    description="Loaded row count (e.g. SilverCount). Used to calculate total Rows Processed KPI."
                    currentVal={silverMapping.rows_processed_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, rows_processed_col: val }))}
                  />
                  <MappingRow
                    label="Duration in Seconds"
                    description="Execution duration in seconds (e.g. DurationInSec). Used to calculate Avg. Load Duration KPI."
                    currentVal={silverMapping.duration_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, duration_col: val }))}
                  />
                  <MappingRow
                    label="Status"
                    description="Table transformation status (e.g. Success, Failure). Used to calculate Successfully Loaded and Failed Tables KPIs."
                    currentVal={silverMapping.status_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, status_col: val }))}
                  />
                  <MappingRow
                    label="Start Time"
                    description="Table transformation start timestamp. Displayed in table log details."
                    currentVal={silverMapping.start_time_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, start_time_col: val }))}
                  />
                  <MappingRow
                    label="Error Message"
                    description="Detailed error message if table transformation failed."
                    currentVal={silverMapping.error_message_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, error_message_col: val }))}
                  />
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('bronze')}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving Configuration..." : "Save Mapping to Database"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>All selections are 100% dynamic without hardcoded defaults.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetMapping}
              title="Clear all saved mappings and reset"
              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition text-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Reset Mapping</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save Mapping"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MappingRow({ label, description, currentVal, columns, onChange }) {
  return (
    <div className="p-2.5 rounded-lg bg-slate-950/50 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition">
      <div className="sm:w-1/2">
        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
          <span>{label}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
      </div>

      <div className="sm:w-1/2 flex items-center gap-2">
        <select
          value={currentVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
        >
          <option value="">-- Select Column --</option>
          {columns.map(c => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.dataType})
            </option>
          ))}
        </select>
        {currentVal && (
          <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/40 text-[10px] text-cyan-400 font-mono shrink-0">
            Mapped
          </span>
        )}
      </div>
    </div>
  );
}
