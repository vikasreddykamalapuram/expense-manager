export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  date: string; // ISO date string YYYY-MM-DD
  notes: string;
  isRecurring: boolean;
  recurringFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string; // lucide icon name
  color: string; // tailwind color class
  isCustom: boolean;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM format
  createdAt: string;
}

export interface Settings {
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  theme: 'light' | 'dark';
  defaultView: 'dashboard' | 'transactions';
}

export interface MonthlyStats {
  month: string;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  byCategory: CategoryStat[];
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  color: string;
  count: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface TransactionFilters {
  type?: 'income' | 'expense';
  categoryId?: string;
  dateRange?: DateRange;
  searchQuery?: string;
  sortBy: 'date' | 'amount' | 'category';
  sortOrder: 'asc' | 'desc';
}
