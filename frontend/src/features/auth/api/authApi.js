import { apiFetch } from '../../../services/api/apiClient';

/**
 * Fetches the currently authenticated user's profile and RBAC role.
 */
export async function getCurrentUser() {
  return apiFetch('/api/auth/me');
}

/**
 * Authenticates a user with email and password credentials.
 */
export async function loginUser(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  return apiFetch('/api/auth/jwt/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
}

/**
 * Logs out the currently authenticated user session.
 */
export async function logoutUser() {
  return apiFetch('/api/auth/jwt/logout', {
    method: 'POST',
  });
}
