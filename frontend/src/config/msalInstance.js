import { PublicClientApplication, EventType } from '@azure/msal-browser';
import { msalConfig } from './authConfig';

// Single shared MSAL instance used by both <MsalProvider> and the API client.
// NOTE: no account APIs (getAllAccounts/getActiveAccount) may be called before
// `initialize()` runs — that setup happens in main.jsx after initialize().
export const msalInstance = new PublicClientApplication(msalConfig);

// Registering an event callback is safe before initialization.
msalInstance.addEventCallback((event) => {
  if (
    (event.eventType === EventType.LOGIN_SUCCESS ||
      event.eventType === EventType.ACQUIRE_TOKEN_SUCCESS) &&
    event.payload?.account
  ) {
    msalInstance.setActiveAccount(event.payload.account);
  }
});
