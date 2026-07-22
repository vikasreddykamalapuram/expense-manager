-- Migration 003: Enable Supabase Realtime on synced tables
-- This adds tables to the supabase_realtime publication so that
-- INSERT/UPDATE/DELETE events are broadcast to connected clients.
--
-- Run in Supabase SQL Editor:
--   Dashboard → SQL Editor → New query → paste & run

-- Enable realtime for all synced tables
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE recurring_rules;
ALTER PUBLICATION supabase_realtime ADD TABLE stock_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE bill_reminders;

-- Verify: check which tables are in the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';
