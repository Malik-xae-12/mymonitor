export const API_ENDPOINTS = {
  WORKSPACES: '/api/workspaces',
  AUTH_ME: '/api/auth/me',
  USERS: '/api/admin/users',
  ASSIGNMENTS: '/api/admin/assignments',
  DIAGNOSTICS_AI_FIX: '/api/diagnostics/ai-fix',
  WS_WORKSPACES: (id) => `/ws/workspaces/${id}`,
};
