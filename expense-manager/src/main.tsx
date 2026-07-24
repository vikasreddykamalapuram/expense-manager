import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication } from '@azure/msal-browser';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { SyncProviderWrapper } from './context/SyncProviderWrapper';
import { ToastProvider } from './shared/components/ui/Toast';
import { AUTH_CONFIG } from './shared/config/auth';
import { preloadSymbolMap } from './shared/services/symbolResolver';
import { initSupabaseAuth } from './shared/services/supabaseAuthService';
import { router } from './app/router';
import './index.css';

// Pre-load NSE symbol map for ISIN→ticker resolution (non-blocking)
preloadSymbolMap().catch(() => {});

// Initialize Supabase auth — restores session if previously connected (non-blocking)
initSupabaseAuth().catch(() => {});

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
            <SyncProviderWrapper>
              <ToastProvider>
                <RouterProvider router={router} />
              </ToastProvider>
            </SyncProviderWrapper>
          </AppProvider>
        </AuthProvider>
      </MsalProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
