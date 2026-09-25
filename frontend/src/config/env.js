export const env = {
  isAuthEnabled: import.meta.env.VITE_AUTH_ENABLED !== 'false',
  azureTenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID,
  azureClientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
};
