import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, User, Check, Briefcase } from 'lucide-react';

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

export default function FabricPeoplePicker({
  value = '',
  displayName = '',
  onChange,
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
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
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
    if (onChange) {
      onChange({
        email: user.email,
        displayName: user.displayName,
        initials: user.initials,
        jobTitle: user.jobTitle
      });
    }
    setQuery('');
    setIsOpen(false);
  };

  const handleClear = () => {
    if (onChange) {
      onChange({
        email: '',
        displayName: '',
        initials: '',
        jobTitle: ''
      });
    }
    setQuery('');
  };

  const initials = displayName 
    ? (displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase())
    : (value ? value.slice(0, 2).toUpperCase() : '??');

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
      {value ? (
        <div className="flex items-center justify-between p-1.5 px-2 rounded border border-[#d1d1d1] bg-[#ffffff] hover:border-[#8a8886] transition shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Fabric Persona Coin */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-[11px] shrink-0 shadow-xs ${getPersonaColor(displayName || value)}`}>
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#242424] truncate">
                  {displayName || value}
                </span>
              </div>
              <span className="text-[11px] text-[#605e5c] font-mono block truncate">
                {value}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            title="Change assigned person"
            className="p-1 rounded text-[#797775] hover:text-[#242424] hover:bg-[#f3f2f1] transition ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Search / Input Box Mode */
        <div className="relative">
          <div className="flex items-center border border-[#d1d1d1] rounded bg-white hover:border-[#8a8886] focus-within:border-[#0f6cbd] focus-within:ring-1 focus-within:ring-[#0f6cbd] transition px-2.5 py-1.5 shadow-2xs">
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
              placeholder={placeholder}
              className="w-full text-xs text-[#242424] placeholder-[#797775] focus:outline-none bg-transparent"
            />
          </div>

          {/* Directory Users Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#edebe9] rounded shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-[#f3f2f1]">
              {results.length > 0 ? (
                results.map((user) => (
                  <div
                    key={user.id || user.email}
                    onClick={() => handleSelectUser(user)}
                    className="flex items-center gap-2.5 p-2 px-3 hover:bg-[#eff6fc] cursor-pointer transition text-left"
                  >
                    {/* Persona Coin */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-semibold text-[11px] shrink-0 ${getPersonaColor(user.displayName || user.email)}`}>
                      {user.initials || 'US'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#242424] truncate">
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
                    <span>Searching organization directory...</span>
                  ) : query ? (
                    <div>
                      <p>No directory match found for &quot;{query}&quot;</p>
                      <button
                        type="button"
                        onClick={() => handleSelectUser({
                          email: query.trim().toLowerCase(),
                          displayName: query.trim(),
                          initials: query.slice(0, 2).toUpperCase()
                        })}
                        className="text-xs text-[#0f6cbd] font-semibold hover:underline mt-1 inline-block"
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

