import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoginPage from './LoginPage';

function FullScreen({ children }) {
  return (
    <div className="min-h-screen w-full bg-[#faf9f8] text-[#242424] flex items-center justify-center p-6 select-none">
      {children}
    </div>
  );
}

/**
 * Gates the entire app behind Entra ID sign-in + profile resolution.
 *   not signed in        -> LoginPage
 *   loading profile      -> spinner
 *   signed in, no role   -> "no access" notice (authenticated but unassigned)
 *   otherwise            -> app (children)
 */
export default function AuthGate({ children }) {
  const { isAuthenticated, loading, profile, error, role, isAdmin, logout } = useAuth();

  if (!isAuthenticated) return <LoginPage />;

  if (loading) {
    return (
      <FullScreen>
        <div className="flex flex-col items-center gap-3 text-[#605e5c]">
          <Loader2 className="w-6 h-6 animate-spin text-[#0f6cbd]" />
          <p className="text-sm">Loading your workspace access…</p>
        </div>
      </FullScreen>
    );
  }

  if (error) {
    return (
      <FullScreen>
        <div className="max-w-sm w-full bg-white border border-[#edebe9] rounded-lg shadow-xl p-6 text-center space-y-4">
          <div className="w-11 h-11 rounded-full bg-[#fde7e9] border border-[#f19999] text-[#a80000] mx-auto flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold">Couldn&apos;t verify your access</h2>
          <p className="text-xs text-[#a80000] bg-[#fdf2f2] border border-[#fecaca] rounded p-2.5 break-words text-left">
            {error.message || 'Authentication failed.'}
          </p>
          <button
            onClick={logout}
            className="w-full py-2 px-4 rounded bg-[#0f6cbd] hover:bg-[#115ea3] text-white text-xs font-medium transition"
          >
            Sign out and retry
          </button>
        </div>
      </FullScreen>
    );
  }

  if (!isAdmin && role === 'none') {
    return (
      <FullScreen>
        <div className="max-w-sm w-full bg-white border border-[#edebe9] rounded-lg shadow-xl p-6 text-center space-y-4">
          <div className="w-11 h-11 rounded-full bg-[#fff4ce] border border-[#f2c94c] text-[#8a6d00] mx-auto flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold">No workspaces assigned yet</h2>
          <p className="text-xs text-[#605e5c] leading-relaxed">
            You&apos;re signed in as <span className="font-medium">{profile?.email}</span>, but an
            administrator hasn&apos;t assigned you (as L1 or L2) to any workspace yet.
          </p>
          <button
            onClick={logout}
            className="w-full py-2 px-4 rounded border border-[#d1d1d1] hover:bg-[#f3f2f1] text-[#242424] text-xs font-medium transition"
          >
            Sign out
          </button>
        </div>
      </FullScreen>
    );
  }

  return children;
}
