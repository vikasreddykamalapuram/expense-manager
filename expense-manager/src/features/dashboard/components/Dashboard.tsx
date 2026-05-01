import { TrendingUp, TrendingDown, Wallet, ArrowRight, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { getCategoryById } from '../../../shared/constants/categories';
import { formatCurrency, formatDate, formatMonth, getLast6Months, classNames } from '../../../shared/utils/helpers';
import { CHART_COLORS } from '../../../shared/constants/categories';

export function Dashboard() {
  const { state } = useAppContext();
  const { settings } = state;
  const { currentMonthStats, totalBalance, recentTransactions, getMonthlyStats } = useTransactions();
  const navigate = useNavigate();

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
    .filter((c: { categoryId: string }) => {
      const cat = getCategoryById(c.categoryId);
      return cat?.type === 'expense';
    })
    .slice(0, 6);

  const hasData = state.transactions.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">
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
          {/* Monthly Trend Chart */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">Monthly Trend</h3>
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
                <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expense Breakdown */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              Expense Breakdown — {formatMonth(currentMonthStats.month).split(' ')[0]}
            </h3>
            {expenseByCategory.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                No expenses this month
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {expenseByCategory.map((entry, index) => (
                        <Cell key={entry.categoryId} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {expenseByCategory.map((cat) => (
                    <div key={cat.categoryId} className="flex items-center gap-2 text-sm">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 truncate text-gray-600">{cat.categoryName}</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(cat.amount, settings)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Recent Transactions</h3>
              <button
                onClick={() => navigate('/transactions')}
                className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {recentTransactions.map((tx) => {
                const category = getCategoryById(tx.categoryId);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-gray-50"
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
                      <p className="text-sm font-medium text-gray-900">
                        {category?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
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
