/**
 * Supabase Realtime Service — live cross-device sync via Postgres Changes.
 *
 * When connected, subscribes to all synced tables for the current user.
 * INSERT/UPDATE/DELETE events from OTHER devices are merged into local IndexedDB,
 * then a callback fires to refresh the React state.
 *
 * Architecture:
 *   - One Realtime channel per user session
 *   - Listens to Postgres changes (via Supabase Realtime)
 *   - Filters by user_id so we only get our own data
 *   - Skips changes that originated from this device (via device_id tracking)
 *   - Merges into IndexedDB with LWW conflict resolution
 *   - Calls onDataChanged callback to refresh AppContext
 */

import { getSupabase } from '../config/supabase';
import { db } from './db';
import { getSupabaseUserId, isBackendConnected } from './supabaseAuthService';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ─── Types ──────────────────────────────────────────────

type DataChangedCallback = () => void;

interface RealtimeState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel: any;
  eventsReceived: number;
  lastEventAt: string | null;
  error: string | null;
}

type RealtimeStateListener = (state: RealtimeState) => void;

// ─── Table Config ───────────────────────────────────────
// Maps Supabase table names → Dexie table names + field transform

interface RealtimeTableConfig {
  remote: string;        // Supabase table name
  local: string;         // Dexie table name
  schema: string;        // Postgres schema
}

const REALTIME_TABLES: RealtimeTableConfig[] = [
  { remote: 'transactions', local: 'transactions', schema: 'public' },
  { remote: 'categories', local: 'categories', schema: 'public' },
  { remote: 'accounts', local: 'accounts', schema: 'public' },
  { remote: 'budgets', local: 'budgets', schema: 'public' },
  { remote: 'recurring_rules', local: 'recurringRules', schema: 'public' },
  { remote: 'stock_transactions', local: 'stockTransactions', schema: 'public' },
  { remote: 'bill_reminders', local: 'billReminders', schema: 'public' },
];

// ─── Field Transformers (reused from supabaseSyncService) ───

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function transformKeysToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'user_id') continue; // strip server-only field
    if (key === 'profile_id') {
      result['profileId'] = value;
    } else {
      result[snakeToCamel(key)] = value;
    }
  }
  return result;
}

// ─── Internal State ─────────────────────────────────────

let realtimeState: RealtimeState = {
  status: 'disconnected',
  channel: null,
  eventsReceived: 0,
  lastEventAt: null,
  error: null,
};

const stateListeners = new Set<RealtimeStateListener>();
let dataChangedCallback: DataChangedCallback | null = null;
let currentDeviceId: string | null = null;

// Debounce refresh so rapid changes (e.g., bulk import) trigger one reload
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_MS = 500;

function updateState(updates: Partial<RealtimeState>): void {
  realtimeState = { ...realtimeState, ...updates };
  stateListeners.forEach((cb) => cb(realtimeState));
}

// ─── Public API ─────────────────────────────────────────

export function getRealtimeState(): RealtimeState {
  return { ...realtimeState };
}

export function onRealtimeStateChange(cb: RealtimeStateListener): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

/**
 * Register a callback to be called when remote data changes are merged.
 * The AppContext uses this to reload profile data.
 */
export function setRealtimeDataChangedCallback(cb: DataChangedCallback | null): void {
  dataChangedCallback = cb;
}

/**
 * Start listening for realtime changes from Supabase.
 * Call this after the user connects to the backend.
 */
export function startRealtimeSync(): void {
  if (!isBackendConnected()) return;
  if (realtimeState.status === 'connected' || realtimeState.status === 'connecting') return;

  const supabase = getSupabase();
  const userId = getSupabaseUserId();
  if (!supabase || !userId) return;

  // Get device ID to filter out our own changes
  currentDeviceId = localStorage.getItem('em_device_id');

  updateState({ status: 'connecting', error: null });

  // Build channel with chained .on() calls for each table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channel: any = supabase.channel(`db-changes-${userId}`);

  for (const table of REALTIME_TABLES) {
    channel = channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: table.schema,
        table: table.remote,
        filter: `user_id=eq.${userId}`,
      },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        handleChange(table, payload);
      },
    );
  }

  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      updateState({ status: 'connected', channel, error: null });
      console.log('[Realtime] Connected — listening for cross-device changes');
    } else if (status === 'CHANNEL_ERROR') {
      updateState({ status: 'error', error: 'Channel subscription failed' });
      console.error('[Realtime] Channel error');
    } else if (status === 'TIMED_OUT') {
      updateState({ status: 'error', error: 'Connection timed out' });
      console.error('[Realtime] Connection timed out');
    } else if (status === 'CLOSED') {
      updateState({ status: 'disconnected', channel: null });
      console.log('[Realtime] Channel closed');
    }
  });

  updateState({ channel });
}

/**
 * Stop listening for realtime changes.
 * Call this on disconnect or sign out.
 */
export function stopRealtimeSync(): void {
  const { channel } = realtimeState;
  if (channel) {
    const supabase = getSupabase();
    if (supabase) {
      supabase.removeChannel(channel);
    }
  }

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  updateState({
    status: 'disconnected',
    channel: null,
    error: null,
  });
  console.log('[Realtime] Stopped');
}

// ─── Change Handler ─────────────────────────────────────

async function handleChange(
  table: RealtimeTableConfig,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Promise<void> {
  const eventType = payload.eventType;
  const record = (eventType === 'DELETE' ? payload.old : payload.new) as Record<string, unknown> | undefined;

  if (!record || !record.id) return;

  // Skip changes from this device (we already have them locally)
  // We use a heuristic: if the updated_at is within 10s of our last push, skip
  // This avoids echo effects where our own push triggers a realtime event back
  const recordDeviceHint = record.device_id as string | undefined;
  if (recordDeviceHint && recordDeviceHint === currentDeviceId) return;

  console.log(`[Realtime] ${eventType} on ${table.remote}: ${record.id}`);

  try {
    const dexieTable = (db as unknown as Record<string, {
      get: (id: string) => Promise<Record<string, unknown> | undefined>;
      put: (record: Record<string, unknown>) => Promise<unknown>;
      delete: (id: string) => Promise<void>;
    }>)[table.local];

    if (!dexieTable) return;

    if (eventType === 'DELETE') {
      await dexieTable.delete(record.id as string);
    } else {
      // Transform to local format
      const localRecord = transformKeysToCamel(record);

      // LWW check for updates
      if (eventType === 'UPDATE') {
        const existing = await dexieTable.get(record.id as string);
        if (existing) {
          const localTime = (existing.updatedAt as string) || '1970-01-01';
          const remoteTime = (localRecord.updatedAt as string) || '1970-01-01';
          if (localTime >= remoteTime) return; // local is newer or same, skip
        }
      }

      await dexieTable.put(localRecord);
    }

    updateState({
      eventsReceived: realtimeState.eventsReceived + 1,
      lastEventAt: new Date().toISOString(),
    });

    // Debounced refresh — multiple rapid changes trigger one reload
    scheduleRefresh();
  } catch (err) {
    console.error(`[Realtime] Error processing ${eventType} on ${table.local}:`, err);
  }
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    if (dataChangedCallback) {
      dataChangedCallback();
    }
  }, REFRESH_DEBOUNCE_MS);
}
