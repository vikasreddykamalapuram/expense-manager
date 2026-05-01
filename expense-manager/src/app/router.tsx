import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '../shared/components/Layout';
import { Dashboard } from '../features/dashboard/components/Dashboard';
import { TransactionsPage } from '../features/transactions/components/TransactionsPage';
import { AddTransactionPage } from '../features/transactions/components/AddTransactionPage';
import { MonthlyView } from '../features/monthly/components/MonthlyView';
import { SettingsPage } from '../features/settings/components/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'add', element: <AddTransactionPage /> },
      { path: 'monthly', element: <MonthlyView /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
