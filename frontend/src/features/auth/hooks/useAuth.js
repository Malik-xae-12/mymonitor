import { useAuthContext } from '../context/AuthContext';

/** Convenience hook to access the current user's auth state and role. */
export function useAuth() {
  return useAuthContext();
}
