import React, { useEffect, useMemo, useState } from 'react';
import {
  Users, Search, Loader2, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2,
  UserPlus, Trash2, Check
} from 'lucide-react';
import { listUsers, setUserRole, addUser, deleteUser } from './api/adminApi';
import FabricPeoplePicker from '../../components/FabricPeoplePicker';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function getPersonaInitials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'US';
}

const SUPPORT_ROLE_OPTIONS = [
  { id: 'l1', label: 'L1 Support Lead', color: 'bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/30' },
  { id: 'l2', label: 'L2 Escalation Owner', color: 'bg-[#fdf3e7] text-[#c45500] border-[#c45500]/30' },
];

/**
 * Fabric Users & Support Personnel administration page.
 * Allows searching Azure AD directory with service principal, defining them strictly
 * as L1 or L2 support personnel, and maintaining team rosters.
 */
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // Add person form state
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [newPersonRole, setNewPersonRole] = useState('l1');
  const [adding, setAdding] = useState(false);
  const [savingEmail, setSavingEmail] = useState(null);
  const [deletingEmail, setDeletingEmail] = useState(null);

  const load = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const data = await listUsers();
      setUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'Failed to load users.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAddUser = async () => {
    if (!selectedPerson || !selectedPerson.email) {
      setStatus({ type: 'err', msg: 'Please select a person from the directory first.' });
      return;
    }
    setAdding(true);
    setStatus(null);
    try {
      const data = await addUser({
        email: selectedPerson.email,
        display_name: selectedPerson.displayName || selectedPerson.name || '',
        oid: selectedPerson.id || selectedPerson.oid || '',
        role_id: newPersonRole,
      });
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setStatus({
        type: 'ok',
        msg: `Added ${selectedPerson.displayName || selectedPerson.email} as ${
          newPersonRole === 'l1' ? 'L1 Support Lead' : 'L2 Escalation Owner'
        }.`,
      });
      setSelectedPerson(null);
      setNewPersonRole('l1');
    } catch (err) {
      let errMsg = err.message || 'Failed to add user.';
      try {
        const parsed = JSON.parse(errMsg);
        if (parsed.detail) errMsg = parsed.detail;
      } catch {
        /* use raw message */
      }
      setStatus({ type: 'err', msg: errMsg });
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (email, roleId) => {
    setSavingEmail(email);
    setStatus(null);
    try {
      const data = await setUserRole(email, roleId);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setStatus({
        type: 'ok',
        msg: `Updated ${email} → ${roleId === 'l1' ? 'L1 Support Lead' : 'L2 Escalation Owner'}.`,
      });
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'Failed to update role.' });
    } finally {
      setSavingEmail(null);
    }
  };

  const handleDeleteUser = async (email) => {
    if (!window.confirm(`Remove ${email} from the support roster?`)) return;
    setDeletingEmail(email);
    setStatus(null);
    try {
      const data = await deleteUser(email);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setStatus({ type: 'ok', msg: `Removed ${email} from the team.` });
    } catch (err) {
      setStatus({ type: 'err', msg: err.message || 'Failed to delete user.' });
    } finally {
      setDeletingEmail(null);
    }
  };

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
          (u.display_name || '').toLowerCase().includes(search.toLowerCase()),
      ),
    [users, search],
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f8] text-[#242424]">
      {/* Fabric Header */}
      <div className="px-6 py-4 bg-white border-b border-[#edebe9] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#eff6fc] text-[#0f6cbd] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-[#242424]">
              Users &amp; Support Personnel
            </h1>
            <p className="text-xs text-[#605e5c]">
              Select people from Microsoft Entra ID (Azure AD) and designate them strictly as L1 Support Leads or L2 Escalation Owners.
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#d1d1d1] hover:bg-[#f3f2f1] text-xs font-medium text-[#242424] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#0f6cbd]' : 'text-[#605e5c]'}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-5">
        {/* Status notification */}
        {status && (
          <div
            className={`flex items-center gap-2 text-xs rounded p-3 border ${
              status.type === 'ok'
                ? 'bg-[#f1faf1] border-[#a7d8a7] text-[#107c10]'
                : 'bg-[#fdf2f2] border-[#fecaca] text-[#a80000]'
            }`}
          >
            {status.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words font-medium">{status.msg}</span>
          </div>
        )}

        {/* 1. Add Support Personnel Card (People Picker from Entra ID) */}
        <div className="bg-white border border-[#edebe9] rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#edebe9]">
            <UserPlus className="w-4 h-4 text-[#0f6cbd]" />
            <h2 className="text-xs font-semibold text-[#242424] uppercase tracking-wider">
              Add Support Person from Directory
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Person Search */}
            <div className="md:col-span-6 space-y-1">
              <label className="text-xs font-medium text-[#323130] flex items-center justify-between">
                <span>Select Person (Entra ID Directory)</span>
                <span className="text-[10px] text-[#797775]">Graph Service Principal</span>
              </label>
              <FabricPeoplePicker
                selectedUser={selectedPerson}
                onSelectUser={(u) => setSelectedPerson(u)}
                value={selectedPerson?.email || ''}
                displayName={selectedPerson?.displayName || ''}
                onChange={(u) => setSelectedPerson(u)}
                placeholder="Search by name or email in your organization…"
              />
            </div>

            {/* Role Definition: Strictly L1 or L2 */}
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-medium text-[#323130]">
                Assign Support Role
              </label>
              <select
                value={newPersonRole}
                onChange={(e) => setNewPersonRole(e.target.value)}
                className="w-full h-8 px-2.5 rounded border border-[#8a8886] hover:border-[#242424] text-xs bg-white text-[#242424] font-medium focus:outline-none focus:ring-1 focus:ring-[#0f6cbd]"
              >
                <option value="l1">L1 Support Lead</option>
                <option value="l2">L2 Escalation Owner</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="md:col-span-3">
              <button
                type="button"
                onClick={handleAddUser}
                disabled={adding || !selectedPerson}
                className="w-full h-8 flex items-center justify-center gap-1.5 px-3 rounded bg-[#0f6cbd] hover:bg-[#115ea3] disabled:bg-[#f3f2f1] disabled:text-[#a19f9d] text-white text-xs font-semibold transition shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0f6cbd]"
              >
                {adding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Add to Support Team</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Team Roster Table */}
        <div className="bg-white border border-[#edebe9] rounded-lg overflow-hidden shadow-xs space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-semibold text-[#242424] uppercase tracking-wider">
                Configured Support Team ({filtered.length})
              </h2>
              <p className="text-[11px] text-[#605e5c]">
                These designated L1 and L2 personnel are available to be assigned to pipelines across all workspaces.
              </p>
            </div>

            {/* Search Filter */}
            <div className="flex items-center gap-2 bg-[#faf9f8] border border-[#d1d1d1] rounded px-2.5 py-1.5 w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#797775] shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter team members…"
                className="w-full bg-transparent text-xs text-[#242424] placeholder-[#797775] focus:outline-none"
              />
            </div>
          </div>

          <div className="border border-[#edebe9] rounded overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#faf9f8] text-[#605e5c] text-[11px] font-semibold uppercase tracking-wider border-b border-[#edebe9]">
                  <th className="px-4 py-2.5 font-semibold">Support Person</th>
                  <th className="px-4 py-2.5 font-semibold">Assigned Role</th>
                  <th className="px-4 py-2.5 font-semibold">Change Role</th>
                  <th className="px-4 py-2.5 font-semibold">Last Active</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edebe9]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#605e5c]">
                      <Loader2 className="w-5 h-5 animate-spin text-[#0f6cbd] inline" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#797775]">
                      No personnel configured yet. Use the search box above to add L1 and L2 team members from Microsoft Entra ID.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const isAdmin = u.role_id === 'admin';
                    const initials = getPersonaInitials(u.display_name, u.email);

                    return (
                      <tr key={u.email} className="hover:bg-[#faf9f8] transition">
                        {/* Person details with Persona coin */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                              isAdmin ? 'bg-[#0f6cbd]' : u.role_id === 'l2' ? 'bg-[#c45500]' : 'bg-[#0078d4]'
                            }`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[#242424] truncate">
                                {u.display_name || u.email}
                              </div>
                              <div className="text-[11px] text-[#797775] truncate font-mono">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Current Role badge */}
                        <td className="px-4 py-2.5">
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/40">
                              <ShieldCheck className="w-3 h-3" />
                              Administrator (DB Managed)
                            </span>
                          ) : u.role_id === 'l1' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold bg-[#eff6fc] text-[#0f6cbd] border-[#0f6cbd]/30">
                              L1 Support Lead
                            </span>
                          ) : u.role_id === 'l2' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold bg-[#fdf3e7] text-[#c45500] border-[#c45500]/30">
                              L2 Escalation Owner
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-medium bg-[#f3f2f1] text-[#605e5c] border-[#d1d1d1]">
                              None
                            </span>
                          )}
                        </td>

                        {/* Set Role dropdown (only l1 or l2, disabled for admin) */}
                        <td className="px-4 py-2.5">
                          {isAdmin ? (
                            <span className="text-[11px] text-[#797775] italic">
                              Managed in database
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select
                                value={u.role_id || 'l1'}
                                disabled={savingEmail === u.email}
                                onChange={(e) => changeRole(u.email, e.target.value)}
                                className="px-2 py-1 rounded border border-[#8a8886] hover:border-[#242424] text-xs bg-white text-[#242424] focus:outline-none focus:ring-1 focus:ring-[#0f6cbd] disabled:opacity-50"
                              >
                                <option value="l1">L1 Support Lead</option>
                                <option value="l2">L2 Escalation Owner</option>
                              </select>
                              {savingEmail === u.email && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0f6cbd]" />
                              )}
                            </div>
                          )}
                        </td>

                        {/* Last sign in */}
                        <td className="px-4 py-2.5 text-[#605e5c] text-[11px]">
                          {formatWhen(u.last_login_at || u.created_at)}
                        </td>

                        {/* Action: Delete (disabled for admin) */}
                        <td className="px-4 py-2.5 text-right">
                          {!isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.email)}
                              disabled={deletingEmail === u.email}
                              title={`Remove ${u.email}`}
                              className="p-1 rounded text-[#797775] hover:text-[#a4262c] hover:bg-[#fdf2f2] transition"
                            >
                              {deletingEmail === u.email ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
