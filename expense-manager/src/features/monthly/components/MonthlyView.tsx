import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, TrendingUp, TrendingDown,
  Wallet, List as ListIcon, LineChart as LineChartIcon,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  formatCurrency, formatDate, formatMonth, formatWeek,
  getCurrentMonth, getCurrentYear, getCurrentWeek,
  getPreviousMonth, getNextMonth,
  getPreviousWeek, getNextWeek,
  getWeekRange, getMonthRange, getYearRange,
  getToday,
} from '../../../shared/utils/helpers';
import { CHART_COLORS } from '../../../shared/constants/categories';

type ViewMode = 'weekly' | 'monthly' | 'yearly' | 'period' | 'list' | 'trend';

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'period', label: 'Period' },
  { value: 'list', label: 'List' },
  { value: 'trend', label: 'Trend' },
];

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlyView() {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeek());
  const [periodStart, setPeriodStart] = useState(getToday());
  const [periodEnd, setPeriodEnd] = useState(getToday());
  // Tracks the last date range used by weekly/monthly/yearly/period for List & Trend views
  const [lastDateRange, setLastDateRange] = useState<{ start: string; end: string }>(
    getMonthRange(getCurrentMonth())
  );

  const { state } = useAppContext();
  const { settings, categories } = state;
  const { getMonthlyStats, getYearlyStats, getRangeStats, allTransactions } = useTransactions();

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  // ─── Compute active date range based on the current view mode ───
  const activeDateRange = useMemo(() => {
    switch (viewMode) {
      case 'weekly': return getWeekRange(selectedWeek);
      case 'monthly': return getMonthRange(selectedMonth);
      case 'yearly': return getYearRange(selectedYear);
      case 'period': return { start: periodStart, end: periodEnd };
      default: return lastDateRange;
    }
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, periodStart, periodEnd, lastDateRange]);

  // Persist date range whenever a primary mode changes
  useEffect(() => {
    if (['weekly', 'monthly', 'yearly', 'period'].includes(viewMode)) {
      setLastDateRange(activeDateRange);
    }
  }, [viewMode, activeDateRange]);

  // ─── Stats ───
  const stats = useMemo(() => {
    switch (viewMode) {
      case 'weekly': return getRangeStats(activeDateRange.start, activeDateRange.end);
      case 'monthly': return getMonthlyStats(selectedMonth);
      case 'yearly': return getYearlyStats(selectedYear);
      case 'period': return getRangeStats(periodStart, periodEnd);
      case 'list':
      case 'trend':
        return getRangeStats(lastDateRange.start, lastDateRange.end);
    }
  }, [viewMode, selectedMonth, selectedYear, selectedWeek, periodStart, periodEnd, lastDateRange,
      getMonthlyStats, getYearlyStats, getRangeStats, activeDateRange]);

  const prevStats = useMemo(() => {
    switch (viewMode) {
      case 'monthly': return getMonthlyStats(getPreviousMonth(selectedMonth));
      case 'yearly': return getYearlyStats((parseInt(selectedYear) - 1).toString());
      case 'weekly': {
        const prev = getWeekRange(getPreviousWeek(selectedWeek));
        return getRangeStats(prev.start, prev.end);
      }
      default: return null;
    }
  }, [viewMode, selectedMonth, selectedYear, selectedWeek, getMonthlyStats, getYearlyStats, getRangeStats]);

  // ─── Period label ───
  const periodLabel = useMemo(() => {
    switch (viewMode) {
      case 'weekly': return formatWeek(selectedWeek);
      case 'monthly': return formatMonth(selectedMonth);
      case 'yearly': return selectedYear;
      case 'period': return `${formatDate(periodStart, 'DD MMM YYYY')} – ${formatDate(periodEnd, 'DD MMM YYYY')}`;
      case 'list': return 'Transactions';
      case 'trend': return 'Trend Analysis';
    }
  }, [viewMode, selectedWeek, selectedMonth, selectedYear, periodStart, periodEnd]);

  const prevPeriodLabel = useMemo(() => {
    switch (viewMode) {
      case 'weekly': return formatWeek(getPreviousWeek(selectedWeek));
      case 'monthly': return formatMonth(getPreviousMonth(selectedMonth));
      case 'yearly': return (parseInt(selectedYear) - 1).toString();
      default: return '';
    }
  }, [viewMode, selectedWeek, selectedMonth, selectedYear]);

  // ─── Yearly bar-chart breakdown ───
  const monthlyBreakdown = useMemo(() => {
    if (viewMode !== 'yearly') return [];
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = `${selectedYear}-${(i + 1).toString().padStart(2, '0')}`;
      const ms = getMonthlyStats(monthStr);
      return { month: MONTH_NAMES_SHORT[i], income: ms.totalIncome, expense: ms.totalExpense, balance: ms.balance };
    });
  }, [viewMode, selectedYear, getMonthlyStats]);

  // ─── Category breakdowns ───
  const expenseCategories = useMemo(
    () => stats.byCategory.filter((c) => findCategory(c.categoryId)?.type === 'expense'),
    [stats, categories]
  );
  const incomeCategories = useMemo(
    () => stats.byCategory.filter((c) => findCategory(c.categoryId)?.type === 'income'),
    [stats, categories]
  );

  // ─── Comparison data ───
  const comparisonData = useMemo(() => {
    if (!prevStats) return [];
    return [
      { label: 'Income', current: stats.totalIncome, previous: prevStats.totalIncome },
      { label: 'Expenses', current: stats.totalExpense, previous: prevStats.totalExpense },
      { label: 'Balance', current: stats.balance, previous: prevStats.balance },
    ];
  }, [stats, prevStats]);

  // ─── List view: filtered & sorted transactions ───
  const filteredTransactions = useMemo(() => {
    if (viewMode !== 'list') return [];
    const { start, end } = lastDateRange;
    return allTransactions
      .filter((t) => t.date >= start && t.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [viewMode, lastDateRange, allTransactions]);

  // ─── Trend view: data point generation ───
  const trendData = useMemo(() => {
    if (viewMode !== 'trend') return [];
    const data: { label: string; income: number; expense: number; balance: number }[] = [];

    // Determine granularity based on the view mode that was active before switching to trend
    const rangeDays = Math.ceil(
      (new Date(lastDateRange.end).getTime() - new Date(lastDateRange.start).getTime()) / 86400000
    );

    if (rangeDays <= 10) {
      // Daily points for the last 4 weeks
      const endDate = new Date(lastDateRange.end + 'T00:00:00');
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 27);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        const s = getRangeStats(dateStr, dateStr);
        data.push({
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
        });
      }
    } else if (rangeDays <= 45) {
      // Weekly points for last 6 months
      let current = getCurrentMonth();
      const months: string[] = [];
      for (let i = 0; i < 6; i++) { months.unshift(current); current = getPreviousMonth(current); }
      for (const m of months) {
        const range = getMonthRange(m);
        // Split each month into ~4 weeks
        const mStart = new Date(range.start + 'T00:00:00');
        const mEnd = new Date(range.end + 'T00:00:00');
        let wStart = new Date(mStart);
        let weekNum = 1;
        while (wStart <= mEnd) {
          const wEnd = new Date(Math.min(wStart.getTime() + 6 * 86400000, mEnd.getTime()));
          const sStr = `${wStart.getFullYear()}-${(wStart.getMonth() + 1).toString().padStart(2, '0')}-${wStart.getDate().toString().padStart(2, '0')}`;
          const eStr = `${wEnd.getFullYear()}-${(wEnd.getMonth() + 1).toString().padStart(2, '0')}-${wEnd.getDate().toString().padStart(2, '0')}`;
          const s = getRangeStats(sStr, eStr);
          const monthLabel = MONTH_NAMES_SHORT[wStart.getMonth()];
          data.push({
            label: `${monthLabel} W${weekNum}`,
            income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
          });
          wStart = new Date(wEnd.getTime() + 86400000);
          weekNum++;
        }
      }
    } else {
      // Monthly points for the last 2 years (or 12 months)
      const count = rangeDays > 400 ? 24 : 12;
      let current = getCurrentMonth();
      const months: string[] = [];
      for (let i = 0; i < count; i++) { months.unshift(current); current = getPreviousMonth(current); }
      for (const m of months) {
        const s = getMonthlyStats(m);
        const [, mon] = m.split('-');
        const yr = m.split('-')[0].slice(2);
        data.push({
          label: `${MONTH_NAMES_SHORT[parseInt(mon) - 1]} '${yr}`,
          income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
        });
      }
    }
    return data;
  }, [viewMode, lastDateRange, getRangeStats, getMonthlyStats]);

  // ─── Navigation handlers ───
  const handlePrev = () => {
    if (viewMode === 'weekly') setSelectedWeek(getPreviousWeek(selectedWeek));
    else if (viewMode === 'monthly') setSelectedMonth(getPreviousMonth(selectedMonth));
    else if (viewMode === 'yearly') setSelectedYear((parseInt(selectedYear) - 1).toString());
  };

  const handleNext = () => {
    if (viewMode === 'weekly') setSelectedWeek(getNextWeek(selectedWeek));
    else if (viewMode === 'monthly') setSelectedMonth(getNextMonth(selectedMonth));
    else if (viewMode === 'yearly') setSelectedYear((parseInt(selectedYear) + 1).toString());
  };

  const showNav = viewMode === 'weekly' || viewMode === 'monthly' || viewMode === 'yearly';
  const showStats = viewMode !== 'list' && viewMode !== 'trend';
  const viewLabel = VIEW_MODE_OPTIONS.find((o) => o.value === viewMode)?.label ?? 'Analytics';

  // ─── Tooltip style shared across charts ───
  const tooltipStyle = { borderRadius: '12px', border: '1px solid #e2e8f0' };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{viewLabel} View</h1>
          <p className="text-sm text-gray-500">Detailed breakdown for {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View mode dropdown */}
          <div className="relative">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="appearance-none rounded-lg border border-gray-200 bg-white px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 cursor-pointer"
            >
              {VIEW_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-gray-400" />
          </div>

          {/* Period navigator (weekly/monthly/yearly) */}
          {showNav && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button onClick={handlePrev} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Previous period">
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900">
                {periodLabel}
              </span>
              <button onClick={handleNext} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Next period">
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Period date pickers */}
          {viewMode === 'period' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm outline-none focus:border-primary-400"
              />
              <span className="text-sm text-gray-400">to</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm outline-none focus:border-primary-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      {showStats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Income" value={formatCurrency(stats.totalIncome, settings)} icon={<TrendingUp size={24} />} variant="income" />
          <StatCard title="Expenses" value={formatCurrency(stats.totalExpense, settings)} icon={<TrendingDown size={24} />} variant="expense" />
          <StatCard title="Net Balance" value={formatCurrency(stats.balance, settings)} icon={<Wallet size={24} />} variant={stats.balance >= 0 ? 'income' : 'expense'} />
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <ListIcon size={18} /> Transactions
            </h3>
            <span className="text-xs text-gray-400">
              {formatDate(lastDateRange.start, 'DD MMM YYYY')} – {formatDate(lastDateRange.end, 'DD MMM YYYY')}
              {' · '}{filteredTransactions.length} items
            </span>
          </div>
          {filteredTransactions.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={<ListIcon size={40} />} title="No transactions" description="No transactions found for the selected period." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Notes</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-center">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.map((txn) => {
                    const cat = findCategory(txn.categoryId);
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                        <td className="whitespace-nowrap px-6 py-3 text-gray-700">{formatDate(txn.date, 'DD MMM YYYY')}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            {cat && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                            <span className="text-gray-700">{cat?.name ?? 'Unknown'}</span>
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-3 text-gray-500">{txn.notes || '—'}</td>
                        <td className={`whitespace-nowrap px-6 py-3 text-right font-medium ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount, settings)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            txn.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {txn.type === 'income' ? 'Income' : 'Expense'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Trend View ── */}
      {viewMode === 'trend' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold text-gray-900 flex items-center gap-2">
            <LineChartIcon size={18} /> Income / Expense / Balance Trend
          </h3>
          <p className="mb-4 text-xs text-gray-400">
            {formatDate(lastDateRange.start, 'DD MMM YYYY')} – {formatDate(lastDateRange.end, 'DD MMM YYYY')}
          </p>
          {trendData.length === 0 ? (
            <EmptyState icon={<LineChartIcon size={40} />} title="No trend data" description="Not enough data to display a trend." />
          ) : (
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#gradIncome)" name="Income" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#gradExpense)" name="Expense" />
                <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBalance)" name="Balance" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Stats-based views (weekly, monthly, yearly, period) ── */}
      {showStats && stats.byCategory.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={40} />}
          title={`No data for this ${viewMode === 'period' ? 'period' : viewMode === 'weekly' ? 'week' : viewMode === 'monthly' ? 'month' : 'year'}`}
          description="There are no transactions recorded for this period."
        />
      )}

      {showStats && stats.byCategory.length > 0 && (
        <>
          {/* Yearly: Month-by-month bar chart */}
          {viewMode === 'yearly' && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900">Monthly Trend — {selectedYear}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyBreakdown} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} name="Income" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison with previous period (weekly/monthly/yearly only) */}
          {comparisonData.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900">vs {prevPeriodLabel}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={comparisonData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Previous" />
                  <Bar dataKey="current" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Current" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {expenseCategories.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-gray-900">Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={expenseCategories} dataKey="amount" nameKey="categoryName" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
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

            {incomeCategories.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-base font-semibold text-gray-900">Income Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={incomeCategories} dataKey="amount" nameKey="categoryName" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
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
