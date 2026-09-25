import React, { useState } from 'react';
import { Users, GitFork } from 'lucide-react';
import UsersPage from './UsersPage';
import PipelineTeamsPage from './PipelineTeamsPage';

const TABS = [
  { id: 'users', label: 'Users & Support Personnel', icon: Users },
  { id: 'pipeline-teams', label: 'Pipeline L1/L2 Teams & SLA', icon: GitFork },
];

/**
 * AdminConsole component.
 * Renders the top-level Administrator management console with pivot tabs
 * for directory user role configuration and per-pipeline L1/L2 team assignments.
 *
 * @param {Object} props
 * @param {Function} props.onOpenTableConfig - Callback when user navigates to table log configuration
 * @returns {JSX.Element}
 */
export default function AdminConsole({ onOpenTableConfig }) {
  const [tab, setTab] = useState('users');

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] overflow-hidden">
      {/* Pivot tabs */}
      <div className="bg-white border-b border-[#edebe9] px-6 flex items-center gap-2 select-none shadow-2xs">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              id={`admin-tab-${id}`}
              onClick={() => setTab(id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-xs font-semibold transition ${
                active ? 'text-[#0f6cbd]' : 'text-[#605e5c] hover:text-[#242424]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {active && (
                <span className="absolute left-2 right-2 bottom-0 h-[2.5px] bg-[#0f6cbd] rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {tab === 'users' ? (
          <UsersPage />
        ) : (
          <PipelineTeamsPage onOpenTableConfig={onOpenTableConfig} />
        )}
      </div>
    </div>
  );
}
