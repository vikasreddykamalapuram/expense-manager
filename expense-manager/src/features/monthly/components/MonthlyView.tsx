import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  formatCurrency, formatMonth, getCurrentMonth, getCurrentYear,
  getPreviousMonth, getNextMonth,
} from '../../../shared/utils/helpers';
import { CHART_COLORS } from '../../../shared/constants/categories';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

type ViewMode = 'monthly' | 'yearly';

export function MonthlyView() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const { state } = useAppContext();
  const { settings, categories } = state;
  const { getMonthlyStats, getYearlyStats } = useTransactions();

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  // Monthly data
  const monthStats = useMemo(() => getMonthlyStats(selectedMonth), [selectedMonth, getMonthlyStats]);
  const prevMonthStats = useMemo(
    () => getMonthlyStats(getPreviousMonth(selectedMonth)),
    [selectedMonth, getMonthlyStats]
  );

  // Yearly data
  const yearStats = useMemo(() => getYearlyStats(selectedYear), [selectedYear, getYearlyStats]);
  const prevYearStats = useMemo(
    () => getYearlyStats((parseInt(selectedYear) - 1).toString()),
    [selectedYear, getYearlyStats]
  );

  // Monthly breakdown for the selected year (bar chart)
  const monthlyBreakdown = useMemo(() => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${selectedYear}-${m.toString().padStart(2, '0')}`;
      const ms = getMonthlyStats(monthStr);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.push({
        month: monthNames[m - 1],
        income: ms.totalIncome,
        expense: ms.totalExpense,
        balance: ms.balance,
      });
    }
    return months;
  }, [selectedYear, getMonthlyStats]);

  const stats = viewMode === 'monthly' ? monthStats : yearStats;
  const prevStats = viewMode === 'monthly' ? prevMonthStats : prevYearStats;
  const periodLabel = viewMode === 'monthly'
    ? formatMonth(selectedMonth)
    : selectedYear;
  const prevPeriodLabel = viewMode === 'monthly'
    ? formatMonth(getPreviousMonth(selectedMonth))
    : (parseInt(selectedYear) - 1).toString();

  const expenseCategories = stats.byCategory.filter((c) => {
    const cat = findCategory(c.categoryId);
    return cat?.type === 'expense';
  });

  const incomeCategories = stats.byCategory.filter((c) => {
    const cat = findCategory(c.categoryId);
    return cat?.type === 'income';
  });

  const comparisonData = [
    { label: 'Income', current: stats.totalIncome, previous: prevStats.totalIncome },
    { label: 'Expenses', current: stats.totalExpense, previous: prevStats.totalExpense },
    { label: 'Balance', current: stats.balance, previous: prevStats.balance },
  ];

  const handlePrev = () => {
    if (viewMode === 'monthly') {
      setSelectedMonth(getPreviousMonth(selectedMonth));
    } else {
      setSelectedYear((parseInt(selectedYear) - 1).toString());
    }
  };

  const handleNext = () => {
    if (viewMode === 'monthly') {
      setSelectedMonth(getNextMonth(selectedMonth));
    } else {
      setSelectedYear((parseInt(selectedYear) + 1).toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewMode === 'monthly' ? 'Monthly' : 'Yearly'} View
          </h1>
          <p className="text-sm text-gray-500">
            Detailed breakdown for {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'monthly'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                viewMode === 'yearly'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Yearly
            </button>
          </div>
          {/* Period navigator */}
          <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 p-1 shadow-sm">
            <button
              onClick={handlePrev}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Previous period"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
              {periodLabel}
            </span>
            <button
              onClick={handleNext}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Next period"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Income"
          value={formatCurrency(stats.totalIncome, settings)}
          icon={<TrendingUp size={24} />}
          variant="income"
        />
        <StatCard
          title="Expenses"
          value={formatCurrency(stats.totalExpense, settings)}
          icon={<TrendingDown size={24} />}
          variant="expense"
        />
        <StatCard
          title="Net Balance"
          value={formatCurrency(stats.balance, settings)}
          icon={<Wallet size={24} />}
          variant={stats.balance >= 0 ? 'income' : 'expense'}
        />
      </div>

      {stats.byCategory.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title={`No data for ${viewMode === 'monthly' ? 'this month' : 'this year'}`}
          description="There are no transactions recorded for this period."
        />
      ) : (
        <>
          {/* Yearly: Month-by-month trend */}
          {viewMode === 'yearly' && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900">
                Monthly Trend — {selectedYear}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyBreakdown} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), settings)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison with Previous Period */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              vs {prevPeriodLabel}
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={comparisonData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), settings)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Previous" />
                <Bar dataKey="current" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Current" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Expense Breakdown */}
            {expenseCategories.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-gray-900">Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={expenseCategories}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell key={entry.categoryId} fill={entry.color || CHART_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {expenseCategories.map((cat) => (
                    <div key={cat.categoryId} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-gray-600">{cat.categoryName}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(cat.amount, settings)}</span>
                      <span className="text-xs text-gray-400">({cat.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Income Breakdown */}
            {incomeCategories.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-gray-900">Income Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={incomeCategories}
                      dataKey="amount"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {incomeCategories.map((entry, index) => (
                        <Cell key={entry.categoryId} fill={entry.color || CHART_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {incomeCategories.map((cat) => (
                    <div key={cat.categoryId} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-gray-600">{cat.categoryName}</span>
                      <span className="font-medium text-gray-900">{formatCurrency(cat.amount, settings)}</span>
                      <span className="text-xs text-gray-400">({cat.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
