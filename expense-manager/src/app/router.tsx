import { Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { Layout } from '../shared/components/Layout';
import { Dashboard } from '../features/dashboard/components/Dashboard';
import { RouteErrorFallback } from '../shared/components/RouteErrorFallback';
import { lazyWithRetry } from '../shared/utils/lazyWithRetry';

// Lazy-loaded routes — lazyWithRetry auto-reloads once when a stale service
// worker serves an index.html referencing chunk hashes that no longer exist
// (typical after a deploy). If the retry also fails, RouteErrorFallback
// surfaces a manual "Reload app" button.
const LoginPage = lazyWithRetry(() => import('../features/auth/components/LoginPage').then(m => ({ default: m.LoginPage })));
const TransactionsPage = lazyWithRetry(() => import('../features/transactions/components/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const AddTransactionPage = lazyWithRetry(() => import('../features/transactions/components/AddTransactionPage').then(m => ({ default: m.AddTransactionPage })));
const AnalyticsView = lazyWithRetry(() => import('../features/analytics/components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const AccountsPage = lazyWithRetry(() => import('../features/accounts/components/AccountsPage').then(m => ({ default: m.AccountsPage })));
const CategoriesPage = lazyWithRetry(() => import('../features/categories/components/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const SettingsPage = lazyWithRetry(() => import('../features/settings/components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const SecuritySettingsPage = lazyWithRetry(() => import('../features/settings/components/SecuritySettingsPage').then(m => ({ default: m.SecuritySettingsPage })));
const BudgetsPage = lazyWithRetry(() => import('../features/budgets/components/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const MonthlyReport = lazyWithRetry(() => import('../features/reports/components/MonthlyReport').then(m => ({ default: m.MonthlyReport })));
const StatementImportPage = lazyWithRetry(() => import('../features/import/components/StatementImportPage').then(m => ({ default: m.StatementImportPage })));
const RecurringPage = lazyWithRetry(() => import('../features/recurring/components/RecurringPage').then(m => ({ default: m.RecurringPage })));
const BillRemindersPage = lazyWithRetry(() => import('../features/reminders/components/BillRemindersPage').then(m => ({ default: m.BillRemindersPage })));
const HealthScorePage = lazyWithRetry(() => import('../features/health/components/HealthScorePage').then(m => ({ default: m.HealthScorePage })));
const PortfolioPage = lazyWithRetry(() => import('../features/stocks/components/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const PortfolioAnalytics = lazyWithRetry(() => import('../features/stocks/components/PortfolioAnalytics').then(m => ({ default: m.PortfolioAnalytics })));
const TradeHistoryPage = lazyWithRetry(() => import('../features/stocks/components/TradeHistoryPage').then(m => ({ default: m.TradeHistoryPage })));
const TradeImportPage = lazyWithRetry(() => import('../features/stocks/components/TradeImportPage').then(m => ({ default: m.TradeImportPage })));
const StockDetailPage = lazyWithRetry(() => import('../features/stocks/components/StockDetailPage').then(m => ({ default: m.StockDetailPage })));
const SplitwisePage = lazyWithRetry(() => import('../features/splitwise/components/SplitwisePage').then(m => ({ default: m.SplitwisePage })));
const SmartInsights = lazyWithRetry(() => import('../features/insights/components/SmartInsights').then(m => ({ default: m.SmartInsights })));
const SavingsGoalsPage = lazyWithRetry(() => import('../features/savings/components/SavingsGoalsPage').then(m => ({ default: m.SavingsGoalsPage })));
const FinancialCalendar = lazyWithRetry(() => import('../features/insights/components/FinancialCalendar').then(m => ({ default: m.FinancialCalendar })));
const ExpenseBenchmark = lazyWithRetry(() => import('../features/insights/components/ExpenseBenchmark').then(m => ({ default: m.ExpenseBenchmark })));

function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  );
}

/** Wrap a lazy route in Suspense + a per-route errorElement so a stale-chunk
 *  failure in one page doesn't tear down the whole app shell. */
function lazyRoute(path: string, Component: ComponentType): RouteObject {
  return {
    path,
    element: <Suspense fallback={<RouteLoader />}><Component /></Suspense>,
    errorElement: <RouteErrorFallback />,
  };
}

/** Redirect to /login if first-time visitor (no onboarding flag set) */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const onboarded = localStorage.getItem('expenseiq_onboarded');
  if (!onboarded) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Suspense fallback={<RouteLoader />}><LoginPage /></Suspense>,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/',
    element: <OnboardingGuard><Layout /></OnboardingGuard>,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Dashboard /> },
      lazyRoute('transactions', TransactionsPage),
      lazyRoute('recurring', RecurringPage),
      lazyRoute('reminders', BillRemindersPage),
      lazyRoute('add', AddTransactionPage),
      lazyRoute('analytics', AnalyticsView),
      lazyRoute('portfolio-analytics', PortfolioAnalytics),
      lazyRoute('budgets', BudgetsPage),
      lazyRoute('reports', MonthlyReport),
      lazyRoute('health', HealthScorePage),
      lazyRoute('portfolio', PortfolioPage),
      lazyRoute('portfolio/:symbol', StockDetailPage),
      lazyRoute('trades', TradeHistoryPage),
      lazyRoute('trade-import', TradeImportPage),
      lazyRoute('accounts', AccountsPage),
      lazyRoute('categories', CategoriesPage),
      lazyRoute('import', StatementImportPage),
      lazyRoute('splitwise', SplitwisePage),
      lazyRoute('insights', SmartInsights),
      lazyRoute('savings', SavingsGoalsPage),
      lazyRoute('calendar', FinancialCalendar),
      lazyRoute('benchmark', ExpenseBenchmark),
      lazyRoute('settings', SettingsPage),
      lazyRoute('settings/security', SecuritySettingsPage),
    ],
  },
], { basename });
