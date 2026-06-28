import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../shared/components/Layout';
import { Dashboard } from '../features/dashboard/components/Dashboard';

// Lazy-loaded routes
const LoginPage = lazy(() => import('../features/auth/components/LoginPage').then(m => ({ default: m.LoginPage })));
const TransactionsPage = lazy(() => import('../features/transactions/components/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const AddTransactionPage = lazy(() => import('../features/transactions/components/AddTransactionPage').then(m => ({ default: m.AddTransactionPage })));
const AnalyticsView = lazy(() => import('../features/analytics/components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const AccountsPage = lazy(() => import('../features/accounts/components/AccountsPage').then(m => ({ default: m.AccountsPage })));
const CategoriesPage = lazy(() => import('../features/categories/components/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const SettingsPage = lazy(() => import('../features/settings/components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BudgetsPage = lazy(() => import('../features/budgets/components/BudgetsPage').then(m => ({ default: m.BudgetsPage })));
const MonthlyReport = lazy(() => import('../features/reports/components/MonthlyReport').then(m => ({ default: m.MonthlyReport })));
const StatementImportPage = lazy(() => import('../features/import/components/StatementImportPage').then(m => ({ default: m.StatementImportPage })));
const RecurringPage = lazy(() => import('../features/recurring/components/RecurringPage').then(m => ({ default: m.RecurringPage })));
const BillRemindersPage = lazy(() => import('../features/reminders/components/BillRemindersPage').then(m => ({ default: m.BillRemindersPage })));
const HealthScorePage = lazy(() => import('../features/health/components/HealthScorePage').then(m => ({ default: m.HealthScorePage })));
const PortfolioPage = lazy(() => import('../features/stocks/components/PortfolioPage').then(m => ({ default: m.PortfolioPage })));
const PortfolioAnalytics = lazy(() => import('../features/stocks/components/PortfolioAnalytics').then(m => ({ default: m.PortfolioAnalytics })));
const TradeHistoryPage = lazy(() => import('../features/stocks/components/TradeHistoryPage').then(m => ({ default: m.TradeHistoryPage })));
const TradeImportPage = lazy(() => import('../features/stocks/components/TradeImportPage').then(m => ({ default: m.TradeImportPage })));

function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
  );
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
  },
  {
    path: '/',
    element: <OnboardingGuard><Layout /></OnboardingGuard>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transactions', element: <Suspense fallback={<RouteLoader />}><TransactionsPage /></Suspense> },
      { path: 'recurring', element: <Suspense fallback={<RouteLoader />}><RecurringPage /></Suspense> },
      { path: 'reminders', element: <Suspense fallback={<RouteLoader />}><BillRemindersPage /></Suspense> },
      { path: 'add', element: <Suspense fallback={<RouteLoader />}><AddTransactionPage /></Suspense> },
      { path: 'analytics', element: <Suspense fallback={<RouteLoader />}><AnalyticsView /></Suspense> },
      { path: 'portfolio-analytics', element: <Suspense fallback={<RouteLoader />}><PortfolioAnalytics /></Suspense> },
      { path: 'budgets', element: <Suspense fallback={<RouteLoader />}><BudgetsPage /></Suspense> },
      { path: 'reports', element: <Suspense fallback={<RouteLoader />}><MonthlyReport /></Suspense> },
      { path: 'health', element: <Suspense fallback={<RouteLoader />}><HealthScorePage /></Suspense> },
      { path: 'portfolio', element: <Suspense fallback={<RouteLoader />}><PortfolioPage /></Suspense> },
      { path: 'trades', element: <Suspense fallback={<RouteLoader />}><TradeHistoryPage /></Suspense> },
      { path: 'trade-import', element: <Suspense fallback={<RouteLoader />}><TradeImportPage /></Suspense> },
      { path: 'accounts', element: <Suspense fallback={<RouteLoader />}><AccountsPage /></Suspense> },
      { path: 'categories', element: <Suspense fallback={<RouteLoader />}><CategoriesPage /></Suspense> },
      { path: 'import', element: <Suspense fallback={<RouteLoader />}><StatementImportPage /></Suspense> },
      { path: 'settings', element: <Suspense fallback={<RouteLoader />}><SettingsPage /></Suspense> },
    ],
  },
], { basename });
