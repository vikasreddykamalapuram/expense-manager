/**
 * Sync Service — core engine for cross-device data synchronization.
 *
 * Architecture:
 *   - Full snapshot on first sync (new device gets all data)
 *   - Delta sync on subsequent syncs (only changed records)
 *   - LWW (Last-Write-Wins) conflict resolution with tombstones
 *   - E2E encrypted with shared sync key (AES-256-GCM)
 *   - Transport: Google Drive appDataFolder / OneDrive App Folder
 *
 * Sync flow:
 *   PUSH: collect local changes since lastPush → encrypt → upload delta
 *   PULL: download remote deltas since lastPull → decrypt → merge (LWW)
 */

import { db } from './db';
import { syncKeyService } from './syncKeyService';
import { encryptForSync, decryptFromSync } from './syncEncryptionService';
import { repository } from './repository';
import type {
  AuthProvider, SyncDelta, SyncManifest, SyncStatus, SyncState,
  Transaction, Category, Account, Budget, RecurringRule, StockTransaction, BillReminder,
} from '../types';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'em_device_id';
const DEVICE_NAME_KEY = 'em_device_name';
const SYNC_ENABLED_KEY = 'em_sync_enabled';
const LAST_SYNC_KEY = 'em_last_sync_at';
const LAST_PUSH_KEY = 'em_last_push_at';
const MANIFEST_FILENAME = 'expenseiq-sync-manifest.json';
const SNAPSHOT_FILENAME = 'expenseiq-sync-snapshot.enc';
const DELTA_PREFIX = 'expenseiq-delta-';
const TOMBSTONE_TTL_DAYS = 30;
const TOMBSTONE_CLEANUP_KEY = 'em_last_tombstone_cleanup';
const TOMBSTONE_CLEANUP_INTERVAL_DAYS = 7;

// Mutex to prevent concurrent push/pull operations
let syncLock = false;

async function acquireSyncLock(): Promise<boolean> {
  if (syncLock) return false;
  syncLock = true;
  return true;
}

function releaseSyncLock(): void {
  syncLock = false;
}

function isValidSyncDelta(obj: unknown): obj is SyncDelta {
  if (!obj || typeof obj !== 'object') return false;
  const d = obj as Record<string, unknown>;
  return typeof d.deviceId === 'string' &&
    typeof d.timestamp === 'string' &&
    typeof d.profileId === 'string' &&
    d.tables !== null &&
    typeof d.tables === 'object';
}

// ─── Device Identity ────────────────────────────────────

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  let name = localStorage.getItem(DEVICE_NAME_KEY);
  if (!name) {
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) name = 'Android';
    else if (/iPhone|iPad/i.test(ua)) name = 'iOS';
    else if (/Mac/i.test(ua)) name = 'Mac';
    else if (/Linux/i.test(ua)) name = 'Linux';
    else name = 'Windows';
    name += ` ${new Date().toLocaleDateString()}`;
    localStorage.setItem(DEVICE_NAME_KEY, name);
  }
  return name;
}

// ─── Sync State Management ─────────────────────────────

let currentSyncState: SyncState = 'disabled';
let lastError: string | undefined;
const stateListeners = new Set<(status: SyncStatus) => void>();

function updateState(state: SyncState, error?: string): void {
  currentSyncState = state;
  lastError = error;
  notifyListeners();
}

function notifyListeners(): void {
  const status = getSyncStatus();
  stateListeners.forEach((cb) => cb(status));
}

export function getSyncStatus(): SyncStatus {
  return {
    state: currentSyncState,
    lastSyncAt: localStorage.getItem(LAST_SYNC_KEY) || undefined,
    lastError,
    pendingChanges: 0, // calculated on demand
    provider: getSyncProvider() || undefined,
  };
}

export function onSyncStatusChange(cb: (status: SyncStatus) => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

export function isSyncEnabled(): boolean {
  return localStorage.getItem(SYNC_ENABLED_KEY) === 'true';
}

function getSyncProvider(): AuthProvider | null {
  const provider = localStorage.getItem('em_sync_provider');
  return provider as AuthProvider | null;
}

// ─── Enable / Disable Sync ─────────────────────────────

export async function enableSync(provider: AuthProvider, profileId: string): Promise<boolean> {
  try {
    updateState('syncing');

    // Get or create sync key
    const syncKey = await syncKeyService.getOrCreateSyncKey(provider);
    if (!syncKey) {
      updateState('error', 'Failed to initialize sync key');
      return false;
    }

    // Check if there's existing data in cloud (from another device)
    const token = await syncKeyService.getAccessToken(provider, true);
    if (!token) {
      updateState('error', 'Authentication required');
      return false;
    }

    const manifestContent = await syncKeyService.downloadFile(provider, token, MANIFEST_FILENAME);

    if (manifestContent) {
      // Cloud has data — pull it first
      await pullFromCloud(provider, profileId, syncKey, token);
    } else {
      // First device — push full snapshot
      await pushFullSnapshot(provider, profileId, syncKey, token);
    }

    localStorage.setItem(SYNC_ENABLED_KEY, 'true');
    localStorage.setItem('em_sync_provider', provider);
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    localStorage.setItem(LAST_PUSH_KEY, new Date().toISOString());

    updateState('idle');
    return true;
  } catch (err) {
    updateState('error', (err as Error).message);
    return false;
  }
}

export async function disableSync(): Promise<void> {
  localStorage.removeItem(SYNC_ENABLED_KEY);
  localStorage.removeItem('em_sync_provider');
  localStorage.removeItem(LAST_SYNC_KEY);
  localStorage.removeItem(LAST_PUSH_KEY);
  syncKeyService.clearLocalCache();
  updateState('disabled');
}

// ─── Full Snapshot (first sync) ─────────────────────────

async function pushFullSnapshot(
  provider: AuthProvider,
  profileId: string,
  syncKey: CryptoKey,
  token: string
): Promise<void> {
  const data = await collectAllData(profileId);
  const delta: SyncDelta = {
    deviceId: getDeviceId(),
    timestamp: new Date().toISOString(),
    profileId,
    tables: data,
  };

  const json = JSON.stringify(delta);
  const encrypted = await encryptForSync(json, syncKey);

  await syncKeyService.uploadFile(provider, token, SNAPSHOT_FILENAME, encrypted);

  // Create manifest
  const manifest: SyncManifest = {
    devices: {
      [getDeviceId()]: {
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        lastSyncAt: new Date().toISOString(),
        lastPushAt: new Date().toISOString(),
      },
    },
    lastFullSnapshot: new Date().toISOString(),
    schemaVersion: 6,
  };

  await syncKeyService.uploadFile(provider, token, MANIFEST_FILENAME, JSON.stringify(manifest));
}

// ─── Delta Push ─────────────────────────────────────────

export async function pushDelta(profileId: string): Promise<boolean> {
  if (!isSyncEnabled()) return false;
  if (!await acquireSyncLock()) return false;

  const provider = getSyncProvider();
  if (!provider) { releaseSyncLock(); return false; }

  try {
    updateState('syncing');

    const syncKey = await syncKeyService.getOrCreateSyncKey(provider);
    if (!syncKey) {
      updateState('error', 'Sync key not available');
      return false;
    }

    const token = await syncKeyService.getAccessToken(provider, false);
    if (!token) {
      updateState('error', 'Authentication expired');
      return false;
    }

    const lastPush = localStorage.getItem(LAST_PUSH_KEY) || '1970-01-01T00:00:00.000Z';
    const delta = await generateDelta(profileId, lastPush);

    if (!delta) {
      updateState('idle');
      return true; // nothing to push
    }

    const json = JSON.stringify(delta);
    const encrypted = await encryptForSync(json, syncKey);
    const filename = `${DELTA_PREFIX}${getDeviceId()}-${Date.now()}.enc`;

    const uploaded = await syncKeyService.uploadFile(provider, token, filename, encrypted);
    if (!uploaded) {
      updateState('error', 'Failed to upload delta');
      return false;
    }

    // Update manifest
    await updateManifest(provider, token, 'push');

    const now = new Date().toISOString();
    localStorage.setItem(LAST_PUSH_KEY, now);
    localStorage.setItem(LAST_SYNC_KEY, now);
    updateState('idle');
    return true;
  } catch (err) {
    updateState('error', (err as Error).message);
    return false;
  } finally {
    releaseSyncLock();
  }
}

// ─── Delta Pull ─────────────────────────────────────────

export async function pullDeltas(profileId: string): Promise<boolean> {
  if (!isSyncEnabled()) return false;
  if (!await acquireSyncLock()) return false;

  const provider = getSyncProvider();
  if (!provider) { releaseSyncLock(); return false; }

  try {
    updateState('syncing');

    const syncKey = await syncKeyService.getOrCreateSyncKey(provider);
    if (!syncKey) {
      updateState('error', 'Sync key not available');
      return false;
    }

    const token = await syncKeyService.getAccessToken(provider, false);
    if (!token) {
      updateState('error', 'Authentication expired');
      return false;
    }

    await pullFromCloud(provider, profileId, syncKey, token);

    // Auto-cleanup tombstones periodically
    await maybeCleanupTombstones(profileId);

    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
    updateState('idle');
    return true;
  } catch (err) {
    updateState('error', (err as Error).message);
    return false;
  } finally {
    releaseSyncLock();
  }
}

async function pullFromCloud(
  provider: AuthProvider,
  profileId: string,
  syncKey: CryptoKey,
  token: string
): Promise<void> {
  const deviceId = getDeviceId();
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);

  // If no previous sync, try full snapshot first
  if (!lastSync) {
    const snapshotContent = await syncKeyService.downloadFile(provider, token, SNAPSHOT_FILENAME);
    if (snapshotContent) {
      const decrypted = await decryptFromSync(snapshotContent, syncKey);
      const snapshot = JSON.parse(decrypted);
      if (isValidSyncDelta(snapshot) && snapshot.deviceId !== deviceId) {
        await applyDelta(profileId, snapshot);
      }
    }
  }

  // Pull delta files from other devices
  const files = await syncKeyService.listCloudFiles(provider, token, DELTA_PREFIX);
  const otherDeviceDeltas = files.filter(
    (f: { name: string }) => !f.name.includes(deviceId)
  );

  // Sort by timestamp in filename
  otherDeviceDeltas.sort((a: { name: string }, b: { name: string }) => {
    const tsA = extractTimestamp(a.name);
    const tsB = extractTimestamp(b.name);
    return tsA - tsB;
  });

  // Only apply deltas newer than our last sync
  const lastSyncTs = lastSync ? new Date(lastSync).getTime() : 0;

  for (const file of otherDeviceDeltas) {
    const fileTs = extractTimestamp(file.name);
    if (fileTs <= lastSyncTs) continue;

    let content: string | null;
    if (provider === 'google') {
      content = await downloadGoogleFile(token, file.id);
    } else {
      content = await syncKeyService.downloadFile(provider, token, file.name);
    }

    if (content) {
      try {
        const decrypted = await decryptFromSync(content, syncKey);
        const delta = JSON.parse(decrypted);
        if (isValidSyncDelta(delta)) {
          await applyDelta(profileId, delta);
        } else {
          console.warn(`Invalid delta format in ${file.name}`);
        }
      } catch (err) {
        console.warn(`Failed to apply delta ${file.name}:`, err);
      }
    }
  }

  // Update manifest
  await updateManifest(provider, token, 'pull');
}

async function downloadGoogleFile(token: string, fileId: string): Promise<string | null> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return null;
  return resp.text();
}

function extractTimestamp(filename: string): number {
  // Format: expenseiq-delta-{deviceId}-{timestamp}.enc
  const match = filename.match(/-(\d+)\.enc$/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Full Sync (pull + push) ────────────────────────────

export async function fullSync(profileId: string): Promise<boolean> {
  if (!isSyncEnabled()) return false;

  const pullOk = await pullDeltas(profileId);
  if (!pullOk) return false;

  const pushOk = await pushDelta(profileId);
  return pushOk;
}

// ─── Delta Generation ───────────────────────────────────

async function generateDelta(profileId: string, since: string): Promise<SyncDelta | null> {
  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  const [transactions, categories, accounts, budgets, recurringRules, stockTransactions, billReminders, settings, customInstitutions] = await Promise.all([
    getChangedRecords<Transaction>('transactions', profileId, since),
    getChangedRecords<Category>('categories', profileId, since),
    getChangedRecords<Account>('accounts', profileId, since),
    getChangedRecords<Budget>('budgets', profileId, since),
    getChangedRecords<RecurringRule>('recurringRules', profileId, since),
    getChangedRecords<StockTransaction>('stockTransactions', profileId, since),
    getChangedRecords<BillReminder>('billReminders', profileId, since),
    db.settings.get(profileId),
    db.customInstitutions.get(profileId),
  ]);

  const hasChanges = [transactions, categories, accounts, budgets, recurringRules, stockTransactions, billReminders]
    .some((t) => t.upserted.length > 0 || t.deleted.length > 0);

  // Always include settings if they've changed
  const settingsChanged = settings?.updatedAt && settings.updatedAt > since;
  const customInsChanged = customInstitutions?.updatedAt && customInstitutions.updatedAt > since;

  if (!hasChanges && !settingsChanged && !customInsChanged) return null;

  return {
    deviceId,
    timestamp: now,
    profileId,
    tables: {
      ...(transactions.upserted.length || transactions.deleted.length ? { transactions } : {}),
      ...(categories.upserted.length || categories.deleted.length ? { categories } : {}),
      ...(accounts.upserted.length || accounts.deleted.length ? { accounts } : {}),
      ...(budgets.upserted.length || budgets.deleted.length ? { budgets } : {}),
      ...(recurringRules.upserted.length || recurringRules.deleted.length ? { recurringRules } : {}),
      ...(stockTransactions.upserted.length || stockTransactions.deleted.length ? { stockTransactions } : {}),
      ...(billReminders.upserted.length || billReminders.deleted.length ? { billReminders } : {}),
      ...(settingsChanged ? { settings: settings!.data } : {}),
      ...(customInsChanged ? { customInstitutions: customInstitutions!.data } : {}),
    },
  };
}

async function getChangedRecords<T extends { id: string; updatedAt?: string; isDeleted?: boolean }>(
  tableName: string,
  profileId: string,
  since: string
): Promise<{ upserted: T[]; deleted: string[] }> {
  const table = (db as unknown as Record<string, { where: (idx: string) => { between: (lower: [string, string], upper: [string, string]) => { toArray: () => Promise<T[]> } } }>)[tableName];
  if (!table) return { upserted: [], deleted: [] };

  try {
    const records = await table
      .where('[profileId+updatedAt]')
      .between([profileId, since], [profileId, '\uffff'])
      .toArray();

    const upserted: T[] = [];
    const deleted: string[] = [];

    for (const record of records) {
      if (record.isDeleted) {
        deleted.push(record.id);
      } else {
        upserted.push(record);
      }
    }

    return { upserted, deleted };
  } catch {
    // Fallback: scan all records (for tables without updatedAt index)
    const allTable = (db as unknown as Record<string, { where: (field: string) => { equals: (val: string) => { toArray: () => Promise<T[]> } } }>)[tableName];
    const allRecords = await allTable.where('profileId').equals(profileId).toArray();
    const changed = allRecords.filter((r) => r.updatedAt && r.updatedAt > since);

    const upserted: T[] = [];
    const deleted: string[] = [];

    for (const record of changed) {
      if (record.isDeleted) {
        deleted.push(record.id);
      } else {
        upserted.push(record);
      }
    }

    return { upserted, deleted };
  }
}

// ─── Delta Application (LWW Merge) ─────────────────────

async function applyDelta(profileId: string, delta: SyncDelta): Promise<void> {
  const tables = delta.tables;

  await db.transaction('rw', [
    db.transactions, db.categories, db.accounts, db.budgets,
    db.recurringRules, db.stockTransactions, db.billReminders,
    db.settings, db.customInstitutions,
  ], async () => {
    if (tables.transactions) {
      await mergeTableRecords('transactions', profileId, tables.transactions);
    }
    if (tables.categories) {
      await mergeTableRecords('categories', profileId, tables.categories);
    }
    if (tables.accounts) {
      await mergeTableRecords('accounts', profileId, tables.accounts);
    }
    if (tables.budgets) {
      await mergeTableRecords('budgets', profileId, tables.budgets);
    }
    if (tables.recurringRules) {
      await mergeTableRecords('recurringRules', profileId, tables.recurringRules);
    }
    if (tables.stockTransactions) {
      await mergeTableRecords('stockTransactions', profileId, tables.stockTransactions);
    }
    if (tables.billReminders) {
      await mergeTableRecords('billReminders', profileId, tables.billReminders);
    }
    if (tables.settings) {
      await repository.saveSettings(profileId, tables.settings);
    }
    if (tables.customInstitutions) {
      await db.customInstitutions.put({
        profileId,
        data: tables.customInstitutions,
        updatedAt: delta.timestamp,
      });
    }
  });
}

async function mergeTableRecords<T extends { id: string; updatedAt?: string }>(
  tableName: string,
  profileId: string,
  delta: { upserted: T[]; deleted: string[] }
): Promise<void> {
  const table = (db as unknown as Record<string, {
    get: (id: string) => Promise<{ updatedAt?: string; profileId?: string } | undefined>;
    put: (record: unknown) => Promise<unknown>;
    update: (id: string, changes: Record<string, unknown>) => Promise<number>;
  }>)[tableName];

  if (!table) return;

  // Apply upserts (LWW: newer updatedAt wins)
  for (const record of delta.upserted) {
    const existing = await table.get(record.id);

    if (!existing) {
      // New record — insert with profileId
      await table.put({ ...record, profileId });
    } else {
      // Existing — compare timestamps (LWW)
      const existingTime = existing.updatedAt || '1970-01-01T00:00:00.000Z';
      const incomingTime = record.updatedAt || '1970-01-01T00:00:00.000Z';

      if (incomingTime > existingTime) {
        await table.put({ ...record, profileId });
      }
      // else: local is newer, skip incoming
    }
  }

  // Apply deletes (soft-delete with tombstone)
  for (const id of delta.deleted) {
    const existing = await table.get(id);
    if (existing && existing.profileId === profileId) {
      await table.update(id, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

// ─── Collect All Data (for snapshot) ────────────────────

async function collectAllData(profileId: string) {
  const [transactions, categories, accounts, budgets, recurringRules, stockTransactions, billReminders, settings, customInstitutions] = await Promise.all([
    db.transactions.where('profileId').equals(profileId).toArray(),
    db.categories.where('profileId').equals(profileId).toArray(),
    db.accounts.where('profileId').equals(profileId).toArray(),
    db.budgets.where('profileId').equals(profileId).toArray(),
    db.recurringRules.where('profileId').equals(profileId).toArray(),
    db.stockTransactions.where('profileId').equals(profileId).toArray(),
    db.billReminders.where('profileId').equals(profileId).toArray(),
    db.settings.get(profileId),
    db.customInstitutions.get(profileId),
  ]);

  // Filter out deleted records from snapshot
  const filterActive = <T extends { isDeleted?: boolean }>(arr: T[]) => arr.filter((r) => !r.isDeleted);

  return {
    transactions: { upserted: filterActive(transactions) as Transaction[], deleted: [] as string[] },
    categories: { upserted: filterActive(categories) as Category[], deleted: [] as string[] },
    accounts: { upserted: filterActive(accounts) as Account[], deleted: [] as string[] },
    budgets: { upserted: filterActive(budgets) as Budget[], deleted: [] as string[] },
    recurringRules: { upserted: filterActive(recurringRules) as RecurringRule[], deleted: [] as string[] },
    stockTransactions: { upserted: filterActive(stockTransactions) as StockTransaction[], deleted: [] as string[] },
    billReminders: { upserted: filterActive(billReminders) as BillReminder[], deleted: [] as string[] },
    settings: settings?.data,
    customInstitutions: customInstitutions?.data,
  };
}

// ─── Manifest Management ────────────────────────────────

async function updateManifest(provider: AuthProvider, token: string, action: 'push' | 'pull'): Promise<void> {
  let manifest: SyncManifest;
  const content = await syncKeyService.downloadFile(provider, token, MANIFEST_FILENAME);

  if (content) {
    try {
      manifest = JSON.parse(content);
    } catch {
      manifest = { devices: {}, schemaVersion: 6 };
    }
  } else {
    manifest = { devices: {}, schemaVersion: 6 };
  }

  const deviceId = getDeviceId();
  const now = new Date().toISOString();

  if (!manifest.devices[deviceId]) {
    manifest.devices[deviceId] = {
      deviceId,
      deviceName: getDeviceName(),
      lastSyncAt: now,
    };
  }

  manifest.devices[deviceId].lastSyncAt = now;
  if (action === 'push') {
    manifest.devices[deviceId].lastPushAt = now;
  }

  await syncKeyService.uploadFile(provider, token, MANIFEST_FILENAME, JSON.stringify(manifest));
}

// ─── Tombstone Cleanup ──────────────────────────────────

export async function purgeOldTombstones(profileId: string): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - TOMBSTONE_TTL_DAYS);
  const cutoffStr = cutoff.toISOString();
  let purged = 0;

  const tableNames = ['transactions', 'categories', 'accounts', 'budgets', 'recurringRules', 'stockTransactions', 'billReminders'] as const;

  for (const tableName of tableNames) {
    const table = (db as unknown as Record<string, {
      where: (field: string) => { equals: (val: string) => { toArray: () => Promise<{ id: string; isDeleted?: boolean; deletedAt?: string }[]> } };
      delete: (id: string) => Promise<void>;
    }>)[tableName];

    const records = await table.where('profileId').equals(profileId).toArray();
    for (const record of records) {
      if (record.isDeleted && record.deletedAt && record.deletedAt < cutoffStr) {
        await table.delete(record.id);
        purged++;
      }
    }
  }

  return purged;
}

async function maybeCleanupTombstones(profileId: string): Promise<void> {
  const lastCleanup = localStorage.getItem(TOMBSTONE_CLEANUP_KEY);
  if (lastCleanup) {
    const daysSince = (Date.now() - new Date(lastCleanup).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < TOMBSTONE_CLEANUP_INTERVAL_DAYS) return;
  }
  await purgeOldTombstones(profileId);
  localStorage.setItem(TOMBSTONE_CLEANUP_KEY, new Date().toISOString());
}

// ─── Delete All Cloud Sync Data ─────────────────────────

export async function deleteAllCloudSyncData(provider: AuthProvider): Promise<boolean> {
  try {
    const token = await syncKeyService.getAccessToken(provider, true);
    if (!token) return false;

    // Delete manifest
    await syncKeyService.deleteCloudFile(provider, token, MANIFEST_FILENAME);

    // Delete snapshot
    await syncKeyService.deleteCloudFile(provider, token, SNAPSHOT_FILENAME);

    // Delete all delta files
    const deltas = await syncKeyService.listCloudFiles(provider, token, DELTA_PREFIX);
    for (const delta of deltas) {
      if (provider === 'google') {
        await fetch(`https://www.googleapis.com/drive/v3/files/${delta.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await syncKeyService.deleteCloudFile(provider, token, delta.name);
      }
    }

    // Delete sync key
    await syncKeyService.deleteSyncKey(provider);

    // Clear local state
    await disableSync();

    return true;
  } catch (err) {
    console.error('Failed to delete cloud sync data:', err);
    return false;
  }
}

// ─── Debounced Push (for auto-sync after writes) ────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 5000;

export function schedulePush(profileId: string): void {
  if (!isSyncEnabled()) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushDelta(profileId).catch(console.error);
    pushTimer = null;
  }, PUSH_DEBOUNCE_MS);
}

// ─── Visibility-based Pull ──────────────────────────────

let visibilityListenerRegistered = false;

export function registerVisibilitySync(profileId: string): () => void {
  if (visibilityListenerRegistered) return () => {};

  const handler = () => {
    if (document.visibilityState === 'visible' && isSyncEnabled()) {
      pullDeltas(profileId).catch(console.error);
    }
  };

  document.addEventListener('visibilitychange', handler);
  visibilityListenerRegistered = true;

  return () => {
    document.removeEventListener('visibilitychange', handler);
    visibilityListenerRegistered = false;
  };
}
