import React, { useState, useEffect } from 'react';
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
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';

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

  // Stepper state: 1: 'source', 2: 'batch_header', 3: 'bronze', 4: 'silver'
  const [activeStep, setActiveStep] = useState(1);

  // Load existing mapping and workspace artifacts
  useEffect(() => {
    if (!workspaceId) return;

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

            if (m.server_fqdn && m.database_name) {
              await fetchTables(m.server_fqdn, m.database_name, bhFull, brFull, slFull);
              return;
            }
          }
        }

        // If no saved mapping, default artifact selection if available
        if (artList.length > 0) {
          const firstArt = artList[0];
          setSelectedArtifactId(firstArt.id);
          if (firstArt.serverFqdn && firstArt.databaseName) {
            await fetchTables(firstArt.serverFqdn, firstArt.databaseName);
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
      batch_header_schema: bhSchema || null,
      batch_header_table: bhTable || null,
      bronze_schema: brSchema || null,
      bronze_table: brTable || null,
      silver_schema: slSchema || null,
      silver_table: slTable || null,
      batch_header_mapping: batchHeaderMapping,
      bronze_mapping: bronzeMapping,
      silver_mapping: silverMapping
    };

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusMsg({ type: 'success', text: 'Column mapping successfully saved and applied to Monitoring hub!' });
        if (onSaved) onSaved();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: err.detail || 'Failed to save mapping.' });
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

  const currentArtifact = artifacts.find(a => a.id === selectedArtifactId);

  // Stepper completion checks
  const isStep1Complete = !!selectedArtifactId && !!(batchHeaderTable || bronzeTable || silverTable);
  const isStep2Complete = !!batchHeaderTable && Object.keys(batchHeaderMapping).length > 0;
  const isStep3Complete = !!bronzeTable && Object.keys(bronzeMapping).length > 0;
  const isStep4Complete = !!silverTable && Object.keys(silverMapping).length > 0;

  const completedStepsCount = [isStep1Complete, isStep2Complete, isStep3Complete, isStep4Complete].filter(Boolean).length;
  const progressPercent = Math.round((completedStepsCount / 4) * 100);

  const steps = [
    {
      number: 1,
      id: 'source',
      title: 'Source & Data Artifact',
      subtitle: 'Select Lakehouse / Warehouse & log tables',
      isCompleted: isStep1Complete,
      icon: Database
    },
    {
      number: 2,
      id: 'batch_header',
      title: 'Batch Header Mapping',
      subtitle: 'Map Run ID, Batch ID, status & duration',
      isCompleted: isStep2Complete,
      icon: TableProperties
    },
    {
      number: 3,
      id: 'bronze',
      title: 'Bronze Layer Mapping',
      subtitle: 'Map Bronze table ingestion audit fields',
      isCompleted: isStep3Complete,
      icon: Layers
    },
    {
      number: 4,
      id: 'silver',
      title: 'Silver Layer Mapping',
      subtitle: 'Map Silver refinement audit fields',
      isCompleted: isStep4Complete,
      icon: FileSpreadsheet
    }
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] text-[#242424] select-none">
      {/* Top Breadcrumb & Page Title Bar */}
      <div className="bg-[#ffffff] border-b border-[#edebe9] px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="space-y-1 min-w-0">
          <nav className="flex items-center gap-1.5 text-xs text-[#605e5c]">
            <button 
              onClick={onBackToMonitoring}
              className="hover:text-[#0f6cbd] flex items-center gap-1 transition"
            >
              <span>Workspaces</span>
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d]" />
            <span className="text-[#323130] font-medium truncate max-w-[200px]">
              {workspaceName || 'Current Workspace'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d]" />
            <button 
              onClick={onBackToMonitoring}
              className="hover:text-[#0f6cbd] transition"
            >
              Monitoring hub
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#a19f9d]" />
            <span className="text-[#242424] font-semibold">Table Logging Configuration</span>
          </nav>

          <div className="flex items-center gap-2.5 pt-0.5">
            <button
              onClick={onBackToMonitoring}
              title="Return to Monitoring hub"
              className="p-1 rounded text-[#605e5c] hover:text-[#242424] hover:bg-[#f3f2f1] transition border border-transparent hover:border-[#edebe9]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#242424] tracking-tight flex items-center gap-2">
                Lakehouse / Warehouse & Dynamic Column Mapping
                <span className="px-2 py-0.5 rounded text-[11px] font-normal bg-[#eff6fc] text-[#0f6cbd] border border-[#c7e0f4]">
                  Fabric SQL Endpoint
                </span>
              </h1>
              <p className="text-xs text-[#605e5c]">
                Connect dynamically to your Microsoft Fabric data items to query ETL batch execution logs and layer ingestion metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBackToMonitoring}
            className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#242424] text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Monitoring Hub</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Mapping"}</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Experience */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Vertical Stepper Navigation Rail */}
        <aside className="w-72 lg:w-80 border-r border-[#edebe9] bg-[#ffffff] flex flex-col shrink-0 overflow-y-auto">
          {/* Stepper Header with Progress Meter */}
          <div className="p-5 border-b border-[#edebe9] space-y-2.5 bg-[#faf9f8]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#242424] uppercase tracking-wider">Setup Progress</span>
              <span className="text-xs font-bold text-[#0f6cbd]">{progressPercent}%</span>
            </div>
            
            {/* Fluent Progress Bar */}
            <div className="w-full bg-[#edebe9] h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#0f6cbd] h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.max( progressPercent, 5)}%` }}
              />
            </div>
            
            <p className="text-[11px] text-[#605e5c]">
              {completedStepsCount} of 4 steps completed
            </p>
          </div>

          {/* Vertical Stepper Timeline */}
          <nav className="p-4 flex-1 space-y-1">
            {steps.map((step, idx) => {
              const isActive = activeStep === step.number;
              const isCompleted = step.isCompleted;
              const isLast = idx === steps.length - 1;
              const StepIcon = step.icon;

              return (
                <div key={step.id} className="relative">
                  {/* Vertical Connecting Line */}
                  {!isLast && (
                    <div 
                      className={`absolute left-[18px] top-9 bottom-[-10px] w-0.5 transition-colors duration-200 ${
                        isCompleted ? 'bg-[#107c41]' : isActive ? 'bg-[#0f6cbd]/40' : 'bg-[#edebe9]'
                      }`}
                      style={{ zIndex: 0 }}
                    />
                  )}

                  {/* Step Item Card / Button */}
                  <button
                    type="button"
                    onClick={() => setActiveStep(step.number)}
                    className={`relative z-10 w-full text-left p-3 rounded transition-all flex items-start gap-3 group ${
                      isActive 
                        ? 'bg-[#eff6fc] border border-[#c7e0f4] shadow-sm'
                        : 'hover:bg-[#f3f2f1] border border-transparent'
                    }`}
                  >
                    {/* Node Circle */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                      isCompleted
                        ? 'bg-[#dff6dd] text-[#107c41] border-2 border-[#107c41]'
                        : isActive
                        ? 'bg-[#0f6cbd] text-white ring-4 ring-[#eff6fc] shadow-sm'
                        : 'bg-[#ffffff] text-[#605e5c] border-2 border-[#d1d1d1] group-hover:border-[#0f6cbd]'
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <span>{step.number}</span>
                      )}
                    </div>

                    {/* Step Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className={`text-xs font-semibold truncate ${
                          isActive ? 'text-[#0f6cbd]' : 'text-[#242424]'
                        }`}>
                          {step.title}
                        </h3>
                        {isCompleted && (
                          <span className="text-[10px] text-[#107c41] font-medium bg-[#dff6dd] px-1.5 py-0.2 rounded shrink-0">
                            Ready
                          </span>
                        )}
                        {!isCompleted && isActive && (
                          <span className="text-[10px] text-[#0f6cbd] font-medium bg-[#eff6fc] px-1.5 py-0.2 rounded border border-[#c7e0f4] shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#605e5c] leading-tight mt-0.5 line-clamp-2">
                        {step.subtitle}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Left Rail Summary Widget */}
          <div className="p-4 border-t border-[#edebe9] bg-[#faf9f8] space-y-2 text-xs">
            <span className="text-[10px] font-bold text-[#605e5c] uppercase tracking-wider block">
              Active Configuration
            </span>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#605e5c]">Data Item:</span>
                <span className="font-semibold text-[#242424] truncate max-w-[140px]" title={currentArtifact?.displayName || "None"}>
                  {currentArtifact?.displayName || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#605e5c]">Batch Table:</span>
                <span className="font-mono text-[#0f6cbd] truncate max-w-[140px]" title={batchHeaderTable || "None"}>
                  {batchHeaderTable ? batchHeaderTable.split('.').pop() : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#605e5c]">Bronze Table:</span>
                <span className="font-mono text-[#d83b01] truncate max-w-[140px]" title={bronzeTable || "None"}>
                  {bronzeTable ? bronzeTable.split('.').pop() : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#605e5c]">Silver Table:</span>
                <span className="font-mono text-[#0078d4] truncate max-w-[140px]" title={silverTable || "None"}>
                  {silverTable ? silverTable.split('.').pop() : "—"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: Active Step Workspace */}
        <main className="flex-1 overflow-y-auto bg-[#faf9f8] p-6 space-y-4">
          {/* Status Feedback Banner */}
          {statusMsg && (
            <div className={`p-3 rounded border flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
              statusMsg.type === 'success'
                ? 'bg-[#dff6dd] border-[#92c353] text-[#107c41]'
                : 'bg-[#fde7e9] border-[#f19999] text-[#a80000]'
            }`}>
              <div className="flex items-center gap-2 text-xs font-medium">
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

          {/* STEP 1: Source & Tables */}
          {activeStep === 1 && (
            <div className="space-y-4">
              {/* Step Header Card */}
              <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0f6cbd]" />
                  <h2 className="text-sm font-bold text-[#242424]">Step 1: Select Microsoft Fabric Artifact & Schemas</h2>
                </div>
                <p className="text-xs text-[#605e5c] leading-relaxed">
                  Choose the Fabric Lakehouse or Warehouse containing your batch logging tables. The system connects dynamically to its SQL Endpoint to list available tables and inspect metadata columns.
                </p>
              </div>

              {/* Data Artifact Selection Grid */}
              <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-xs text-[#242424] flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#0f6cbd]" />
                    Available Warehouses & Lakehouses in Workspace
                  </label>
                  {isLoadingArtifacts && (
                    <span className="flex items-center gap-1.5 text-xs text-[#0f6cbd] animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Discovering Fabric artifacts...
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {artifacts.length === 0 && !isLoadingArtifacts && (
                    <div className="col-span-full p-6 text-center text-[#605e5c] bg-[#faf9f8] rounded border border-[#edebe9] text-xs">
                      No Lakehouses or Warehouses found in this workspace. Ensure your Azure Service Principal has Read/Execute permissions on workspace SQL Endpoints.
                    </div>
                  )}

                  {artifacts.map((art) => {
                    const isSelected = art.id === selectedArtifactId;
                    const isLakehouse = art.type?.toLowerCase().includes('lakehouse');

                    return (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => handleArtifactChange(art.id)}
                        className={`p-3.5 rounded border text-left transition flex items-start gap-3 ${
                          isSelected
                            ? 'bg-[#eff6fc] border-[#0f6cbd] ring-2 ring-[#0f6cbd]/20 shadow-sm'
                            : 'bg-[#ffffff] border-[#edebe9] hover:border-[#d1d1d1] hover:bg-[#faf9f8]'
                        }`}
                      >
                        <div className={`p-2.5 rounded shrink-0 ${
                          isLakehouse ? 'bg-[#fff4ce] text-[#8a660a]' : 'bg-[#eff6fc] text-[#0f6cbd]'
                        }`}>
                          <Database className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold text-xs text-[#242424] truncate">
                              {art.displayName}
                            </span>
                            <span className={`px-1.5 py-0.2 text-[9px] font-medium uppercase rounded ${
                              isLakehouse ? 'bg-[#fff4ce] text-[#8a660a]' : 'bg-[#eff6fc] text-[#0f6cbd]'
                            }`}>
                              {art.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#605e5c] font-mono truncate mt-1">
                            {art.serverFqdn || "Endpoint discovering..."}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-[#797775] mt-1.5">
                            <span>DB: {art.databaseName || art.displayName}</span>
                            {isSelected && (
                              <span className="text-[#107c41] font-semibold flex items-center gap-0.5 ml-auto">
                                <Check className="w-3 h-3" /> Selected
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table Pickers */}
              {selectedArtifactId && (
                <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-xs text-[#242424] flex items-center gap-2">
                        <TableProperties className="w-4 h-4 text-[#0f6cbd]" />
                        Map Log Tables from {currentArtifact?.displayName}
                      </h3>
                      <p className="text-[11px] text-[#605e5c]">
                        Select which SQL tables in the artifact correspond to the Batch Header, Bronze, and Silver logs.
                      </p>
                    </div>
                    {isLoadingTables && (
                      <span className="flex items-center gap-1.5 text-xs text-[#0f6cbd] animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying SQL Endpoint tables...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Batch Header Table */}
                    <div className="p-3.5 rounded border border-[#edebe9] bg-[#faf9f8] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#242424]">1. Batch Header Table</span>
                        <span className="text-[10px] text-[#0f6cbd] font-medium px-1.5 py-0.2 bg-[#eff6fc] rounded">Master</span>
                      </div>
                      <p className="text-[11px] text-[#605e5c]">Stores PipelineRunId, BatchId, PipelineName, and overall status.</p>
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
                      {batchHeaderTable && (
                        <div className="text-[11px] text-[#107c41] font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> {batchHeaderCols.length} columns loaded
                        </div>
                      )}
                    </div>

                    {/* Bronze Table */}
                    <div className="p-3.5 rounded border border-[#edebe9] bg-[#faf9f8] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#d83b01]">2. Bronze Log Table</span>
                        <span className="text-[10px] text-[#d83b01] font-medium px-1.5 py-0.2 bg-[#fff4ce] rounded">Raw Load</span>
                      </div>
                      <p className="text-[11px] text-[#605e5c]">Stores BatchId, TableName, SchemaName, and raw row counts.</p>
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
                      {bronzeTable && (
                        <div className="text-[11px] text-[#107c41] font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> {bronzeCols.length} columns loaded
                        </div>
                      )}
                    </div>

                    {/* Silver Table */}
                    <div className="p-3.5 rounded border border-[#edebe9] bg-[#faf9f8] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#0078d4]">3. Silver Log Table</span>
                        <span className="text-[10px] text-[#0078d4] font-medium px-1.5 py-0.2 bg-[#eff6fc] rounded">Refined</span>
                      </div>
                      <p className="text-[11px] text-[#605e5c]">Stores BatchId, TableName, transformed rows, and durations.</p>
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
                      {silverTable && (
                        <div className="text-[11px] text-[#107c41] font-mono flex items-center gap-1">
                          <Check className="w-3 h-3" /> {silverCols.length} columns loaded
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Batch Header Mapping */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0f6cbd]" />
                    <h2 className="text-sm font-bold text-[#242424]">Step 2: Batch Header Column Mapping</h2>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#c7e0f4]">
                    Table: {batchHeaderTable || "None Selected"}
                  </span>
                </div>
                <p className="text-xs text-[#605e5c]">
                  Map each required semantic attribute to the column name in your database's batch header table.
                </p>
              </div>

              {!batchHeaderTable ? (
                <div className="p-12 text-center bg-[#ffffff] rounded border border-[#edebe9] space-y-3">
                  <AlertCircle className="w-8 h-8 text-[#8a660a] mx-auto" />
                  <p className="text-xs text-[#605e5c]">
                    Please select a <strong>Batch Header Table</strong> in Step 1 before mapping columns.
                  </p>
                  <button
                    onClick={() => setActiveStep(1)}
                    className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition"
                  >
                    Go to Step 1
                  </button>
                </div>
              ) : (
                <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#edebe9]">
                    <span className="text-xs font-semibold text-[#242424] uppercase tracking-wider">Semantic Field</span>
                    <span className="text-xs font-semibold text-[#242424] uppercase tracking-wider">Database Column Mapping</span>
                  </div>

                  <div className="space-y-2.5">
                    <MappingRow
                      label="Pipeline Run ID"
                      description="Links Fabric pipeline run ID to this batch record for telemetry correlation."
                      currentVal={batchHeaderMapping.pipeline_run_id_col}
                      columns={batchHeaderCols}
                      onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, pipeline_run_id_col: val }))}
                    />
                    <MappingRow
                      label="Batch ID (Primary Key)"
                      description="Unique batch run identifier. Joins batch summary with Bronze & Silver log tables."
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
                      label="Batch Execution Status"
                      description="Batch status (e.g. Success, Failure, In Progress). Displayed in header pill."
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
                      description="Overall batch execution error description if failed."
                      currentVal={batchHeaderMapping.error_message_col}
                      columns={batchHeaderCols}
                      onChange={(val) => setBatchHeaderMapping(prev => ({ ...prev, error_message_col: val }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Bronze Layer Mapping */}
          {activeStep === 3 && (
            <div className="space-y-4">
              <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#d83b01]" />
                    <h2 className="text-sm font-bold text-[#242424]">Step 3: Bronze Layer Ingestion Column Mapping</h2>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#fff4ce] text-[#8a660a] border border-[#fed9cc]">
                    Table: {bronzeTable || "None Selected"}
                  </span>
                </div>
                <p className="text-xs text-[#605e5c]">
                  Configure column mappings for your raw ingestion layer log table.
                </p>
              </div>

              {!bronzeTable ? (
                <div className="p-12 text-center bg-[#ffffff] rounded border border-[#edebe9] space-y-3">
                  <AlertCircle className="w-8 h-8 text-[#8a660a] mx-auto" />
                  <p className="text-xs text-[#605e5c]">
                    Please select a <strong>Bronze Log Table</strong> in Step 1 before mapping columns.
                  </p>
                  <button
                    onClick={() => setActiveStep(1)}
                    className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition"
                  >
                    Go to Step 1
                  </button>
                </div>
              ) : (
                <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-3">
                  <div className="p-2.5 rounded bg-[#eff6fc] border border-[#c7e0f4] text-[#004e8c] text-xs flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-[#0f6cbd] shrink-0 mt-0.5" />
                    <span>
                      The system automatically detects if Table Name and Schema Name are inverted in your database and corrects them during query execution.
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <MappingRow
                      label="Batch ID (Foreign Key)"
                      description="Foreign key column matching the Batch Header BatchId to filter logs."
                      currentVal={bronzeMapping.batch_id_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, batch_id_col: val }))}
                    />
                    <MappingRow
                      label="Table Name"
                      description="Name of the ingested Bronze table. Displayed in table details & counts."
                      currentVal={bronzeMapping.table_name_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, table_name_col: val }))}
                    />
                    <MappingRow
                      label="Schema Name"
                      description="Schema of the ingested Bronze table (e.g. dbo, raw, stg)."
                      currentVal={bronzeMapping.schema_name_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, schema_name_col: val }))}
                    />
                    <MappingRow
                      label="Rows Processed / Ingested"
                      description="Rows loaded (e.g. IngestionCount). Aggregated in Rows Processed KPI."
                      currentVal={bronzeMapping.rows_processed_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, rows_processed_col: val }))}
                    />
                    <MappingRow
                      label="Status"
                      description="Ingestion status (e.g. Success, Failure). Used for KPI counts."
                      currentVal={bronzeMapping.status_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, status_col: val }))}
                    />
                    <MappingRow
                      label="Start Time"
                      description="Table extraction start timestamp."
                      currentVal={bronzeMapping.start_time_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, start_time_col: val }))}
                    />
                    <MappingRow
                      label="End Time"
                      description="Table extraction completion timestamp."
                      currentVal={bronzeMapping.end_time_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, end_time_col: val }))}
                    />
                    <MappingRow
                      label="Duration"
                      description="Pre-computed table extraction duration in seconds or minutes."
                      currentVal={bronzeMapping.duration_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, duration_col: val }))}
                    />
                    <MappingRow
                      label="Error Message"
                      description="Error description if bronze extraction failed."
                      currentVal={bronzeMapping.error_message_col}
                      columns={bronzeCols}
                      onChange={(val) => setBronzeMapping(prev => ({ ...prev, error_message_col: val }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Silver Layer Mapping */}
          {activeStep === 4 && (
            <div className="space-y-4">
              <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0078d4]" />
                    <h2 className="text-sm font-bold text-[#242424]">Step 4: Silver Layer Refinement Column Mapping</h2>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#eff6fc] text-[#0078d4] border border-[#c7e0f4]">
                    Table: {silverTable || "None Selected"}
                  </span>
                </div>
                <p className="text-xs text-[#605e5c]">
                  Configure column mappings for your transformed Silver layer log table.
                </p>
              </div>

              {!silverTable ? (
                <div className="p-12 text-center bg-[#ffffff] rounded border border-[#edebe9] space-y-3">
                  <AlertCircle className="w-8 h-8 text-[#8a660a] mx-auto" />
                  <p className="text-xs text-[#605e5c]">
                    Please select a <strong>Silver Log Table</strong> in Step 1 before mapping columns.
                  </p>
                  <button
                    onClick={() => setActiveStep(1)}
                    className="px-3.5 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition"
                  >
                    Go to Step 1
                  </button>
                </div>
              ) : (
                <div className="bg-[#ffffff] border border-[#edebe9] rounded p-5 shadow-sm space-y-3">
                  <div className="space-y-2.5">
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
                      label="Rows Processed / Count"
                      description="Loaded transformed row count."
                      currentVal={silverMapping.rows_processed_col}
                      columns={silverCols}
                      onChange={(val) => setSilverMapping(prev => ({ ...prev, rows_processed_col: val }))}
                    />
                    <MappingRow
                      label="Status"
                      description="Execution status (e.g. Success, Failure)."
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
                      description="Table load end timestamp."
                      currentVal={silverMapping.end_time_col}
                      columns={silverCols}
                      onChange={(val) => setSilverMapping(prev => ({ ...prev, end_time_col: val }))}
                    />
                    <MappingRow
                      label="Duration"
                      description="Execution duration in minutes or seconds."
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
                </div>
              )}
            </div>
          )}

          {/* Stepper Navigation Command Bar */}
          <div className="bg-[#ffffff] border border-[#edebe9] rounded p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activeStep === 1}
                onClick={() => setActiveStep(prev => Math.max(prev - 1, 1))}
                className="px-3.5 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] text-[#242424] text-xs font-medium transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>

              {activeStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(prev => Math.min(prev + 1, 4))}
                  className="px-4 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Next: {steps[activeStep]?.title}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? "Saving..." : "Save & Complete Configuration"}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetMapping}
                title="Clear all saved mappings and reset"
                className="px-3 py-1.5 rounded bg-[#ffffff] hover:bg-[#fde7e9] border border-[#d1d1d1] text-[#a80000] text-xs font-medium transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset Mapping</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-1.5 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? "Saving..." : "Save Mapping"}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function MappingRow({ label, description, currentVal, columns, onChange }) {
  return (
    <div className="p-3 rounded bg-[#ffffff] border border-[#edebe9] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#c7e0f4] transition shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="sm:w-1/2">
        <div className="font-semibold text-[#242424] text-xs flex items-center gap-1.5">
          <span>{label}</span>
        </div>
        <p className="text-[11px] text-[#605e5c] mt-0.5 leading-snug">{description}</p>
      </div>

      <div className="sm:w-1/2 flex items-center gap-2">
        <select
          value={currentVal || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#ffffff] border border-[#d1d1d1] rounded px-3 py-1.5 text-xs text-[#242424] font-mono focus:outline-none focus:border-[#0f6cbd] cursor-pointer"
        >
          <option value="">-- Select Column --</option>
          {columns.map(c => (
            <option key={c.name} value={c.name} className="bg-[#ffffff] text-[#242424]">
              {c.name} ({c.dataType})
            </option>
          ))}
        </select>
        {currentVal ? (
          <span className="px-2 py-0.5 rounded bg-[#dff6dd] border border-[#92c353] text-[10px] text-[#107c41] font-mono shrink-0 font-medium flex items-center gap-1">
            <Check className="w-2.5 h-2.5" /> Mapped
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-[#f3f2f1] text-[10px] text-[#605e5c] font-mono shrink-0">
            Unmapped
          </span>
        )}
      </div>
    </div>
  );
}

