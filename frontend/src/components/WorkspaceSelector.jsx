import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, Search, RefreshCw, Box, X } from 'lucide-react';

export default function WorkspaceSelector({ 
  currentWorkspaceId, 
  onSelectWorkspace, 
  workspaces: propWorkspaces,
  align = 'left',
  buttonClassName = '',
  placeholder = "Select Workspace..."
}) {
  const [workspaces, setWorkspaces] = useState(propWorkspaces || []);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(!propWorkspaces);
  const dropdownRef = useRef(null);

  const fetchWorkspaces = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/workspaces');
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data);
        if (!currentWorkspaceId && data.length > 0 && onSelectWorkspace) {
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
    if (propWorkspaces && propWorkspaces.length > 0) {
      setWorkspaces(propWorkspaces);
      setIsLoading(false);
    } else if (!propWorkspaces) {
      fetchWorkspaces();
    }
  }, [propWorkspaces]);

  // Close on click outside or escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const activeWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const activeName = activeWorkspace ? (activeWorkspace.displayName || activeWorkspace.name || activeWorkspace.id) : placeholder;

  const filtered = workspaces.filter(w => {
    const label = (w.displayName || w.name || w.id || '').toLowerCase();
    return label.includes(search.toLowerCase());
  });

  return (
    <div className="relative font-sans select-none" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch('');
        }}
        title="Switch Microsoft Fabric Workspace"
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#ffffff] hover:bg-[#f3f2f1] border border-[#d1d1d1] hover:border-[#a19f9d] text-[#242424] text-xs font-medium transition shadow-2xs min-w-[190px] max-w-[260px] justify-between focus:outline-none focus:ring-1 focus:ring-[#0f6cbd] ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          <div className="w-4 h-4 rounded flex items-center justify-center bg-[#eff6fc] text-[#0f6cbd] shrink-0">
            <Box className="w-3 h-3" />
          </div>
          <span className="truncate text-xs font-normal text-[#242424]">
            {activeName}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[#605e5c] transition-transform duration-150 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1 w-72 rounded-md bg-[#ffffff] border border-[#edebe9] shadow-xl z-50 overflow-hidden animate-in fade-in duration-100`}>
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
            {search ? (
              <button 
                type="button"
                onClick={() => setSearch('')}
                className="p-1 text-[#605e5c] hover:text-[#242424] rounded hover:bg-[#edebe9] transition"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <button 
                type="button"
                onClick={fetchWorkspaces} 
                title="Refresh workspaces"
                className="p-1 text-[#605e5c] hover:text-[#242424] rounded hover:bg-[#f3f2f1] transition"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin text-[#0f6cbd]" : ""}`} />
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-[#797775]">
                {search ? `No workspaces matching "${search}"` : "No workspaces found"}
              </div>
            ) : (
              filtered.map((ws) => {
                const isSelected = ws.id === currentWorkspaceId;
                const label = ws.displayName || ws.name || ws.id;
                return (
                  <button
                    type="button"
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
                    <span className="truncate">{label}</span>
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
