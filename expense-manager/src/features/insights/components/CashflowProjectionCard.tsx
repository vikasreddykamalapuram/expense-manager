import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingDown, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { projectCashflow, type CashflowPoint } from '../../../shared/services/cashflowProjection';
import { computeAccountBalance } from '../../../shared/constants/accounts';
import { formatCurrency } from '../../../shared/utils/helpers';

/**
 * 30-day forward cashflow projection chart — rolls forward known recurring
 * income + expenses, bill reminders, and the last-60-day discretionary
 * baseline. Highlights the projected minimum-balance day so the user can
 * spot cash crunches before they happen.
 */
export function CashflowProjectionCard() {
  const { state } = useAppContext();
  const { transactions, recurringRules, billReminders, accounts, settings } = state;

  const currentBalance = useMemo(() => {
    return accounts
      .filter((a) => !a.isDeleted)
      .reduce((sum, a) => sum + computeAccountBalance(a, transactions), 0);
  }, [accounts, transactions]);

  const projection = useMemo(
    () =>
      projectCashflow({
        transactions,
        recurringRules,
        billReminders,
        currentBalance,
      }),
    [transactions, recurringRules, billReminders, currentBalance],
  );

  const chartData = projection.points.map((p) => ({
    date: p.date.slice(5), // MM-DD
    balance: p.balance,
    events: p.events.join(', '),
  }));

  const isCritical = projection.minBalance < 0;
  const dropAmount = projection.startBalance - projection.endBalance;

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              30-day cashflow projection
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-10">
            Recurring + bills + ₹{projection.dailyBaseline.toLocaleString('en-IN')}/day baseline
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Projected end balance</p>
          <p className={`text-xl font-bold ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
            {formatCurrency(projection.endBalance, settings)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {dropAmount > 0 ? '−' : '+'}{formatCurrency(Math.abs(dropAmount), settings)} vs today
          </p>
        </div>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 100000) return `${(v / 100000).toFixed(1)}L`;
                if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                return String(v);
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,24,39,0.95)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
              formatter={(value) => [formatCurrency(Number(value), settings), 'Balance']}
              labelFormatter={(label, payload) => {
                const p = payload?.[0]?.payload as (typeof chartData)[0] | undefined;
                if (p?.events) return `${label} — ${p.events}`;
                return label;
              }}
            />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
            <Line
              type="monotone"
              dataKey="balance"
              stroke={isCritical ? '#ef4444' : '#0891b2'}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {isCritical && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
          <ArrowRight className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-red-700 dark:text-red-300">
              Projected shortfall on {projection.minBalanceDate}
            </p>
            <p className="text-red-600 dark:text-red-400 mt-0.5">
              Balance could dip to {formatCurrency(projection.minBalance, settings)}. Consider
              deferring discretionary spend or moving funds earlier.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Prevents an unused-import warning in files that consume this only as a lazy component.
export type { CashflowPoint };
