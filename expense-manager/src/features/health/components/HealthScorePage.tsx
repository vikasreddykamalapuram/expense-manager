import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  PiggyBank, Target, CreditCard, PieChart, Activity,
  Lightbulb, TrendingUp, TrendingDown, ArrowLeft, LucideIcon,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { calculateHealthScore, calculateMonthlyScore, HealthFactor } from '../../../shared/services/healthScore';
import { getLast6Months, formatMonth, classNames } from '../../../shared/utils/helpers';

// Map icon name strings → Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  PiggyBank, Target, CreditCard, PieChart, Activity,
};

function statusColor(status: HealthFactor['status']): string {
  switch (status) {
    case 'excellent': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'good': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'fair': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'poor': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

function ringStroke(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

// ── Circular Gauge ───────────────────────────────────────

function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const radius = 80;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = ringStroke(score);

  return (
    <div className="flex flex-col items-center">
      <svg width={200} height={200} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={100} cy={100} r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Score ring */}
        <circle
          cx={100} cy={100} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute flex flex-col items-center justify-center" style={{ width: 200, height: 200 }}>
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{score}</span>
        <span
          className="mt-1 text-lg font-bold"
          style={{ color }}
        >
          {grade}
        </span>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────

export function HealthScorePage() {
  const { state } = useAppContext();
  const { transactions, budgets, accounts, categories } = state;
  const navigate = useNavigate();

  const result = useMemo(
    () => calculateHealthScore(transactions, budgets, accounts, categories),
    [transactions, budgets, accounts, categories],
  );

  // Previous month score for comparison
  const last6 = useMemo(() => getLast6Months(), []);
  const prevMonthScore = useMemo(() => {
    if (last6.length < 2) return null;
    return calculateMonthlyScore(last6[last6.length - 2], transactions, budgets, accounts, categories);
  }, [last6, transactions, budgets, accounts, categories]);

  const scoreDiff = prevMonthScore !== null ? result.totalScore - prevMonthScore : null;

  // Trend data
  const trendData = useMemo(() => {
    return last6.map((m) => ({
      month: formatMonth(m).split(' ')[0].slice(0, 3),
      score: calculateMonthlyScore(m, transactions, budgets, accounts, categories),
    }));
  }, [last6, transactions, budgets, accounts, categories]);

  const hasEnoughTrend = trendData.some((d) => d.score > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Financial Health Score</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">A composite view of your financial well-being</p>
        </div>
      </div>

      {/* Score Gauge + Comparison */}
      <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="relative">
          <ScoreGauge score={result.totalScore} grade={result.grade} />
        </div>
        {scoreDiff !== null && (
          <div className={classNames(
            'mt-4 flex items-center gap-1 text-sm font-medium',
            scoreDiff > 0 ? 'text-green-600' : scoreDiff < 0 ? 'text-red-600' : 'text-gray-500',
          )}>
            {scoreDiff > 0 ? <TrendingUp size={16} /> : scoreDiff < 0 ? <TrendingDown size={16} /> : null}
            {scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff} points vs last month
          </div>
        )}
      </div>

      {/* Factor Breakdown */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Score Breakdown</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.factors.map((f) => {
            const Icon = ICON_MAP[f.icon] || Activity;
            return (
              <div
                key={f.name}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
                      <Icon size={18} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.name}</span>
                  </div>
                  <span className={classNames('rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusColor(f.status))}>
                    {f.status}
                  </span>
                </div>
                {/* Score bar */}
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{f.score}/100</span>
                    <span>{f.weight}% weight</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className={classNames('h-2 rounded-full transition-all duration-700 ease-out', barColor(f.score))}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Score Trend */}
      {hasEnoughTrend && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Score Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 4 }}
                activeDot={{ r: 6 }}
                name="Health Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tips & Recommendations */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          <Lightbulb size={20} className="text-amber-500" />
          Tips &amp; Recommendations
        </h2>
        <ul className="space-y-3">
          {result.tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
