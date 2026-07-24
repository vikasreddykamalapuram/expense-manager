/**
 * Feature Discovery Tips — contextual hints shown on the dashboard
 * to guide users toward features they haven't used yet.
 *
 * Tips are dismissed individually and stored in localStorage.
 */

import { useState, useMemo } from 'react';
import { X, Lightbulb, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../context/AppContext';

interface Tip {
  id: string;
  title: string;
  description: string;
  action: string;
  path: string;
  condition: (state: ReturnType<typeof useAppContext>['state']) => boolean;
}

const TIPS: Tip[] = [
  {
    id: 'tip-accounts',
    title: 'Set up your accounts',
    description: 'Track balances across bank accounts, credit cards, and wallets for accurate net worth.',
    action: 'Add Accounts',
    path: '/accounts',
    condition: (state) => state.accounts.length === 0,
  },
  {
    id: 'tip-budgets',
    title: 'Create a budget',
    description: 'Set monthly spending limits per category and get alerts when you overspend.',
    action: 'Set Budget',
    path: '/budgets',
    condition: (state) => state.budgets.length === 0 && state.transactions.length >= 5,
  },
  {
    id: 'tip-recurring',
    title: 'Automate recurring expenses',
    description: 'Set up rules for rent, subscriptions, and salary so they auto-record each month.',
    action: 'Add Rules',
    path: '/recurring',
    condition: (state) => state.recurringRules.length === 0 && state.transactions.length >= 10,
  },
  {
    id: 'tip-reminders',
    title: 'Never miss a bill',
    description: 'Add bill reminders for EMIs, subscriptions, and due dates with push notifications.',
    action: 'Add Reminder',
    path: '/reminders',
    condition: (state) => state.billReminders.length === 0 && state.transactions.length >= 3,
  },
  {
    id: 'tip-analytics',
    title: 'Explore your spending patterns',
    description: 'View category breakdowns, trends, and comparisons in the analytics dashboard.',
    action: 'View Analytics',
    path: '/analytics',
    condition: (state) => state.transactions.length >= 10,
  },
];

const DISMISSED_KEY = 'expenseiq_dismissed_tips';

function getDismissedTips(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissTip(id: string): void {
  const dismissed = getDismissedTips();
  dismissed.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

export function FeatureTips() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(getDismissedTips);

  const visibleTips = useMemo(() => {
    return TIPS.filter((tip) => !dismissed.has(tip.id) && tip.condition(state)).slice(0, 2);
  }, [state, dismissed]);

  if (visibleTips.length === 0) return null;

  const handleDismiss = (id: string) => {
    dismissTip(id);
    setDismissed(new Set([...dismissed, id]));
  };

  return (
    <div className="space-y-2">
      {visibleTips.map((tip) => (
        <div
          key={tip.id}
          className="flex items-start gap-3 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 p-4"
        >
          <Lightbulb size={18} className="text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tip.title}</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{tip.description}</p>
            <button
              onClick={() => navigate(tip.path)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {tip.action} <ArrowRight size={12} />
            </button>
          </div>
          <button
            onClick={() => handleDismiss(tip.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            aria-label={`Dismiss ${tip.title}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
