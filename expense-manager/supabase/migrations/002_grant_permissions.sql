-- Fix: Grant table permissions to authenticated users
-- Run this in Supabase SQL Editor after 001_initial_schema.sql

grant all on profiles to authenticated;
grant all on accounts to authenticated;
grant all on categories to authenticated;
grant all on transactions to authenticated;
grant all on budgets to authenticated;
grant all on recurring_rules to authenticated;
grant all on stock_transactions to authenticated;
grant all on bill_reminders to authenticated;
grant all on user_settings to authenticated;
grant all on custom_institutions to authenticated;
grant all on split_groups to authenticated;
grant all on split_members to authenticated;
grant all on split_expenses to authenticated;
grant all on split_settlements to authenticated;
grant all on sync_metadata to authenticated;
