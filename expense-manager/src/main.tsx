import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { AUTH_CONFIG } from './shared/config/auth';
import { router } from './app/router';
import './index.css';

// MSAL instance (singleton)
const msalInstance = new PublicClientApplication({
  auth: {
    clientId: AUTH_CONFIG.microsoft.clientId,
    authority: AUTH_CONFIG.microsoft.authority,
    redirectUri: AUTH_CONFIG.microsoft.redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={AUTH_CONFIG.google.clientId}>
      <MsalProvider instance={msalInstance}>
        <AuthProvider>
          <AppProvider>
            <RouterProvider router={router} />
          </AppProvider>
        </AuthProvider>
      </MsalProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
