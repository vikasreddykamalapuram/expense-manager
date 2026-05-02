import { db } from './db';
import { Transaction, Category, Account, Budget, Settings, Profile } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants/categories';

const MIGRATION_VERSION = 1;
const PROFILE_LIST_KEY = 'em_profiles';
const ACTIVE_PROFILE_KEY = 'em_active_profile';
const DEFAULT_PROFILE_ID = 'default';

/**
 * Migrates data from localStorage to IndexedDB.
 * - Versioned and idempotent: tracks per-profile migration status
 * - Transactional: each profile migrated atomically
 * - Safe in React Strict Mode (double-run safe)
 */
export async function migrateFromLocalStorage(): Promise<void> {
  // Get all profile IDs from localStorage
  const profileIds = getLocalStorageProfileIds();

  for (const profileId of profileIds) {
    const migrationKey = `ls_to_idb_v${MIGRATION_VERSION}_${profileId}`;

    // Check if already migrated (idempotent)
    const existing = await db.migrations.get(migrationKey);
    if (existing) continue;

    // Check if there's any localStorage data for this profile
    const lsKey = profileId === DEFAULT_PROFILE_ID
      ? STORAGE_KEYS.TRANSACTIONS
      : `${STORAGE_KEYS.TRANSACTIONS}_p_${profileId}`;
    const rawData = localStorage.getItem(lsKey);
    if (!rawData) {
      // No data to migrate — mark as done
      await db.migrations.put({ key: migrationKey, completedAt: new Date().toISOString(), version: MIGRATION_VERSION });
      continue;
    }

    try {
      // Read all localStorage data for this profile
      const transactions = readLS<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, profileId, []);
      const customCategories = readLS<Category[]>(STORAGE_KEYS.CATEGORIES, profileId, []);
      const accounts = readLS<Account[]>(STORAGE_KEYS.ACCOUNTS, profileId, []);
      const budgets = readLS<Budget[]>(STORAGE_KEYS.BUDGETS, profileId, []);
      const settings = readLS<Settings>(STORAGE_KEYS.SETTINGS, profileId, DEFAULT_SETTINGS);

      // Write to IndexedDB atomically
      await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.settings, db.customInstitutions, db.migrations], async () => {
        // Double-check inside transaction (guard against concurrent migration)
        const recheck = await db.migrations.get(migrationKey);
        if (recheck) return;

        if (transactions.length > 0) {
          await db.transactions.bulkAdd(transactions.map((t) => ({ ...t, profileId })));
        }
        if (customCategories.length > 0) {
          await db.categories.bulkAdd(customCategories.map((c) => ({ ...c, profileId })));
        }
        if (accounts.length > 0) {
          await db.accounts.bulkAdd(accounts.map((a) => ({ ...a, profileId })));
        }
        if (budgets.length > 0) {
          await db.budgets.bulkAdd(budgets.map((b) => ({ ...b, profileId })));
        }
        await db.settings.put({ profileId, data: settings });

        // Custom institutions
        const customInstitutionsKey = profileId === DEFAULT_PROFILE_ID
          ? STORAGE_KEYS.CUSTOM_INSTITUTIONS
          : `${STORAGE_KEYS.CUSTOM_INSTITUTIONS}_p_${profileId}`;
        const ciRaw = localStorage.getItem(customInstitutionsKey);
        if (ciRaw) {
          await db.customInstitutions.put({ profileId, data: JSON.parse(ciRaw) });
        }

        // Mark migration complete
        await db.migrations.put({ key: migrationKey, completedAt: new Date().toISOString(), version: MIGRATION_VERSION });
      });

      console.log(`Migration complete for profile: ${profileId} (${transactions.length} transactions)`);
    } catch (error) {
      console.error(`Migration failed for profile ${profileId}:`, error);
      // Don't mark as complete — will retry next time
    }
  }

  // Migrate profiles list
  const profilesMigrationKey = `ls_to_idb_v${MIGRATION_VERSION}_profiles`;
  const profilesMigrated = await db.migrations.get(profilesMigrationKey);
  if (!profilesMigrated) {
    const profilesRaw = localStorage.getItem(PROFILE_LIST_KEY);
    if (profilesRaw) {
      try {
        const profiles: Profile[] = JSON.parse(profilesRaw);
        for (const profile of profiles) {
          const exists = await db.profiles.get(profile.id);
          if (!exists) {
            await db.profiles.add(profile);
          }
        }
      } catch { /* ignore bad data */ }
    }
    await db.migrations.put({ key: profilesMigrationKey, completedAt: new Date().toISOString(), version: MIGRATION_VERSION });
  }
}

/**
 * Get the active profile ID from localStorage (for migration)
 */
export function getActiveProfileIdFromLS(): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

// ─── Helpers ─────────────────────────────────────────

function getLocalStorageProfileIds(): string[] {
  const profileIds = new Set<string>([DEFAULT_PROFILE_ID]);

  // Read from profile list
  const profilesRaw = localStorage.getItem(PROFILE_LIST_KEY);
  if (profilesRaw) {
    try {
      const profiles: Profile[] = JSON.parse(profilesRaw);
      profiles.forEach((p) => profileIds.add(p.id));
    } catch { /* ignore */ }
  }

  // Also scan for any orphaned profile keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const match = key.match(/_p_(.+)$/);
      if (match) profileIds.add(match[1]);
    }
  }

  return Array.from(profileIds);
}

function readLS<T>(baseKey: string, profileId: string, fallback: T): T {
  const key = profileId === DEFAULT_PROFILE_ID ? baseKey : `${baseKey}_p_${profileId}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
