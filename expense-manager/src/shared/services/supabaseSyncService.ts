/**
 * Supabase Sync Service — bidirectional delta sync between IndexedDB and Supabase PostgreSQL.
 *
 * Architecture:
 *   - IndexedDB (Dexie) remains the primary local store
 *   - Supabase PostgreSQL is the cloud sync target
 *   - Delta sync using `updatedAt` timestamps (already indexed in Dexie v6)
 *   - Last-Write-Wins (LWW) conflict resolution
 *   - Non-blocking: app works fully offline, syncs when online + authenticated
 *
 * Sync flow:
 *   PUSH: collect local changes since lastPush → upsert to Supabase
 *   PULL: query Supabase for changes since lastPull → merge into IndexedDB (LWW)
 */

import { getSupabase } from '../config/supabase';
import { db } from './db';
import { getSupabaseUserId, isBackendConnected, updateLastBackendSync } from './supabaseAuthService';

// ─── Constants ──────────────────────────────────────────

const LAST_PUSH_KEY = 'expenseiq_backend_last_push';
const LAST_PULL_KEY = 'expenseiq_backend_last_pull';
const SYNC_DEBOUNCE_MS = 5000;

// ─── Types ──────────────────────────────────────────────

interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

type SyncStateListener = (syncing: boolean) => void;

// ─── State ──────────────────────────────────────────────

let isSyncing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const stateListeners = new Set<SyncStateListener>();

function setSyncing(syncing: boolean): void {
  isSyncing = syncing;
  stateListeners.forEach((cb) => cb(syncing));
}

export function onBackendSyncStateChange(cb: SyncStateListener): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export function isBackendSyncing(): boolean {
  return isSyncing;
}

// ─── Table Mapping ──────────────────────────────────────
// Maps Dexie table names to Supabase table names and field transformations

interface TableMapping {
  local: string;       // Dexie table name
  remote: string;      // Supabase table name
  toRemote: (record: Record<string, unknown>, userId: string) => Record<string, unknown>;
  toLocal: (record: Record<string, unknown>) => Record<string, unknown>;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function transformKeysToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'profileId') {
      result['profile_id'] = value;
    } else {
      result[camelToSnake(key)] = value;
    }
  }
  return result;
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

function defaultToRemote(record: Record<string, unknown>, userId: string): Record<string, unknown> {
  const transformed = transformKeysToSnake(record);
  transformed['user_id'] = userId;
  return transformed;
}

function defaultToLocal(record: Record<string, unknown>): Record<string, unknown> {
  return transformKeysToCamel(record);
}

// Stock transactions need special handling for charges (JSONB)
function stockToRemote(record: Record<string, unknown>, userId: string): Record<string, unknown> {
  const transformed = defaultToRemote(record, userId);
  // charges is already an object, Supabase handles JSONB natively
  return transformed;
}

function stockToLocal(record: Record<string, unknown>): Record<string, unknown> {
  const transformed = defaultToLocal(record);
  // charges comes back as object from JSONB
  return transformed;
}

const TABLE_MAPPINGS: TableMapping[] = [
  { local: 'transactions', remote: 'transactions', toRemote: defaultToRemote, toLocal: defaultToLocal },
  { local: 'categories', remote: 'categories', toRemote: defaultToRemote, toLocal: defaultToLocal },
  { local: 'accounts', remote: 'accounts', toRemote: defaultToRemote, toLocal: defaultToLocal },
  { local: 'budgets', remote: 'budgets', toRemote: defaultToRemote, toLocal: defaultToLocal },
  { local: 'recurringRules', remote: 'recurring_rules', toRemote: defaultToRemote, toLocal: defaultToLocal },
  { local: 'stockTransactions', remote: 'stock_transactions', toRemote: stockToRemote, toLocal: stockToLocal },
  { local: 'billReminders', remote: 'bill_reminders', toRemote: defaultToRemote, toLocal: defaultToLocal },
];

// ─── Push (Local → Supabase) ────────────────────────────

async function pushChanges(profileId: string): Promise<number> {
  const supabase = getSupabase();
  const userId = getSupabaseUserId();
  if (!supabase || !userId) return 0;

  const lastPush = localStorage.getItem(LAST_PUSH_KEY) || '1970-01-01T00:00:00.000Z';
  let totalPushed = 0;

  for (const mapping of TABLE_MAPPINGS) {
    const records = await getChangedLocalRecords(mapping.local, profileId, lastPush);
    if (records.length === 0) continue;

    // Transform and upsert in batches of 100
    const remoteRecords = records.map((r) => mapping.toRemote(r as Record<string, unknown>, userId));

    for (let i = 0; i < remoteRecords.length; i += 100) {
      const batch = remoteRecords.slice(i, i + 100);
      const { error } = await supabase
        .from(mapping.remote)
        .upsert(batch, { onConflict: 'id' });

      if (error) {
        console.error(`[BackendSync] Push error for ${mapping.remote}:`, error.message);
        throw new Error(`Push failed for ${mapping.remote}: ${error.message}`);
      }

      totalPushed += batch.length;
    }
  }

  // Push settings and custom institutions
  await pushSettings(profileId, userId, lastPush);

  return totalPushed;
}

async function pushSettings(profileId: string, userId: string, since: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const settings = await db.settings.get(profileId);
  if (settings?.updatedAt && settings.updatedAt > since) {
    await supabase.from('user_settings').upsert({
      user_id: userId,
      profile_id: profileId,
      data: settings.data,
      updated_at: settings.updatedAt,
    }, { onConflict: 'user_id,profile_id' });
  }

  const customInst = await db.customInstitutions.get(profileId);
  if (customInst?.updatedAt && customInst.updatedAt > since) {
    await supabase.from('custom_institutions').upsert({
      user_id: userId,
      profile_id: profileId,
      data: customInst.data,
      updated_at: customInst.updatedAt,
    }, { onConflict: 'user_id,profile_id' });
  }
}

async function getChangedLocalRecords(
  tableName: string,
  profileId: string,
  since: string
): Promise<Record<string, unknown>[]> {
  const table = (db as unknown as Record<string, {
    where: (idx: string) => {
      between: (lower: [string, string], upper: [string, string]) => { toArray: () => Promise<Record<string, unknown>[]> };
      equals: (val: string) => { toArray: () => Promise<Record<string, unknown>[]> };
    };
  }>)[tableName];
  if (!table) return [];

  try {
    return await table
      .where('[profileId+updatedAt]')
      .between([profileId, since], [profileId, '\uffff'])
      .toArray();
  } catch {
    // Fallback for tables without compound index
    const all = await table.where('profileId').equals(profileId).toArray();
    return all.filter((r) => {
      const updatedAt = r.updatedAt as string | undefined;
      return updatedAt && updatedAt > since;
    });
  }
}

// ─── Pull (Supabase → Local) ────────────────────────────

async function pullChanges(profileId: string): Promise<number> {
  const supabase = getSupabase();
  const userId = getSupabaseUserId();
  if (!supabase || !userId) return 0;

  const lastPull = localStorage.getItem(LAST_PULL_KEY) || '1970-01-01T00:00:00.000Z';
  let totalPulled = 0;

  for (const mapping of TABLE_MAPPINGS) {
    const { data, error } = await supabase
      .from(mapping.remote)
      .select('*')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .gt('updated_at', lastPull)
      .order('updated_at', { ascending: true })
      .limit(1000);

    if (error) {
      console.error(`[BackendSync] Pull error for ${mapping.remote}:`, error.message);
      continue; // skip table, don't fail entire sync
    }

    if (!data || data.length === 0) continue;

    // Transform to local format and merge with LWW
    const localRecords = data.map((r) => mapping.toLocal(r as Record<string, unknown>));
    await mergeRecords(mapping.local, profileId, localRecords);
    totalPulled += localRecords.length;
  }

  // Pull settings
  totalPulled += await pullSettings(profileId, userId, lastPull);

  return totalPulled;
}

async function pullSettings(profileId: string, userId: string, since: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  let pulled = 0;

  // User settings
  const { data: settingsData } = await supabase
    .from('user_settings')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .gt('updated_at', since)
    .single();

  if (settingsData) {
    const local = await db.settings.get(profileId);
    const remoteTime = settingsData.updated_at as string;
    const localTime = local?.updatedAt || '1970-01-01';

    if (remoteTime > localTime) {
      await db.settings.put({
        profileId,
        data: settingsData.data,
        updatedAt: remoteTime,
      });
      pulled++;
    }
  }

  // Custom institutions
  const { data: instData } = await supabase
    .from('custom_institutions')
    .select('data, updated_at')
    .eq('user_id', userId)
    .eq('profile_id', profileId)
    .gt('updated_at', since)
    .single();

  if (instData) {
    const local = await db.customInstitutions.get(profileId);
    const remoteTime = instData.updated_at as string;
    const localTime = local?.updatedAt || '1970-01-01';

    if (remoteTime > localTime) {
      await db.customInstitutions.put({
        profileId,
        data: instData.data,
        updatedAt: remoteTime,
      });
      pulled++;
    }
  }

  return pulled;
}

async function mergeRecords(
  tableName: string,
  _profileId: string,
  remoteRecords: Record<string, unknown>[]
): Promise<void> {
  const table = (db as unknown as Record<string, {
    get: (id: string) => Promise<Record<string, unknown> | undefined>;
    put: (record: Record<string, unknown>) => Promise<unknown>;
    bulkPut: (records: Record<string, unknown>[]) => Promise<unknown>;
  }>)[tableName];
  if (!table) return;

  // LWW merge: for each remote record, compare updatedAt with local
  const toWrite: Record<string, unknown>[] = [];

  for (const remote of remoteRecords) {
    const id = remote.id as string;
    const local = await table.get(id);

    if (!local) {
      // New record from remote — add it
      toWrite.push(remote);
    } else {
      // Both exist — Last Write Wins
      const localTime = (local.updatedAt as string) || '1970-01-01';
      const remoteTime = (remote.updatedAt as string) || '1970-01-01';

      if (remoteTime > localTime) {
        toWrite.push(remote);
      }
      // else: local is newer, skip remote
    }
  }

  if (toWrite.length > 0) {
    await table.bulkPut(toWrite);
  }
}

// ─── Full Sync (Pull + Push) ────────────────────────────

/**
 * Perform a full bidirectional sync: pull first, then push.
 * Pull-first ensures we don't overwrite newer remote data.
 */
export async function backendSync(profileId: string): Promise<SyncResult> {
  if (!isBackendConnected()) {
    return { success: false, pushed: 0, pulled: 0, error: 'Not connected to backend' };
  }

  if (isSyncing) {
    return { success: false, pushed: 0, pulled: 0, error: 'Sync already in progress' };
  }

  setSyncing(true);

  try {
    // Pull first (get remote changes before pushing)
    const pulled = await pullChanges(profileId);

    // Then push local changes
    const pushed = await pushChanges(profileId);

    // Update timestamps
    const now = new Date().toISOString();
    localStorage.setItem(LAST_PUSH_KEY, now);
    localStorage.setItem(LAST_PULL_KEY, now);
    updateLastBackendSync();

    // Update sync metadata on server
    await updateSyncMetadata();

    return { success: true, pushed, pulled };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown sync error';
    console.error('[BackendSync] Sync failed:', message);
    return { success: false, pushed: 0, pulled: 0, error: message };
  } finally {
    setSyncing(false);
  }
}

/**
 * Push-only sync (for immediate saves without full pull).
 */
export async function backendPush(profileId: string): Promise<SyncResult> {
  if (!isBackendConnected() || isSyncing) {
    return { success: false, pushed: 0, pulled: 0 };
  }

  setSyncing(true);
  try {
    const pushed = await pushChanges(profileId);
    const now = new Date().toISOString();
    localStorage.setItem(LAST_PUSH_KEY, now);
    updateLastBackendSync();
    return { success: true, pushed, pulled: 0 };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, pushed: 0, pulled: 0, error: message };
  } finally {
    setSyncing(false);
  }
}

// ─── Initial Sync (first device setup) ──────────────────

/**
 * Push all local data to Supabase (first-time setup or re-sync).
 */
export async function backendFullPush(profileId: string): Promise<SyncResult> {
  // Reset last push to epoch so ALL records are pushed
  localStorage.setItem(LAST_PUSH_KEY, '1970-01-01T00:00:00.000Z');
  return backendSync(profileId);
}

// ─── Debounced Auto-Sync ────────────────────────────────

/**
 * Schedule a sync after a short delay (debounced).
 * Call this after data changes to auto-push.
 */
export function scheduleBackendSync(profileId: string): void {
  if (!isBackendConnected()) return;

  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    backendPush(profileId).catch(console.error);
  }, SYNC_DEBOUNCE_MS);
}

// ─── Sync Metadata ──────────────────────────────────────

async function updateSyncMetadata(): Promise<void> {
  const supabase = getSupabase();
  const userId = getSupabaseUserId();
  if (!supabase || !userId) return;

  // Generate a stable device ID
  let deviceId = localStorage.getItem('em_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('em_device_id', deviceId);
  }

  let deviceName = localStorage.getItem('em_device_name');
  if (!deviceName) {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) deviceName = 'Android';
    else if (/iPhone|iPad/i.test(ua)) deviceName = 'iOS';
    else if (/Mac/i.test(ua)) deviceName = 'Mac';
    else deviceName = 'Windows';
    deviceName += ` ${new Date().toLocaleDateString()}`;
    localStorage.setItem('em_device_name', deviceName);
  }

  await supabase.from('sync_metadata').upsert({
    user_id: userId,
    device_id: deviceId,
    device_name: deviceName,
    last_sync_at: new Date().toISOString(),
    last_push_at: new Date().toISOString(),
  }, { onConflict: 'user_id,device_id' });
}

// ─── Cleanup ────────────────────────────────────────────

/**
 * Clear all backend sync state (for disconnect).
 */
export function clearBackendSyncState(): void {
  localStorage.removeItem(LAST_PUSH_KEY);
  localStorage.removeItem(LAST_PULL_KEY);
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
