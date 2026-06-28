import { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, TrendingUp, TrendingDown,
  Wallet, List as ListIcon, LineChart as LineChartIcon, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import {
  formatCurrency, formatCurrencyCompact, formatDate, formatMonth, formatWeek,
  getCurrentMonth, getCurrentYear, getCurrentWeek,
  getPreviousMonth, getNextMonth,
  getPreviousWeek, getNextWeek,
  getWeekRange, getMonthRange, getYearRange,
  getToday,
} from '../../../shared/utils/helpers';
import { CHART_COLORS } from '../../../shared/constants/categories';

type ViewMode = 'weekly' | 'monthly' | 'yearly' | 'period' | 'list' | 'trend';
type TrendRange = '7d' | '30d' | '3m' | '6m' | '1y' | 'all' | 'custom';

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'period', label: 'Period' },
  { value: 'list', label: 'List' },
  { value: 'trend', label: 'Trend' },
];

const TREND_RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '3m', label: 'Last 3 Months' },
  { value: '6m', label: 'Last 6 Months' },
  { value: '1y', label: 'Last 1 Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Range' },
];

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function AnalyticsView() {
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
  // Trend view specific state
  const [trendRange, setTrendRange] = useState<TrendRange>('3m');
  const [trendCustomStart, setTrendCustomStart] = useState('');
  const [trendCustomEnd, setTrendCustomEnd] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<{ id: string; type: 'expense' | 'income' } | null>(null);

  const { state } = useAppContext();
  const { settings, categories, accounts } = state;
  const { getMonthlyStats, getYearlyStats, getRangeStats, allTransactions } = useTransactions();

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  // ─── Compute trend date range from trendRange selector ───
  const trendDateRange = useMemo(() => {
    const today = new Date();
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const endStr = fmt(today);

    switch (trendRange) {
      case '7d': { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: fmt(s), end: endStr }; }
      case '30d': { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: fmt(s), end: endStr }; }
      case '3m': { const s = new Date(today); s.setMonth(s.getMonth() - 3); return { start: fmt(s), end: endStr }; }
      case '6m': { const s = new Date(today); s.setMonth(s.getMonth() - 6); return { start: fmt(s), end: endStr }; }
      case '1y': { const s = new Date(today); s.setFullYear(s.getFullYear() - 1); return { start: fmt(s), end: endStr }; }
      case 'all': {
        if (allTransactions.length === 0) return { start: endStr, end: endStr };
        const sorted = [...allTransactions].sort((a, b) => a.date.localeCompare(b.date));
        return { start: sorted[0].date, end: sorted[sorted.length - 1].date };
      }
      case 'custom':
        return { start: trendCustomStart || endStr, end: trendCustomEnd || endStr };
    }
  }, [trendRange, trendCustomStart, trendCustomEnd, allTransactions]);

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
  }, [viewMode, selectedMonth, selectedYear, periodStart, periodEnd, lastDateRange,
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

  // ─── Category breakdowns — filter by transaction type stored on each stat ───
  const expenseCategories = useMemo(
    () => stats.byCategory.filter((c) => c.type === 'expense'),
    [stats]
  );
  const incomeCategories = useMemo(
    () => stats.byCategory.filter((c) => c.type === 'income'),
    [stats]
  );

  // ─── Transactions for expanded category (filtered by date range and type) ───
  // Include transactions assigned to the parent OR any of its subcategories
  const categoryTransactions = useMemo(() => {
    if (!expandedCategory) return [];
    const childIds = categories
      .filter((c) => c.parentId === expandedCategory.id)
      .map((c) => c.id);
    const matchIds = new Set([expandedCategory.id, ...childIds]);
    const { start, end } = activeDateRange;
    return allTransactions
      .filter((t) => matchIds.has(t.categoryId) && t.type === expandedCategory.type && t.date >= start && t.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expandedCategory, activeDateRange, allTransactions, categories]);

  // Reset expanded category when view/period changes
  useEffect(() => {
    setExpandedCategory(null);
  }, [viewMode, selectedMonth, selectedYear, selectedWeek, periodStart, periodEnd]);

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

  // ─── Trend view: data point generation with user-selected range ───
  const trendData = useMemo(() => {
    if (viewMode !== 'trend') return [];
    const data: { label: string; income: number; expense: number; balance: number; [key: string]: string | number }[] = [];

    const rangeDays = Math.ceil(
      (new Date(trendDateRange.end).getTime() - new Date(trendDateRange.start).getTime()) / 86400000
    );

    // Get top expense categories for category-wise tracking
    const overallStats = getRangeStats(trendDateRange.start, trendDateRange.end);
    const topExpenseCategories = overallStats.byCategory
      .filter((c) => c.type === 'expense')
      .slice(0, 8); // Top 8 categories

    if (rangeDays <= 14) {
      // Daily points
      const endDate = new Date(trendDateRange.end + 'T00:00:00');
      const startDate = new Date(trendDateRange.start + 'T00:00:00');
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        const s = getRangeStats(dateStr, dateStr);
        const point: Record<string, string | number> = {
          label: `${d.getDate()}/${d.getMonth() + 1}`,
          income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
        };
        // Add per-category amounts
        for (const topCat of topExpenseCategories) {
          const catStat = s.byCategory.find((c) => c.categoryId === topCat.categoryId);
          point[topCat.categoryId] = catStat ? catStat.amount : 0;
        }
        data.push(point as typeof data[number]);
      }
    } else if (rangeDays <= 90) {
      // Weekly points
      const startDate = new Date(trendDateRange.start + 'T00:00:00');
      const endDate = new Date(trendDateRange.end + 'T00:00:00');
      let wStart = new Date(startDate);
      while (wStart <= endDate) {
        const wEnd = new Date(Math.min(wStart.getTime() + 6 * 86400000, endDate.getTime()));
        const sStr = `${wStart.getFullYear()}-${(wStart.getMonth() + 1).toString().padStart(2, '0')}-${wStart.getDate().toString().padStart(2, '0')}`;
        const eStr = `${wEnd.getFullYear()}-${(wEnd.getMonth() + 1).toString().padStart(2, '0')}-${wEnd.getDate().toString().padStart(2, '0')}`;
        const s = getRangeStats(sStr, eStr);
        const monthLabel = MONTH_NAMES_SHORT[wStart.getMonth()];
        const point: Record<string, string | number> = {
          label: `${monthLabel} ${wStart.getDate()}`,
          income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
        };
        for (const topCat of topExpenseCategories) {
          const catStat = s.byCategory.find((c) => c.categoryId === topCat.categoryId);
          point[topCat.categoryId] = catStat ? catStat.amount : 0;
        }
        data.push(point as typeof data[number]);
        wStart = new Date(wEnd.getTime() + 86400000);
      }
    } else {
      // Monthly points
      const startDate = new Date(trendDateRange.start + 'T00:00:00');
      const endDate = new Date(trendDateRange.end + 'T00:00:00');
      let current = `${startDate.getFullYear()}-${(startDate.getMonth() + 1).toString().padStart(2, '0')}`;
      const endMonth = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}`;
      while (current <= endMonth) {
        const s = getMonthlyStats(current);
        const [yr, mon] = current.split('-');
        const point: Record<string, string | number> = {
          label: `${MONTH_NAMES_SHORT[parseInt(mon) - 1]} '${yr.slice(2)}`,
          income: s.totalIncome, expense: s.totalExpense, balance: s.balance,
        };
        for (const topCat of topExpenseCategories) {
          const catStat = s.byCategory.find((c) => c.categoryId === topCat.categoryId);
          point[topCat.categoryId] = catStat ? catStat.amount : 0;
        }
        data.push(point as typeof data[number]);
        // Advance to next month
        const [y, m] = current.split('-').map(Number);
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        current = `${nextY}-${nextM.toString().padStart(2, '0')}`;
      }
    }
    return data;
  }, [viewMode, trendDateRange, getRangeStats, getMonthlyStats]);

  // Top expense categories for trend legend (computed alongside trendData)
  const trendTopCategories = useMemo(() => {
    if (viewMode !== 'trend') return [];
    const overallStats = getRangeStats(trendDateRange.start, trendDateRange.end);
    return overallStats.byCategory
      .filter((c) => c.type === 'expense')
      .slice(0, 8);
  }, [viewMode, trendDateRange, getRangeStats]);

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{viewLabel} View</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Detailed breakdown for {periodLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View mode dropdown */}
          <div className="relative">
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              className="appearance-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 cursor-pointer"
            >
              {VIEW_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 dark:text-gray-500" />
          </div>

          {/* Period navigator (weekly/monthly/yearly) */}
          {showNav && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
              <button onClick={handlePrev} className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600" aria-label="Previous period">
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                {periodLabel}
              </span>
              <button onClick={handleNext} className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600" aria-label="Next period">
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
                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400"
              />
              <span className="text-sm text-gray-400 dark:text-gray-500">to</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400"
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
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ListIcon size={18} /> Transactions
            </h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">
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
                  <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Notes</th>
                    <th className="px-6 py-3 text-right">Amount</th>
                    <th className="px-6 py-3 text-center">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {filteredTransactions.map((txn) => {
                    const cat = findCategory(txn.categoryId);
                    return (
                      <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <td className="whitespace-nowrap px-6 py-3 text-gray-700 dark:text-gray-300">{formatDate(txn.date, 'DD MMM YYYY')}</td>
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            {cat && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />}
                            <span className="text-gray-700 dark:text-gray-300">{cat?.name ?? 'Unknown'}</span>
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-6 py-3 text-gray-500 dark:text-gray-400">{txn.notes || '—'}</td>
                        <td className={`whitespace-nowrap px-6 py-3 text-right font-medium ${txn.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount, settings)}
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            txn.type === 'income' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
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
        <div className="space-y-6">
          {/* Trend timeline selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <select
                value={trendRange}
                onChange={(e) => setTrendRange(e.target.value as TrendRange)}
                className="appearance-none rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 cursor-pointer"
              >
                {TREND_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-gray-400 dark:text-gray-500" />
            </div>
            {trendRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={trendCustomStart}
                  onChange={(e) => setTrendCustomStart(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400" />
                <span className="text-sm text-gray-400 dark:text-gray-500">to</span>
                <input type="date" value={trendCustomEnd}
                  onChange={(e) => setTrendCustomEnd(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 shadow-sm outline-none focus:border-primary-400" />
              </div>
            )}
          </div>

          {/* Summary stats for trend period */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Income" value={formatCurrency(getRangeStats(trendDateRange.start, trendDateRange.end).totalIncome, settings)} icon={<TrendingUp size={24} />} variant="income" />
            <StatCard title="Expenses" value={formatCurrency(getRangeStats(trendDateRange.start, trendDateRange.end).totalExpense, settings)} icon={<TrendingDown size={24} />} variant="expense" />
            <StatCard title="Net Balance" value={formatCurrency(getRangeStats(trendDateRange.start, trendDateRange.end).balance, settings)} icon={<Wallet size={24} />}
              variant={getRangeStats(trendDateRange.start, trendDateRange.end).balance >= 0 ? 'income' : 'expense'} />
          </div>

          {/* Overall Income / Expense / Balance trend */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <LineChartIcon size={18} /> Income / Expense / Balance Trend
            </h3>
            <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
              {formatDate(trendDateRange.start, 'DD MMM YYYY')} – {formatDate(trendDateRange.end, 'DD MMM YYYY')}
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
                  <YAxis tickFormatter={(v) => formatCurrencyCompact(v, settings)} tick={{ fontSize: 10, fill: '#64748b' }} width={65} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="url(#gradIncome)" name="Income" />
                  <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#gradExpense)" name="Expense" />
                  <Area type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBalance)" name="Balance" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category-wise Expense Trend */}
          {trendTopCategories.length > 0 && trendData.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <h3 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <TrendingDown size={18} /> Category-wise Expense Trend
              </h3>
              <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">Top {trendTopCategories.length} expense categories over time</p>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v) => formatCurrencyCompact(v, settings)} tick={{ fontSize: 10, fill: '#64748b' }} width={65} />
                  <Tooltip
                    formatter={(value, name) => {
                      const cat = trendTopCategories.find((c) => c.categoryId === name);
                      return [formatCurrency(Number(value), settings), cat?.categoryName || String(name)];
                    }}
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    formatter={(value) => {
                      const cat = trendTopCategories.find((c) => c.categoryId === value);
                      return cat?.categoryName || String(value);
                    }}
                  />
                  {trendTopCategories.map((cat, i) => (
                    <Area
                      key={cat.categoryId}
                      type="monotone"
                      dataKey={cat.categoryId}
                      stackId="categories"
                      stroke={cat.color || CHART_COLORS[i]}
                      fill={cat.color || CHART_COLORS[i]}
                      fillOpacity={0.3}
                      strokeWidth={1.5}
                      name={cat.categoryId}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>

              {/* Category legend with totals */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {trendTopCategories.map((cat) => (
                  <div key={cat.categoryId} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="truncate text-gray-600 dark:text-gray-400">{cat.categoryName}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100 ml-auto">{formatCurrency(cat.amount, settings)}</span>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Monthly Trend — {selectedYear}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyBreakdown} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value), settings)} contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#ef4444" name="Expense" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparison with previous period (weekly/monthly/yearly only) */}
          {comparisonData.length > 0 && prevStats && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">vs {prevPeriodLabel}</h3>
              <div className="space-y-6">
                {comparisonData.map((item) => {
                  const maxVal = Math.max(Math.abs(item.current), Math.abs(item.previous), 1);
                  const currentPct = (Math.abs(item.current) / maxVal) * 100;
                  const previousPct = (Math.abs(item.previous) / maxVal) * 100;
                  const diff = item.current - item.previous;
                  const diffPct = item.previous !== 0 ? ((diff / Math.abs(item.previous)) * 100).toFixed(1) : '—';
                  const isPositiveChange = item.label === 'Expenses' ? diff <= 0 : diff >= 0;
                  return (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositiveChange ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                          {diff >= 0 ? '+' : ''}{diffPct}%
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500 w-16">Current</span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${currentPct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-28 text-right">{formatCurrency(item.current, settings)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500 w-16">Previous</span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-gray-400 transition-all duration-500" style={{ width: `${previousPct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-28 text-right">{formatCurrency(item.previous, settings)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Category breakdowns */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {expenseCategories.length > 0 && (() => {
              const total = expenseCategories.reduce((s, c) => s + c.amount, 0);
              let cumulative = 0;
              const stops = expenseCategories.map((cat, index) => {
                const start = cumulative;
                cumulative += (cat.amount / total) * 100;
                return `${cat.color || CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cumulative}%`;
              });
              const gradient = `conic-gradient(${stops.join(', ')})`;
              return (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                  <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Expense Breakdown</h3>
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
                  <div className="space-y-1">
                    {expenseCategories.map((cat, index) => {
                      const isExpanded = expandedCategory?.id === cat.categoryId && expandedCategory?.type === 'expense';
                      return (
                        <div key={cat.categoryId}>
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : { id: cat.categoryId, type: 'expense' })}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="flex-1 text-left text-gray-600 dark:text-gray-400 truncate">{cat.categoryName}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(cat.amount, settings)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">({cat.percentage}%)</span>
                            <ChevronDown size={14} className={`text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="ml-5 mb-2 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
                              {categoryTransactions.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No transactions</p>
                              ) : (
                                <div className="space-y-1 py-1 max-h-60 overflow-y-auto">
                                  {categoryTransactions.map((txn) => {
                                    const acct = txn.accountId ? accounts.find((a) => a.id === txn.accountId) : null;
                                    const subCat = findCategory(txn.categoryId);
                                    const parentCat = subCat?.parentId ? findCategory(subCat.parentId) : null;
                                    return (
                                      <div key={txn.id} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <span className="text-gray-400 dark:text-gray-500 w-16 flex-shrink-0">{formatDate(txn.date, settings.dateFormat)}</span>
                                        <span className="flex-1 text-gray-600 dark:text-gray-400 truncate">
                                          {parentCat ? `${subCat?.name}` : txn.notes || cat.categoryName}
                                        </span>
                                        {acct && <span className="text-gray-400 dark:text-gray-500 truncate max-w-[80px]">{acct.name}</span>}
                                        <span className="font-medium text-danger-600 whitespace-nowrap">
                                          -{formatCurrency(txn.amount, settings)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">{categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {incomeCategories.length > 0 && (() => {
              const total = incomeCategories.reduce((s, c) => s + c.amount, 0);
              let cumulative = 0;
              const stops = incomeCategories.map((cat, index) => {
                const start = cumulative;
                cumulative += (cat.amount / total) * 100;
                return `${cat.color || CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${cumulative}%`;
              });
              const gradient = `conic-gradient(${stops.join(', ')})`;
              return (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
                  <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Income Breakdown</h3>
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
                  <div className="space-y-1">
                    {incomeCategories.map((cat, index) => {
                      const isExpanded = expandedCategory?.id === cat.categoryId && expandedCategory?.type === 'income';
                      return (
                        <div key={cat.categoryId}>
                          <button
                            onClick={() => setExpandedCategory(isExpanded ? null : { id: cat.categoryId, type: 'income' })}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                          >
                            <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || CHART_COLORS[index % CHART_COLORS.length] }} />
                            <span className="flex-1 text-left text-gray-600 dark:text-gray-400 truncate">{cat.categoryName}</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(cat.amount, settings)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">({cat.percentage}%)</span>
                            <ChevronDown size={14} className={`text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="ml-5 mb-2 border-l-2 border-gray-100 dark:border-gray-700 pl-3">
                              {categoryTransactions.length === 0 ? (
                                <p className="text-xs text-gray-400 dark:text-gray-500 py-2">No transactions</p>
                              ) : (
                                <div className="space-y-1 py-1 max-h-60 overflow-y-auto">
                                  {categoryTransactions.map((txn) => {
                                    const acct = txn.accountId ? accounts.find((a) => a.id === txn.accountId) : null;
                                    const subCat = findCategory(txn.categoryId);
                                    const parentCat = subCat?.parentId ? findCategory(subCat.parentId) : null;
                                    return (
                                      <div key={txn.id} className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <span className="text-gray-400 dark:text-gray-500 w-16 flex-shrink-0">{formatDate(txn.date, settings.dateFormat)}</span>
                                        <span className="flex-1 text-gray-600 dark:text-gray-400 truncate">
                                          {parentCat ? `${subCat?.name}` : txn.notes || cat.categoryName}
                                        </span>
                                        {acct && <span className="text-gray-400 dark:text-gray-500 truncate max-w-[80px]">{acct.name}</span>}
                                        <span className="font-medium text-success-600 whitespace-nowrap">
                                          +{formatCurrency(txn.amount, settings)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 pt-1">{categoryTransactions.length} transaction{categoryTransactions.length !== 1 ? 's' : ''}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
}
