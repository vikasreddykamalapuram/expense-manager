import { HoldingType } from '../types';

export type HoldingCategory = 'retirement' | 'investment' | 'other';

export interface HoldingTypeMeta {
  label: string;
  icon: string;       // lucide icon name
  color: string;
  category: HoldingCategory;
  /** Hint shown in the form. */
  hint?: string;
}

export const HOLDING_TYPE_META: Record<HoldingType, HoldingTypeMeta> = {
  epf: { label: 'EPF (Provident Fund)', icon: 'Landmark', color: '#0891b2', category: 'retirement', hint: 'Employees\u2019 Provident Fund balance' },
  ppf: { label: 'PPF', icon: 'PiggyBank', color: '#0d9488', category: 'retirement', hint: 'Public Provident Fund balance' },
  nps: { label: 'NPS', icon: 'ShieldCheck', color: '#4f46e5', category: 'retirement', hint: 'National Pension System corpus' },
  fd: { label: 'Fixed Deposit', icon: 'Landmark', color: '#2563eb', category: 'investment' },
  rd: { label: 'Recurring Deposit', icon: 'Repeat', color: '#3b82f6', category: 'investment' },
  mutual_fund: { label: 'Mutual Funds', icon: 'TrendingUp', color: '#7c3aed', category: 'investment' },
  stocks: { label: 'Stocks (external)', icon: 'LineChart', color: '#dc2626', category: 'investment', hint: 'Holdings not tracked in the portfolio' },
  gold: { label: 'Gold', icon: 'Coins', color: '#d97706', category: 'investment' },
  real_estate: { label: 'Real Estate', icon: 'Home', color: '#16a34a', category: 'investment' },
  insurance: { label: 'Insurance (cash value)', icon: 'Shield', color: '#0ea5e9', category: 'other' },
  other: { label: 'Other asset', icon: 'Wallet', color: '#64748b', category: 'other' },
};

export const HOLDING_TYPE_OPTIONS = Object.entries(HOLDING_TYPE_META).map(([value, m]) => ({
  value: value as HoldingType,
  label: m.label,
}));

export const HOLDING_CATEGORY_LABEL: Record<HoldingCategory, string> = {
  retirement: 'Retirement',
  investment: 'Investments',
  other: 'Other assets',
};
