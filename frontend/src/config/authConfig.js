import { LogLevel } from '@azure/msal-browser';

const clientId = import.meta.env.VITE_AZURE_AD_CLIENT_ID;
const tenantId = import.meta.env.VITE_AZURE_AD_TENANT_ID;
const redirectUri = import.meta.env.VITE_AZURE_AD_REDIRECT_URI || window.location.origin;

// When "false", the SPA skips MSAL sign-in entirely (local UI work only).
export const authEnabled =
  String(import.meta.env.VITE_AUTH_ENABLED ?? 'true').toLowerCase() !== 'false';

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Error,
      piiLoggingEnabled: false,
      loggerCallback: () => {},
    },
  },
};

// Minimal scopes needed to obtain an ID token for the signed-in user.
export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};
