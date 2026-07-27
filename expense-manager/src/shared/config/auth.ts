/**
 * Authentication configuration for OAuth providers.
 * Replace placeholder values with your actual OAuth client IDs.
 *
 * Google: https://console.cloud.google.com/apis/credentials
 * Microsoft: https://portal.azure.com → Entra ID → App Registrations
 */

// All-zeroes GUID used as a MSAL-safe placeholder when VITE_MICROSOFT_CLIENT_ID
// is unset. MSAL's PublicClientApplication constructor throws synchronously on
// invalid clientId formats, which used to crash the whole app at boot
// (blank screen, Maestro sees no text). isMicrosoftConfigured() checks the raw
// env var so we still gate the UI on real credentials.
const MSAL_UNCONFIGURED_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

export const AUTH_CONFIG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
    scopes: 'openid profile email https://www.googleapis.com/auth/drive.appdata',
  },
  microsoft: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || MSAL_UNCONFIGURED_PLACEHOLDER,
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    scopes: ['User.Read', 'Files.ReadWrite.AppFolder', 'offline_access'],
  },
} as const;

// Check if real credentials are configured. Reads the raw env var so the
// MSAL placeholder GUID above never counts as "configured".
export function isGoogleConfigured(): boolean {
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof raw === 'string' && raw.length > 10 && raw !== 'YOUR_GOOGLE_CLIENT_ID';
}

export function isMicrosoftConfigured(): boolean {
  const raw = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
  return typeof raw === 'string' && raw.length > 10 && raw !== 'YOUR_MICROSOFT_CLIENT_ID';
}

export function isAnyAuthConfigured(): boolean {
  return isGoogleConfigured() || isMicrosoftConfigured();
}
