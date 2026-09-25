import { apiFetch } from '../../../services/api/apiClient';

/**
 * Lists Lakehouses and Warehouses in the workspace.
 */
export async function getDataArtifacts(workspaceId) {
  return apiFetch(`/api/workspaces/${workspaceId}/data-artifacts`);
}

/**
 * Gets the configured table log mapping for a workspace.
 */
export async function getTableLogMapping(workspaceId) {
  return apiFetch(`/api/workspaces/${workspaceId}/table-log-mapping`);
}

/**
 * Saves or updates table log mapping configuration for a workspace.
 */
export async function saveTableLogMapping(workspaceId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Deletes table log mapping configuration for a workspace.
 */
export async function deleteTableLogMapping(workspaceId) {
  return apiFetch(`/api/workspaces/${workspaceId}/table-log-mapping`, {
    method: 'DELETE',
  });
}

/**
 * Discovers SQL schemas and tables in a selected Lakehouse/Warehouse.
 */
export async function getSqlTables(workspaceId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/sql-metadata/tables`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Discovers columns for a given table in a Lakehouse/Warehouse.
 */
export async function getSqlColumns(workspaceId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/sql-metadata/columns`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Queries batch header, bronze, or silver table logs with pagination and filters.
 */
export async function getTableLogs(workspaceId, { layer = 'batch', batchId, pipelineName, status, limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams({
    layer,
    limit: String(limit),
    offset: String(offset),
  });
  if (batchId) params.set('batch_id', batchId);
  if (pipelineName) params.set('pipeline_name', pipelineName);
  if (status) params.set('status', status);

  return apiFetch(`/api/workspaces/${workspaceId}/table-logs?${params.toString()}`);
}

/**
 * Fetches AI diagnostics for a table error.
 */
export async function getTableLogAiFix(workspaceId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/diagnostics/ai-fix`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
