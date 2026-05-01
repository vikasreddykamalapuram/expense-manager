import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Transaction, TransactionFilters, Settings, Budget, Category } from '../shared/types';
import { storageService } from '../shared/services/storageService';
import { DEFAULT_SETTINGS } from '../shared/constants/categories';

// State
interface AppState {
  transactions: Transaction[];
  settings: Settings;
  budgets: Budget[];
  categories: Category[];
  filters: TransactionFilters;
  isLoading: boolean;
}

// Actions
type AppAction =
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: { id: string; updates: Partial<Transaction> } }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SET_SETTINGS'; payload: Settings }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> }
  | { type: 'SET_BUDGETS'; payload: Budget[] }
  | { type: 'SET_BUDGET'; payload: Budget }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'SET_FILTERS'; payload: Partial<TransactionFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'IMPORT_DATA'; payload: { transactions: Transaction[]; settings: Settings; budgets: Budget[]; categories: Category[] } };

const initialFilters: TransactionFilters = {
  sortBy: 'date',
  sortOrder: 'desc',
};

const initialState: AppState = {
  transactions: [],
  settings: DEFAULT_SETTINGS,
  budgets: [],
  categories: [],
  filters: initialFilters,
  isLoading: true,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    case 'ADD_TRANSACTION': {
      const newTransactions = [...state.transactions, action.payload];
      storageService.saveTransactions(newTransactions);
      return { ...state, transactions: newTransactions };
    }
    case 'UPDATE_TRANSACTION': {
      const updated = state.transactions.map((t) =>
        t.id === action.payload.id
          ? { ...t, ...action.payload.updates, updatedAt: new Date().toISOString() }
          : t
      );
      storageService.saveTransactions(updated);
      return { ...state, transactions: updated };
    }
    case 'DELETE_TRANSACTION': {
      const filtered = state.transactions.filter((t) => t.id !== action.payload);
      storageService.saveTransactions(filtered);
      return { ...state, transactions: filtered };
    }
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    case 'UPDATE_SETTINGS': {
      const newSettings = { ...state.settings, ...action.payload };
      storageService.saveSettings(newSettings);
      return { ...state, settings: newSettings };
    }
    case 'SET_BUDGETS':
      return { ...state, budgets: action.payload };
    case 'SET_BUDGET': {
      const budgets = [...state.budgets];
      const idx = budgets.findIndex(
        (b) => b.categoryId === action.payload.categoryId && b.month === action.payload.month
      );
      if (idx >= 0) budgets[idx] = action.payload;
      else budgets.push(action.payload);
      storageService.saveBudgets(budgets);
      return { ...state, budgets };
    }
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'ADD_CATEGORY': {
      const cats = storageService.addCustomCategory(action.payload);
      return { ...state, categories: cats };
    }
    case 'DELETE_CATEGORY': {
      const cats = storageService.deleteCustomCategory(action.payload);
      return { ...state, categories: cats };
    }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'RESET_FILTERS':
      return { ...state, filters: initialFilters };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'IMPORT_DATA':
      return {
        ...state,
        transactions: action.payload.transactions,
        settings: action.payload.settings,
        budgets: action.payload.budgets,
        categories: action.payload.categories,
      };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    const transactions = storageService.getTransactions();
    const settings = storageService.getSettings();
    const budgets = storageService.getBudgets();
    const categories = storageService.getAllCategories();

    dispatch({ type: 'SET_TRANSACTIONS', payload: transactions });
    dispatch({ type: 'SET_SETTINGS', payload: settings });
    dispatch({ type: 'SET_BUDGETS', payload: budgets });
    dispatch({ type: 'SET_CATEGORIES', payload: categories });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
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
