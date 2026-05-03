import { Transaction, Budget, Settings, Category, Account, Profile } from '../types';
import { STORAGE_KEYS, DEFAULT_SETTINGS, ALL_CATEGORIES } from '../constants/categories';

const PROFILE_LIST_KEY = 'em_profiles';
const ACTIVE_PROFILE_KEY = 'em_active_profile';
const DEFAULT_PROFILE_ID = 'default';

class StorageService {
  private profileId: string = DEFAULT_PROFILE_ID;

  // --- Profile Management ---

  private getProfileKey(baseKey: string): string {
    if (this.profileId === DEFAULT_PROFILE_ID) return baseKey;
    return `${baseKey}_p_${this.profileId}`;
  }

  getProfiles(): Profile[] {
    try {
      const data = localStorage.getItem(PROFILE_LIST_KEY);
      const profiles: Profile[] = data ? JSON.parse(data) : [];
      // Ensure default profile exists
      if (!profiles.find((p) => p.id === DEFAULT_PROFILE_ID)) {
        profiles.unshift({
          id: DEFAULT_PROFILE_ID,
          name: 'Personal',
          icon: '💰',
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
      }
      return profiles;
    } catch {
      return [{
        id: DEFAULT_PROFILE_ID,
        name: 'Personal',
        icon: '💰',
        createdAt: new Date().toISOString(),
      }];
    }
  }

  addProfile(profile: Profile): Profile[] {
    const profiles = this.getProfiles();
    if (profiles.some((p) => p.id === profile.id)) return profiles;
    profiles.push(profile);
    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
    return profiles;
  }

  updateProfile(id: string, updates: Partial<Profile>): Profile[] {
    const profiles = this.getProfiles().map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
    return profiles;
  }

  deleteProfile(id: string): Profile[] {
    if (id === DEFAULT_PROFILE_ID) return this.getProfiles(); // can't delete default
    // Remove all profile data
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(`${key}_p_${id}`);
    });
    const profiles = this.getProfiles().filter((p) => p.id !== id);
    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(profiles));
    // Switch to default if active profile was deleted
    if (this.profileId === id) {
      this.setActiveProfile(DEFAULT_PROFILE_ID);
    }
    return profiles;
  }

  getActiveProfileId(): string {
    try {
      return localStorage.getItem(ACTIVE_PROFILE_KEY) || DEFAULT_PROFILE_ID;
    } catch {
      return DEFAULT_PROFILE_ID;
    }
  }

  setActiveProfile(profileId: string): void {
    this.profileId = profileId;
    localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  }

  getCurrentProfileId(): string {
    return this.profileId;
  }

  initProfile(): void {
    this.profileId = this.getActiveProfileId();
  }
  private getItem<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(this.getProfileKey(key));
      return data ? JSON.parse(data) : fallback;
    } catch {
      console.error(`Failed to read ${key} from storage`);
      return fallback;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.getProfileKey(key), JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to write ${key} to storage`, error);
    }
  }

  // Transactions
  getTransactions(): Transaction[] {
    return this.getItem<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
  }

  saveTransactions(transactions: Transaction[]): void {
    this.setItem(STORAGE_KEYS.TRANSACTIONS, transactions);
  }

  addTransaction(transaction: Transaction): Transaction[] {
    const transactions = this.getTransactions();
    transactions.push(transaction);
    this.saveTransactions(transactions);
    return transactions;
  }

  updateTransaction(id: string, updates: Partial<Transaction>): Transaction[] {
    const transactions = this.getTransactions().map((t) =>
      t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
    );
    this.saveTransactions(transactions);
    return transactions;
  }

  deleteTransaction(id: string): Transaction[] {
    const transactions = this.getTransactions().filter((t) => t.id !== id);
    this.saveTransactions(transactions);
    return transactions;
  }

  // Categories (custom ones)
  getCustomCategories(): Category[] {
    return this.getItem<Category[]>(STORAGE_KEYS.CATEGORIES, []);
  }

  getAllCategories(): Category[] {
    return [...ALL_CATEGORIES, ...this.getCustomCategories()];
  }

  addCustomCategory(category: Category): Category[] {
    const custom = this.getCustomCategories();
    if (custom.some((c) => c.id === category.id)) return this.getAllCategories();
    custom.push({ ...category, isCustom: true });
    this.setItem(STORAGE_KEYS.CATEGORIES, custom);
    return this.getAllCategories();
  }

  deleteCustomCategory(id: string): Category[] {
    const custom = this.getCustomCategories().filter((c) => c.id !== id);
    this.setItem(STORAGE_KEYS.CATEGORIES, custom);
    return this.getAllCategories();
  }

  updateCustomCategory(id: string, updates: Partial<Category>): Category[] {
    const custom = this.getCustomCategories().map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    this.setItem(STORAGE_KEYS.CATEGORIES, custom);
    return this.getAllCategories();
  }

  // Custom Institutions
  getCustomInstitutions(): Record<string, string[]> {
    return this.getItem<Record<string, string[]>>(STORAGE_KEYS.CUSTOM_INSTITUTIONS, {});
  }

  addCustomInstitution(accountType: string, name: string): Record<string, string[]> {
    const institutions = this.getCustomInstitutions();
    if (!institutions[accountType]) institutions[accountType] = [];
    if (!institutions[accountType].includes(name)) {
      institutions[accountType].push(name);
    }
    this.setItem(STORAGE_KEYS.CUSTOM_INSTITUTIONS, institutions);
    return institutions;
  }

  // Accounts
  getAccounts(): Account[] {
    return this.getItem<Account[]>(STORAGE_KEYS.ACCOUNTS, []);
  }

  saveAccounts(accounts: Account[]): void {
    this.setItem(STORAGE_KEYS.ACCOUNTS, accounts);
  }

  addAccount(account: Account): Account[] {
    const accounts = this.getAccounts();
    if (accounts.some((a) => a.id === account.id)) return accounts;
    accounts.push(account);
    this.saveAccounts(accounts);
    return accounts;
  }

  updateAccount(id: string, updates: Partial<Account>): Account[] {
    const accounts = this.getAccounts().map((a) =>
      a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
    );
    this.saveAccounts(accounts);
    return accounts;
  }

  deleteAccount(id: string): Account[] {
    const accounts = this.getAccounts().filter((a) => a.id !== id);
    this.saveAccounts(accounts);
    return accounts;
  }

  // Budgets
  getBudgets(): Budget[] {
    return this.getItem<Budget[]>(STORAGE_KEYS.BUDGETS, []);
  }

  saveBudgets(budgets: Budget[]): void {
    this.setItem(STORAGE_KEYS.BUDGETS, budgets);
  }

  setBudget(budget: Budget): Budget[] {
    const budgets = this.getBudgets();
    const existingIndex = budgets.findIndex(
      (b) => b.categoryId === budget.categoryId && b.month === budget.month
    );
    if (existingIndex >= 0) {
      budgets[existingIndex] = budget;
    } else {
      budgets.push(budget);
    }
    this.saveBudgets(budgets);
    return budgets;
  }

  // Settings
  getSettings(): Settings {
    const stored = this.getItem<Partial<Settings>>(STORAGE_KEYS.SETTINGS, {});
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  saveSettings(settings: Settings): void {
    this.setItem(STORAGE_KEYS.SETTINGS, settings);
  }

  updateSettings(updates: Partial<Settings>): Settings {
    const settings = { ...this.getSettings(), ...updates };
    this.saveSettings(settings);
    return settings;
  }

  // Data Export/Import
  exportData(): string {
    const data = {
      transactions: this.getTransactions(),
      categories: this.getCustomCategories(),
      budgets: this.getBudgets(),
      accounts: this.getAccounts(),
      settings: this.getSettings(),
      exportedAt: new Date().toISOString(),
      version: '1.1.0',
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data.version || !data.transactions) {
        throw new Error('Invalid data format');
      }
      this.saveTransactions(data.transactions);
      if (data.categories) this.setItem(STORAGE_KEYS.CATEGORIES, data.categories);
      if (data.budgets) this.saveBudgets(data.budgets);
      if (data.accounts) this.saveAccounts(data.accounts);
      if (data.settings) this.saveSettings(data.settings);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(this.getProfileKey(key)));
  }
}

export const storageService = new StorageService();
