import React, { useState, useEffect, useRef } from 'react';
import { FolderGit2, ChevronDown, Check, Search, RefreshCw } from 'lucide-react';

export default function WorkspaceSelector({ currentWorkspaceId, onSelectWorkspace }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef(null);

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
        if (!currentWorkspaceId && data.length > 0) {
          onSelectWorkspace(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const filtered = workspaces.filter(w => 
    w.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-100 text-sm font-medium shadow-sm transition hover:bg-slate-800/80 min-w-[240px] justify-between"
      >
        <div className="flex items-center gap-2.5 truncate">
          <FolderGit2 className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate">
            {activeWorkspace ? activeWorkspace.displayName : "Select Workspace..."}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Search box */}
          <div className="p-2 border-b border-slate-800 flex items-center gap-2 bg-slate-950/40">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              autoFocus
            />
            <button 
              onClick={fetchWorkspaces} 
              title="Refresh workspaces"
              className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-400" : ""}`} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500">
                No workspaces found
              </div>
            ) : (
              filtered.map((ws) => {
                const isSelected = ws.id === currentWorkspaceId;
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition text-left ${
                      isSelected
                        ? "bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30"
                        : "text-slate-300 hover:bg-slate-800/70"
                    }`}
                  >
                    <span className="truncate">{ws.displayName}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

