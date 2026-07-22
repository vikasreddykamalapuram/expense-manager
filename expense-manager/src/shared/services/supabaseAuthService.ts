/**
 * Supabase Auth Bridge — connects existing Google/Microsoft OAuth to Supabase Auth.
 *
 * How it works:
 *   1. User signs in with Google or Microsoft (existing flow, unchanged)
 *   2. We take the OAuth ID token and pass it to Supabase via signInWithIdToken()
 *   3. Supabase creates/links a user record and returns a Supabase session
 *   4. The Supabase session is used for all backend operations (DB, Storage, Realtime)
 *
 * This bridge is NON-BLOCKING: the app works fully without Supabase.
 * If Supabase is not configured or auth fails, we log and continue silently.
 */

import { getSupabase, isSupabaseConfigured } from '../config/supabase';
import type { Session, User } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────

export interface SupabaseAuthState {
  isConnected: boolean;
  user: User | null;
  session: Session | null;
  error: string | null;
  lastSyncAt: string | null;
}

type AuthStateListener = (state: SupabaseAuthState) => void;

// ─── Internal State ─────────────────────────────────────

let currentState: SupabaseAuthState = {
  isConnected: false,
  user: null,
  session: null,
  error: null,
  lastSyncAt: null,
};

const listeners = new Set<AuthStateListener>();
const LAST_BACKEND_SYNC_KEY = 'expenseiq_backend_last_sync';

// ─── State Management ───────────────────────────────────

function setState(updates: Partial<SupabaseAuthState>): void {
  currentState = { ...currentState, ...updates };
  listeners.forEach((cb) => cb(currentState));
}

export function getSupabaseAuthState(): SupabaseAuthState {
  return { ...currentState };
}

export function onSupabaseAuthChange(cb: AuthStateListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ─── Initialize ─────────────────────────────────────────

let initialized = false;

/**
 * Initialize Supabase auth — call once on app startup.
 * Restores existing session if available.
 */
export async function initSupabaseAuth(): Promise<void> {
  if (initialized || !isSupabaseConfigured()) return;
  initialized = true;

  const supabase = getSupabase();
  if (!supabase) return;

  try {
    // Restore existing session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.warn('[SupabaseAuth] Session restore failed:', error.message);
      setState({ error: error.message });
      return;
    }

    if (session) {
      setState({
        isConnected: true,
        user: session.user,
        session,
        error: null,
        lastSyncAt: localStorage.getItem(LAST_BACKEND_SYNC_KEY),
      });
    }

    // Listen for auth state changes (token refresh, sign out, etc.)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setState({
          isConnected: true,
          user: session.user,
          session,
          error: null,
        });
      } else {
        setState({
          isConnected: false,
          user: null,
          session: null,
        });
      }
    });
  } catch (err) {
    console.warn('[SupabaseAuth] Init failed:', err);
  }
}

// ─── Sign In with OAuth Token ───────────────────────────

/**
 * Bridge an existing Google OAuth ID token to Supabase Auth.
 * Call this after the user signs in with Google (existing flow).
 */
export async function bridgeGoogleAuth(idToken: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      console.error('[SupabaseAuth] Google bridge failed:', error.message);
      setState({ error: `Google auth bridge failed: ${error.message}` });
      return false;
    }

    if (data.session) {
      setState({
        isConnected: true,
        user: data.user,
        session: data.session,
        error: null,
      });
      return true;
    }

    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SupabaseAuth] Google bridge error:', message);
    setState({ error: message });
    return false;
  }
}

/**
 * Bridge an existing Microsoft OAuth access token to Supabase Auth.
 *
 * Microsoft uses MSAL which gives us an access token (not an ID token).
 * We use Supabase's signInWithIdToken with the Azure provider.
 * Note: Supabase must have Azure (Microsoft) configured as an auth provider.
 */
export async function bridgeMicrosoftAuth(idToken: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'azure',
      token: idToken,
    });

    if (error) {
      console.error('[SupabaseAuth] Microsoft bridge failed:', error.message);
      setState({ error: `Microsoft auth bridge failed: ${error.message}` });
      return false;
    }

    if (data.session) {
      setState({
        isConnected: true,
        user: data.user,
        session: data.session,
        error: null,
      });
      return true;
    }

    return false;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SupabaseAuth] Microsoft bridge error:', message);
    setState({ error: message });
    return false;
  }
}

// ─── Sign Out ───────────────────────────────────────────

/**
 * Sign out from Supabase (does NOT sign out from Google/Microsoft).
 */
export async function signOutSupabase(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.auth.signOut();
    setState({
      isConnected: false,
      user: null,
      session: null,
      error: null,
    });
  } catch (err) {
    console.warn('[SupabaseAuth] Sign out failed:', err);
  }
}

// ─── Utilities ──────────────────────────────────────────

/**
 * Get the current Supabase access token (for API calls).
 * Returns null if not authenticated.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Get the current Supabase user ID.
 */
export function getSupabaseUserId(): string | null {
  return currentState.user?.id ?? null;
}

/**
 * Update the last backend sync timestamp.
 */
export function updateLastBackendSync(): void {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_BACKEND_SYNC_KEY, now);
  setState({ lastSyncAt: now });
}

/**
 * Check if the user is connected to the backend.
 */
export function isBackendConnected(): boolean {
  return currentState.isConnected && currentState.session !== null;
}
