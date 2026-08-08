import { Suspense, useEffect, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { Layout } from '../shared/components/Layout';
import { Dashboard } from '../features/dashboard/components/Dashboard';
import { RouteErrorFallback } from '../shared/components/RouteErrorFallback';
import { lazyWithRetry } from '../shared/utils/lazyWithRetry';
import { useAppContext } from '../context/AppContext';
import { isSetupComplete, markSetupComplete } from '../features/onboarding/setupStatus';

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
const BudgetsPage = lazyWithRetry(() => import('../features/budgets/components/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const ReportsPage = lazyWithRetry(() => import('../features/reports/components/ReportsPage').then(m => ({ default: m.ReportsPage })));
const StatementImportPage = lazyWithRetry(() => import('../features/import/components/StatementImportPage').then(m => ({ default: m.StatementImportPage })));
const RecurringPage = lazyWithRetry(() => import('../features/recurring/components/RecurringPage').then(m => ({ default: m.RecurringPage })));
const BillRemindersPage = lazyWithRetry(() => import('../features/reminders/components/BillRemindersPage').then(m => ({ default: m.BillRemindersPage })));
const PortfolioPage = lazyWithRetry(() => import('../features/stocks/components/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const PortfolioAnalytics = lazyWithRetry(() => import('../features/stocks/components/PortfolioAnalytics').then(m => ({ default: m.PortfolioAnalytics })));
const TradeHistoryPage = lazyWithRetry(() => import('../features/stocks/components/TradeHistoryPage').then(m => ({ default: m.TradeHistoryPage })));
const TradeImportPage = lazyWithRetry(() => import('../features/stocks/components/TradeImportPage').then(m => ({ default: m.TradeImportPage })));
const StockDetailPage = lazyWithRetry(() => import('../features/stocks/components/StockDetailPage').then(m => ({ default: m.StockDetailPage })));
const SplitwisePage = lazyWithRetry(() => import('../features/splitwise/components/SplitwisePage').then(m => ({ default: m.SplitwisePage })));
const InsightsHub = lazyWithRetry(() => import('../features/insights/components/InsightsHub').then(m => ({ default: m.InsightsHub })));
const SavingsGoalsPage = lazyWithRetry(() => import('../features/savings/components/SavingsGoalsPage').then(m => ({ default: m.SavingsGoalsPage })));
const SalaryPage = lazyWithRetry(() => import('../features/salary/components/SalaryPage').then(m => ({ default: m.SalaryPage })));
const TaxAdvisorPage = lazyWithRetry(() => import('../features/tax/components/TaxAdvisorPage').then(m => ({ default: m.TaxAdvisorPage })));
const SetupWizard = lazyWithRetry(() => import('../features/onboarding/components/SetupWizard').then(m => ({ default: m.SetupWizard })));

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
  const onboarded = localStorage.getItem('moneyiq_onboarded');
  if (!onboarded) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/**
 * Send brand-new users (no data yet, setup not completed) into the first-run
 * setup wizard. Data-aware so existing users are never nagged — and once they
 * have any transactions we mark setup complete so the check is a no-op.
 */
function SetupGuard({ children }: { children: React.ReactNode }) {
  const { state } = useAppContext();
  const setupDone = isSetupComplete();

  useEffect(() => {
    if (!setupDone && !state.isLoading && state.transactions.length > 0) {
      markSetupComplete();
    }
  }, [setupDone, state.isLoading, state.transactions.length]);

  if (state.isLoading) {
    return <RouteLoader />;
  }
  if (!setupDone && state.transactions.length === 0) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

// BASE_URL is absolute ('/expense-manager/') on GitHub Pages but relative
// ('./') in the Capacitor build. React Router's basename must be absolute
// — passing '.' silently renders a blank screen. Collapse any relative
// value to '/' so mobile routes match correctly.
const rawBase = import.meta.env.BASE_URL;
const basename = rawBase.startsWith('/') ? (rawBase.replace(/\/$/, '') || '/') : '/';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Suspense fallback={<RouteLoader />}><LoginPage /></Suspense>,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/welcome',
    element: <OnboardingGuard><Suspense fallback={<RouteLoader />}><SetupWizard /></Suspense></OnboardingGuard>,
    errorElement: <RouteErrorFallback />,
  },
  {
    path: '/',
    element: <OnboardingGuard><SetupGuard><Layout /></SetupGuard></OnboardingGuard>,
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
      lazyRoute('reports', ReportsPage),
      lazyRoute('portfolio', PortfolioPage),
      lazyRoute('portfolio/:symbol', StockDetailPage),
      lazyRoute('trades', TradeHistoryPage),
      lazyRoute('trade-import', TradeImportPage),
      lazyRoute('accounts', AccountsPage),
      lazyRoute('categories', CategoriesPage),
      lazyRoute('import', StatementImportPage),
      lazyRoute('splitwise', SplitwisePage),
      lazyRoute('insights', InsightsHub),
      lazyRoute('insights/health', InsightsHub),
      lazyRoute('insights/benchmark', InsightsHub),
      { path: 'health', element: <Navigate to="/insights/health" replace /> },
      { path: 'benchmark', element: <Navigate to="/insights/benchmark" replace /> },
      lazyRoute('savings', SavingsGoalsPage),
      lazyRoute('salary', SalaryPage),
      lazyRoute('tax', TaxAdvisorPage),
      { path: 'calendar', element: <Navigate to="/transactions?view=calendar" replace /> },
      lazyRoute('settings', SettingsPage),
      lazyRoute('settings/appearance', SettingsPage),
      lazyRoute('settings/data', SettingsPage),
      lazyRoute('settings/cloud', SettingsPage),
      lazyRoute('settings/security', SettingsPage),
      lazyRoute('settings/notifications', SettingsPage),
      lazyRoute('settings/about', SettingsPage),
    ],
  },
], { basename });
