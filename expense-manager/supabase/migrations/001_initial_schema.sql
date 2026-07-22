-- ExpenseIQ — Supabase Database Migration
-- Version: 001 — Initial schema (mirrors Dexie IndexedDB v6)
--
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run
--
-- All tables use Row Level Security (RLS) so users can only access their own data.
-- The user_id column links to Supabase Auth (auth.uid()).

-- ─── Helper: updated_at trigger ─────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── Profiles ───────────────────────────────────────────

create table profiles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '💰',
  created_at timestamptz not null default now(),

  unique(user_id, id)
);

alter table profiles enable row level security;

create policy "Users can manage their own profiles"
  on profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Accounts ───────────────────────────────────────────

create table accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  type text not null check (type in ('bank', 'credit_card', 'loan', 'wallet', 'cash')),
  kind text not null check (kind in ('asset', 'liability')),
  subtype text,
  institution text,
  opening_balance numeric not null default 0,
  color text not null,
  icon text not null,
  credit_limit numeric,
  interest_rate numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table accounts enable row level security;

create policy "Users can manage their own accounts"
  on accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_accounts_user_profile on accounts(user_id, profile_id);
create index idx_accounts_user_type on accounts(user_id, profile_id, type);
create index idx_accounts_updated on accounts(user_id, profile_id, updated_at);

create trigger accounts_updated_at
  before update on accounts
  for each row execute function update_updated_at();

-- ─── Categories ─────────────────────────────────────────

create table categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null,
  color text not null,
  is_custom boolean not null default true,
  parent_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table categories enable row level security;

create policy "Users can manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_categories_user_profile on categories(user_id, profile_id);
create index idx_categories_user_type on categories(user_id, profile_id, type);
create index idx_categories_updated on categories(user_id, profile_id, updated_at);

create trigger categories_updated_at
  before update on categories
  for each row execute function update_updated_at();

-- ─── Transactions ───────────────────────────────────────

create table transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  type text not null check (type in ('income', 'expense', 'transfer')),
  amount numeric not null,
  category_id text not null,
  date date not null,
  notes text not null default '',
  account_id text,
  to_account_id text,
  payment_method text check (payment_method in ('upi', 'cash', 'card', 'net_banking', 'cheque', 'auto_debit', 'other')),
  is_recurring boolean not null default false,
  recurring_frequency text check (recurring_frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  receipt_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table transactions enable row level security;

create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_transactions_user_profile on transactions(user_id, profile_id);
create index idx_transactions_user_date on transactions(user_id, profile_id, date);
create index idx_transactions_user_category on transactions(user_id, profile_id, category_id);
create index idx_transactions_user_account on transactions(user_id, profile_id, account_id);
create index idx_transactions_user_type on transactions(user_id, profile_id, type);
create index idx_transactions_updated on transactions(user_id, profile_id, updated_at);

create trigger transactions_updated_at
  before update on transactions
  for each row execute function update_updated_at();

-- ─── Budgets ────────────────────────────────────────────

create table budgets (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  category_id text not null,
  amount numeric not null,
  month text not null, -- YYYY-MM format
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz,

  unique(user_id, profile_id, category_id, month)
);

alter table budgets enable row level security;

create policy "Users can manage their own budgets"
  on budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_budgets_user_profile on budgets(user_id, profile_id);
create index idx_budgets_updated on budgets(user_id, profile_id, updated_at);

create trigger budgets_updated_at
  before update on budgets
  for each row execute function update_updated_at();

-- ─── Recurring Rules ────────────────────────────────────

create table recurring_rules (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric not null,
  category_id text not null,
  account_id text,
  payment_method text,
  notes text not null default '',
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  start_date date not null,
  end_date date,
  next_due_date date not null,
  last_generated_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table recurring_rules enable row level security;

create policy "Users can manage their own recurring rules"
  on recurring_rules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_recurring_user_profile on recurring_rules(user_id, profile_id);
create index idx_recurring_updated on recurring_rules(user_id, profile_id, updated_at);

create trigger recurring_rules_updated_at
  before update on recurring_rules
  for each row execute function update_updated_at();

-- ─── Stock Transactions ─────────────────────────────────

create table stock_transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  date date not null,
  symbol text not null,
  name text not null,
  exchange text not null check (exchange in ('NSE', 'BSE', 'MCX', 'OTHER')),
  asset_class text not null check (asset_class in ('equity', 'mutual_fund', 'etf', 'bond', 'gold', 'other')),
  type text not null check (type in ('buy', 'sell', 'dividend', 'bonus', 'split', 'ipo')),
  quantity numeric not null,
  price numeric not null,
  total_value numeric not null,
  -- Trade charges (stored as JSONB for flexibility)
  charges jsonb not null default '{"brokerage":0,"stt":0,"gst":0,"stampDuty":0,"exchangeCharges":0,"sebiCharges":0,"otherCharges":0,"total":0}',
  broker text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table stock_transactions enable row level security;

create policy "Users can manage their own stock transactions"
  on stock_transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_stocks_user_profile on stock_transactions(user_id, profile_id);
create index idx_stocks_user_date on stock_transactions(user_id, profile_id, date);
create index idx_stocks_user_symbol on stock_transactions(user_id, profile_id, symbol);
create index idx_stocks_updated on stock_transactions(user_id, profile_id, updated_at);

create trigger stock_transactions_updated_at
  before update on stock_transactions
  for each row execute function update_updated_at();

-- ─── Bill Reminders ─────────────────────────────────────

create table bill_reminders (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  amount numeric not null,
  category text not null check (category in ('utility', 'credit_card', 'loan_emi', 'insurance', 'subscription', 'rent', 'other')),
  due_date integer not null, -- day of month (1-31)
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly', 'one_time')),
  account_id text,
  is_auto_pay boolean not null default false,
  reminder_days integer[] not null default '{}',
  is_active boolean not null default true,
  last_paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table bill_reminders enable row level security;

create policy "Users can manage their own bill reminders"
  on bill_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_bills_user_profile on bill_reminders(user_id, profile_id);
create index idx_bills_updated on bill_reminders(user_id, profile_id, updated_at);

create trigger bill_reminders_updated_at
  before update on bill_reminders
  for each row execute function update_updated_at();

-- ─── Settings ───────────────────────────────────────────

create table user_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),

  primary key (user_id, profile_id)
);

alter table user_settings enable row level security;

create policy "Users can manage their own settings"
  on user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

-- ─── Custom Institutions ────────────────────────────────

create table custom_institutions (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),

  primary key (user_id, profile_id)
);

alter table custom_institutions enable row level security;

create policy "Users can manage their own custom institutions"
  on custom_institutions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Split Groups ───────────────────────────────────────

create table split_groups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  description text,
  member_ids text[] not null default '{}',
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table split_groups enable row level security;

create policy "Users can manage their own split groups"
  on split_groups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_split_groups_user on split_groups(user_id, profile_id);

create trigger split_groups_updated_at
  before update on split_groups
  for each row execute function update_updated_at();

-- ─── Split Members ──────────────────────────────────────

create table split_members (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  name text not null,
  phone text,
  email text,
  avatar_color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table split_members enable row level security;

create policy "Users can manage their own split members"
  on split_members for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_split_members_user on split_members(user_id, profile_id);

create trigger split_members_updated_at
  before update on split_members
  for each row execute function update_updated_at();

-- ─── Split Expenses ─────────────────────────────────────

create table split_expenses (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  group_id text not null,
  description text not null,
  amount numeric not null,
  paid_by text not null, -- member ID
  split_type text not null check (split_type in ('equal', 'percentage', 'exact', 'shares')),
  splits jsonb not null default '[]', -- array of {memberId, amount}
  category text,
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table split_expenses enable row level security;

create policy "Users can manage their own split expenses"
  on split_expenses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_split_expenses_user on split_expenses(user_id, profile_id);
create index idx_split_expenses_group on split_expenses(user_id, group_id);

create trigger split_expenses_updated_at
  before update on split_expenses
  for each row execute function update_updated_at();

-- ─── Split Settlements ──────────────────────────────────

create table split_settlements (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null,
  group_id text not null,
  from_member_id text not null,
  to_member_id text not null,
  amount numeric not null,
  date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false,
  deleted_at timestamptz
);

alter table split_settlements enable row level security;

create policy "Users can manage their own split settlements"
  on split_settlements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_split_settlements_user on split_settlements(user_id, profile_id);

create trigger split_settlements_updated_at
  before update on split_settlements
  for each row execute function update_updated_at();

-- ─── Sync Metadata ──────────────────────────────────────
-- Tracks device sync state for delta queries

create table sync_metadata (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text not null,
  last_sync_at timestamptz not null default now(),
  last_push_at timestamptz,

  primary key (user_id, device_id)
);

alter table sync_metadata enable row level security;

create policy "Users can manage their own sync metadata"
  on sync_metadata for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── Summary ────────────────────────────────────────────
-- Tables created: 14
-- All with RLS enabled + policies for user isolation
-- Auto-updating updated_at triggers on all mutable tables
-- Indexes for common query patterns (profile, date, updated_at)
