import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { forecastSpending } from '../../../shared/services/spendingPredictions';
import { formatCurrency } from '../../../shared/utils/helpers';

/**
 * Compact end-of-month spend forecast tile for the Dashboard. Uses the
 * existing `forecastSpending` engine and renders a status badge + delta
 * vs total budget.
 */
export function MonthEndForecastTile() {
  const { state } = useAppContext();
  const { transactions, budgets, settings } = state;

  const totalBudget = useMemo(
    () => budgets.filter((b) => !b.isDeleted).reduce((sum, b) => sum + b.amount, 0),
    [budgets],
  );

  const forecast = useMemo(
    () => forecastSpending(transactions, totalBudget),
    [transactions, totalBudget],
  );

  if (totalBudget === 0) return null;

  const { status, projectedTotal, projectedSurplus, daysRemaining } = forecast;

  const statusMeta =
    status === 'overspending'
      ? {
          label: 'Trending over',
          badgeCls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
          barCls: 'from-red-500 to-orange-500',
          icon: TrendingUp,
        }
      : status === 'underspending'
        ? {
            label: 'Under budget',
            badgeCls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
            barCls: 'from-emerald-500 to-teal-500',
            icon: TrendingDown,
          }
        : {
            label: 'On track',
            badgeCls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
            barCls: 'from-blue-500 to-indigo-500',
            icon: Target,
          };
  const Icon = statusMeta.icon;

  const pctOfBudget = Math.min(200, Math.round((projectedTotal / totalBudget) * 100));

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${statusMeta.barCls} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Month-end forecast</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {formatCurrency(projectedTotal, settings)}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusMeta.badgeCls}`}>
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${statusMeta.barCls}`}
          style={{ width: `${Math.min(100, pctOfBudget)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <span>{pctOfBudget}% of {formatCurrency(totalBudget, settings)}</span>
        <span>
          {projectedSurplus >= 0 ? 'Surplus ' : 'Over by '}
          <span className={projectedSurplus >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {formatCurrency(Math.abs(projectedSurplus), settings)}
          </span>
          {' · '}{daysRemaining}d left
        </span>
      </div>
    </div>
  );
}
