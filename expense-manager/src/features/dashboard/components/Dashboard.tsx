import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, ArrowRight, PlusCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { formatCurrency, formatDate, formatMonth, getLast6Months, classNames } from '../../../shared/utils/helpers';
import { CHART_COLORS } from '../../../shared/constants/categories';
import { calculateHealthScore } from '../../../shared/services/healthScore';

export function Dashboard() {
  const { state } = useAppContext();
  const { settings, categories, transactions: allTxns, budgets, accounts } = state;
  const { currentMonthStats, totalBalance, recentTransactions, getMonthlyStats } = useTransactions();
  const navigate = useNavigate();

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  const last6Months = getLast6Months();
  const monthlyData = last6Months.map((m: string) => {
    const stats = getMonthlyStats(m);
    return {
      month: formatMonth(m).split(' ')[0].slice(0, 3),
      income: stats.totalIncome,
      expense: stats.totalExpense,
    };
  });

  const expenseByCategory = currentMonthStats.byCategory
    .filter((c) => c.type === 'expense')
    .slice(0, 6);

  const hasData = state.transactions.length > 0;

  // Health score for dashboard widget
  const healthScore = useMemo(
    () => calculateHealthScore(allTxns, budgets, accounts, categories, settings),
    [allTxns, budgets, accounts, categories, settings],
  );
  const gaugeRadius = 36;
  const gaugeStroke = 6;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference - (healthScore.totalScore / 100) * gaugeCircumference;
  const gaugeColor = healthScore.totalScore >= 80 ? '#22c55e' : healthScore.totalScore >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Overview of your finances for {formatMonth(currentMonthStats.month)}
          </p>
        </div>
        <Button icon={<PlusCircle size={18} />} onClick={() => navigate('/add')}>
          Add Transaction
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value={formatCurrency(totalBalance.balance, settings)}
          icon={<Wallet size={24} />}
          variant="balance"
        />
        <StatCard
          title="Monthly Income"
          value={formatCurrency(currentMonthStats.totalIncome, settings)}
          icon={<TrendingUp size={24} />}
          variant="income"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatCurrency(currentMonthStats.totalExpense, settings)}
          icon={<TrendingDown size={24} />}
          variant="expense"
        />
        <StatCard
          title="Monthly Balance"
          value={formatCurrency(currentMonthStats.balance, settings)}
          icon={<Wallet size={24} />}
          variant={currentMonthStats.balance >= 0 ? 'income' : 'expense'}
        />
      </div>

      {!hasData ? (
        <EmptyState
          icon={<Wallet size={40} />}
          title="Welcome to ExpenseIQ!"
          description="Start tracking your finances by adding your first transaction. Your dashboard will come alive with charts and insights."
          action={
            <Button icon={<PlusCircle size={18} />} onClick={() => navigate('/add')}>
              Add Your First Transaction
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Health Score Widget */}
          <div
            onClick={() => navigate('/health')}
            className="cursor-pointer rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 lg:col-span-2"
          >
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
                <svg width={96} height={96} className="transform -rotate-90">
                  <circle cx={48} cy={48} r={gaugeRadius} fill="none" stroke="currentColor" strokeWidth={gaugeStroke} className="text-gray-200 dark:text-gray-700" />
                  <circle cx={48} cy={48} r={gaugeRadius} fill="none" stroke={gaugeColor} strokeWidth={gaugeStroke} strokeLinecap="round" strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeOffset} className="transition-[stroke-dashoffset] duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{healthScore.totalScore}</span>
                  <span className="text-xs font-bold" style={{ color: gaugeColor }}>{healthScore.grade}</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Heart size={18} className="text-red-500" />
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Financial Health</h3>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {healthScore.tips[0] || 'Track more to improve your score.'}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
                  View details <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Monthly Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), settings)}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_, i) => <Cell key={i} fill="#22c55e" />)}
                </Bar>
                <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((_, i) => <Cell key={i} fill="#ef4444" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expense Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">
              Expense Breakdown— {formatMonth(currentMonthStats.month).split(' ')[0]}
            </h3>
            {expenseByCategory.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                No expenses this month
              </div>
            ) : (() => {
              const total = expenseByCategory.reduce((s, c) => s + c.amount, 0);
              let cumulative = 0;
              const stops = expenseByCategory.map((cat, index) => {
                const start = cumulative;
                cumulative += (cat.amount / total) * 100;
                return `${cat.color || CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cumulative}%`;
              });
              const gradient = `conic-gradient(${stops.join(', ')})`;
              return (
                <div>
                  <div className="flex justify-center mb-4">
                    <div className="relative" style={{ width: 160, height: 160 }}>
                      <div className="w-full h-full rounded-full" style={{ background: gradient }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{formatCurrency(total, settings)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {expenseByCategory.map((cat, index) => (
                      <div key={cat.categoryId} className="flex items-center gap-2 text-sm">
                        <div
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="flex-1 truncate text-gray-600 dark:text-gray-400">{cat.categoryName}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {total > 0 ? Math.round((cat.amount / total) * 100) : 0}%
                        </span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(cat.amount, settings)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h3>
              <button
                onClick={() => navigate('/transactions')}
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((tx) => {
                const category = findCategory(tx.categoryId);
                const parent = category?.parentId ? findCategory(category.parentId) : null;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${category?.color}15` }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category?.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {parent ? `${parent.name} › ${category?.name}` : category?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(tx.date, settings.dateFormat)}
                        {tx.notes && ` · ${tx.notes}`}
                      </p>
                    </div>
                    <span
                      className={classNames(
                        'text-sm font-bold',
                        tx.type === 'income' ? 'text-success-600' : 'text-danger-600'
                      )}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, settings)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
