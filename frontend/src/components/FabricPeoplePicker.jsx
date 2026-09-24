import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api/apiClient';

// Fabric Persona avatar background colors
const PERSONA_COLORS = [
  'bg-[#0f6cbd] text-white',
  'bg-[#107c41] text-white',
  'bg-[#8764b8] text-white',
  'bg-[#008272] text-white',
  'bg-[#c19c00] text-white',
  'bg-[#d83b01] text-white',
  'bg-[#e3008c] text-white',
  'bg-[#4f6bed] text-white',
];

function getPersonaColor(text = '') {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PERSONA_COLORS[Math.abs(hash) % PERSONA_COLORS.length];
}

function getPersonaInitials(name = '', email = '') {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length === 1 && parts[0].length === 1) return parts[0].toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}

export default function FabricPeoplePicker({
  selectedUser = null,
  onSelectUser = null,
  value = '',
  displayName = '',
  onChange = null,
  placeholder = 'Search directory by name or email...',
  label = '',
  required = false,
  roleBadge = ''
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Active user resolution supporting both prop patterns
  const activeUser = selectedUser || (typeof value === 'object' && value ? value : (value ? { email: value, displayName: displayName || value } : null));
  const activeEmail = activeUser?.email || (typeof value === 'string' ? value : '');
  const activeDisplayName = activeUser?.displayName || activeUser?.name || displayName || activeEmail;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search querying Microsoft Graph directory
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();

    const fetchTimer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const url = `/api/directory/users?query=${encodeURIComponent(trimmed)}`;
        try {
          const data = await apiFetch(url);
          if (Array.isArray(data)) {
            setResults(data);
            return;
          }
        } catch {
          // Fallback if unauthenticated apiFetch fails
        }

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Directory search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(fetchTimer);
  }, [query, isOpen]);

  const handleSelectUser = (user) => {
    if (!user) return;
    const normalized = {
      id: user.id || user.oid || '',
      oid: user.id || user.oid || '',
      email: (user.email || user.userPrincipalName || '').toLowerCase(),
      displayName: user.displayName || user.name || user.email,
      name: user.displayName || user.name || user.email,
      initials: user.initials || getPersonaInitials(user.displayName, user.email),
      jobTitle: user.jobTitle || '',
      department: user.department || '',
      userPrincipalName: user.userPrincipalName || user.email,
    };
    if (onSelectUser) onSelectUser(normalized);
    if (onChange) onChange(normalized);
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    if (onSelectUser) onSelectUser(null);
    if (onChange) onChange(null);
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0) {
        handleSelectUser(results[0]);
      } else if (query.trim()) {
        handleSelectUser({
          id: '',
          email: query.trim().toLowerCase(),
          displayName: query.trim(),
          initials: getPersonaInitials(query.trim(), query.trim()),
        });
      }
    }
  };

  const initials = activeDisplayName 
    ? getPersonaInitials(activeDisplayName, activeEmail)
    : (activeEmail ? activeEmail.slice(0, 2).toUpperCase() : '??');

  return (
    <div className="space-y-1.5 text-left font-sans select-none" ref={containerRef}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-[#242424] flex items-center gap-1.5">
            <span>{label}</span>
            {required && <span className="text-[#a80000]">*</span>}
          </label>
          {roleBadge && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#eff6fc] text-[#0f6cbd] border border-[#0f6cbd]/20">
              {roleBadge}
            </span>
          )}
        </div>
      )}

      {/* Selected Person Chip Mode */}
      {activeEmail ? (
        <div className="flex items-center justify-between h-8 px-2.5 rounded border border-[#0f6cbd]/40 bg-[#eff6fc]/40 hover:border-[#0f6cbd] transition shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Fabric Persona Coin */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold text-[10px] shrink-0 shadow-xs ${getPersonaColor(activeDisplayName || activeEmail)}`}>
              {initials}
            </div>

            <div className="min-w-0 flex items-center gap-2">
              <span className="text-xs font-semibold text-[#242424] truncate">
                {activeDisplayName}
              </span>
              <span className="text-[11px] text-[#605e5c] font-mono truncate">
                ({activeEmail})
              </span>
              {activeUser?.jobTitle && (
                <span className="text-[10px] text-[#797775] truncate hidden sm:inline">
                  • {activeUser.jobTitle}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            title="Remove or change selected person"
            className="p-1 rounded text-[#797775] hover:text-[#242424] hover:bg-[#d0e7f8] transition ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Search / Input Box Mode */
        <div className="relative">
          <div className="flex items-center h-8 border border-[#d1d1d1] rounded bg-white hover:border-[#8a8886] focus-within:border-[#0f6cbd] focus-within:ring-1 focus-within:ring-[#0f6cbd] transition px-2.5 shadow-2xs">
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0f6cbd] shrink-0 mr-2" />
            ) : (
              <Search className="w-3.5 h-3.5 text-[#797775] shrink-0 mr-2" />
            )}

            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onClick={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full text-xs text-[#242424] placeholder-[#797775] focus:outline-none bg-transparent"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-0.5 text-[#797775] hover:text-[#242424] ml-1 shrink-0"
                title="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Directory Users Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#edebe9] rounded shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f3f2f1]">
              {results.length > 0 ? (
                results.map((user) => (
                  <div
                    key={user.id || user.email}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectUser(user);
                    }}
                    className="flex items-center gap-2.5 p-2 px-3 hover:bg-[#eff6fc] cursor-pointer transition text-left group"
                  >
                    {/* Persona Coin */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-[11px] shrink-0 ${getPersonaColor(user.displayName || user.email)}`}>
                      {user.initials || getPersonaInitials(user.displayName, user.email)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#242424] group-hover:text-[#0f6cbd] truncate">
                          {user.displayName}
                        </span>
                        {user.jobTitle && (
                          <span className="text-[10px] text-[#797775] truncate ml-2">
                            {user.jobTitle}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#605e5c] font-mono truncate block">
                        {user.email}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-xs text-[#605e5c] space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-1.5 py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0f6cbd]" />
                      <span>Searching organization directory...</span>
                    </div>
                  ) : query.trim() ? (
                    <div>
                      <p>No directory match found for &quot;{query.trim()}&quot;</p>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectUser({
                            id: '',
                            email: query.trim().toLowerCase(),
                            displayName: query.trim(),
                            initials: getPersonaInitials(query.trim(), query.trim()),
                          });
                        }}
                        className="text-xs text-[#0f6cbd] font-semibold hover:underline mt-1 inline-block cursor-pointer"
                      >
                        Use &quot;{query.trim()}&quot; as custom email
                      </button>
                    </div>
                  ) : (
                    <span>Type a name or email to search directory users</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

