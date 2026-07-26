import { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarDays, Printer,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, FileBarChart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { Transaction, Category, Account, Budget, Settings } from '../../../shared/types';
import {
  formatCurrency, classNames,
  type Period, type PeriodKind,
  currentPeriod, buildPeriod, shiftPeriod, previousPeriod, monthsInPeriod,
} from '../../../shared/utils/helpers';
import { EmptyState } from '../../../shared/components/ui/EmptyState';

// ─── Helpers ──────────────────────────────────────────

function txInRange(transactions: Transaction[], p: Period): Transaction[] {
  return transactions.filter((t) => t.date >= p.start && t.date <= p.end);
}

function sumByType(txs: Transaction[], type: 'income' | 'expense'): number {
  return txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

interface CategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
  percentage: number;
  prevAmount: number;
  change: number;
}

function topCategories(
  txs: Transaction[],
  prevTxs: Transaction[],
  categories: Category[],
  type: 'income' | 'expense',
  limit: number = 5,
): CategoryTotal[] {
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));
  const totals = new Map<string, number>();
  const prev = new Map<string, number>();

  txs.filter((t) => t.type === type).forEach((t) => {
    const parentId = catMap.get(t.categoryId)?.parentId || t.categoryId;
    totals.set(parentId, (totals.get(parentId) || 0) + t.amount);
  });
  prevTxs.filter((t) => t.type === type).forEach((t) => {
    const parentId = catMap.get(t.categoryId)?.parentId || t.categoryId;
    prev.set(parentId, (prev.get(parentId) || 0) + t.amount);
  });

  const grand = Array.from(totals.values()).reduce((s, v) => s + v, 0);
  return Array.from(totals.entries())
    .map(([categoryId, amount]) => {
      const cat = catMap.get(categoryId);
      const prevAmount = prev.get(categoryId) || 0;
      return {
        categoryId,
        name: cat?.name || 'Unknown',
        color: cat?.color || '#6b7280',
        amount,
        percentage: grand > 0 ? (amount / grand) * 100 : 0,
        prevAmount,
        change: pctChange(amount, prevAmount),
      };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

interface BudgetPerf {
  categoryId: string;
  name: string;
  color: string;
  budgetAmount: number;
  actual: number;
  remaining: number;
  pct: number;
  over: boolean;
}

/**
 * Budget performance for a period. Budgets are monthly, so for Quarter/Year
 * we sum the budgeted amounts across all months in the period and compare
 * against actual spend in the same range.
 */
function budgetPerformance(
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  period: Period,
): BudgetPerf[] {
  const catMap = new Map<string, Category>();
  categories.forEach((c) => catMap.set(c.id, c));
  const months = new Set(monthsInPeriod(period));
  const periodBudgets = budgets.filter((b) => months.has(b.month));
  if (periodBudgets.length === 0) return [];

  // Sum budgeted amount per categoryId across months in range.
  const summed = new Map<string, number>();
  periodBudgets.forEach((b) => {
    summed.set(b.categoryId, (summed.get(b.categoryId) || 0) + b.amount);
  });

  return Array.from(summed.entries()).map(([categoryId, budgetAmount]) => {
    const cat = catMap.get(categoryId);
    const subcategoryIds = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
    const allIds = [categoryId, ...subcategoryIds];
    const actual = transactions
      .filter((t) => t.type === 'expense' && t.date >= period.start && t.date <= period.end && allIds.includes(t.categoryId))
      .reduce((s, t) => s + t.amount, 0);
    const remaining = budgetAmount - actual;
    const pct = budgetAmount > 0 ? (actual / budgetAmount) * 100 : 0;
    return {
      categoryId,
      name: cat?.name || 'Unknown',
      color: cat?.color || '#6b7280',
      budgetAmount,
      actual,
      remaining,
      pct,
      over: actual > budgetAmount,
    };
  });
}

interface AccountSummary {
  id: string;
  name: string;
  type: string;
  color: string;
  deposits: number;
  withdrawals: number;
  netChange: number;
}

function accountSummaries(accounts: Account[], txs: Transaction[]): AccountSummary[] {
  return accounts
    .filter((a) => a.isActive)
    .map((a) => {
      let deposits = 0;
      let withdrawals = 0;
      txs.forEach((t) => {
        if (t.accountId === a.id) {
          if (t.type === 'income') deposits += t.amount;
          else if (t.type === 'expense') withdrawals += t.amount;
          else if (t.type === 'transfer') withdrawals += t.amount;
        }
        if (t.toAccountId === a.id && t.type === 'transfer') {
          deposits += t.amount;
        }
      });
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        color: a.color,
        deposits,
        withdrawals,
        netChange: deposits - withdrawals,
      };
    })
    .filter((a) => a.deposits > 0 || a.withdrawals > 0);
}

// ─── Spending series (adapts granularity to period) ───

interface SpendBucket {
  key: string;
  /** Short axis label (e.g. "12", "Wk 3", "Mar") */
  label: string;
  /** Long label used in tooltip */
  fullLabel: string;
  amount: number;
}

function spendingSeries(txs: Transaction[], period: Period): SpendBucket[] {
  const expenses = txs.filter((t) => t.type === 'expense');
  const start = new Date(period.start);
  const end = new Date(period.end);

  if (period.kind === 'month' || (period.kind === 'custom' && daysBetween(start, end) <= 45)) {
    // Daily buckets
    const days = daysBetween(start, end) + 1;
    const buckets: SpendBucket[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      buckets.push({ key: iso, label: String(d.getDate()), fullLabel: d.toDateString(), amount: 0 });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    expenses.forEach((t) => {
      const i = idx.get(t.date);
      if (i !== undefined) buckets[i].amount += t.amount;
    });
    return buckets;
  }

  if (period.kind === 'quarter' || (period.kind === 'custom' && daysBetween(start, end) <= 200)) {
    // Weekly buckets
    const buckets: SpendBucket[] = [];
    const cursor = new Date(start);
    let wk = 1;
    while (cursor <= end) {
      const wkStart = new Date(cursor);
      const wkEnd = new Date(cursor);
      wkEnd.setDate(wkEnd.getDate() + 6);
      if (wkEnd > end) wkEnd.setTime(end.getTime());
      buckets.push({
        key: `${wkStart.toISOString().slice(0, 10)}_${wkEnd.toISOString().slice(0, 10)}`,
        label: `W${wk}`,
        fullLabel: `${wkStart.toDateString()} – ${wkEnd.toDateString()}`,
        amount: 0,
      });
      cursor.setDate(cursor.getDate() + 7);
      wk++;
    }
    expenses.forEach((t) => {
      const d = new Date(t.date);
      const daysSinceStart = Math.floor((d.getTime() - start.getTime()) / 86400000);
      const bIdx = Math.floor(daysSinceStart / 7);
      if (bIdx >= 0 && bIdx < buckets.length) buckets[bIdx].amount += t.amount;
    });
    return buckets;
  }

  // Year or long custom → monthly buckets
  const months = monthsInPeriod(period);
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const buckets: SpendBucket[] = months.map((m) => {
    const [, mm] = m.split('-').map(Number);
    return { key: m, label: monthLabels[mm - 1], fullLabel: m, amount: 0 };
  });
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  expenses.forEach((t) => {
    const i = idx.get(t.date.slice(0, 7));
    if (i !== undefined) buckets[i].amount += t.amount;
  });
  return buckets;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function generateInsights(
  income: number,
  expenses: number,
  prevIncome: number,
  prevExpenses: number,
  topExp: CategoryTotal[],
  budgetPerfs: BudgetPerf[],
  settings: Settings,
  periodNoun: string,
  prevPeriodNoun: string,
): string[] {
  const insights: string[] = [];

  if (topExp.length > 0) {
    insights.push(
      `Your biggest expense was ${topExp[0].name} at ${formatCurrency(topExp[0].amount, settings)} (${topExp[0].percentage.toFixed(0)}% of total).`,
    );
  }

  const savings = income - expenses;
  if (income > 0) {
    const savingsRate = (savings / income) * 100;
    if (savings >= 0) {
      insights.push(`You saved ${savingsRate.toFixed(1)}% of your income this ${periodNoun}.`);
    } else {
      insights.push(`You overspent by ${formatCurrency(Math.abs(savings), settings)}.`);
    }
  }

  if (prevExpenses > 0 || prevIncome > 0) {
    const expChange = pctChange(expenses, prevExpenses);
    if (prevExpenses > 0 && Math.abs(expChange) >= 1) {
      insights.push(
        `Compared to ${prevPeriodNoun}, spending ${expChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(expChange).toFixed(1)}%.`,
      );
    } else if (prevExpenses > 0) {
      insights.push(`Spending remained roughly the same as ${prevPeriodNoun}.`);
    }
    if (prevIncome > 0) {
      const incChange = pctChange(income, prevIncome);
      if (Math.abs(incChange) >= 1) {
        insights.push(
          `Income ${incChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(incChange).toFixed(1)}% compared to ${prevPeriodNoun}.`,
        );
      }
    }
  }

  if (budgetPerfs.length > 0) {
    const withinBudget = budgetPerfs.filter((b) => !b.over).length;
    insights.push(`You stayed within budget on ${withinBudget} out of ${budgetPerfs.length} categories.`);
  }

  if (topExp.length > 1) {
    const biggestIncrease = [...topExp]
      .filter((c) => c.prevAmount > 0)
      .sort((a, b) => b.change - a.change)[0];
    if (biggestIncrease && biggestIncrease.change > 0) {
      insights.push(
        `${biggestIncrease.name} spending increased the most (${biggestIncrease.change.toFixed(1)}% more than ${prevPeriodNoun}).`,
      );
    }
  }

  return insights;
}

// ─── UI atoms ─────────────────────────────────────────

function ChangeIndicator({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.1) {
    return <span className="inline-flex items-center text-xs text-gray-400"><Minus size={12} className="mr-0.5" />0{suffix}</span>;
  }
  const positive = value > 0;
  return (
    <span className={classNames('inline-flex items-center text-xs font-medium', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
      {positive ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames('rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800', className)}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {children}
    </div>
  );
}

function ChartTooltip({ active, payload, label, settings }: {
  active?: boolean;
  payload?: Array<{ value: number; payload?: { fullLabel?: string } }>;
  label?: string;
  settings: Settings;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-gray-600 dark:bg-gray-700">
      <p className="font-medium text-gray-700 dark:text-gray-200">{p.payload?.fullLabel || label}</p>
      <p className="text-gray-500 dark:text-gray-400">{formatCurrency(p.value, settings)}</p>
    </div>
  );
}

// ─── Period noun helpers ──────────────────────────────

function periodNoun(kind: PeriodKind): string {
  if (kind === 'month') return 'month';
  if (kind === 'quarter') return 'quarter';
  if (kind === 'year') return 'year';
  return 'period';
}

function prevPeriodNoun(kind: PeriodKind): string {
  if (kind === 'month') return 'last month';
  if (kind === 'quarter') return 'last quarter';
  if (kind === 'year') return 'last year';
  return 'the previous period';
}

// ─── Main Component ───────────────────────────────────

const PERIOD_TABS: Array<{ kind: PeriodKind; label: string }> = [
  { kind: 'month',   label: 'Month' },
  { kind: 'quarter', label: 'Quarter' },
  { kind: 'year',    label: 'Year' },
  { kind: 'custom',  label: 'Custom' },
];

export function ReportsPage() {
  const { state } = useAppContext();
  const { transactions, categories, accounts, budgets, settings } = state;
  const [period, setPeriod] = useState<Period>(() => currentPeriod('month'));
  const [customDraft, setCustomDraft] = useState<{ start: string; end: string }>(() => ({
    start: currentPeriod('month').start,
    end: currentPeriod('month').end,
  }));

  const prev = useMemo(() => previousPeriod(period), [period]);
  const periodTxs = useMemo(() => txInRange(transactions, period), [transactions, period]);
  const prevTxs = useMemo(() => txInRange(transactions, prev), [transactions, prev]);

  const income = useMemo(() => sumByType(periodTxs, 'income'), [periodTxs]);
  const expenses = useMemo(() => sumByType(periodTxs, 'expense'), [periodTxs]);
  const prevIncome = useMemo(() => sumByType(prevTxs, 'income'), [prevTxs]);
  const prevExpenses = useMemo(() => sumByType(prevTxs, 'expense'), [prevTxs]);
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  const topExp = useMemo(() => topCategories(periodTxs, prevTxs, categories, 'expense'), [periodTxs, prevTxs, categories]);
  const topInc = useMemo(() => topCategories(periodTxs, prevTxs, categories, 'income'), [periodTxs, prevTxs, categories]);
  const budgetPerfs = useMemo(() => budgetPerformance(budgets, transactions, categories, period), [budgets, transactions, categories, period]);
  const acctSummaries = useMemo(() => accountSummaries(accounts, periodTxs), [accounts, periodTxs]);
  const series = useMemo(() => spendingSeries(periodTxs, period), [periodTxs, period]);
  const insights = useMemo(
    () => generateInsights(income, expenses, prevIncome, prevExpenses, topExp, budgetPerfs, settings, periodNoun(period.kind), prevPeriodNoun(period.kind)),
    [income, expenses, prevIncome, prevExpenses, topExp, budgetPerfs, settings, period.kind],
  );

  const overallBudgetUtil = useMemo(() => {
    const totalBudget = budgetPerfs.reduce((s, b) => s + b.budgetAmount, 0);
    const totalActual = budgetPerfs.reduce((s, b) => s + b.actual, 0);
    return totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  }, [budgetPerfs]);

  const highest = useMemo(() => series.reduce((max, d) => d.amount > max.amount ? d : max, series[0]), [series]);
  const lowestSpend = useMemo(() => {
    const spending = series.filter((d) => d.amount > 0);
    if (spending.length === 0) return null;
    return spending.reduce((min, d) => d.amount < min.amount ? d : min, spending[0]);
  }, [series]);

  const hasData = periodTxs.length > 0;
  const compareLabel = `vs ${prevPeriodNoun(period.kind)}`;

  const handlePrint = () => window.print();

  const switchKind = (kind: PeriodKind) => {
    setPeriod(kind === 'custom'
      ? buildPeriod('custom', customDraft.start, customDraft.end)
      : currentPeriod(kind));
  };

  const applyCustom = () => {
    if (customDraft.start && customDraft.end && customDraft.start <= customDraft.end) {
      setPeriod(buildPeriod('custom', customDraft.start, customDraft.end));
    }
  };

  const reportTitle = period.kind === 'custom'
    ? 'Custom Report'
    : `${period.kind[0].toUpperCase() + period.kind.slice(1)}ly Report`;

  return (
    <>
      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, aside, header, button, .no-print,
          [class*="FloatingAssistant"], [class*="PWA"] { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; }
          .dark\\:bg-gray-800, .dark\\:bg-gray-900 { background: white !important; }
          .dark\\:text-gray-100, .dark\\:text-gray-200, .dark\\:text-gray-300,
          .dark\\:text-gray-400 { color: #1f2937 !important; }
          .dark\\:border-gray-700 { border-color: #e5e7eb !important; }
          .print-report { max-width: 100% !important; }
          .print-break { page-break-before: always; }
          .recharts-responsive-container { page-break-inside: avoid; }
        }
      `}</style>

      <div className="print-report mx-auto max-w-5xl space-y-6">
        {/* Header + Period tabs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reportTitle}</h1>
          </div>
          <div className="no-print inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
            {PERIOD_TABS.map((t) => (
              <button
                key={t.kind}
                onClick={() => switchKind(t.kind)}
                className={classNames(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  period.kind === t.kind
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period navigator */}
        <div className="no-print flex flex-col gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:flex-row sm:items-center sm:justify-between">
          {period.kind !== 'custom' ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriod(shiftPeriod(period, -1))}
                aria-label="Previous period"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 dark:border-gray-700">
                <CalendarDays size={16} className="text-gray-400" />
                <span className="min-w-[140px] text-center text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {period.label}
                </span>
              </div>
              <button
                onClick={() => setPeriod(shiftPeriod(period, 1))}
                aria-label="Next period"
                className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setPeriod(currentPeriod(period.kind))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                Today
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-gray-500 dark:text-gray-400">From</span>
                <input
                  type="date"
                  value={customDraft.start}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, start: e.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="flex flex-col text-xs">
                <span className="mb-1 text-gray-500 dark:text-gray-400">To</span>
                <input
                  type="date"
                  value={customDraft.end}
                  onChange={(e) => setCustomDraft((d) => ({ ...d, end: e.target.value }))}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
              </label>
              <button
                onClick={applyCustom}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Apply
              </button>
            </div>
          )}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {period.start} — {period.end}
          </div>
        </div>

        {/* Report Header */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100 p-6 dark:border-gray-700 dark:from-primary-900/20 dark:to-primary-800/20">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{period.label}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {period.start} — {period.end}
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Printer size={16} />
            Download PDF
          </button>
        </div>

        {!hasData ? (
          <EmptyState
            icon="receipt"
            title="No transactions"
            description={`No transactions found for ${period.label}.`}
          />
        ) : (
          <>
            {/* Summary Section */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <SummaryCard label="Total Income"   amount={income}   prevAmount={prevIncome}   settings={settings} color="text-emerald-600 dark:text-emerald-400" compareLabel={compareLabel} />
              <SummaryCard label="Total Expenses" amount={expenses} prevAmount={prevExpenses} settings={settings} color="text-red-500 dark:text-red-400" compareLabel={compareLabel} />
              <SummaryCard label="Net Savings"    amount={savings}  prevAmount={prevIncome - prevExpenses} settings={settings} color={savings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} compareLabel={compareLabel} />
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Savings Rate</p>
                <p className={classNames('mt-1 text-2xl font-bold', savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                  {savingsRate.toFixed(1)}%
                </p>
                <div className="mt-1">
                  {prevIncome > 0 && (
                    <ChangeIndicator value={savingsRate - ((prevIncome - prevExpenses) / prevIncome) * 100} suffix=" pts" />
                  )}
                </div>
              </div>
            </div>

            {/* Top Categories */}
            <div className="grid gap-6 lg:grid-cols-2">
              {topExp.length > 0 && (
                <Card title="Top Expense Categories">
                  <div className="space-y-3">
                    {topExp.map((cat, i) => (
                      <CategoryBar key={cat.categoryId} rank={i + 1} cat={cat} settings={settings} maxAmount={topExp[0].amount} />
                    ))}
                  </div>
                </Card>
              )}
              {topInc.length > 0 && (
                <Card title="Top Income Sources">
                  <div className="space-y-3">
                    {topInc.map((cat, i) => (
                      <CategoryBar key={cat.categoryId} rank={i + 1} cat={cat} settings={settings} maxAmount={topInc[0].amount} />
                    ))}
                  </div>
                </Card>
              )}
            </div>

            {/* Budget Performance */}
            {budgetPerfs.length > 0 && (
              <Card title={period.kind === 'month' ? 'Budget Performance' : `Budget Performance (${period.label})`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={classNames(
                          'h-3 rounded-full transition-all',
                          overallBudgetUtil > 100 ? 'bg-red-500' : overallBudgetUtil > 85 ? 'bg-amber-500' : 'bg-emerald-500',
                        )}
                        style={{ width: `${Math.min(overallBudgetUtil, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {overallBudgetUtil.toFixed(0)}% used
                  </span>
                </div>
                <div className="space-y-3">
                  {budgetPerfs.map((bp) => (
                    <div key={bp.categoryId} className={classNames('rounded-lg border p-3', bp.over ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-gray-100 dark:border-gray-700')}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: bp.color }} />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{bp.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-gray-500 dark:text-gray-400">
                            {formatCurrency(bp.actual, settings)} / {formatCurrency(bp.budgetAmount, settings)}
                          </span>
                          {bp.over ? (
                            <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                              <AlertTriangle size={12} />
                              Over by {formatCurrency(Math.abs(bp.remaining), settings)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} />
                              {formatCurrency(bp.remaining, settings)} left
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={classNames('h-2 rounded-full', bp.over ? 'bg-red-500' : bp.pct > 85 ? 'bg-amber-500' : 'bg-emerald-500')}
                          style={{ width: `${Math.min(bp.pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Account Summary */}
            {acctSummaries.length > 0 && (
              <Card title="Account Summary">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="pb-2 text-left font-medium text-gray-500 dark:text-gray-400">Account</th>
                        <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Deposits</th>
                        <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Withdrawals</th>
                        <th className="pb-2 text-right font-medium text-gray-500 dark:text-gray-400">Net Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {acctSummaries.map((a) => (
                        <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50">
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color }} />
                              <span className="font-medium text-gray-900 dark:text-gray-100">{a.name}</span>
                              <span className="text-xs text-gray-400">({a.type.replace('_', ' ')})</span>
                            </div>
                          </td>
                          <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">
                            {a.deposits > 0 ? `+${formatCurrency(a.deposits, settings)}` : '—'}
                          </td>
                          <td className="py-2 text-right text-red-500 dark:text-red-400">
                            {a.withdrawals > 0 ? `-${formatCurrency(a.withdrawals, settings)}` : '—'}
                          </td>
                          <td className={classNames('py-2 text-right font-medium', a.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
                            {a.netChange >= 0 ? '+' : '-'}{formatCurrency(Math.abs(a.netChange), settings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Spending Pattern (adapts to period granularity) */}
            <Card title={
              period.kind === 'year'    ? 'Monthly Spending'
              : period.kind === 'quarter' ? 'Weekly Spending'
              : period.kind === 'month'   ? 'Daily Spending Pattern'
              : 'Spending Over Time'
            } className="print-break">
              {series.some((d) => d.amount > 0) ? (
                <>
                  <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                    {highest && highest.amount > 0 && (
                      <span>📈 Highest: {highest.label} ({formatCurrency(highest.amount, settings)})</span>
                    )}
                    {lowestSpend && (
                      <span>📉 Lowest: {lowestSpend.label} ({formatCurrency(lowestSpend.amount, settings)})</span>
                    )}
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={series} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          interval={series.length > 20 ? Math.floor(series.length / 15) : 0}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: '#9ca3af' }}
                          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                          width={40}
                        />
                        <Tooltip content={<ChartTooltip settings={settings} />} />
                        <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                          {series.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={
                                highest && entry.key === highest.key
                                  ? '#ef4444'
                                  : lowestSpend && entry.key === lowestSpend.key
                                    ? '#10b981'
                                    : '#6366f1'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500">No spending data for this {periodNoun(period.kind)}.</p>
              )}
            </Card>

            {/* Key Insights */}
            {insights.length > 0 && (
              <Card title="Key Insights">
                <ul className="space-y-2">
                  {insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-primary-100 text-center text-xs font-semibold leading-5 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                        {i + 1}
                      </span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────

function SummaryCard({
  label, amount, prevAmount, settings, color, compareLabel,
}: {
  label: string;
  amount: number;
  prevAmount: number;
  settings: Settings;
  color: string;
  compareLabel: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className={classNames('mt-1 text-2xl font-bold', color)}>
        {formatCurrency(Math.abs(amount), settings)}
      </p>
      <div className="mt-1">
        <ChangeIndicator value={pctChange(amount, prevAmount)} />
        <span className="ml-1 text-xs text-gray-400">{compareLabel}</span>
      </div>
    </div>
  );
}

function CategoryBar({
  rank, cat, settings, maxAmount,
}: {
  rank: number;
  cat: CategoryTotal;
  settings: Settings;
  maxAmount: number;
}) {
  const barWidth = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 text-center text-xs font-semibold text-gray-400">{rank}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
            <span className="font-medium text-gray-900 dark:text-gray-100">{cat.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatCurrency(cat.amount, settings)}
            </span>
            <span className="text-xs text-gray-400">({cat.percentage.toFixed(1)}%)</span>
            <ChangeIndicator value={cat.change} />
          </div>
        </div>
        <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className="h-2 rounded-full transition-all"
            style={{ width: `${barWidth}%`, backgroundColor: cat.color }}
          />
        </div>
      </div>
    </div>
  );
}
