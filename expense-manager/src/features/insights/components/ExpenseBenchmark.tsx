import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, Target } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';

const FIFTY_THIRTY_TWENTY = {
  needs: { label: 'Needs', target: 50, description: 'Essentials: rent, groceries, utilities, transport, insurance', color: '#3b82f6' },
  wants: { label: 'Wants', target: 30, description: 'Lifestyle: dining, entertainment, shopping, subscriptions', color: '#8b5cf6' },
  savings: { label: 'Savings & Debt', target: 20, description: 'Investments, emergency fund, loan payments', color: '#22c55e' },
};

// Classify categories into needs/wants/savings
const NEEDS_KEYWORDS = ['rent', 'grocery', 'groceries', 'utilities', 'electricity', 'water', 'gas', 'transport', 'fuel', 'insurance', 'medical', 'health', 'education', 'emi', 'loan'];
const WANTS_KEYWORDS = ['dining', 'restaurant', 'food', 'entertainment', 'movie', 'shopping', 'clothes', 'subscription', 'travel', 'hobby', 'gift', 'beauty', 'personal'];

function classifyCategory(name: string): 'needs' | 'wants' | 'savings' {
  const lower = name.toLowerCase();
  if (NEEDS_KEYWORDS.some(k => lower.includes(k))) return 'needs';
  if (WANTS_KEYWORDS.some(k => lower.includes(k))) return 'wants';
  // Default: if not clearly a want, treat as need
  return 'needs';
}

export function ExpenseBenchmark() {
  const { state } = useAppContext();
  const { transactions, categories, settings } = state;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const analysis = useMemo(() => {
    const monthTxns = transactions.filter(t => !t.isDeleted && t.date.startsWith(thisMonth));
    const totalIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTxns.filter(t => t.type === 'expense');
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

    const catLookup = new Map(categories.map(c => [c.id, c]));

    // Classify expenses into needs/wants
    let needsTotal = 0, wantsTotal = 0;
    for (const t of expenses) {
      const cat = catLookup.get(t.categoryId);
      const classification = cat ? classifyCategory(cat.name) : 'needs';
      if (classification === 'needs') needsTotal += t.amount;
      else wantsTotal += t.amount;
    }

    const savingsTotal = Math.max(0, totalIncome - totalExpense);

    // Calculate percentages based on income
    const base = totalIncome || totalExpense || 1;
    const needsPct = (needsTotal / base) * 100;
    const wantsPct = (wantsTotal / base) * 100;
    const savingsPct = (savingsTotal / base) * 100;

    return { totalIncome, totalExpense, needsTotal, wantsTotal, savingsTotal, needsPct, wantsPct, savingsPct, base };
  }, [transactions, categories, thisMonth]);

  const getStatus = (actual: number, target: number, isReverse = false): 'good' | 'warning' | 'over' => {
    if (isReverse) {
      // For savings: higher is better
      if (actual >= target) return 'good';
      if (actual >= target * 0.5) return 'warning';
      return 'over';
    }
    // For spending: lower is better
    if (actual <= target) return 'good';
    if (actual <= target * 1.2) return 'warning';
    return 'over';
  };

  const sections = [
    { key: 'needs', ...FIFTY_THIRTY_TWENTY.needs, actual: analysis.needsPct, amount: analysis.needsTotal, status: getStatus(analysis.needsPct, 50) },
    { key: 'wants', ...FIFTY_THIRTY_TWENTY.wants, actual: analysis.wantsPct, amount: analysis.wantsTotal, status: getStatus(analysis.wantsPct, 30) },
    { key: 'savings', ...FIFTY_THIRTY_TWENTY.savings, actual: analysis.savingsPct, amount: analysis.savingsTotal, status: getStatus(analysis.savingsPct, 20, true) },
  ];

  const overallScore = sections.filter(s => s.status === 'good').length;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Expense Benchmark</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">50/30/20 Rule Analysis</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
          overallScore === 3 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
          overallScore >= 2 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
          'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {overallScore}/3 on track
        </div>
      </div>

      {/* Income base */}
      {analysis.totalIncome > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border border-indigo-200 dark:border-indigo-800 p-4">
          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Monthly Income (Benchmark Base)</p>
          <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{formatCurrency(analysis.totalIncome, settings)}</p>
        </div>
      )}

      {/* 50/30/20 Sections */}
      <div className="space-y-3">
        {sections.map(section => {
          const statusIcon = section.status === 'good' ? CheckCircle2 : section.status === 'warning' ? AlertTriangle : Target;
          const StatusIcon = statusIcon;

          return (
            <div key={section.key} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: section.color }} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">{section.label}</h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Target: {section.target}%</span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{section.description}</p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  section.status === 'good' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                  section.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                  'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                }`}>
                  <StatusIcon className="w-3 h-3" />
                  {section.status === 'good' ? 'On Track' : section.status === 'warning' ? 'Watch' : 'Over'}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative w-full h-3 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="absolute h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, section.actual)}%`, backgroundColor: section.color, opacity: 0.8 }}
                />
                {/* Target marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-gray-900 dark:bg-white opacity-40"
                  style={{ left: `${section.target}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-gray-600 dark:text-gray-400">
                  {formatCurrency(section.amount, settings)} ({section.actual.toFixed(0)}%)
                </span>
                <span className="text-gray-500 dark:text-gray-500">
                  Target: {formatCurrency(Math.round(analysis.base * section.target / 100), settings)} ({section.target}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" />
          Recommendations
        </h3>
        <div className="space-y-2">
          {analysis.needsPct > 50 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              Your needs ({analysis.needsPct.toFixed(0)}%) exceed the 50% target. Consider reducing rent, switching to cheaper alternatives, or renegotiating bills.
            </p>
          )}
          {analysis.wantsPct > 30 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <span className="text-amber-500 mt-0.5">•</span>
              Lifestyle spending ({analysis.wantsPct.toFixed(0)}%) is above 30%. Try a "no-spend" week or cut one subscription.
            </p>
          )}
          {analysis.savingsPct < 20 && (
            <p className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              Savings ({analysis.savingsPct.toFixed(0)}%) are below the 20% target. Set up auto-transfers on payday to prioritize savings.
            </p>
          )}
          {overallScore === 3 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-start gap-2">
              <span className="mt-0.5">🎉</span>
              You're perfectly following the 50/30/20 rule! Keep it up.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
