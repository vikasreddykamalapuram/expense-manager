import { useMemo, useState } from 'react';
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, 
  Calendar, Flame, Sun, PieChart, AlertTriangle, Lightbulb,
  ChevronRight, Sparkles, X
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { generateInsights, Insight } from '../../../shared/services/insightsEngine';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Flame,
  Sun,
  PieChart,
  AlertTriangle,
  'Piggy Bank': Sparkles,
  Lightbulb,
};

function getSeverityStyles(severity: Insight['severity']) {
  switch (severity) {
    case 'positive':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        icon: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
      };
    case 'warning':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
      };
    default:
      return {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      };
  }
}

export function InsightsCard() {
  const { state } = useAppContext();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const insights = useMemo(
    () => generateInsights(state.transactions, state.categories),
    [state.transactions, state.categories]
  );

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));
  const displayInsights = expanded ? visibleInsights : visibleInsights.slice(0, 3);

  if (visibleInsights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Smart Insights</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{visibleInsights.length} insight{visibleInsights.length !== 1 ? 's' : ''} this month</p>
          </div>
        </div>
      </div>

      {/* Insights list */}
      <div className="space-y-2.5">
        {displayInsights.map((insight, idx) => {
          const styles = getSeverityStyles(insight.severity);
          const IconComp = ICON_MAP[insight.icon] || Lightbulb;

          return (
            <div
              key={insight.id}
              className={`relative group flex items-start gap-3 p-3 rounded-xl border ${styles.bg} ${styles.border} transition-all duration-200 hover:shadow-sm`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${styles.badge}`}>
                <IconComp className={`w-3.5 h-3.5 ${styles.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                  {insight.title}
                  {insight.change !== undefined && (
                    <span className={`ml-1.5 text-xs font-semibold ${insight.change > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {insight.change > 0 ? '+' : ''}{insight.change}%
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {insight.description}
                </p>
              </div>
              {/* Dismiss button */}
              <button
                onClick={() => setDismissed(prev => new Set([...prev, insight.id]))}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center"
                aria-label="Dismiss insight"
              >
                <X className="w-3 h-3 text-gray-500 dark:text-gray-300" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Show more/less */}
      {visibleInsights.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${visibleInsights.length - 3} more`}
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      )}
    </div>
  );
}
