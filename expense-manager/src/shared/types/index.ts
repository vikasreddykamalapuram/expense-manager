export type AccountType = 'bank' | 'credit_card' | 'loan' | 'wallet' | 'cash';
export type AccountKind = 'asset' | 'liability';
export type BankSubtype = 'savings' | 'current' | 'salary' | 'fd' | 'rd';
export type LoanSubtype = 'home' | 'personal' | 'car' | 'education' | 'gold' | 'business' | 'other';
export type PaymentMethod = 'upi' | 'cash' | 'card' | 'net_banking' | 'cheque' | 'auto_debit' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  kind: AccountKind;
  subtype?: BankSubtype | LoanSubtype;
  institution?: string;
  openingBalance: number; // starting balance; for liabilities = initial amount owed (positive)
  color: string;
  icon: string;
  creditLimit?: number; // credit cards only
  interestRate?: number; // loans / credit cards
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  categoryId: string;
  date: string; // ISO date string YYYY-MM-DD
  notes: string;
  accountId?: string; // source (expense/transfer) or destination (income)
  toAccountId?: string; // destination for transfers only
  paymentMethod?: PaymentMethod;
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
  color: string; // hex color
  isCustom: boolean;
  parentId?: string; // if set, this is a subcategory
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
  theme: 'light' | 'dark' | 'system';
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
  type: 'income' | 'expense'; // transaction type this stat belongs to
}

export interface DateRange {
  start: string;
  end: string;
}

export interface TransactionFilters {
  type?: 'income' | 'expense' | 'transfer';
  categoryId?: string;
  accountId?: string;
  dateRange?: DateRange;
  searchQuery?: string;
  sortBy: 'date' | 'amount' | 'category';
  sortOrder: 'asc' | 'desc';
}

export interface Profile {
  id: string;
  name: string;
  icon: string; // emoji or short label
  createdAt: string;
}

export type AuthProvider = 'google' | 'microsoft';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
}
