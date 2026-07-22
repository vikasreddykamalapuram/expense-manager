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
  isDeleted?: boolean;
  deletedAt?: string;
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
  receiptId?: string; // references a receipt in the receipts store
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string; // lucide icon name
  color: string; // hex color
  isCustom: boolean;
  parentId?: string; // if set, this is a subcategory
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: string; // YYYY-MM format
  createdAt: string;
  updatedAt?: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export type AccentColor = 'blue' | 'magenta' | 'teal' | 'pink' | 'purple' | 'emerald' | 'orange' | 'rose' | 'amber' | 'cyan';
export type DarkMode = 'default' | 'black';

export interface Settings {
  currency: string;
  currencySymbol: string;
  dateFormat: string;
  theme: 'light' | 'dark' | 'system';
  defaultView: 'dashboard' | 'transactions';
  accentColor: AccentColor;
  darkMode: DarkMode;
  updatedAt?: string;
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

export interface RecurringRule {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  accountId?: string;
  paymentMethod?: PaymentMethod;
  notes: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string; // YYYY-MM-DD
  endDate?: string; // optional end date
  nextDueDate: string; // YYYY-MM-DD
  lastGeneratedDate?: string; // last time a transaction was auto-created
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

// ─── Stock/Trading Types ────────────────────────────────

export type StockExchange = 'NSE' | 'BSE' | 'MCX' | 'OTHER';
export type TradeType = 'buy' | 'sell' | 'dividend' | 'bonus' | 'split' | 'ipo';
export type AssetClass = 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'other';

export interface StockTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  symbol: string; // e.g., RELIANCE, INFY, TATAMOTORS
  name: string; // full company/fund name
  exchange: StockExchange;
  assetClass: AssetClass;
  type: TradeType;
  quantity: number;
  price: number; // per unit price
  totalValue: number; // quantity × price
  charges: TradeCharges;
  broker: string; // broker name
  notes: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface TradeCharges {
  brokerage: number;
  stt: number; // Securities Transaction Tax
  gst: number;
  stampDuty: number;
  exchangeCharges: number;
  sebiCharges: number;
  otherCharges: number;
  total: number; // sum of all
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  exchange: StockExchange;
  assetClass: AssetClass;
  quantity: number;
  avgBuyPrice: number;
  totalInvested: number;
  totalCharges: number;
  broker: string;
  // Live price fields (populated when prices available)
  currentPrice?: number;
  currentValue?: number;
  unrealizedPL?: number;
  unrealizedPLPercent?: number;
  dayChange?: number;
  dayChangePercent?: number;
  priceLastUpdated?: string;
}

// ─── Bill Reminder Types ────────────────────────────────
export type BillCategory = 'utility' | 'credit_card' | 'loan_emi' | 'insurance' | 'subscription' | 'rent' | 'other';
export type BillFrequency = 'monthly' | 'quarterly' | 'yearly' | 'one_time';

export interface BillReminder {
  id: string;
  name: string;
  amount: number;
  category: BillCategory;
  dueDate: number; // day of month (1-31)
  frequency: BillFrequency;
  accountId?: string;
  isAutoPay: boolean;
  reminderDays: number[];
  isActive: boolean;
  lastPaidDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

// ─── Splitwise / Group Expense Types ────────────────────

export type SplitType = 'equal' | 'percentage' | 'exact' | 'shares';

export interface SplitMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarColor: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SplitGroup {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  category?: string; // trip, flat, office, couple, other
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SplitShare {
  memberId: string;
  amount: number; // computed final amount this member owes
}

export interface SplitExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string; // member ID who paid
  splitType: SplitType;
  splits: SplitShare[];
  category?: string;
  date: string; // ISO date string YYYY-MM-DD
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface SplitSettlement {
  id: string;
  groupId: string;
  fromMemberId: string; // who paid
  toMemberId: string; // who received
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  balance: number; // positive = owed money, negative = owes money
}

export interface DebtEdge {
  from: string; // member ID who owes
  to: string; // member ID who is owed
  amount: number;
}

export type AuthProvider = 'google' | 'microsoft';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
}

// ─── Sync Types ─────────────────────────────────────────

export type SyncState = 'disabled' | 'idle' | 'syncing' | 'error';

export interface SyncManifest {
  devices: Record<string, SyncDeviceInfo>;
  lastFullSnapshot?: string; // ISO timestamp
  schemaVersion: number;
}

export interface SyncDeviceInfo {
  deviceId: string;
  deviceName: string;
  lastSyncAt: string; // ISO timestamp
  lastPushAt?: string;
}

export interface SyncDelta {
  deviceId: string;
  timestamp: string; // ISO timestamp
  profileId: string;
  tables: {
    transactions?: SyncTableDelta<Transaction>;
    categories?: SyncTableDelta<Category>;
    accounts?: SyncTableDelta<Account>;
    budgets?: SyncTableDelta<Budget>;
    recurringRules?: SyncTableDelta<RecurringRule>;
    stockTransactions?: SyncTableDelta<StockTransaction>;
    billReminders?: SyncTableDelta<BillReminder>;
    settings?: Settings;
    customInstitutions?: Record<string, string[]>;
  };
}

export interface SyncTableDelta<T> {
  upserted: T[];
  deleted: string[]; // IDs of deleted records
}

export interface SyncStatus {
  state: SyncState;
  lastSyncAt?: string;
  lastError?: string;
  pendingChanges: number;
  provider?: AuthProvider;
}
