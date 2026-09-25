import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, authEnabled } from '../../../config/authConfig';
import { getCurrentUser } from '../api';

const AuthContext = createContext(null);

/**
 * Provides the signed-in user's profile + resolved role (admin / l1 / l2)
 * and the list of workspaces they are scoped to. Wraps MSAL sign-in state.
 */
export function AuthProvider({ children }) {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getCurrentUser();
      setProfile(me);
    } catch (err) {
      setError(err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Dev bypass: no MSAL, hit the backend directly.
    if (!authEnabled) {
      loadProfile();
      return;
    }
    if (inProgress !== InteractionStatus.None) return;
    if (isAuthenticated) {
      loadProfile();
    } else {
      setLoading(false);
      setProfile(null);
    }
  }, [authEnabled, isAuthenticated, inProgress, loadProfile]);

  const login = useCallback(() => {
    instance.loginRedirect(loginRequest).catch((e) => setError(e));
  }, [instance]);

  const logout = useCallback(() => {
    const account = instance.getActiveAccount() || accounts[0];
    instance.logoutRedirect({ account });
  }, [instance, accounts]);

  const value = {
    profile,
    role: profile?.role ?? 'none',
    isAdmin: !!profile?.is_admin,
    assignedWorkspaceIds: profile?.assigned_workspace_ids ?? [],
    isAuthenticated: authEnabled ? isAuthenticated : true,
    loading,
    error,
    login,
    logout,
    refresh: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within <AuthProvider>');
  return ctx;
}
