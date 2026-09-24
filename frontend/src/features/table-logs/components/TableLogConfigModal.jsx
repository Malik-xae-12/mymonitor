import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Database, 
  Check, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  ChevronRight,
  TableProperties,
  Trash2,
  CheckCircle2,
  Info
} from 'lucide-react';

export default function TableLogConfigModal({ workspaceId, isOpen, onClose, onSaved }) {
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [availableTables, setAvailableTables] = useState([]);
  
  // Table Selections (Schema.Table) - completely dynamic
  const [batchHeaderTable, setBatchHeaderTable] = useState('');
  const [bronzeTable, setBronzeTable] = useState('');
  const [silverTable, setSilverTable] = useState('');

  // Column Lists per selected table
  const [batchHeaderCols, setBatchHeaderCols] = useState([]);
  const [bronzeCols, setBronzeCols] = useState([]);
  const [silverCols, setSilverCols] = useState([]);

  // Column Mappings - completely dynamic
  const [batchHeaderMapping, setBatchHeaderMapping] = useState({});
  const [bronzeMapping, setBronzeMapping] = useState({});
  const [silverMapping, setSilverMapping] = useState({});

  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('source'); // 'source' | 'batch_header' | 'bronze' | 'silver'

  // Request sequencing to prevent async race conditions
  const activeReqIdRef = useRef(0);
  const abortCtrlRef = useRef(null);

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
              return;
            }
          }
        }
      } catch (err) {
        console.error("Error loading config:", err);
        setStatusMsg({ type: 'error', text: 'Failed to load workspace data sources.' });
      } finally {
        setIsLoadingArtifacts(false);
      }
    };

    loadData();
  }, [isOpen, workspaceId]);

function extractErrorText(err, defaultMsg) {
  if (!err) return defaultMsg;
  if (typeof err === 'string') return err;
  const d = err.detail !== undefined ? err.detail : err;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) {
    return d.map(item => (typeof item === 'object' ? (item.msg || JSON.stringify(item)) : String(item))).join('; ');
  }
  if (typeof d === 'object') {
    return d.msg || d.message || JSON.stringify(d);
  }
  return String(d);
}

  const fetchTables = async (serverFqdn, databaseName, preBH = '', preBR = '', preSL = '') => {
    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;
    const currentReqId = ++activeReqIdRef.current;

    setIsLoadingTables(true);
    setStatusMsg(null);
    setAvailableTables([]);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sql-metadata/tables`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverFqdn, databaseName }),
        signal: abortCtrl.signal
      });

      if (currentReqId !== activeReqIdRef.current) {
        return; // Superseded by a newer selection
      }

      if (res.ok) {
        const json = await res.json();
        const tbls = json.tables || [];
        setAvailableTables(tbls);

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
      } else {
        const errJson = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: extractErrorText(errJson, 'Could not connect to SQL Endpoint to fetch tables.') });
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (currentReqId !== activeReqIdRef.current) return;
      console.error("Failed to fetch tables:", e);
      setStatusMsg({ type: 'error', text: 'Could not connect to SQL Endpoint to fetch tables.' });
    } finally {
      if (currentReqId === activeReqIdRef.current) {
        setIsLoadingTables(false);
      }
    }
  };

  const fetchCols = async (serverFqdn, databaseName, schemaName, tableName, setColState) => {
    if (!serverFqdn || !databaseName || !schemaName || !tableName) {
      setColState([]);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sql-metadata/columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverFqdn, databaseName, schemaName, tableName })
      });
      if (res.ok) {
        const json = await res.json();
        setColState(json.columns || []);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: extractErrorText(errJson, `Could not fetch columns for ${schemaName}.${tableName}.`) });
      }
    } catch (e) {
      console.error(`Failed to fetch columns for ${schemaName}.${tableName}:`, e);
      setStatusMsg({ type: 'error', text: `Failed to fetch columns for ${schemaName}.${tableName}.` });
    }
  };

  const handleArtifactChange = (artId) => {
    setSelectedArtifactId(artId);
    setAvailableTables([]);
    setBatchHeaderTable('');
    setBronzeTable('');
    setSilverTable('');
    setBatchHeaderCols([]);
    setBronzeCols([]);
    setSilverCols([]);
    setBatchHeaderMapping({});
    setBronzeMapping({});
    setSilverMapping({});
    setStatusMsg(null);
    const art = artifacts.find(a => a.id === artId);
    if (art && art.serverFqdn && art.databaseName) {
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

  const handleSave = async () => {
    if (!selectedArtifactId) {
      setStatusMsg({ type: 'error', text: 'Please select a Warehouse or Lakehouse.' });
      return;
    }
    const art = artifacts.find(a => a.id === selectedArtifactId);
    if (!art) return;

    setIsSaving(true);
    setStatusMsg(null);

    const [bhSchema, bhTable] = (batchHeaderTable || '').split('.');
    const [brSchema, brTable] = (bronzeTable || '').split('.');
    const [slSchema, slTable] = (silverTable || '').split('.');

    const payload = {
      artifact_id: art.id,
      artifact_name: art.displayName,
      artifact_type: art.type,
      server_fqdn: art.serverFqdn,
      database_name: art.databaseName,
      batch_header_schema: bhSchema || '',
      batch_header_table: bhTable || '',
      bronze_schema: brSchema || '',
      bronze_table: brTable || '',
      silver_schema: slSchema || '',
      silver_table: slTable || '',
      batch_header_mapping: batchHeaderMapping,
      bronze_mapping: bronzeMapping,
      silver_mapping: silverMapping,
      // camelCase aliases
      artifactId: art.id,
      artifactName: art.displayName,
      artifactType: art.type,
      serverFqdn: art.serverFqdn,
      databaseName: art.databaseName,
      batchHeaderSchema: bhSchema || '',
      batchHeaderTable: bhTable || '',
      bronzeSchema: brSchema || '',
      bronzeTable: brTable || '',
      silverSchema: slSchema || '',
      silverTable: slTable || '',
      batchHeaderMapping: batchHeaderMapping,
      bronzeMapping: bronzeMapping,
      silverMapping: silverMapping
    };

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Column mapping successfully saved and applied!' });
        if (onSaved) onSaved();
        setTimeout(() => onClose(), 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: extractErrorText(err, 'Failed to save mapping.') });
      }
    } catch (e) {
      console.error("Save error:", e);
      setStatusMsg({ type: 'error', text: 'Network error saving mapping.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMapping = async () => {
    if (!window.confirm("Are you sure you want to clear and reset the table logging mapping?")) return;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Mapping reset. Default fallback schema will be used.' });
        setBatchHeaderTable('');
        setBronzeTable('');
        setSilverTable('');
        setBatchHeaderMapping({});
        setBronzeMapping({});
        setSilverMapping({});
        if (onSaved) onSaved();
      }
    } catch (e) {
      console.error("Reset error:", e);
      setStatusMsg({ type: 'error', text: 'Failed to reset mapping.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentArtifact = artifacts.find(a => a.id === selectedArtifactId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-4xl bg-[#ffffff] border border-[#edebe9] rounded shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#edebe9] bg-[#faf9f8]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#d1d1d1]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#242424]">
                Lakehouse / Warehouse & Dynamic Column Mapping
              </h2>
              <p className="text-xs text-[#605e5c]">
                Connect dynamically to your Fabric SQL Endpoint and map table logging schemas
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

        {/* Tab Navigation */}
        <div className="flex border-b border-[#edebe9] bg-[#faf9f8] px-5 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('source')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'source'
                ? 'border-[#0f6cbd] text-[#0f6cbd] font-semibold bg-[#ffffff]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#008272]" />
            1. Source & Tables
          </button>
          <button
            onClick={() => setActiveTab('batch_header')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'batch_header'
                ? 'border-[#0f6cbd] text-[#0f6cbd] font-semibold bg-[#ffffff]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <TableProperties className="w-3.5 h-3.5 text-[#0f6cbd]" />
            2. Batch Header Mapping
          </button>
          <button
            onClick={() => setActiveTab('bronze')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'bronze'
                ? 'border-[#0f6cbd] text-[#0f6cbd] font-semibold bg-[#ffffff]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#d83b01] inline-block" />
            3. Bronze Log Mapping
          </button>
          <button
            onClick={() => setActiveTab('silver')}
            className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'silver'
                ? 'border-[#0f6cbd] text-[#0f6cbd] font-semibold bg-[#ffffff]'
                : 'border-transparent text-[#605e5c] hover:text-[#242424]'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#0078d4] inline-block" />
            4. Silver Log Mapping
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-[#242424]">
          {/* Status feedback */}
          {statusMsg && (
            <div className={`p-3 rounded flex items-center gap-2 border ${
              statusMsg.type === 'success'
                ? 'bg-[#dff6dd] border-[#107c41]/30 text-[#107c41]'
                : 'bg-[#fde7e9] border-[#f4b4b9] text-[#c42b1c]'
            }`}>
              {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span className="font-medium">{statusMsg.text}</span>
            </div>
          )}

          {/* TAB 1: Source & Tables */}
          {activeTab === 'source' && (
            <div className="space-y-4">
              {/* Step 1: Warehouse / Lakehouse */}
              <div className="bg-[#faf9f8] p-4 rounded border border-[#edebe9] space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#242424] flex items-center gap-2 text-xs">
                    <Database className="w-4 h-4 text-[#008272]" />
                    Select Warehouse or Lakehouse
                  </label>
                  {isLoadingArtifacts && (
                    <span className="flex items-center gap-1.5 text-[11px] text-[#0f6cbd] animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Querying Fabric API...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {artifacts.length === 0 && !isLoadingArtifacts && (
                    <p className="text-[#605e5c] italic col-span-2 text-xs">
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
                        className={`p-3 rounded border text-left transition flex items-start gap-2.5 ${
                          isSel
                            ? 'bg-[#eff6fc] border-[#0f6cbd] text-[#242424] shadow-sm'
                            : 'bg-[#ffffff] border-[#edebe9] text-[#242424] hover:bg-[#faf9f8]'
                        }`}
                      >
                        <div className={`p-2 rounded shrink-0 ${
                          art.type === 'Lakehouse' ? 'bg-[#fff4ce] text-[#794500]' : 'bg-[#eff6fc] text-[#0f6cbd]'
                        }`}>
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs truncate">{art.displayName}</span>
                            <span className="px-1.5 py-0.2 text-[9px] font-medium uppercase rounded bg-[#f3f2f1] text-[#605e5c]">
                              {art.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#605e5c] truncate mt-0.5">
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
                <div className="bg-[#faf9f8] p-4 rounded border border-[#edebe9] space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#242424] flex items-center gap-2 text-xs">
                      <TableProperties className="w-4 h-4 text-[#0f6cbd]" />
                      Select Log Tables from {currentArtifact?.displayName}
                    </label>
                    {isLoadingTables && (
                      <span className="flex items-center gap-1.5 text-[11px] text-[#0f6cbd] animate-pulse">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Querying SQL Endpoint tables...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Batch Header Table */}
                    <div className="space-y-1">
                      <span className="font-medium text-[#242424] block">1. Batch Header Table</span>
                      <p className="text-[11px] text-[#605e5c]">Contains PipelineRunId, BatchId, PipelineName, Status</p>
                      <select
                        value={batchHeaderTable}
                        onChange={(e) => handleTableChange('batch_header', e.target.value)}
                        className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#0f6cbd] font-mono cursor-pointer"
                      >
                        <option value="">-- Select Batch Header Table --</option>
                        {availableTables.map(t => (
                          <option key={`bh-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Bronze Table */}
                    <div className="space-y-1">
                      <span className="font-medium text-[#d83b01] block">2. Bronze Log Table</span>
                      <p className="text-[11px] text-[#605e5c]">Contains BatchId, TableName, SchemaName, Rows</p>
                      <select
                        value={bronzeTable}
                        onChange={(e) => handleTableChange('bronze', e.target.value)}
                        className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#0f6cbd] font-mono cursor-pointer"
                      >
                        <option value="">-- Select Bronze Table --</option>
                        {availableTables.map(t => (
                          <option key={`br-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Silver Table */}
                    <div className="space-y-1">
                      <span className="font-medium text-[#0078d4] block">3. Silver Log Table</span>
                      <p className="text-[11px] text-[#605e5c]">Contains BatchId, TableName, SchemaName, Duration, Counts</p>
                      <select
                        value={silverTable}
                        onChange={(e) => handleTableChange('silver', e.target.value)}
                        className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#0f6cbd] font-mono cursor-pointer"
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
                      className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium transition flex items-center gap-1.5 text-xs shadow-sm"
                    >
                      <span>Next: Map Columns</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Batch Header Mapping */}
          {activeTab === 'batch_header' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
                <div>
                  <h3 className="text-xs font-bold text-[#242424]">Batch Header Table Column Mapping</h3>
                  <p className="text-[#605e5c] text-[11px]">Selected Table: <span className="font-mono text-[#0f6cbd]">{batchHeaderTable || "None selected"}</span></p>
                </div>
              </div>

              {!batchHeaderTable ? (
                <div className="p-8 text-center text-[#605e5c] italic bg-[#faf9f8] rounded border border-[#edebe9]">
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
                  className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#323130] text-xs font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('bronze')}
                  className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium flex items-center gap-1 text-xs shadow-sm"
                >
                  <span>Next: Bronze Mapping</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Bronze Mapping */}
          {activeTab === 'bronze' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
                <div>
                  <h3 className="text-xs font-bold text-[#d83b01]">Bronze Details Column Mapping</h3>
                  <p className="text-[#605e5c] text-[11px]">Selected Table: <span className="font-mono text-[#d83b01]">{bronzeTable || "None selected"}</span></p>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#fff4ce] border border-[#ffe082] text-[#794500] text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#794500] shrink-0 mt-0.5" />
                <span>
                  Tip: In tables with both "Data Load" and "Source Delete" records (such as <code className="font-bold">SourceName</code>), the dashboard automatically filters and calculates counts from the <strong>Data Load</strong> operations to avoid duplicate table counts.
                </span>
              </div>

              {!bronzeTable ? (
                <div className="p-8 text-center text-[#605e5c] italic bg-[#faf9f8] rounded border border-[#edebe9]">
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
                  className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#323130] text-xs font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('silver')}
                  className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium flex items-center gap-1 text-xs shadow-sm"
                >
                  <span>Next: Silver Mapping</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Silver Mapping */}
          {activeTab === 'silver' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
                <div>
                  <h3 className="text-xs font-bold text-[#0078d4]">Silver Log Details Column Mapping</h3>
                  <p className="text-[#605e5c] text-[11px]">Selected Table: <span className="font-mono text-[#0078d4]">{silverTable || "None selected"}</span></p>
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#eff6fc] border border-[#c7e0f4] text-[#004e8c] text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#0f6cbd] shrink-0 mt-0.5" />
                <span>
                  Tip: If your database table has column values swapped, simply map <strong>Table Name</strong> and <strong>Schema Name</strong> to their respective database columns. The system also automatically detects and resolves swapped names.
                </span>
              </div>

              {!silverTable ? (
                <div className="p-8 text-center text-[#605e5c] italic bg-[#faf9f8] rounded border border-[#edebe9]">
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
                    label="Status"
                    description="Table execution status (e.g. Success, Failure). Used to calculate Successfully Loaded and Failed Tables KPIs."
                    currentVal={silverMapping.status_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, status_col: val }))}
                  />
                  <MappingRow
                    label="Start Time"
                    description="Table load start timestamp."
                    currentVal={silverMapping.start_time_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, start_time_col: val }))}
                  />
                  <MappingRow
                    label="End Time"
                    description="Table load end timestamp. Used to calculate duration and Avg. Load Duration KPI."
                    currentVal={silverMapping.end_time_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, end_time_col: val }))}
                  />
                  <MappingRow
                    label="Duration"
                    description="Pre-calculated duration in minutes or seconds (e.g. DurationInSeconds)."
                    currentVal={silverMapping.duration_col}
                    columns={silverCols}
                    onChange={(val) => setSilverMapping(prev => ({ ...prev, duration_col: val }))}
                  />
                  <MappingRow
                    label="Error Message"
                    description="Error description if silver table load failed."
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
                  className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#323130] text-xs font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#edebe9] bg-[#faf9f8] text-xs">
          <div className="flex items-center gap-2 text-[#605e5c] text-[11px]">
            <span className="w-2 h-2 rounded-full bg-[#107c41]"></span>
            <span>All selections are 100% dynamic without hardcoded defaults.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetMapping}
              title="Clear all saved mappings and reset"
              className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#fde7e9] border border-[#d1d1d1] text-[#c42b1c] transition text-xs flex items-center gap-1.5 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#c42b1c]" />
              <span>Reset Mapping</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white font-medium flex items-center gap-1.5 transition shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? "Saving..." : "Save Mapping"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MappingRow({ label, description, currentVal, columns, onChange }) {
  return (
    <div className="p-2.5 rounded bg-[#ffffff] border border-[#edebe9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#d1d1d1] transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="sm:w-1/2">
        <div className="font-medium text-[#242424] flex items-center gap-1.5 text-xs">
          <span>{label}</span>
        </div>
        <p className="text-[11px] text-[#605e5c] mt-0.5">{description}</p>
      </div>

      <div className="sm:w-1/2 flex items-center gap-2">
        <select
          value={currentVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-2.5 py-1.5 text-xs text-[#242424] font-mono focus:outline-none focus:border-[#0f6cbd] cursor-pointer"
        >
          <option value="">-- Select Column --</option>
          {columns.map(c => (
            <option key={c.name} value={c.name} className="bg-[#ffffff] text-[#242424]">
              {c.name} ({c.dataType})
            </option>
          ))}
        </select>
        {currentVal && (
          <span className="px-2 py-0.5 rounded bg-[#dff6dd] border border-[#107c41]/30 text-[10px] text-[#107c41] font-mono shrink-0">
            Mapped
          </span>
        )}
      </div>
    </div>
  );
}
