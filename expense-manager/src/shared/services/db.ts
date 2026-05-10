import Dexie, { Table } from 'dexie';
import { Transaction, Category, Account, Budget, Settings, Profile, RecurringRule, StockTransaction, BillReminder } from '../types';

// Sync metadata fields added to all syncable records
export interface SyncFields {
  isDeleted?: boolean;
  deletedAt?: string;
}

// Extended types with profileId for scoping
export interface DbTransaction extends Transaction, SyncFields {
  profileId: string;
}

export interface DbCategory extends Category, SyncFields {
  profileId: string;
}

export interface DbAccount extends Account, SyncFields {
  profileId: string;
}

export interface DbBudget extends Budget, SyncFields {
  profileId: string;
}

export interface DbSettings {
  profileId: string;
  data: Settings;
  updatedAt?: string;
}

export interface DbCustomInstitutions {
  profileId: string;
  data: Record<string, string[]>;
  updatedAt?: string;
}

export interface DbMigration {
  key: string;
  completedAt: string;
  version: number;
}

export interface DbRecurringRule extends RecurringRule, SyncFields {
  profileId: string;
}

export interface DbReceipt {
  id: string;
  profileId: string;
  transactionId: string;
  data: Blob;
  mimeType: string;
  fileName: string;
  fileSize: number;
  thumbnailData?: Blob;
  createdAt: string;
}

export interface DbStockTransaction extends StockTransaction, SyncFields {
  profileId: string;
}

export interface DbBillReminder extends BillReminder, SyncFields {
  profileId: string;
}

export class ExpenseDatabase extends Dexie {
  transactions!: Table<DbTransaction, string>;
  categories!: Table<DbCategory, string>;
  accounts!: Table<DbAccount, string>;
  budgets!: Table<DbBudget, string>;
  settings!: Table<DbSettings, string>;
  customInstitutions!: Table<DbCustomInstitutions, string>;
  profiles!: Table<Profile, string>;
  migrations!: Table<DbMigration, string>;
  recurringRules!: Table<DbRecurringRule, string>;
  receipts!: Table<DbReceipt, string>;
  stockTransactions!: Table<DbStockTransaction, string>;
  billReminders!: Table<DbBillReminder, string>;

  constructor() {
    super('ExpenseIQDatabase');

    this.version(1).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
    });

    this.version(2).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
    });

    this.version(3).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
      receipts: 'id, profileId, transactionId',
    });

    this.version(4).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
      receipts: 'id, profileId, transactionId',
      stockTransactions: 'id, profileId, [profileId+date], [profileId+symbol], [profileId+type], [profileId+broker]',
    });

    this.version(5).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive]',
      budgets: 'id, profileId, [profileId+categoryId+month]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate]',
      receipts: 'id, profileId, transactionId',
      stockTransactions: 'id, profileId, [profileId+date], [profileId+symbol], [profileId+type], [profileId+broker]',
      billReminders: 'id, profileId, [profileId+dueDate], [profileId+category]',
    });

    // v6: Add updatedAt index for sync delta queries on all syncable tables
    this.version(6).stores({
      transactions: 'id, profileId, [profileId+date], [profileId+categoryId], [profileId+accountId], [profileId+type], [profileId+updatedAt]',
      categories: 'id, profileId, [profileId+type], [profileId+parentId], [profileId+updatedAt]',
      accounts: 'id, profileId, [profileId+type], [profileId+isActive], [profileId+updatedAt]',
      budgets: 'id, profileId, [profileId+categoryId+month], [profileId+updatedAt]',
      settings: 'profileId',
      customInstitutions: 'profileId',
      profiles: 'id',
      migrations: 'key',
      recurringRules: 'id, profileId, [profileId+isActive], [profileId+nextDueDate], [profileId+updatedAt]',
      receipts: 'id, profileId, transactionId',
      stockTransactions: 'id, profileId, [profileId+date], [profileId+symbol], [profileId+type], [profileId+broker], [profileId+updatedAt]',
      billReminders: 'id, profileId, [profileId+dueDate], [profileId+category], [profileId+updatedAt]',
    }).upgrade(async (tx) => {
      // Backfill updatedAt on records that don't have it
      const now = new Date().toISOString();
      const tables = ['transactions', 'categories', 'accounts', 'budgets', 'recurringRules', 'stockTransactions', 'billReminders'];
      for (const tableName of tables) {
        const table = (tx as unknown as Record<string, Table>)[tableName];
        if (table) {
          await table.toCollection().modify((record: Record<string, unknown>) => {
            if (!record.updatedAt) {
              record.updatedAt = (record.createdAt as string) || now;
            }
          });
        }
      }
    });
  }
}

export const db = new ExpenseDatabase();

/**
 * Runtime migration: fix stock symbols AND names using ISIN-based resolution.
 * Uses the official NSE symbol map (2000+ stocks with authoritative ISINs).
 * Runs once per version. Uses the migrations table to track.
 */
export async function migrateStockSymbols(): Promise<void> {
  const MIGRATION_KEY = 'fix-stock-symbols-v2'; // v2: uses official NSE data, fixes names too
  const existing = await db.migrations.get(MIGRATION_KEY);
  if (existing) return; // Already migrated

  try {
    const { loadMapSync, resolveSymbolSync } = await import('./symbolResolver');

    // Load the symbol map
    const baseUrl = import.meta.env.BASE_URL || '/';
    const resp = await fetch(`${baseUrl}nse-symbol-map.json`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return; // Can't migrate without the map

    const mapData = await resp.json();
    loadMapSync(mapData);

    const tickerInfo: Record<string, { isin: string; name: string }> = mapData.tickerInfo || {};

    // Process all stock transactions
    const allStocks = await db.stockTransactions.toArray();
    let fixedCount = 0;

    await db.transaction('rw', db.stockTransactions, async () => {
      for (const stock of allStocks) {
        // Extract ISIN from notes field (Geojit stores "ISIN: INExxxxxxxx...")
        let isin: string | undefined;
        if (stock.notes) {
          const isinMatch = stock.notes.match(/ISIN:\s*(INE\w+)/i);
          if (isinMatch) isin = isinMatch[1];
        }

        const resolved = resolveSymbolSync(stock.symbol, isin);
        const updates: Record<string, unknown> = {};

        // Fix symbol if it changed
        if (resolved !== stock.symbol) {
          updates.symbol = resolved;
        }

        // Fix name from official NSE data (always update to authoritative name)
        const info = tickerInfo[resolved];
        if (info?.name) {
          const officialName = info.name.replace(/\s+Limited$/i, '').trim();
          if (officialName && officialName !== stock.name) {
            updates.name = officialName;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date().toISOString();
          await db.stockTransactions.update(stock.id, updates);
          fixedCount++;
        }
      }
    });

    // Mark migration as complete
    await db.migrations.put({
      key: MIGRATION_KEY,
      completedAt: new Date().toISOString(),
      version: 7,
    });

    if (fixedCount > 0) {
      console.log(`[DB Migration v2] Fixed ${fixedCount} stock transactions (symbols + names)`);
    }
  } catch (err) {
    console.warn('[DB Migration v2] Stock symbol migration failed (will retry next load):', err);
  }
}
