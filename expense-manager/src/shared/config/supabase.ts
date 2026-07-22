/**
 * Supabase client configuration.
 *
 * Reads project URL and anon key from environment variables.
 * The anon key is safe to expose in frontend code — Row Level Security (RLS)
 * on the Supabase side ensures users can only access their own data.
 *
 * Setup: https://supabase.com/dashboard → New Project → Settings → API
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client, or null if not configured.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        storageKey: 'expenseiq_supabase_auth',
        autoRefreshToken: true,
        detectSessionInUrl: false, // we handle OAuth ourselves
      },
    });
  }

  return supabaseInstance;
}

/**
 * Check if Supabase credentials are configured.
 */
export function isSupabaseConfigured(): boolean {
  return (
    SUPABASE_URL.length > 10 &&
    SUPABASE_ANON_KEY.length > 10 &&
    SUPABASE_URL.startsWith('https://')
  );
}
