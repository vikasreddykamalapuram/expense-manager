/**
 * Curated, commonly-wanted categories & subcategories offered during onboarding.
 *
 * The app's built-in defaults (ALL_CATEGORIES) are always present; these are
 * popular *additions* users often want. `parentId` (when set) attaches a
 * subcategory under a built-in parent. Adds are de-duped by name at insert time.
 */
export interface SuggestedCategory {
  key: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;   // lucide icon name
  color: string;
  parentId?: string; // built-in parent id if this is a subcategory
  defaultChecked?: boolean;
}

export const SUGGESTED_CATEGORIES: SuggestedCategory[] = [
  // Standalone popular expense categories
  { key: 'emi', name: 'EMI / Loan Payment', type: 'expense', icon: 'Landmark', color: '#6366f1', defaultChecked: true },
  { key: 'investments-out', name: 'Investments / SIP', type: 'expense', icon: 'TrendingUp', color: '#3b82f6', defaultChecked: true },
  { key: 'pets', name: 'Pets', type: 'expense', icon: 'PawPrint', color: '#f43f5e' },
  { key: 'childcare', name: 'Kids / Childcare', type: 'expense', icon: 'Baby', color: '#06b6d4' },
  { key: 'domestic-help', name: 'Domestic Help', type: 'expense', icon: 'Home', color: '#d946ef' },

  // Popular subscription subcategories (under built-in "subscriptions")
  { key: 'sub-netflix', name: 'Netflix', type: 'expense', icon: 'Tv', color: '#3b82f6', parentId: 'subscriptions', defaultChecked: true },
  { key: 'sub-prime', name: 'Amazon Prime', type: 'expense', icon: 'Tv', color: '#3b82f6', parentId: 'subscriptions', defaultChecked: true },
  { key: 'sub-spotify', name: 'Spotify', type: 'expense', icon: 'Music', color: '#3b82f6', parentId: 'subscriptions' },
  { key: 'sub-hotstar', name: 'Hotstar / JioCinema', type: 'expense', icon: 'Tv', color: '#3b82f6', parentId: 'subscriptions' },

  // Utility subcategory (under built-in "bills-utilities")
  { key: 'bills-dth', name: 'DTH / Cable TV', type: 'expense', icon: 'Tv', color: '#6366f1', parentId: 'bills-utilities' },

  // Income
  { key: 'income-cashback', name: 'Cashback & Rewards', type: 'income', icon: 'Gift', color: '#10b981' },
];
