/**
 * Authentication configuration for OAuth providers.
 * Replace placeholder values with your actual OAuth client IDs.
 *
 * Google: https://console.cloud.google.com/apis/credentials
 * Microsoft: https://portal.azure.com → Entra ID → App Registrations
 */

export const AUTH_CONFIG = {
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID',
    scopes: 'openid profile email https://www.googleapis.com/auth/drive.appdata',
  },
  microsoft: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || 'YOUR_MICROSOFT_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin,
    scopes: ['User.Read', 'Files.ReadWrite.AppFolder', 'offline_access'],
  },
} as const;

// Check if real credentials are configured
export function isGoogleConfigured(): boolean {
  return AUTH_CONFIG.google.clientId !== 'YOUR_GOOGLE_CLIENT_ID' && AUTH_CONFIG.google.clientId.length > 10;
}

export function isMicrosoftConfigured(): boolean {
  return AUTH_CONFIG.microsoft.clientId !== 'YOUR_MICROSOFT_CLIENT_ID' && AUTH_CONFIG.microsoft.clientId.length > 10;
}

export function isAnyAuthConfigured(): boolean {
  return isGoogleConfigured() || isMicrosoftConfigured();
}
