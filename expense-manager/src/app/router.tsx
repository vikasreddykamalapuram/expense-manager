import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from '../shared/components/Layout';
import { Dashboard } from '../features/dashboard/components/Dashboard';
import { TransactionsPage } from '../features/transactions/components/TransactionsPage';
import { AddTransactionPage } from '../features/transactions/components/AddTransactionPage';
import { AnalyticsView } from '../features/analytics/components/AnalyticsView';
import { AccountsPage } from '../features/accounts/components/AccountsPage';
import { CategoriesPage } from '../features/categories/components/CategoriesPage';
import { SettingsPage } from '../features/settings/components/SettingsPage';
import { BudgetsPage } from '../features/budgets/components/BudgetsPage';
import { MonthlyReport } from '../features/reports/components/MonthlyReport';
import { StatementImportPage } from '../features/import/components/StatementImportPage';
import { LoginPage } from '../features/auth/components/LoginPage';
import { RecurringPage } from '../features/recurring/components/RecurringPage';
import { HealthScorePage } from '../features/health/components/HealthScorePage';
import { PortfolioPage } from '../features/stocks/components/PortfolioPage';
import { TradeHistoryPage } from '../features/stocks/components/TradeHistoryPage';
import { TradeImportPage } from '../features/stocks/components/TradeImportPage';

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
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <OnboardingGuard><Layout /></OnboardingGuard>,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'recurring', element: <RecurringPage /> },
      { path: 'add', element: <AddTransactionPage /> },
      { path: 'analytics', element: <AnalyticsView /> },
      { path: 'budgets', element: <BudgetsPage /> },
      { path: 'reports', element: <MonthlyReport /> },
      { path: 'health', element: <HealthScorePage /> },
      { path: 'portfolio', element: <PortfolioPage /> },
      { path: 'trades', element: <TradeHistoryPage /> },
      { path: 'trade-import', element: <TradeImportPage /> },
      { path: 'accounts', element: <AccountsPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'import', element: <StatementImportPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
], { basename });
