import { Category, Settings } from '../types';

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
  { id: 'household', name: 'Home / Household', type: 'expense', icon: 'Home', color: '#d946ef', isCustom: false },
  { id: 'insurance', name: 'Insurance', type: 'expense', icon: 'Shield', color: '#0ea5e9', isCustom: false },
  { id: 'personal-care', name: 'Personal Care', type: 'expense', icon: 'Sparkles', color: '#f43f5e', isCustom: false },
  { id: 'gifts-donations', name: 'Gifts & Donations', type: 'expense', icon: 'Gift', color: '#10b981', isCustom: false },
  { id: 'subscriptions', name: 'Subscriptions', type: 'expense', icon: 'CreditCard', color: '#3b82f6', isCustom: false },
  { id: 'other-expense', name: 'Other', type: 'expense', icon: 'MoreHorizontal', color: '#64748b', isCustom: false },
];

/** Default subcategories for common expense parents */
export const EXPENSE_SUBCATEGORIES: Category[] = [
  // Food & Dining
  { id: 'food-restaurants', name: 'Restaurants', type: 'expense', icon: 'UtensilsCrossed', color: '#ef4444', isCustom: false, parentId: 'food-dining' },
  { id: 'food-takeaway', name: 'Takeaway / Delivery', type: 'expense', icon: 'Package', color: '#ef4444', isCustom: false, parentId: 'food-dining' },
  { id: 'food-coffee-snacks', name: 'Coffee & Snacks', type: 'expense', icon: 'Coffee', color: '#ef4444', isCustom: false, parentId: 'food-dining' },
  // Groceries
  { id: 'groceries-general', name: 'General Groceries', type: 'expense', icon: 'ShoppingCart', color: '#f97316', isCustom: false, parentId: 'groceries' },
  { id: 'groceries-fruits-veg', name: 'Fruits & Vegetables', type: 'expense', icon: 'Trees', color: '#f97316', isCustom: false, parentId: 'groceries' },
  { id: 'groceries-dairy', name: 'Dairy & Bakery', type: 'expense', icon: 'Package', color: '#f97316', isCustom: false, parentId: 'groceries' },
  // Transportation
  { id: 'transport-fuel', name: 'Fuel / Petrol', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-public', name: 'Public Transit / Metro', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-taxi', name: 'Taxi / Ride Share', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-parking', name: 'Parking & Tolls', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-flight', name: 'Flight', type: 'expense', icon: 'Plane', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-bus', name: 'Bus', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  { id: 'transport-train', name: 'Train', type: 'expense', icon: 'Car', color: '#eab308', isCustom: false, parentId: 'transportation' },
  // Shopping
  { id: 'shopping-clothing', name: 'Clothing & Fashion', type: 'expense', icon: 'ShoppingBag', color: '#a855f7', isCustom: false, parentId: 'shopping' },
  { id: 'shopping-electronics', name: 'Electronics & Gadgets', type: 'expense', icon: 'Smartphone', color: '#a855f7', isCustom: false, parentId: 'shopping' },
  { id: 'shopping-home-decor', name: 'Home & Decor', type: 'expense', icon: 'Home', color: '#a855f7', isCustom: false, parentId: 'shopping' },
  { id: 'shopping-online', name: 'Online Shopping', type: 'expense', icon: 'Globe', color: '#a855f7', isCustom: false, parentId: 'shopping' },
  // Bills & Utilities
  { id: 'bills-electricity', name: 'Electricity', type: 'expense', icon: 'Zap', color: '#6366f1', isCustom: false, parentId: 'bills-utilities' },
  { id: 'bills-water', name: 'Water', type: 'expense', icon: 'Zap', color: '#6366f1', isCustom: false, parentId: 'bills-utilities' },
  { id: 'bills-gas', name: 'Gas / Cooking', type: 'expense', icon: 'Zap', color: '#6366f1', isCustom: false, parentId: 'bills-utilities' },
  { id: 'bills-internet', name: 'Internet / Broadband', type: 'expense', icon: 'Wifi', color: '#6366f1', isCustom: false, parentId: 'bills-utilities' },
  { id: 'bills-phone', name: 'Phone / Mobile', type: 'expense', icon: 'Phone', color: '#6366f1', isCustom: false, parentId: 'bills-utilities' },
  // Health & Medical
  { id: 'health-doctor', name: 'Doctor / Consultation', type: 'expense', icon: 'Stethoscope', color: '#14b8a6', isCustom: false, parentId: 'health' },
  { id: 'health-medicine', name: 'Medicine / Pharmacy', type: 'expense', icon: 'Pill', color: '#14b8a6', isCustom: false, parentId: 'health' },
  { id: 'health-lab-tests', name: 'Lab Tests / Diagnostics', type: 'expense', icon: 'Heart', color: '#14b8a6', isCustom: false, parentId: 'health' },
  { id: 'health-hospital', name: 'Hospital', type: 'expense', icon: 'Heart', color: '#14b8a6', isCustom: false, parentId: 'health' },
  // Home / Household
  { id: 'household-rent', name: 'Rent', type: 'expense', icon: 'Home', color: '#d946ef', isCustom: false, parentId: 'household' },
  { id: 'household-maid', name: 'Maid / Help', type: 'expense', icon: 'Home', color: '#d946ef', isCustom: false, parentId: 'household' },
  { id: 'household-maintenance', name: 'Maintenance & Repairs', type: 'expense', icon: 'Wrench', color: '#d946ef', isCustom: false, parentId: 'household' },
  { id: 'household-furniture', name: 'Furniture', type: 'expense', icon: 'Home', color: '#d946ef', isCustom: false, parentId: 'household' },
  { id: 'household-groceries', name: 'Home Essentials', type: 'expense', icon: 'ShoppingCart', color: '#d946ef', isCustom: false, parentId: 'household' },
  // Entertainment
  { id: 'entertainment-movies', name: 'Movies / Cinema', type: 'expense', icon: 'Film', color: '#ec4899', isCustom: false, parentId: 'entertainment' },
  { id: 'entertainment-streaming', name: 'Streaming Services', type: 'expense', icon: 'Tv', color: '#ec4899', isCustom: false, parentId: 'entertainment' },
  { id: 'entertainment-events', name: 'Events & Concerts', type: 'expense', icon: 'Music', color: '#ec4899', isCustom: false, parentId: 'entertainment' },
  // Personal Care
  { id: 'personal-salon', name: 'Salon / Grooming', type: 'expense', icon: 'Scissors', color: '#f43f5e', isCustom: false, parentId: 'personal-care' },
  { id: 'personal-gym', name: 'Gym / Fitness', type: 'expense', icon: 'Dumbbell', color: '#f43f5e', isCustom: false, parentId: 'personal-care' },
  // Education
  { id: 'education-tuition', name: 'Tuition / Fees', type: 'expense', icon: 'GraduationCap', color: '#06b6d4', isCustom: false, parentId: 'education' },
  { id: 'education-books', name: 'Books & Materials', type: 'expense', icon: 'BookOpen', color: '#06b6d4', isCustom: false, parentId: 'education' },
  { id: 'education-courses', name: 'Online Courses', type: 'expense', icon: 'Laptop', color: '#06b6d4', isCustom: false, parentId: 'education' },
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

/** Default subcategories for common income parents */
export const INCOME_SUBCATEGORIES: Category[] = [
  { id: 'salary-base', name: 'Base Pay', type: 'income', icon: 'Briefcase', color: '#22c55e', isCustom: false, parentId: 'salary' },
  { id: 'salary-bonus', name: 'Bonus', type: 'income', icon: 'Gem', color: '#22c55e', isCustom: false, parentId: 'salary' },
  { id: 'salary-reimbursement', name: 'Reimbursement', type: 'income', icon: 'RotateCcw', color: '#22c55e', isCustom: false, parentId: 'salary' },
  { id: 'investments-dividends', name: 'Dividends', type: 'income', icon: 'TrendingUp', color: '#3b82f6', isCustom: false, parentId: 'investments' },
  { id: 'investments-capital-gains', name: 'Capital Gains', type: 'income', icon: 'TrendingUp', color: '#3b82f6', isCustom: false, parentId: 'investments' },
  { id: 'investments-interest', name: 'Interest Income', type: 'income', icon: 'Percent', color: '#3b82f6', isCustom: false, parentId: 'investments' },
];

export const ALL_CATEGORIES: Category[] = [
  ...EXPENSE_CATEGORIES, ...EXPENSE_SUBCATEGORIES,
  ...INCOME_CATEGORIES, ...INCOME_SUBCATEGORIES,
];

/** Get a built-in category by ID (does NOT include custom categories — use state.categories for that) */
export const getCategoryById = (id: string): Category | undefined =>
  ALL_CATEGORIES.find((c) => c.id === id);

/** Get top-level (parent) built-in categories by type */
export const getParentCategoriesByType = (type: 'income' | 'expense'): Category[] =>
  ALL_CATEGORIES.filter((c) => c.type === type && !c.parentId);

/** Get subcategories for a parent */
export const getSubcategories = (parentId: string): Category[] =>
  ALL_CATEGORIES.filter((c) => c.parentId === parentId);

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

export const DEFAULT_SETTINGS: Settings = {
  currency: 'INR',
  currencySymbol: '₹',
  dateFormat: 'DD/MM/YYYY',
  theme: 'system',
  defaultView: 'dashboard',
  accentColor: 'blue',
  darkMode: 'default',
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
