/**
 * React hook for Supabase auth state.
 * Provides reactive access to backend connection status.
 */

import { useState, useEffect } from 'react';
import {
  getSupabaseAuthState,
  onSupabaseAuthChange,
  initSupabaseAuth,
  bridgeGoogleAuth,
  bridgeMicrosoftAuth,
  signOutSupabase,
  isBackendConnected,
  type SupabaseAuthState,
} from '../services/supabaseAuthService';
import { isSupabaseConfigured } from '../config/supabase';

export function useSupabaseAuth() {
  const [state, setState] = useState<SupabaseAuthState>(getSupabaseAuthState);
  const [isConfigured] = useState(isSupabaseConfigured);

  useEffect(() => {
    // Initialize on first mount
    initSupabaseAuth();

    // Subscribe to changes
    const unsubscribe = onSupabaseAuthChange(setState);
    return unsubscribe;
  }, []);

  return {
    ...state,
    isConfigured,
    isBackendConnected: isBackendConnected(),
    bridgeGoogleAuth,
    bridgeMicrosoftAuth,
    signOutSupabase,
  };
}
