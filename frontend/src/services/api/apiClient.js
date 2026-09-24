import { msalInstance } from '../../config/msalInstance';
import { loginRequest, authEnabled } from '../../config/authConfig';

/**
 * Acquires a fresh Entra ID token for the active account.
 * Returns null when auth is disabled or no account is signed in.
 */
async function getAccessToken() {
  if (!authEnabled) return null;
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    // The backend validates the ID token (aud = SPA client id).
    return result.idToken;
  } catch (err) {
    // Silent acquisition failed (e.g. expired session) -> interactive fallback.
    await msalInstance.acquireTokenRedirect({ ...loginRequest, account });
    return null;
  }
}

/**
 * Authenticated fetch wrapper. Attaches the Bearer token, sets JSON headers,
 * and throws an Error (with .status) on non-2xx responses.
 */
export async function apiFetch(path, options = {}) {
  const token = await getAccessToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {
      /* ignore */
    }
    const error = new Error(detail || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }

  const contentType = res.headers.get('content-type') || '';
  return contentType.includes('application/json') ? res.json() : res.text();
}
