export const env = {
  isAuthEnabled: import.meta.env.VITE_AUTH_ENABLED !== 'false',
  azureTenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID || '008502d6-3f79-46f0-ab37-9354e3fe80ff',
  azureClientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID || '25ad11d7-5885-4f0e-8424-919bf02e04eb',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
};
