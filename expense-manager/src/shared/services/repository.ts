import { db, DbTransaction, DbCategory, DbAccount, DbBudget } from './db';
import { Transaction, Category, Account, Budget, Settings, Profile, RecurringRule, BillReminder } from '../types';
import { DEFAULT_SETTINGS, ALL_CATEGORIES } from '../constants/categories';
import { DEFAULT_ACCOUNTS } from '../constants/accounts';
import { v4 as uuidv4 } from 'uuid';

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
    await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.settings, db.customInstitutions, db.profiles, db.recurringRules, db.billReminders], async () => {
      await db.transactions.where('profileId').equals(id).delete();
      await db.categories.where('profileId').equals(id).delete();
      await db.accounts.where('profileId').equals(id).delete();
      await db.budgets.where('profileId').equals(id).delete();
      await db.settings.where('profileId').equals(id).delete();
      await db.customInstitutions.where('profileId').equals(id).delete();
      await db.recurringRules.where('profileId').equals(id).delete();
      await db.billReminders.where('profileId').equals(id).delete();
      await db.profiles.delete(id);
    });
  }

  // ─── Transactions ───────────────────────────────────

  async getTransactions(profileId: string): Promise<Transaction[]> {
    const rows = await db.transactions.where('profileId').equals(profileId).toArray();
    return rows.filter((r) => !r.isDeleted).map(stripProfileId);
  }

  async saveTransactions(profileId: string, transactions: Transaction[]): Promise<void> {
    await db.transaction('rw', db.transactions, async () => {
      await db.transactions.where('profileId').equals(profileId).delete();
      const rows: DbTransaction[] = transactions.map((t) => ({ ...t, profileId }));
      if (rows.length > 0) await db.transactions.bulkAdd(rows);
    });
  }

  async addTransaction(profileId: string, transaction: Transaction): Promise<void> {
    const now = new Date().toISOString();
    await db.transactions.add({
      ...transaction,
      profileId,
      createdAt: transaction.createdAt || now,
      updatedAt: transaction.updatedAt || now,
    });
  }

  async updateTransaction(_profileId: string, id: string, updates: Partial<Transaction>): Promise<void> {
    await db.transactions.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteTransaction(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.transactions.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
  }

  // ─── Categories ─────────────────────────────────────

  async getCustomCategories(profileId: string): Promise<Category[]> {
    const rows = await db.categories.where('profileId').equals(profileId).toArray();
    return rows.filter((r) => !r.isDeleted).map(stripProfileId);
  }

  async getAllCategories(profileId: string): Promise<Category[]> {
    const custom = await this.getCustomCategories(profileId);
    return [...ALL_CATEGORIES, ...custom];
  }

  async addCustomCategory(profileId: string, category: Category): Promise<Category[]> {
    const exists = await db.categories.get(category.id);
    if (!exists) {
      const now = new Date().toISOString();
      await db.categories.add({ ...category, isCustom: true, profileId, createdAt: now, updatedAt: now } as DbCategory);
    }
    return this.getAllCategories(profileId);
  }

  async updateCustomCategory(profileId: string, id: string, updates: Partial<Category>): Promise<Category[]> {
    await db.categories.update(id, { ...updates, updatedAt: new Date().toISOString() });
    return this.getAllCategories(profileId);
  }

  async deleteCustomCategory(profileId: string, id: string): Promise<Category[]> {
    const now = new Date().toISOString();
    await db.categories.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
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
    return rows.filter((r) => !r.isDeleted).map(stripProfileId);
  }

  async saveAccounts(profileId: string, accounts: Account[]): Promise<void> {
    await db.transaction('rw', db.accounts, async () => {
      await db.accounts.where('profileId').equals(profileId).delete();
      const rows: DbAccount[] = accounts.map((a) => ({ ...a, profileId }));
      if (rows.length > 0) await db.accounts.bulkAdd(rows);
    });
  }

  async addAccount(profileId: string, account: Account): Promise<void> {
    const now = new Date().toISOString();
    await db.accounts.add({ ...account, profileId, createdAt: account.createdAt || now, updatedAt: account.updatedAt || now } as DbAccount);
  }

  async updateAccount(id: string, updates: Partial<Account>): Promise<void> {
    await db.accounts.update(id, { ...updates, updatedAt: new Date().toISOString() });
  }

  async deleteAccount(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.accounts.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
  }

  // ─── Budgets ────────────────────────────────────────

  async getBudgets(profileId: string): Promise<Budget[]> {
    const rows = await db.budgets.where('profileId').equals(profileId).toArray();
    return rows.filter((r) => !r.isDeleted).map(stripProfileId);
  }

  async saveBudgets(profileId: string, budgets: Budget[]): Promise<void> {
    await db.transaction('rw', db.budgets, async () => {
      await db.budgets.where('profileId').equals(profileId).delete();
      const rows: DbBudget[] = budgets.map((b) => ({ ...b, profileId }));
      if (rows.length > 0) await db.budgets.bulkAdd(rows);
    });
  }

  async setBudget(profileId: string, budget: Budget): Promise<void> {
    const now = new Date().toISOString();
    const existing = await db.budgets.get(budget.id);
    if (existing) {
      await db.budgets.update(budget.id, { ...budget, profileId, updatedAt: now });
    } else {
      await db.budgets.add({ ...budget, profileId, updatedAt: now } as DbBudget);
    }
  }

  async deleteBudget(_profileId: string, id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.budgets.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
  }

  // ─── Settings ───────────────────────────────────────

  async getSettings(profileId: string): Promise<Settings> {
    const row = await db.settings.get(profileId);
    return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) };
  }

  async saveSettings(profileId: string, settings: Settings): Promise<void> {
    await db.settings.put({ profileId, data: settings, updatedAt: new Date().toISOString() });
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
    await db.customInstitutions.put({ profileId, data: institutions, updatedAt: new Date().toISOString() });
    return institutions;
  }

  // ─── Data Export/Import ─────────────────────────────

  async exportData(profileId: string): Promise<string> {
    const [transactions, categories, budgets, accounts, settings, recurringRules, stockTransactions, billReminders, customInstitutions] = await Promise.all([
      this.getTransactions(profileId),
      this.getCustomCategories(profileId),
      this.getBudgets(profileId),
      this.getAccounts(profileId),
      this.getSettings(profileId),
      this.getRecurringRules(profileId),
      db.stockTransactions.where('profileId').equals(profileId).toArray().then((rows) => rows.filter((r) => !r.isDeleted).map(stripProfileId)),
      this.getBillReminders(profileId),
      this.getCustomInstitutions(profileId),
    ]);
    const data = {
      transactions,
      categories,
      budgets,
      accounts,
      settings,
      recurringRules,
      stockTransactions,
      billReminders,
      customInstitutions,
      exportedAt: new Date().toISOString(),
      version: '3.0.0',
    };
    return JSON.stringify(data, null, 2);
  }

  async importData(profileId: string, jsonString: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.transactions || !Array.isArray(data.transactions)) {
        throw new Error('Invalid data format: missing version or transactions array');
      }
      // Validate transaction records have required fields
      for (const txn of data.transactions) {
        if (!txn.id || typeof txn.amount !== 'number' || !txn.type || !txn.date || !txn.categoryId) {
          throw new Error('Invalid transaction record: missing required fields (id, amount, type, date, categoryId)');
        }
        if (!['income', 'expense', 'transfer'].includes(txn.type)) {
          throw new Error(`Invalid transaction type: ${txn.type}`);
        }
        if (txn.amount < 0) {
          throw new Error('Transaction amount cannot be negative');
        }
      }
      // Validate categories if present
      if (data.categories && Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          if (!cat.id || !cat.name || !cat.type) {
            throw new Error('Invalid category record: missing required fields (id, name, type)');
          }
        }
      }
      // Validate accounts if present
      if (data.accounts && Array.isArray(data.accounts)) {
        for (const acct of data.accounts) {
          if (!acct.id || !acct.name || !acct.type) {
            throw new Error('Invalid account record: missing required fields (id, name, type)');
          }
        }
      }
      await db.transaction('rw', [db.transactions, db.categories, db.budgets, db.accounts, db.settings, db.recurringRules, db.stockTransactions, db.billReminders, db.customInstitutions], async () => {
        await this.saveTransactions(profileId, data.transactions);
        if (data.categories) await this.saveCustomCategories(profileId, data.categories);
        if (data.budgets) await this.saveBudgets(profileId, data.budgets);
        if (data.accounts) await this.saveAccounts(profileId, data.accounts);
        if (data.settings) await this.saveSettings(profileId, data.settings);
        if (data.recurringRules && Array.isArray(data.recurringRules)) {
          for (const rule of data.recurringRules) {
            await this.saveRecurringRule(profileId, rule);
          }
        }
        if (data.stockTransactions && Array.isArray(data.stockTransactions)) {
          for (const st of data.stockTransactions) {
            await db.stockTransactions.put({ ...st, profileId });
          }
        }
        if (data.billReminders && Array.isArray(data.billReminders)) {
          for (const br of data.billReminders) {
            await this.saveBillReminder(profileId, br);
          }
        }
        if (data.customInstitutions && typeof data.customInstitutions === 'object') {
          await db.customInstitutions.put({ profileId, data: data.customInstitutions, updatedAt: new Date().toISOString() });
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  async clearAllData(profileId: string): Promise<void> {
    await db.transaction('rw', [db.transactions, db.categories, db.accounts, db.budgets, db.settings, db.customInstitutions, db.recurringRules, db.billReminders], async () => {
      await db.transactions.where('profileId').equals(profileId).delete();
      await db.categories.where('profileId').equals(profileId).delete();
      await db.accounts.where('profileId').equals(profileId).delete();
      await db.budgets.where('profileId').equals(profileId).delete();
      await db.settings.where('profileId').equals(profileId).delete();
      await db.customInstitutions.where('profileId').equals(profileId).delete();
      await db.recurringRules.where('profileId').equals(profileId).delete();
      await db.billReminders.where('profileId').equals(profileId).delete();
    });
  }

  async clearPortfolioData(profileId: string): Promise<void> {
    await db.stockTransactions.where('profileId').equals(profileId).delete();
  }

  // ─── Recurring Rules ──────────────────────────────────

  async getRecurringRules(profileId: string): Promise<RecurringRule[]> {
    const rows = await db.recurringRules.where('profileId').equals(profileId).toArray();
    return rows.filter((r) => !r.isDeleted).map(stripProfileId) as RecurringRule[];
  }

  async saveRecurringRule(profileId: string, rule: RecurringRule): Promise<void> {
    await db.recurringRules.put({ ...rule, profileId, updatedAt: new Date().toISOString() });
  }

  async deleteRecurringRule(profileId: string, id: string): Promise<void> {
    const rule = await db.recurringRules.get(id);
    if (rule && rule.profileId === profileId) {
      const now = new Date().toISOString();
      await db.recurringRules.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
    }
  }

  private computeNextDueDate(currentDue: string, frequency: RecurringRule['frequency']): string {
    const d = new Date(currentDue + 'T00:00:00');
    switch (frequency) {
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly': {
        const origDay = d.getDate();
        d.setMonth(d.getMonth() + 1);
        // Handle month overflow (e.g., Jan 31 → Feb 28)
        if (d.getDate() !== origDay) {
          d.setDate(0); // last day of previous month
        }
        break;
      }
      case 'yearly': {
        const origMonth = d.getMonth();
        const origDayY = d.getDate();
        d.setFullYear(d.getFullYear() + 1);
        // Handle Feb 29 → Feb 28 in non-leap years
        if (d.getMonth() !== origMonth || d.getDate() !== origDayY) {
          d.setDate(0);
        }
        break;
      }
    }
    return d.toISOString().split('T')[0];
  }

  async processRecurringRules(profileId: string): Promise<Transaction[]> {
    const today = new Date().toISOString().split('T')[0];
    const allRules = await db.recurringRules
      .where('profileId')
      .equals(profileId)
      .toArray();

    const rules = allRules.filter((r) => r.isActive && r.nextDueDate <= today);
    const generatedTransactions: Transaction[] = [];

    for (const rule of rules) {
      // Generate transactions for all due dates up to today
      while (rule.nextDueDate <= today && rule.isActive) {
        const tx: Transaction = {
          id: uuidv4(),
          type: rule.type,
          amount: rule.amount,
          categoryId: rule.categoryId,
          date: rule.nextDueDate,
          notes: rule.notes ? `${rule.notes} (Auto: ${rule.name})` : `Auto: ${rule.name}`,
          accountId: rule.accountId,
          paymentMethod: rule.paymentMethod,
          isRecurring: true,
          recurringFrequency: rule.frequency,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await db.transactions.add({ ...tx, profileId });
        generatedTransactions.push(tx);

        const nextDue = this.computeNextDueDate(rule.nextDueDate, rule.frequency);
        rule.lastGeneratedDate = today;
        rule.nextDueDate = nextDue;
        rule.updatedAt = new Date().toISOString();

        // If past end date, deactivate
        if (rule.endDate && nextDue > rule.endDate) {
          rule.isActive = false;
        }
      }

      // Persist updated rule
      await db.recurringRules.put(rule);
    }

    return generatedTransactions;
  }

  // ─── Bill Reminders ──────────────────────────────────

  async getBillReminders(profileId: string): Promise<BillReminder[]> {
    const rows = await db.billReminders.where('profileId').equals(profileId).toArray();
    return rows.filter((r) => !r.isDeleted).map(stripProfileId) as BillReminder[];
  }

  async saveBillReminder(profileId: string, reminder: BillReminder): Promise<void> {
    await db.billReminders.put({ ...reminder, profileId, updatedAt: new Date().toISOString() });
  }

  async deleteBillReminder(profileId: string, id: string): Promise<void> {
    const reminder = await db.billReminders.get(id);
    if (reminder && reminder.profileId === profileId) {
      const now = new Date().toISOString();
      await db.billReminders.update(id, { isDeleted: true, deletedAt: now, updatedAt: now });
    }
  }

  // ─── Load all data for a profile (used on init/switch) ──

  async loadProfileData(profileId: string): Promise<{
    transactions: Transaction[];
    categories: Category[];
    accounts: Account[];
    budgets: Budget[];
    settings: Settings;
    recurringRules: RecurringRule[];
    billReminders: BillReminder[];
  }> {
    const [transactions, categories, accounts, budgets, settings, recurringRules, billReminders] = await Promise.all([
      this.getTransactions(profileId),
      this.getAllCategories(profileId),
      this.getAccounts(profileId),
      this.getBudgets(profileId),
      this.getSettings(profileId),
      this.getRecurringRules(profileId),
      this.getBillReminders(profileId),
    ]);

    // Seed default accounts for new profiles with no accounts
    if (accounts.length === 0) {
      const rows: DbAccount[] = DEFAULT_ACCOUNTS.map((a) => ({ ...a, profileId }));
      await db.accounts.bulkAdd(rows);
      return { transactions, categories, accounts: [...DEFAULT_ACCOUNTS], budgets, settings, recurringRules, billReminders };
    }

    return { transactions, categories, accounts, budgets, settings, recurringRules, billReminders };
  }
}

// Strip profileId when returning data to consumers
function stripProfileId<T extends { profileId: string }>(row: T): Omit<T, 'profileId'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { profileId, ...rest } = row;
  return rest as Omit<T, 'profileId'>;
}

export const repository = new ExpenseRepository();
