import React, { useState, useEffect, useRef } from 'react';
import { 
  Database, 
  TableProperties, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RefreshCw, 
  ChevronRight, 
  ChevronLeft,
  Trash2, 
  ArrowLeft,
  Check,
  Sparkles,
  Layers,
  FileSpreadsheet,
  Info,
  X,
  Search,
  CheckSquare,
  ShieldCheck,
  Server,
  FolderTree
} from 'lucide-react';
import { 
  getDataArtifacts, 
  getTableLogMapping, 
  saveTableLogMapping, 
  deleteTableLogMapping, 
  getSqlTables, 
  getSqlColumns 
} from '../api';

export default function TableLogConfigPage({ 
  workspaceId, 
  workspaceName, 
  onBackToMonitoring, 
  onSaved 
}) {
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifactId, setSelectedArtifactId] = useState('');
  const [availableTables, setAvailableTables] = useState([]);
  
  // Table Selections (Schema.Table) - dynamic
  const [batchHeaderTable, setBatchHeaderTable] = useState('');
  const [bronzeTable, setBronzeTable] = useState('');
  const [silverTable, setSilverTable] = useState('');

  // Column Lists per selected table
  const [batchHeaderCols, setBatchHeaderCols] = useState([]);
  const [bronzeCols, setBronzeCols] = useState([]);
  const [silverCols, setSilverCols] = useState([]);

  // Column Mappings - dynamic
  const [batchHeaderMapping, setBatchHeaderMapping] = useState({});
  const [bronzeMapping, setBronzeMapping] = useState({});
  const [silverMapping, setSilverMapping] = useState({});

  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Wizard state: 1: 'Choose data source', 2: 'Choose log tables', 3: 'Map audit columns', 4: 'Review and Create'
  const [activeStep, setActiveStep] = useState(1);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('ALL');
  const [mappingSubTab, setMappingSubTab] = useState('batch_header'); // 'batch_header' | 'bronze' | 'silver'

  // Request sequencing to prevent async race conditions
  const activeReqIdRef = useRef(0);
  const abortCtrlRef = useRef(null);

  // Helper to safely extract string error messages
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

  // Load existing mapping and workspace artifacts
  useEffect(() => {
    if (!workspaceId) return;

    const loadData = async () => {
      setIsLoadingArtifacts(true);
      setStatusMsg(null);
      try {
        // 1. Fetch artifacts (warehouses & lakehouses)
        const artJson = await getDataArtifacts(workspaceId).catch(() => ({ artifacts: [] }));
        const artList = artJson.artifacts || [];
        setArtifacts(artList);

        // 2. Fetch existing mapping from database if previously configured
        const mapJson = await getTableLogMapping(workspaceId).catch(() => ({ mapping: null }));
        if (mapJson?.mapping) {
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

            if (m.server_fqdn && m.database_name) {
              await fetchTables(m.server_fqdn, m.database_name, bhFull, brFull, slFull);
              return;
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
  }, [workspaceId]);

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
      const json = await getSqlTables(workspaceId, { serverFqdn, databaseName, signal: abortCtrl.signal });
      if (currentReqId !== activeReqIdRef.current) return;
      const tbls = json?.tables || [];
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
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (currentReqId !== activeReqIdRef.current) return;
      console.error("Failed to fetch tables:", e);
      setStatusMsg({ type: 'error', text: extractErrorText(e, 'Could not connect to SQL Endpoint to fetch tables.') });
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
      const json = await getSqlColumns(workspaceId, { serverFqdn, databaseName, schemaName, tableName });
      setColState(json?.columns || []);
    } catch (e) {
      console.error(`Failed to fetch columns for ${schemaName}.${tableName}:`, e);
      setStatusMsg({ type: 'error', text: extractErrorText(e, `Could not fetch columns for ${schemaName}.${tableName}.`) });
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

  // Smart Auto-Map helper function
  const handleAutoMap = () => {
    let mappedCount = 0;

    // Helper matcher
    const matchCol = (cols, candidates) => {
      for (const cand of candidates) {
        const normCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
        const found = cols.find(c => c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normCand);
        if (found) return found.name;
      }
      return '';
    };

    // Auto-map Batch Header
    if (batchHeaderCols.length > 0) {
      const newBH = { ...batchHeaderMapping };
      const bhCandidates = {
        pipeline_run_id_col: ['pipelinerunid', 'runid', 'pipeline_run_id', 'fabricrunid'],
        batch_id_col: ['batchid', 'batch_id', 'id', 'batchpk'],
        pipeline_name_col: ['pipelinename', 'pipeline_name', 'name', 'pipelinedisplayname'],
        status_col: ['status', 'batchstatus', 'state', 'executionstatus'],
        start_time_col: ['starttime', 'start_time', 'executionstarttime', 'batchstarttime'],
        duration_col: ['duration', 'durationms', 'durationseconds', 'durationminutes'],
        error_message_col: ['errormessage', 'error_message', 'error', 'errordescription']
      };
      Object.entries(bhCandidates).forEach(([field, cands]) => {
        if (!newBH[field]) {
          const matched = matchCol(batchHeaderCols, cands);
          if (matched) {
            newBH[field] = matched;
            mappedCount++;
          }
        }
      });
      setBatchHeaderMapping(newBH);
    }

    // Auto-map Bronze
    if (bronzeCols.length > 0) {
      const newBR = { ...bronzeMapping };
      const brCandidates = {
        batch_id_col: ['batchid', 'batch_id', 'id'],
        table_name_col: ['tablename', 'table_name', 'targettable', 'schematable'],
        schema_name_col: ['schemaname', 'schema_name', 'targetschema'],
        rows_processed_col: ['rowsprocessed', 'rows_processed', 'rowcount', 'ingestedrows', 'rowsingested'],
        status_col: ['status', 'ingestionstatus', 'state'],
        start_time_col: ['starttime', 'start_time', 'loadtime'],
        end_time_col: ['endtime', 'end_time'],
        duration_col: ['duration', 'durationseconds', 'durationms'],
        error_message_col: ['errormessage', 'error_message', 'error']
      };
      Object.entries(brCandidates).forEach(([field, cands]) => {
        if (!newBR[field]) {
          const matched = matchCol(bronzeCols, cands);
          if (matched) {
            newBR[field] = matched;
            mappedCount++;
          }
        }
      });
      setBronzeMapping(newBR);
    }

    // Auto-map Silver
    if (silverCols.length > 0) {
      const newSL = { ...silverMapping };
      const slCandidates = {
        batch_id_col: ['batchid', 'batch_id', 'id'],
        table_name_col: ['tablename', 'table_name', 'targettable'],
        schema_name_col: ['schemaname', 'schema_name', 'targetschema'],
        rows_processed_col: ['rowsprocessed', 'rows_processed', 'rowcount', 'insertedrows', 'refinedrows'],
        status_col: ['status', 'processingstatus', 'state'],
        start_time_col: ['starttime', 'start_time'],
        end_time_col: ['endtime', 'end_time'],
        duration_col: ['duration', 'durationseconds', 'durationms'],
        error_message_col: ['errormessage', 'error_message', 'error']
      };
      Object.entries(slCandidates).forEach(([field, cands]) => {
        if (!newSL[field]) {
          const matched = matchCol(silverCols, cands);
          if (matched) {
            newSL[field] = matched;
            mappedCount++;
          }
        }
      });
      setSilverMapping(newSL);
    }

    setStatusMsg({
      type: 'success',
      text: mappedCount > 0 
        ? `Auto-map matched and assigned ${mappedCount} columns successfully!`
        : 'Auto-map ran. All identifiable columns were already mapped.'
    });
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
      await saveTableLogMapping(workspaceId, payload);
      setStatusMsg({ type: 'success', text: 'Column mapping successfully saved and applied to Monitoring hub!' });
      if (onSaved) onSaved();
    } catch (e) {
      console.error("Save error:", e);
      setStatusMsg({ type: 'error', text: extractErrorText(e, 'Failed to save mapping.') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetMapping = async () => {
    if (!window.confirm("Are you sure you want to clear and reset the table logging mapping?")) return;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await deleteTableLogMapping(workspaceId);
      setStatusMsg({ type: 'success', text: 'Mapping reset. Default fallback schema will be used.' });
      setBatchHeaderTable('');
      setBronzeTable('');
      setSilverTable('');
      setBatchHeaderMapping({});
      setBronzeMapping({});
      setSilverMapping({});
      if (onSaved) onSaved();
    } catch (e) {
      console.error("Reset error:", e);
      setStatusMsg({ type: 'error', text: extractErrorText(e, 'Failed to reset mapping.') });
    } finally {
      setIsSaving(false);
    }
  };

  const currentArtifact = artifacts.find(a => a.id === selectedArtifactId);

  // Stepper completion checks
  const isStep1Complete = !!selectedArtifactId;
  const isStep2Complete = !!(batchHeaderTable || bronzeTable || silverTable);
  const isStep3Complete = Object.keys(batchHeaderMapping).length > 0 || Object.keys(bronzeMapping).length > 0;
  const isStep4Complete = isStep1Complete && isStep2Complete;

  // Milestone definition matching Microsoft Fabric UI Kit Wizard
  const steps = [
    {
      number: 1,
      id: 'source',
      title: 'Choose data source',
      subtitle: 'Select Lakehouse or Warehouse',
      isCompleted: isStep1Complete,
      icon: Database
    },
    {
      number: 2,
      id: 'tables',
      title: 'Choose log tables',
      subtitle: 'Select catalog log tables',
      isCompleted: isStep2Complete,
      icon: TableProperties
    },
    {
      number: 3,
      id: 'mapping',
      title: 'Map audit columns',
      subtitle: 'Map schema fields & metrics',
      isCompleted: isStep3Complete,
      icon: Layers
    },
    {
      number: 4,
      id: 'review',
      title: 'Review and Create',
      subtitle: 'Verify & apply to workspace',
      isCompleted: isStep4Complete,
      icon: ShieldCheck
    }
  ];

  // Filtered artifacts
  const filteredArtifacts = artifacts.filter(art => {
    const matchesSearch = !sourceSearch || 
      art.displayName?.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      art.databaseName?.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      art.serverFqdn?.toLowerCase().includes(sourceSearch.toLowerCase());
    
    if (sourceTypeFilter === 'WAREHOUSE') {
      return matchesSearch && art.type?.toLowerCase().includes('warehouse');
    }
    if (sourceTypeFilter === 'LAKEHOUSE') {
      return matchesSearch && art.type?.toLowerCase().includes('lakehouse');
    }
    return matchesSearch;
  });

  const totalMappedColumns = 
    Object.keys(batchHeaderMapping).filter(k => batchHeaderMapping[k]).length +
    Object.keys(bronzeMapping).filter(k => bronzeMapping[k]).length +
    Object.keys(silverMapping).filter(k => silverMapping[k]).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full bg-white text-[#242424] font-sans select-none overflow-hidden">

      {/* Full-Page Wizard Title Bar */}
      <div className="border-b border-[#edebe9] px-8 py-3.5 flex items-center justify-between bg-white shrink-0">
        <div>
          <span className="text-xs font-semibold text-[#616161] tracking-wide block">
            Table Catalog Configuration
          </span>
          <h1 className="text-xl font-semibold text-[#242424] tracking-tight mt-0.5">
            {steps[activeStep - 1]?.title}
          </h1>
        </div>

        <button
          onClick={onBackToMonitoring}
          title="Close and return to Monitoring hub"
          className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#616161] hover:text-[#242424] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Full-Page Wizard Body: Left Stepper Rail + Right Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* LEFT RAIL: Microsoft Fabric Vertical Stepper */}
        <aside className="w-64 lg:w-72 bg-[#f5f5f5] border-r border-[#edebe9] p-6 shrink-0 flex flex-col overflow-y-auto">
          {/* Stepper Timeline */}
          <nav className="space-y-6">
            {steps.map((step, idx) => {
              const isActive = activeStep === step.number;
              const isCompleted = step.isCompleted;
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.id} className="relative">
                  {/* Vertical Connecting Line */}
                  {!isLast && (
                    <div 
                      className={`absolute left-[9px] top-6 bottom-[-24px] w-[2px] transition-colors duration-200 ${
                        isCompleted ? 'bg-[#117865]' : 'bg-[#d1d1d1]'
                      }`}
                      style={{ zIndex: 0 }}
                    />
                  )}

                  {/* Step Row Item */}
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.number)}
                    className="relative z-10 w-full text-left flex items-start gap-3 group focus:outline-none"
                  >
                    {/* Status Icon Node */}
                    <div className="shrink-0 mt-0.5">
                      {isActive ? (
                        <div className="w-[20px] h-[20px] rounded-full bg-[#117865] flex items-center justify-center shadow-xs">
                          <div className="w-[7px] h-[7px] rounded-full bg-white" />
                        </div>
                      ) : isCompleted ? (
                        <div className="w-[20px] h-[20px] rounded-full bg-[#117865] flex items-center justify-center text-white shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-[20px] h-[20px] rounded-full bg-white border-2 border-[#d1d1d1] group-hover:border-[#117865] transition-colors" />
                      )}
                    </div>

                    {/* Step Details */}
                    <div className="min-w-0 flex-1">
                      <h3 className={`text-xs font-semibold leading-tight ${
                        isActive ? 'text-[#117865]' : 'text-[#242424]'
                      }`}>
                        {step.title}
                      </h3>
                      <p className="text-[11px] text-[#616161] leading-tight mt-1">
                        {step.subtitle}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* RIGHT MAIN WORKSPACE: Active Step Content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white flex flex-col min-h-0">
              {/* Status Feedback Toast */}
              {statusMsg && (
                <div className={`p-3.5 mb-6 rounded-md border flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
                  statusMsg.type === 'success'
                    ? 'bg-[#e3f7ef] border-[#117865]/30 text-[#117865]'
                    : 'bg-[#fde7e9] border-[#f19999] text-[#a80000]'
                }`}>
                  <div className="flex items-center gap-2.5 text-xs font-medium">
                    {statusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{statusMsg.text}</span>
                  </div>
                  <button
                    onClick={() => setStatusMsg(null)}
                    className="text-xs font-semibold hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* =========================================================
                  STEP 1: Choose Data Source (Warehouse / Lakehouse)
                  ========================================================= */}
              {activeStep === 1 && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h2 className="text-sm font-semibold text-[#242424]">
                      Choose from existing Microsoft Fabric sources
                    </h2>
                    <p className="text-xs text-[#616161] mt-0.5">
                      Select the Fabric Warehouse or Lakehouse where your ETL batch logging tables reside.
                    </p>
                  </div>

                  {/* Search and Filter Toolbar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full sm:w-80">
                      <Search className="w-4 h-4 text-[#616161] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search Lakehouses and Warehouses..."
                        value={sourceSearch}
                        onChange={(e) => setSourceSearch(e.target.value)}
                        className="w-full bg-[#fafafa] border border-[#d1d1d1] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#117865] focus:bg-white transition"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs">
                      <button
                        type="button"
                        onClick={() => setSourceTypeFilter('ALL')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                          sourceTypeFilter === 'ALL'
                            ? 'bg-[#117865] text-white shadow-xs'
                            : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                        }`}
                      >
                        All ({artifacts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceTypeFilter('WAREHOUSE')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                          sourceTypeFilter === 'WAREHOUSE'
                            ? 'bg-[#117865] text-white shadow-xs'
                            : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                        }`}
                      >
                        Warehouses ({artifacts.filter(a => a.type?.toLowerCase().includes('warehouse')).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSourceTypeFilter('LAKEHOUSE')}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                          sourceTypeFilter === 'LAKEHOUSE'
                            ? 'bg-[#117865] text-white shadow-xs'
                            : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                        }`}
                      >
                        Lakehouses ({artifacts.filter(a => a.type?.toLowerCase().includes('lakehouse')).length})
                      </button>
                    </div>
                  </div>

                  {/* Sources Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 flex-1 content-start">
                    {isLoadingArtifacts && (
                      <div className="col-span-full p-12 text-center text-xs text-[#616161] flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 text-[#117865] animate-spin" />
                        <span>Discovering Microsoft Fabric artifacts...</span>
                      </div>
                    )}

                    {!isLoadingArtifacts && filteredArtifacts.length === 0 && (
                      <div className="col-span-full p-12 text-center text-[#616161] bg-[#fafafa] rounded-lg border border-[#edebe9] text-xs">
                        No artifacts matching filter. Ensure your Azure Service Principal has permissions on workspace SQL Endpoints.
                      </div>
                    )}

                    {!isLoadingArtifacts && filteredArtifacts.map((art) => {
                      const isSelected = art.id === selectedArtifactId;
                      const isLakehouse = art.type?.toLowerCase().includes('lakehouse');

                      return (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() => handleArtifactChange(art.id)}
                          className={`p-4 rounded-lg border text-left transition flex flex-col justify-between gap-3 relative ${
                            isSelected
                              ? 'bg-[#e3f7ef]/50 border-[#117865] ring-2 ring-[#117865]/20 shadow-xs'
                              : 'bg-white border-[#edebe9] hover:border-[#d1d1d1] hover:bg-[#fafafa]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-md shrink-0 ${
                              isLakehouse ? 'bg-[#fff4ce] text-[#8a660a]' : 'bg-[#e3f7ef] text-[#117865]'
                            }`}>
                              <Database className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold text-xs text-[#242424] truncate">
                                  {art.displayName}
                                </span>
                              </div>
                              <span className={`inline-block px-1.5 py-0.5 text-[9px] font-medium uppercase rounded mt-1 ${
                                isLakehouse ? 'bg-[#fff4ce] text-[#8a660a]' : 'bg-[#e3f7ef] text-[#117865]'
                              }`}>
                                {art.type}
                              </span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[#edebe9] w-full text-[10px] text-[#616161] space-y-0.5">
                            <div className="truncate font-mono" title={art.serverFqdn}>
                              Endpoint: {art.serverFqdn || "Discovering..."}
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Database: {art.databaseName || art.displayName}</span>
                              {isSelected && (
                                <span className="text-[#117865] font-semibold flex items-center gap-0.5">
                                  <Check className="w-3 h-3 stroke-[3]" /> Selected
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* =========================================================
                  STEP 2: Choose Log Tables (Table Catalog)
                  ========================================================= */}
              {activeStep === 2 && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-[#242424]">
                        Select table catalog for {currentArtifact?.displayName || "selected artifact"}
                      </h2>
                      <p className="text-xs text-[#616161] mt-0.5">
                        Assign which SQL tables in this artifact correspond to Batch Header, Bronze Ingestion, and Silver Refinement.
                      </p>
                    </div>

                    {isLoadingTables && (
                      <span className="flex items-center gap-1.5 text-xs text-[#117865] animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying SQL Endpoint tables...
                      </span>
                    )}
                  </div>

                  {!isLoadingTables && availableTables.length === 0 && (
                    <div className="p-4 rounded-lg bg-[#fff4ce] border border-[#fde896] text-[#8a660a] text-xs flex items-center gap-2.5">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        No user tables or views were found in <strong>{currentArtifact?.displayName}</strong>. 
                        Please ensure the artifact has tables created (or select an artifact containing batch metadata like <strong>WH_MetaData</strong>).
                      </span>
                    </div>
                  )}

                  {/* 3 Role Selection Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Batch Header Table */}
                    <div className="p-4 rounded-lg border border-[#edebe9] bg-[#fafafa] space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[#242424]">1. Batch Header Log Table</span>
                          <span className="text-[10px] text-[#117865] font-medium px-2 py-0.5 bg-[#e3f7ef] rounded">Master</span>
                        </div>
                        <p className="text-[11px] text-[#616161] mt-1">
                          Stores overall pipeline execution, Run ID, Batch ID, and total duration.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-[#616161] block">
                          Table Selection:
                        </label>
                        <select
                          value={batchHeaderTable}
                          onChange={(e) => handleTableChange('batch_header', e.target.value)}
                          className="w-full bg-white border border-[#d1d1d1] rounded-md px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#117865] font-mono cursor-pointer shadow-xs"
                        >
                          <option value="">-- Select Table --</option>
                          {availableTables.map(t => (
                            <option key={`bh-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                          ))}
                        </select>

                        {batchHeaderTable && (
                          <div className="text-[11px] text-[#117865] font-medium flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3 stroke-[3]" /> {batchHeaderCols.length} columns discovered
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bronze Log Table */}
                    <div className="p-4 rounded-lg border border-[#edebe9] bg-[#fafafa] space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[#242424]">2. Bronze Layer Audit Table</span>
                          <span className="text-[10px] text-[#8a660a] font-medium px-2 py-0.5 bg-[#fff4ce] rounded">Raw Layer</span>
                        </div>
                        <p className="text-[11px] text-[#616161] mt-1">
                          Stores raw extraction audit logs, ingested row counts, and status per table.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-[#616161] block">
                          Table Selection:
                        </label>
                        <select
                          value={bronzeTable}
                          onChange={(e) => handleTableChange('bronze', e.target.value)}
                          className="w-full bg-white border border-[#d1d1d1] rounded-md px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#117865] font-mono cursor-pointer shadow-xs"
                        >
                          <option value="">-- Select Table --</option>
                          {availableTables.map(t => (
                            <option key={`br-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                          ))}
                        </select>

                        {bronzeTable && (
                          <div className="text-[11px] text-[#117865] font-medium flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3 stroke-[3]" /> {bronzeCols.length} columns discovered
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Silver Log Table */}
                    <div className="p-4 rounded-lg border border-[#edebe9] bg-[#fafafa] space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-[#242424]">3. Silver Layer Audit Table</span>
                          <span className="text-[10px] text-[#117865] font-medium px-2 py-0.5 bg-[#e3f7ef] rounded">Refined Layer</span>
                        </div>
                        <p className="text-[11px] text-[#616161] mt-1">
                          Stores transformation logs, refined row counts, and stage execution metrics.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-[#616161] block">
                          Table Selection:
                        </label>
                        <select
                          value={silverTable}
                          onChange={(e) => handleTableChange('silver', e.target.value)}
                          className="w-full bg-white border border-[#d1d1d1] rounded-md px-2.5 py-1.5 text-xs text-[#242424] focus:outline-none focus:border-[#117865] font-mono cursor-pointer shadow-xs"
                        >
                          <option value="">-- Select Table --</option>
                          {availableTables.map(t => (
                            <option key={`sl-${t.fullName}`} value={t.fullName}>{t.fullName}</option>
                          ))}
                        </select>

                        {silverTable && (
                          <div className="text-[11px] text-[#117865] font-medium flex items-center gap-1 mt-1">
                            <Check className="w-3 h-3 stroke-[3]" /> {silverCols.length} columns discovered
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* =========================================================
                  STEP 3: Map Audit Columns
                  ========================================================= */}
              {activeStep === 3 && (
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edebe9]">
                    <div>
                      <h2 className="text-sm font-semibold text-[#242424]">
                        Map source database columns to standard audit attributes
                      </h2>
                      <p className="text-xs text-[#616161] mt-0.5">
                        These mappings allow the Monitoring Hub to extract Run IDs, row counts, and status dynamically.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoMap}
                      className="px-3.5 py-1.5 rounded-md bg-[#e3f7ef] hover:bg-[#117865] text-[#117865] hover:text-white border border-[#117865]/30 text-xs font-semibold transition flex items-center gap-1.5 self-start sm:self-auto shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Auto-Map Matching Columns</span>
                    </button>
                  </div>

                  {/* Sub Tabs: Batch Header / Bronze / Silver */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMappingSubTab('batch_header')}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                        mappingSubTab === 'batch_header'
                          ? 'bg-[#117865] text-white shadow-xs'
                          : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                      }`}
                    >
                      <TableProperties className="w-3.5 h-3.5" />
                      <span>Batch Header ({Object.keys(batchHeaderMapping).filter(k => batchHeaderMapping[k]).length}/7)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMappingSubTab('bronze')}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                        mappingSubTab === 'bronze'
                          ? 'bg-[#117865] text-white shadow-xs'
                          : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Bronze Layer ({Object.keys(bronzeMapping).filter(k => bronzeMapping[k]).length}/9)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMappingSubTab('silver')}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5 ${
                        mappingSubTab === 'silver'
                          ? 'bg-[#117865] text-white shadow-xs'
                          : 'bg-[#f5f5f5] text-[#616161] hover:bg-[#edebe9]'
                      }`}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Silver Layer ({Object.keys(silverMapping).filter(k => silverMapping[k]).length}/9)</span>
                    </button>
                  </div>

                  {/* Mapping Table for Selected Sub Tab */}
                  <div className="bg-white border border-[#edebe9] rounded-lg p-4 sm:p-5 shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
                    {mappingSubTab === 'batch_header' && (
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="shrink-0 text-xs font-semibold text-[#616161] pb-2.5 border-b border-[#edebe9] mb-2 flex items-center justify-between px-1">
                          <span>Target Attribute</span>
                          <span>Source Column ({batchHeaderTable || "No Table Selected"})</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
                          <MappingRow
                            label="Pipeline Run ID (Telemetry correlation)"
                            description="Unique Fabric pipeline run ID mapped to this batch header record."
                            currentVal={batchHeaderMapping.pipeline_run_id_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, pipeline_run_id_col: val }))}
                          />
                          <MappingRow
                            label="Batch ID (Primary Key)"
                            description="Unique batch identifier that joins summary with Bronze & Silver log rows."
                            currentVal={batchHeaderMapping.batch_id_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, batch_id_col: val }))}
                          />
                          <MappingRow
                            label="Pipeline Name"
                            description="Human-readable pipeline name displayed in header and batch switcher."
                            currentVal={batchHeaderMapping.pipeline_name_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, pipeline_name_col: val }))}
                          />
                          <MappingRow
                            label="Batch Execution Status"
                            description="Execution status column (Success, Failure, In Progress)."
                            currentVal={batchHeaderMapping.status_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, status_col: val }))}
                          />
                          <MappingRow
                            label="Start Time"
                            description="Batch execution start timestamp."
                            currentVal={batchHeaderMapping.start_time_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, start_time_col: val }))}
                          />
                          <MappingRow
                            label="Duration"
                            description="Overall batch execution duration in minutes or seconds."
                            currentVal={batchHeaderMapping.duration_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, duration_col: val }))}
                          />
                          <MappingRow
                            label="Error Message"
                            description="Execution error message if the batch failed."
                            currentVal={batchHeaderMapping.error_message_col}
                            columns={batchHeaderCols}
                            onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, error_message_col: val }))}
                          />
                        </div>
                      </div>
                    )}

                    {mappingSubTab === 'bronze' && (
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="shrink-0 text-xs font-semibold text-[#616161] pb-2.5 border-b border-[#edebe9] mb-2 flex items-center justify-between px-1">
                          <span>Target Attribute</span>
                          <span>Source Column ({bronzeTable || "No Table Selected"})</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
                          <MappingRow
                            label="Batch ID (Foreign Key)"
                            description="Foreign key column matching the Batch Header BatchId."
                            currentVal={bronzeMapping.batch_id_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, batch_id_col: val }))}
                          />
                          <MappingRow
                            label="Table Name"
                            description="Name of the ingested Bronze table."
                            currentVal={bronzeMapping.table_name_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, table_name_col: val }))}
                          />
                          <MappingRow
                            label="Schema Name"
                            description="Schema of the ingested Bronze table (e.g. dbo, raw, bronze)."
                            currentVal={bronzeMapping.schema_name_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, schema_name_col: val }))}
                          />
                          <MappingRow
                            label="Rows Ingested / Processed"
                            description="Number of rows loaded into Bronze layer."
                            currentVal={bronzeMapping.rows_processed_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, rows_processed_col: val }))}
                          />
                          <MappingRow
                            label="Status"
                            description="Ingestion status for the specific table."
                            currentVal={bronzeMapping.status_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, status_col: val }))}
                          />
                          <MappingRow
                            label="Start Time"
                            description="Extraction start timestamp."
                            currentVal={bronzeMapping.start_time_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, start_time_col: val }))}
                          />
                          <MappingRow
                            label="End Time"
                            description="Extraction completion timestamp."
                            currentVal={bronzeMapping.end_time_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, end_time_col: val }))}
                          />
                          <MappingRow
                            label="Duration"
                            description="Table extraction duration in seconds or minutes."
                            currentVal={bronzeMapping.duration_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, duration_col: val }))}
                          />
                          <MappingRow
                            label="Error Message"
                            description="Error description if extraction failed."
                            currentVal={bronzeMapping.error_message_col}
                            columns={bronzeCols}
                            onChange={(val) => setBronzeMapping(prev => ({ ...prev, error_message_col: val }))}
                          />
                        </div>
                      </div>
                    )}

                    {mappingSubTab === 'silver' && (
                      <div className="flex-1 min-h-0 flex flex-col">
                        <div className="shrink-0 text-xs font-semibold text-[#616161] pb-2.5 border-b border-[#edebe9] mb-2 flex items-center justify-between px-1">
                          <span>Target Attribute</span>
                          <span>Source Column ({silverTable || "No Table Selected"})</span>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
                          <MappingRow
                            label="Batch ID (Foreign Key)"
                            description="Foreign key column matching the Batch Header BatchId."
                            currentVal={silverMapping.batch_id_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, batch_id_col: val }))}
                          />
                          <MappingRow
                            label="Table Name"
                            description="Name of the transformed Silver table."
                            currentVal={silverMapping.table_name_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, table_name_col: val }))}
                          />
                          <MappingRow
                            label="Schema Name"
                            description="Database schema of the silver table (e.g. dbo, silver)."
                            currentVal={silverMapping.schema_name_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, schema_name_col: val }))}
                          />
                          <MappingRow
                            label="Rows Refined / Processed"
                            description="Transformed row count loaded into Silver."
                            currentVal={silverMapping.rows_processed_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, rows_processed_col: val }))}
                          />
                          <MappingRow
                            label="Status"
                            description="Silver refinement status."
                            currentVal={silverMapping.status_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, status_col: val }))}
                          />
                          <MappingRow
                            label="Start Time"
                            description="Refinement start timestamp."
                            currentVal={silverMapping.start_time_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, start_time_col: val }))}
                          />
                          <MappingRow
                            label="End Time"
                            description="Refinement end timestamp."
                            currentVal={silverMapping.end_time_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, end_time_col: val }))}
                          />
                          <MappingRow
                            label="Duration"
                            description="Refinement duration in seconds or minutes."
                            currentVal={silverMapping.duration_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, duration_col: val }))}
                          />
                          <MappingRow
                            label="Error Message"
                            description="Error description if silver transformation failed."
                            currentVal={silverMapping.error_message_col}
                            columns={silverCols}
                            onChange={(val) => setSilverMapping(prev => ({ ...prev, error_message_col: val }))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* =========================================================
                  STEP 4: Review and Create
                  ========================================================= */}
              {activeStep === 4 && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h2 className="text-sm font-semibold text-[#242424]">
                      Review configuration summary
                    </h2>
                    <p className="text-xs text-[#616161] mt-0.5">
                      Verify your Microsoft Fabric data item, catalog tables, and column audit mappings before applying.
                    </p>
                  </div>

                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Source Summary */}
                    <div className="p-4 rounded-lg border border-[#edebe9] bg-[#fafafa] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#117865]">
                        <Database className="w-4 h-4" />
                        <span>Data Source & SQL Endpoint</span>
                      </div>
                      <div className="text-xs space-y-1 pt-1 border-t border-[#edebe9]">
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Item Name:</span>
                          <span className="font-semibold text-[#242424]">{currentArtifact?.displayName || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Item Type:</span>
                          <span className="font-medium text-[#242424]">{currentArtifact?.type || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Database:</span>
                          <span className="font-mono text-[#242424]">{currentArtifact?.databaseName || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tables Summary */}
                    <div className="p-4 rounded-lg border border-[#edebe9] bg-[#fafafa] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#117865]">
                        <TableProperties className="w-4 h-4" />
                        <span>Catalog Log Tables</span>
                      </div>
                      <div className="text-xs space-y-1 pt-1 border-t border-[#edebe9]">
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Batch Header:</span>
                          <span className="font-mono text-[#242424]">{batchHeaderTable || "Not selected"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Bronze Layer:</span>
                          <span className="font-mono text-[#242424]">{bronzeTable || "Not selected"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#616161]">Silver Layer:</span>
                          <span className="font-mono text-[#242424]">{silverTable || "Not selected"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Readiness Checklist */}
                  <div className="p-4 rounded-lg border border-[#edebe9] bg-white space-y-3 shadow-xs">
                    <span className="text-xs font-semibold text-[#242424] block">
                      Configuration Health Checklist
                    </span>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        {isStep1Complete ? (
                          <div className="w-4 h-4 rounded-full bg-[#117865] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#d1d1d1] shrink-0" />
                        )}
                        <span className={isStep1Complete ? 'text-[#242424] font-medium' : 'text-[#616161]'}>
                          Fabric Warehouse / Lakehouse Selected & Connected
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isStep2Complete ? (
                          <div className="w-4 h-4 rounded-full bg-[#117865] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#d1d1d1] shrink-0" />
                        )}
                        <span className={isStep2Complete ? 'text-[#242424] font-medium' : 'text-[#616161]'}>
                          At least 1 log table selected in Table Catalog
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {batchHeaderMapping.pipeline_run_id_col ? (
                          <div className="w-4 h-4 rounded-full bg-[#117865] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-[#fff4ce] text-[#8a660a] flex items-center justify-center shrink-0 text-[10px] font-bold">
                            !
                          </div>
                        )}
                        <span className={batchHeaderMapping.pipeline_run_id_col ? 'text-[#242424] font-medium' : 'text-[#8a660a]'}>
                          Pipeline Run ID correlated for Monitoring Hub telemetry
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {totalMappedColumns > 0 ? (
                          <div className="w-4 h-4 rounded-full bg-[#117865] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#d1d1d1] shrink-0" />
                        )}
                        <span className="text-[#242424] font-medium">
                          {totalMappedColumns} audit attributes mapped across layers
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ready to apply banner */}
                  <div className="p-3.5 rounded-lg bg-[#e3f7ef] border border-[#117865]/30 text-[#117865] text-xs flex items-center gap-2.5 mt-auto">
                    <ShieldCheck className="w-5 h-5 shrink-0" />
                    <span>
                      Ready to apply! Click <strong>Save & Apply Configuration</strong> below to persist your mappings to the Monitoring Hub.
                    </span>
                  </div>
                </div>
              )}
            </main>
          </div>

      {/* Wizard Footer Action Bar (Pinned across bottom) */}
      <footer className="border-t border-[#edebe9] px-8 py-3.5 bg-white flex items-center justify-between shrink-0 shadow-xs">
        <button
          type="button"
          onClick={handleResetMapping}
          className="text-xs text-[#a80000] hover:underline flex items-center gap-1.5 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Reset Configuration</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={activeStep === 1}
            onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))}
            className="px-4 py-1.5 rounded-md border border-[#d1d1d1] bg-white text-[#242424] hover:bg-[#f5f5f5] text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {activeStep < 4 ? (
            <button
              type="button"
              onClick={() => setActiveStep(prev => Math.min(prev + 1, 4))}
              className="px-5 py-1.5 rounded-md bg-[#117865] hover:bg-[#0c5e4f] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-1.5 rounded-md bg-[#117865] hover:bg-[#0c5e4f] text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Apply Configuration</span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function MappingRow({ label, description, currentVal, columns, onChange }) {
  return (
    <div className="p-3 rounded-md bg-[#fafafa] border border-[#edebe9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#117865]/40 transition shadow-2xs">
      <div className="sm:w-1/2">
        <div className="font-semibold text-[#242424] text-xs flex items-center gap-1.5">
          <span>{label}</span>
        </div>
        <p className="text-[11px] text-[#616161] mt-0.5 leading-snug">{description}</p>
      </div>

      <div className="sm:w-1/2 flex items-center gap-2">
        <select
          value={currentVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white border border-[#d1d1d1] rounded-md px-2.5 py-1.5 text-xs text-[#242424] font-mono focus:outline-none focus:border-[#117865] cursor-pointer shadow-2xs"
        >
          <option value="">-- Select Column --</option>
          {columns.map(c => (
            <option key={c.name} value={c.name} className="bg-white text-[#242424]">
              {c.name} ({c.dataType})
            </option>
          ))}
        </select>
        {currentVal ? (
          <span className="px-2 py-0.5 rounded bg-[#e3f7ef] border border-[#117865]/30 text-[10px] text-[#117865] font-mono shrink-0 font-semibold flex items-center gap-1">
            <Check className="w-2.5 h-2.5 stroke-[3]" /> Mapped
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#f5f5f5] text-[10px] text-[#616161] font-mono shrink-0">
            Unmapped
          </span>
        )}
      </div>
    </div>
  );
}
