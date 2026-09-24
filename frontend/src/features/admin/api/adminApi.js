import { apiFetch } from '../../../services/api/apiClient';

/** Lists all Fabric workspaces discovered by the backend. */
export function listWorkspaces() {
  return apiFetch('/api/workspaces');
}

/** Lists every workspace assignment (admin only). */
export function listAssignments() {
  return apiFetch('/api/admin/assignments');
}

/** Creates or updates a workspace assignment (admin only). */
export function saveAssignment(payload) {
  return apiFetch('/api/admin/assignments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Removes a workspace assignment (admin only). */
export function deleteAssignment(workspaceId) {
  return apiFetch(`/api/admin/assignments/${workspaceId}`, { method: 'DELETE' });
}

/** Lists all users + the role catalog (admin only). */
export function listUsers() {
  return apiFetch('/api/admin/users');
}

/** Sets a user's role (admin only). Returns the refreshed users + roles. */
export function setUserRole(email, roleId) {
  return apiFetch('/api/admin/users/role', {
    method: 'POST',
    body: JSON.stringify({ email, role_id: roleId }),
  });
}

/** Adds or updates a directory user with role L1 or L2 (admin only). */
export function addUser(payload) {
  return apiFetch('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Deletes a non-admin user (admin only). */
export function deleteUser(email) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
}

/** Lists a workspace's parent (master) pipelines with their SLA1/SLA2 config. */
export function listParentPipelines(workspaceId, forceSync = false) {
  return apiFetch(`/api/workspaces/${workspaceId}/parent-pipelines?force_sync=${forceSync}`);
}

/** Saves SLA1/SLA2 (+ L1/L2 emails) for a single parent pipeline. */
export function savePipelineSla(workspaceId, pipelineId, body) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
