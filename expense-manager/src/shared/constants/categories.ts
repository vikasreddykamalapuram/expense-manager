import { Category } from '../types';

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food-dining', name: 'Food & Dining', type: 'expense', icon: 'UtensilsCrossed', color: '#ef4444', isCustom: false },
  { id: 'groceries', name: 'Groceries', type: 'expense', icon: 'ShoppingCart', color: '#f97316', isCustom: false },
  { id: 'transportation', name: 'Transportation', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false },
  { id: 'shopping', name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#a855f7', isCustom: false },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', icon: 'Gamepad2', color: '#ec4899', isCustom: false },
  { id: 'bills-utilities', name: 'Bills & Utilities', type: 'expense', icon: 'Zap', color: '#6366f1', isCustom: false },
  { id: 'health', name: 'Health & Medical', type: 'expense', icon: 'Heart', color: '#14b8a6', isCustom: false },
  { id: 'education', name: 'Education', type: 'expense', icon: 'GraduationCap', color: '#06b6d4', isCustom: false },
  { id: 'travel', name: 'Travel', type: 'expense', icon: 'Plane', color: '#8b5cf6', isCustom: false },
  { id: 'rent-mortgage', name: 'Rent / Mortgage', type: 'expense', icon: 'Home', color: '#d946ef', isCustom: false },
  { id: 'insurance', name: 'Insurance', type: 'expense', icon: 'Shield', color: '#0ea5e9', isCustom: false },
  { id: 'personal-care', name: 'Personal Care', type: 'expense', icon: 'Sparkles', color: '#f43f5e', isCustom: false },
  { id: 'gifts-donations', name: 'Gifts & Donations', type: 'expense', icon: 'Gift', color: '#10b981', isCustom: false },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', icon: 'CreditCard', color: '#3b82f6', isCustom: false },
  { id: 'other-expense', name: 'Other', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', isCustom: false },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: 'Salary', type: 'income', icon: 'Briefcase', color: '#22c55e', isCustom: false },
  { id: 'freelance', name: 'Freelance', type: 'income', icon: 'Laptop', color: '#14b8a6', isCustom: false },
  { id: 'investments', name: 'Investments', type: 'income', icon: 'TrendingUp', color: '#3b82f6', isCustom: false },
  { id: 'rental-income', name: 'Rental Income', type: 'income', icon: 'Building2', color: '#8b5cf6', isCustom: false },
  { id: 'business', name: 'Business', type: 'income', icon: 'Store', color: '#f59e0b', isCustom: false },
  { id: 'side-hustle', name: 'Side Hustle', type: 'income', icon: 'Rocket', color: '#ec4899', isCustom: false },
  { id: 'gifts-received', name: 'Gifts Received', type: 'income', icon: 'Gift', color: '#10b981', isCustom: false },
  { id: 'refunds', name: 'Refunds', type: 'income', icon: 'RotateCcw', color: '#06b6d4', isCustom: false },
  { id: 'interest', name: 'Interest', type: 'income', icon: 'Percent', color: '#6366f1', isCustom: false },
  { id: 'other-income', name: 'Other', type: 'income', icon: 'MoreHorizontal', color: '#64748b', isCustom: false },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const getCategoryById = (id: string): Category | undefined =>
  ALL_CATEGORIES.find((c) => c.id === id);

export const getCategoriesByType = (type: 'income' | 'expense'): Category[] =>
  ALL_CATEGORIES.filter((c) => c.type === type);

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

export const DEFAULT_SETTINGS = {
  currency: 'INR',
  currencySymbol: '₹',
  dateFormat: 'DD/MM/YYYY',
  theme: 'light' as const,
  defaultView: 'dashboard' as const,
};

export const STORAGE_KEYS = {
  TRANSACTIONS: 'em_transactions',
  CATEGORIES: 'em_categories',
  BUDGETS: 'em_budgets',
  SETTINGS: 'em_settings',
  ACCOUNTS: 'em_accounts',
  CUSTOM_INSTITUTIONS: 'em_custom_institutions',
};

export const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
  '#d946ef', '#0ea5e9', '#10b981', '#a855f7', '#64748b',
];

/** Icon names available for custom categories (Lucide icons) */
export const CATEGORY_ICON_OPTIONS = [
  'UtensilsCrossed', 'ShoppingCart', 'Car', 'ShoppingBag', 'Gamepad2',
  'Zap', 'Heart', 'GraduationCap', 'Plane', 'Home',
  'Shield', 'Sparkles', 'Gift', 'CreditCard', 'MoreHorizontal',
  'Briefcase', 'Laptop', 'TrendingUp', 'Building2', 'Store',
  'Rocket', 'RotateCcw', 'Percent', 'Smartphone', 'Banknote',
  'Package', 'Coffee', 'Music', 'Film', 'Dumbbell',
  'PawPrint', 'Baby', 'Wrench', 'Scissors', 'Palette',
  'BookOpen', 'Stethoscope', 'Pill', 'Globe', 'Wifi',
  'Phone', 'Tv', 'Camera', 'Headphones', 'Wallet',
  'Gem', 'Crown', 'Trees', 'Flower2', 'Sun',
];

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#d946ef', '#ec4899', '#f43f5e', '#0ea5e9', '#10b981',
  '#f59e0b', '#0d9488', '#be185d', '#4f46e5', '#64748b',
];
