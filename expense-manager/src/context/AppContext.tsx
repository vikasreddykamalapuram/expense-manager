import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Transaction, TransactionFilters, Settings, Budget, Category, Account, Profile } from '../shared/types';
import { repository } from '../shared/services/repository';
import { migrateFromLocalStorage, getActiveProfileIdFromLS } from '../shared/services/migration';
import { DEFAULT_SETTINGS } from '../shared/constants/categories';

// State
interface AppState {
  transactions: Transaction[];
  settings: Settings;
  budgets: Budget[];
  categories: Category[];
  accounts: Account[];
  filters: TransactionFilters;
  profiles: Profile[];
  activeProfileId: string;
  isLoading: boolean;
}

// Pure reducer actions — no side effects
type AppAction =
  | { type: 'LOAD_PROFILE_DATA'; payload: { profileId: string; transactions: Transaction[]; settings: Settings; budgets: Budget[]; categories: Category[]; accounts: Account[] } }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: { id: string; updates: Partial<Transaction> } }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Settings }
  | { type: 'SET_BUDGETS'; payload: Budget[] }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_FILTERS'; payload: Partial<TransactionFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SET_PROFILES'; payload: Profile[] };

const initialFilters: TransactionFilters = {
  sortBy: 'date',
  sortOrder: 'desc',
};

const initialState: AppState = {
  transactions: [],
  settings: DEFAULT_SETTINGS,
  budgets: [],
  categories: [],
  accounts: [],
  profiles: [],
  activeProfileId: 'default',
  filters: initialFilters,
  isLoading: true,
};

// Pure reducer — no persistence side effects
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_PROFILE_DATA':
      return {
        ...state,
        activeProfileId: action.payload.profileId,
        transactions: action.payload.transactions,
        settings: action.payload.settings,
        budgets: action.payload.budgets,
        categories: action.payload.categories,
        accounts: action.payload.accounts,
        filters: initialFilters,
      };
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [...state.transactions, action.payload] };
    case 'UPDATE_TRANSACTION': {
      const updated = state.transactions.map((t) =>
        t.id === action.payload.id
          ? { ...t, ...action.payload.updates, updatedAt: new Date().toISOString() }
          : t
      );
      return { ...state, transactions: updated };
    }
    case 'DELETE_TRANSACTION':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload) };
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'SET_BUDGETS':
      return { ...state, budgets: action.payload };
    case 'ADD_BUDGET': {
      const budgets = [...state.budgets];
      const idx = budgets.findIndex(
        (b) => b.categoryId === action.payload.categoryId && b.month === action.payload.month
      );
      if (idx >= 0) budgets[idx] = action.payload;
      else budgets.push(action.payload);
      return { ...state, budgets };
    }
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'RESET_FILTERS':
      return { ...state, filters: initialFilters };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload };
    case 'SET_PROFILES':
      return { ...state, profiles: action.payload };
    default:
      return state;
  }
}

// ─── Action Creators (async, persist-then-dispatch) ──────

export interface AppActions {
  addTransaction: (tx: Transaction) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setBudget: (budget: Budget) => Promise<void>;
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addAccount: (account: Account) => Promise<void>;
  updateAccount: (id: string, updates: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addProfile: (profile: Profile) => Promise<void>;
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  importData: (jsonString: string) => Promise<boolean>;
  exportData: () => Promise<string>;
  clearAllData: () => Promise<void>;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  // Bulk operations for CSV import
  saveTransactions: (transactions: Transaction[]) => Promise<void>;
  saveAccounts: (accounts: Account[]) => Promise<void>;
  saveCustomCategories: (categories: Category[]) => Promise<void>;
  addCustomInstitution: (accountType: string, name: string) => Promise<Record<string, string[]>>;
  getCustomInstitutions: () => Promise<Record<string, string[]>>;
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: AppActions;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const profileIdRef = useRef('default');

  // Keep ref in sync
  useEffect(() => {
    profileIdRef.current = state.activeProfileId;
  }, [state.activeProfileId]);

  // Initialize: migrate from localStorage → load from IndexedDB
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        // Run migration (idempotent — safe if called twice in StrictMode)
        await migrateFromLocalStorage();

        if (cancelled) return;

        // Determine active profile
        const activeProfileId = getActiveProfileIdFromLS();
        profileIdRef.current = activeProfileId;

        // Load data
        const [profiles, profileData] = await Promise.all([
          repository.getProfiles(),
          repository.loadProfileData(activeProfileId),
        ]);

        if (cancelled) return;

        dispatch({ type: 'SET_PROFILES', payload: profiles });
        dispatch({
          type: 'LOAD_PROFILE_DATA',
          payload: { profileId: activeProfileId, ...profileData },
        });
        dispatch({ type: 'SET_LOADING', payload: false });
      } catch (error) {
        console.error('Failed to initialize app:', error);
        if (!cancelled) dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // ─── Action creators ─────────────────────────────────

  const actions: AppActions = {
    addTransaction: useCallback(async (tx: Transaction) => {
      await repository.addTransaction(profileIdRef.current, tx);
      dispatch({ type: 'ADD_TRANSACTION', payload: tx });
    }, []),

    updateTransaction: useCallback(async (id: string, updates: Partial<Transaction>) => {
      await repository.updateTransaction(profileIdRef.current, id, updates);
      dispatch({ type: 'UPDATE_TRANSACTION', payload: { id, updates } });
    }, []),

    deleteTransaction: useCallback(async (id: string) => {
      await repository.deleteTransaction(id);
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }, []),

    updateSettings: useCallback(async (updates: Partial<Settings>) => {
      const current = profileIdRef.current;
      const existing = await repository.getSettings(current);
      const newSettings = { ...existing, ...updates };
      await repository.saveSettings(current, newSettings);
      dispatch({ type: 'SET_SETTINGS', payload: newSettings });
    }, []),

    setBudget: useCallback(async (budget: Budget) => {
      await repository.setBudget(profileIdRef.current, budget);
      dispatch({ type: 'ADD_BUDGET', payload: budget });
    }, []),

    addCategory: useCallback(async (category: Category) => {
      const cats = await repository.addCustomCategory(profileIdRef.current, category);
      dispatch({ type: 'SET_CATEGORIES', payload: cats });
    }, []),

    updateCategory: useCallback(async (id: string, updates: Partial<Category>) => {
      const cats = await repository.updateCustomCategory(profileIdRef.current, id, updates);
      dispatch({ type: 'SET_CATEGORIES', payload: cats });
    }, []),

    deleteCategory: useCallback(async (id: string) => {
      const cats = await repository.deleteCustomCategory(profileIdRef.current, id);
      dispatch({ type: 'SET_CATEGORIES', payload: cats });
    }, []),

    addAccount: useCallback(async (account: Account) => {
      await repository.addAccount(profileIdRef.current, account);
      const accounts = await repository.getAccounts(profileIdRef.current);
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
    }, []),

    updateAccount: useCallback(async (id: string, updates: Partial<Account>) => {
      await repository.updateAccount(id, updates);
      const accounts = await repository.getAccounts(profileIdRef.current);
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
    }, []),

    deleteAccount: useCallback(async (id: string) => {
      await repository.deleteAccount(id);
      const accounts = await repository.getAccounts(profileIdRef.current);
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
    }, []),

    addProfile: useCallback(async (profile: Profile) => {
      await repository.addProfile(profile);
      const profiles = await repository.getProfiles();
      dispatch({ type: 'SET_PROFILES', payload: profiles });
    }, []),

    updateProfile: useCallback(async (id: string, updates: Partial<Profile>) => {
      await repository.updateProfile(id, updates);
      const profiles = await repository.getProfiles();
      dispatch({ type: 'SET_PROFILES', payload: profiles });
    }, []),

    deleteProfile: useCallback(async (id: string) => {
      await repository.deleteProfile(id);
      const profiles = await repository.getProfiles();
      dispatch({ type: 'SET_PROFILES', payload: profiles });
      // Switch to default if active profile was deleted
      if (profileIdRef.current === id) {
        const data = await repository.loadProfileData('default');
        profileIdRef.current = 'default';
        localStorage.setItem('em_active_profile', 'default');
        dispatch({ type: 'LOAD_PROFILE_DATA', payload: { profileId: 'default', ...data } });
      }
    }, []),

    switchProfile: useCallback(async (profileId: string) => {
      profileIdRef.current = profileId;
      localStorage.setItem('em_active_profile', profileId);
      const [data, profiles] = await Promise.all([
        repository.loadProfileData(profileId),
        repository.getProfiles(),
      ]);
      dispatch({ type: 'SET_PROFILES', payload: profiles });
      dispatch({ type: 'LOAD_PROFILE_DATA', payload: { profileId, ...data } });
    }, []),

    importData: useCallback(async (jsonString: string) => {
      const success = await repository.importData(profileIdRef.current, jsonString);
      if (success) {
        const data = await repository.loadProfileData(profileIdRef.current);
        dispatch({
          type: 'LOAD_PROFILE_DATA',
          payload: { profileId: profileIdRef.current, ...data },
        });
      }
      return success;
    }, []),

    exportData: useCallback(async () => {
      return repository.exportData(profileIdRef.current);
    }, []),

    clearAllData: useCallback(async () => {
      await repository.clearAllData(profileIdRef.current);
      const data = await repository.loadProfileData(profileIdRef.current);
      dispatch({ type: 'LOAD_PROFILE_DATA', payload: { profileId: profileIdRef.current, ...data } });
    }, []),

    setFilters: useCallback((filters: Partial<TransactionFilters>) => {
      dispatch({ type: 'SET_FILTERS', payload: filters });
    }, []),

    resetFilters: useCallback(() => {
      dispatch({ type: 'RESET_FILTERS' });
    }, []),

    // Bulk operations
    saveTransactions: useCallback(async (transactions: Transaction[]) => {
      await repository.saveTransactions(profileIdRef.current, transactions);
      dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
    }, []),

    saveAccounts: useCallback(async (accounts: Account[]) => {
      await repository.saveAccounts(profileIdRef.current, accounts);
      dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
    }, []),

    saveCustomCategories: useCallback(async (categories: Category[]) => {
      await repository.saveCustomCategories(profileIdRef.current, categories);
      const allCats = await repository.getAllCategories(profileIdRef.current);
      dispatch({ type: 'SET_CATEGORIES', payload: allCats });
    }, []),

    addCustomInstitution: useCallback(async (accountType: string, name: string) => {
      return repository.addCustomInstitution(profileIdRef.current, accountType, name);
    }, []),

    getCustomInstitutions: useCallback(async () => {
      return repository.getCustomInstitutions(profileIdRef.current);
    }, []),
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
