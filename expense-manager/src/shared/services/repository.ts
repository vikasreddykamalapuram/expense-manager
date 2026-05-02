import { db, DbTransaction, DbCategory, DbAccount, DbBudget } from './db';
import { Transaction, Category, Account, Budget, Settings, Profile } from '../types';
import { DEFAULT_SETTINGS, ALL_CATEGORIES } from '../constants/categories';
import { DEFAULT_ACCOUNTS } from '../constants/accounts';

const DEFAULT_PROFILE_ID = 'default';

/**
 * Repository layer — single source of truth for all data persistence.
 * Wraps Dexie IndexedDB behind a clean async API.
 * All data is profile-scoped.
 */
class ExpenseRepository {
  // ─── Profiles ───────────────────────────────────────

  async getProfiles(): Promise<Profile[]> {
    const profiles = await db.profiles.toArray();
    if (!profiles.find((p) => p.id === DEFAULT_PROFILE_ID)) {
      const defaultProfile: Profile = {
        id: DEFAULT_PROFILE_ID,
        name: 'Personal',
        icon: '💰',
        createdAt: new Date().toISOString(),
      };
      await db.profiles.add(defaultProfile);
      profiles.unshift(defaultProfile);
    }
    return profiles;
  }

  async addProfile(profile: Profile): Promise<void> {
    const exists = await db.profiles.get(profile.id);
    if (!exists) {
      await db.profiles.add(profile);
    }
  }

  async updateProfile(id: string, updates: Partial<Profile>): Promise<void> {
    await db.profiles.update(id, updates);
  }

  async deleteProfile(id: string): Promise<void> {
    if (id === DEFAULT_PROFILE_ID) return;
    await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.settings, db.customInstitutions, db.profiles], async () => {
      await db.transactions.where('profileId').equals(id).delete();
      await db.categories.where('profileId').equals(id).delete();
      await db.accounts.where('profileId').equals(id).delete();
      await db.budgets.where('profileId').equals(id).delete();
      await db.settings.where('profileId').equals(id).delete();
      await db.customInstitutions.where('profileId').equals(id).delete();
      await db.profiles.delete(id);
    });
  }

  // ─── Transactions ───────────────────────────────────

  async getTransactions(profileId: string): Promise<Transaction[]> {
    const rows = await db.transactions.where('profileId').equals(profileId).toArray();
    return rows.map(stripProfileId);
  }

  async saveTransactions(profileId: string, transactions: Transaction[]): Promise<void> {
    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.where('profileId').equals(profileId).delete();
      const rows: DbTransaction[] = transactions.map((t) => ({ ...t, profileId }));
      if (rows.length > 0) await db.transactions.bulkAdd(rows);
    });
  }

  async addTransaction(profileId: string, transaction: Transaction): Promise<void> {
    await db.transactions.add({ ...transaction, profileId });
  }

  async updateTransaction(_profileId: string, id: string, updates: Partial<Transaction>): Promise<void> {
    await db.transactions.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.transactions.delete(id);
  }

  // ─── Categories ─────────────────────────────────────

  async getCustomCategories(profileId: string): Promise<Category[]> {
    const rows = await db.categories.where('profileId').equals(profileId).toArray();
    return rows.map(stripProfileId);
  }

  async getAllCategories(profileId: string): Promise<Category[]> {
    const custom = await this.getCustomCategories(profileId);
    return [...ALL_CATEGORIES, ...custom];
  }

  async addCustomCategory(profileId: string, category: Category): Promise<Category[]> {
    const exists = await db.categories.get(category.id);
    if (!exists) {
      await db.categories.add({ ...category, isCustom: true, profileId } as DbCategory);
    }
    return this.getAllCategories(profileId);
  }

  async updateCustomCategory(profileId: string, id: string, updates: Partial<Category>): Promise<Category[]> {
    await db.categories.update(id, updates);
    return this.getAllCategories(profileId);
  }

  async deleteCustomCategory(profileId: string, id: string): Promise<Category[]> {
    await db.categories.delete(id);
    return this.getAllCategories(profileId);
  }

  async saveCustomCategories(profileId: string, categories: Category[]): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      await db.categories.where('profileId').equals(profileId).delete();
      const rows: DbCategory[] = categories.map((c) => ({ ...c, profileId }));
      if (rows.length > 0) await db.categories.bulkAdd(rows);
    });
  }

  // ─── Accounts ───────────────────────────────────────

  async getAccounts(profileId: string): Promise<Account[]> {
    const rows = await db.accounts.where('profileId').equals(profileId).toArray();
    return rows.map(stripProfileId);
  }

  async saveAccounts(profileId: string, accounts: Account[]): Promise<void> {
    await db.transaction('rw', db.accounts, async () => {
      await db.accounts.where('profileId').equals(profileId).delete();
      const rows: DbAccount[] = accounts.map((a) => ({ ...a, profileId }));
      if (rows.length > 0) await db.accounts.bulkAdd(rows);
    });
  }

  async addAccount(profileId: string, account: Account): Promise<void> {
    await db.accounts.add({ ...account, profileId } as DbAccount);
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    await db.accounts.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteAccount(id: string): Promise<void> {
    await db.accounts.delete(id);
  }

  // ─── Budgets ────────────────────────────────────────

  async getBudgets(profileId: string): Promise<Budget[]> {
    const rows = await db.budgets.where('profileId').equals(profileId).toArray();
    return rows.map(stripProfileId);
  }

  async saveBudgets(profileId: string, budgets: Budget[]): Promise<void> {
    await db.transaction('rw', db.budgets, async () => {
      await db.budgets.where('profileId').equals(profileId).delete();
      const rows: DbBudget[] = budgets.map((b) => ({ ...b, profileId }));
      if (rows.length > 0) await db.budgets.bulkAdd(rows);
    });
  }

  async setBudget(profileId: string, budget: Budget): Promise<void> {
    const existing = await db.budgets.get(budget.id);
    if (existing) {
      await db.budgets.update(budget.id, { ...budget, profileId });
    } else {
      await db.budgets.add({ ...budget, profileId } as DbBudget);
    }
  }

  // ─── Settings ───────────────────────────────────────

  async getSettings(profileId: string): Promise<Settings> {
    const row = await db.settings.get(profileId);
    return row?.data ?? { ...DEFAULT_SETTINGS };
  }

  async saveSettings(profileId: string, settings: Settings): Promise<void> {
    await db.settings.put({ profileId, data: settings });
  }

  // ─── Custom Institutions ────────────────────────────

  async getCustomInstitutions(profileId: string): Promise<Record<string, string[]>> {
    const row = await db.customInstitutions.get(profileId);
    return row?.data ?? {};
  }

  async addCustomInstitution(profileId: string, accountType: string, name: string): Promise<Record<string, string[]>> {
    const institutions = await this.getCustomInstitutions(profileId);
    if (!institutions[accountType]) institutions[accountType] = [];
    if (!institutions[accountType].includes(name)) {
      institutions[accountType].push(name);
    }
    await db.customInstitutions.put({ profileId, data: institutions });
    return institutions;
  }

  // ─── Data Export/Import ─────────────────────────────

  async exportData(profileId: string): Promise<string> {
    const [transactions, categories, budgets, accounts, settings] = await Promise.all([
      this.getTransactions(profileId),
      this.getCustomCategories(profileId),
      this.getBudgets(profileId),
      this.getAccounts(profileId),
      this.getSettings(profileId),
    ]);
    const data = {
      transactions,
      categories,
      budgets,
      accounts,
      settings,
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(profileId: string, jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.transactions) {
        throw new Error('Invalid data format');
      }
      await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.accounts, db.settings], async () => {
        await this.saveTransactions(profileId, data.transactions);
        if (data.categories) await this.saveCustomCategories(profileId, data.categories);
        if (data.budgets) await this.saveBudgets(profileId, data.budgets);
        if (data.accounts) await this.saveAccounts(profileId, data.accounts);
        if (data.settings) await this.saveSettings(profileId, data.settings);
      });
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  async clearAllData(profileId: string): Promise<void> {
    await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.settings, db.customInstitutions], async () => {
      await db.transactions.where('profileId').equals(profileId).delete();
      await db.categories.where('profileId').equals(profileId).delete();
      await db.accounts.where('profileId').equals(profileId).delete();
      await db.budgets.where('profileId').equals(profileId).delete();
      await db.settings.where('profileId').equals(profileId).delete();
      await db.customInstitutions.where('profileId').equals(profileId).delete();
    });
  }

  // ─── Load all data for a profile (used on init/switch) ──

  async loadProfileData(profileId: string): Promise<{
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    budgets: Budget[];
    settings: Settings;
  }> {
    const [transactions, categories, accounts, budgets, settings] = await Promise.all([
      this.getTransactions(profileId),
      this.getAllCategories(profileId),
      this.getAccounts(profileId),
      this.getBudgets(profileId),
      this.getSettings(profileId),
    ]);

    // Seed default accounts for new profiles with no accounts
    if (accounts.length === 0) {
      const rows: DbAccount[] = DEFAULT_ACCOUNTS.map((a) => ({ ...a, profileId }));
      await db.accounts.bulkAdd(rows);
      return { transactions, categories, accounts: [...DEFAULT_ACCOUNTS], budgets, settings };
    }

    return { transactions, categories, accounts, budgets, settings };
  }
}

// Strip profileId when returning data to consumers
function stripProfileId<T extends { profileId: string }>(row: T): Omit<T, 'profileId'> {
  const { profileId: _, ...rest } = row;
  return rest as Omit<T, 'profileId'>;
}

export const repository = new ExpenseRepository();
