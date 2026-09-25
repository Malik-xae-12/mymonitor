import { apiFetch } from '../../../services/api/apiClient';

/**
 * Fetches the list of all available Fabric workspaces.
 */
export async function getWorkspaces() {
  return apiFetch('/api/workspaces');
}

/**
 * Fetches the workspace hierarchy snapshot with date filtering.
 */
export async function getWorkspaceSnapshot(workspaceId, { forceSync = false, datePreset = 'latest', startDate, endDate, signal } = {}) {
  const params = new URLSearchParams({
    force_sync: String(forceSync),
    date_preset: datePreset || 'latest',
  });
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);

  return apiFetch(`/api/workspaces/${workspaceId}/snapshot?${params.toString()}`, { signal });
}

/**
 * Fetches the latest parent-child pipeline tree for a workspace.
 */
export async function getWorkspaceTree(workspaceId, signal) {
  return apiFetch(`/api/workspaces/${workspaceId}/tree`, { signal });
}

/**
 * Fetches historical runs and activity telemetry for a specific pipeline.
 */
export async function getPipelineHistory(workspaceId, pipelineId) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/history`);
}

/**
 * Fetches schedule configurations and next execution time for a pipeline.
 */
export async function getPipelineSchedule(workspaceId, pipelineId) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/schedule`);
}

/**
 * Fetches all pipeline schedules in a workspace.
 */
export async function getWorkspaceSchedules(workspaceId) {
  return apiFetch(`/api/workspaces/${workspaceId}/schedules`);
}

/**
 * Fetches SLA configuration (L1/L2 emails & targets) for a pipeline.
 */
export async function getPipelineSla(workspaceId, pipelineId) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`);
}

/**
 * Saves SLA configuration for a pipeline.
 */
export async function savePipelineSla(workspaceId, pipelineId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/sla`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Sends a test SLA alert email to verify SMTP configuration.
 */
export async function testPipelineEmail(workspaceId, pipelineId, payload) {
  return apiFetch(`/api/workspaces/${workspaceId}/pipelines/${pipelineId}/test-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Resolves an active SLA incident.
 */
export async function resolveIncident(workspaceId, incidentId, payload = {}) {
  return apiFetch(`/api/workspaces/${workspaceId}/incidents/${incidentId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Requests AI diagnostic explanation and fix recommendations for a failed pipeline/activity.
 */
export async function getAiDiagnosticFix(payload) {
  return apiFetch('/api/diagnostics/ai-fix', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
