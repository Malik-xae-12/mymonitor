import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search, RefreshCw, Box } from 'lucide-react';

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
        title="Switch Microsoft Fabric Workspace"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] hover:border-[#a19f9d] text-[#242424] text-xs font-medium transition shadow-sm min-w-[190px] max-w-[240px] justify-between focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
      >
        <div className="flex items-center gap-2 truncate">
          <div className="w-4 h-4 rounded flex items-center justify-center bg-[#eff6fc] text-[#0f6cbd] shrink-0">
            <Box className="w-3 h-3" />
          </div>
          <span className="truncate text-xs font-normal text-[#242424]">
            {activeWorkspace ? activeWorkspace.displayName : "Select Workspace..."}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#605e5c] transition-transform duration-150 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 lg:left-0 mt-1 w-72 rounded bg-[#ffffff] border border-[#edebe9] shadow-xl z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Search box */}
          <div className="p-2 border-b border-[#edebe9] flex items-center gap-2 bg-[#faf9f8]">
            <Search className="w-3.5 h-3.5 text-[#797775] shrink-0 ml-1" />
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-[#242424] placeholder-[#797775] focus:outline-none"
              autoFocus
            />
            <button 
              onClick={fetchWorkspaces} 
              title="Refresh workspaces"
              className="p-1 text-[#605e5c] hover:text-[#242424] rounded hover:bg-[#f3f2f1] transition"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-[#0f6cbd]" : ""}`} />
            </button>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#797775]">
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
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded transition text-left ${
                      isSelected
                        ? "bg-[#eff6fc] text-[#0f6cbd] font-semibold border-l-2 border-[#0f6cbd]"
                        : "text-[#323130] hover:bg-[#f3f2f1] hover:text-[#242424]"
                    }`}
                  >
                    <span className="truncate">{ws.displayName}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0f6cbd] shrink-0 ml-2" />}
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
