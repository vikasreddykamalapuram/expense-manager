import { useMemo } from 'react';
import { 
  Sparkles, AlertTriangle, TrendingUp, TrendingDown, ArrowUpRight, 
  ArrowDownRight, Calendar, Flame, Sun, PieChart, Lightbulb, Shield,
  Zap, Eye, Target, Clock
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { generateInsights, Insight } from '../../../shared/services/insightsEngine';
import { detectAnomalies } from '../../../shared/services/anomalyDetection';
import { forecastSpending, forecastCategoryBudgets } from '../../../shared/services/spendingPredictions';
import { formatCurrency } from '../../../shared/utils/helpers';

const INSIGHT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Calendar, Flame, Sun, PieChart, AlertTriangle, Lightbulb,
  'Piggy Bank': Sparkles,
};

function getInsightColor(severity: Insight['severity']) {
  switch (severity) {
    case 'positive': return { bg: 'from-emerald-500 to-green-600', text: 'text-emerald-600 dark:text-emerald-400', light: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' };
    case 'warning': return { bg: 'from-amber-500 to-orange-600', text: 'text-amber-600 dark:text-amber-400', light: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' };
    default: return { bg: 'from-blue-500 to-indigo-600', text: 'text-blue-600 dark:text-blue-400', light: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' };
  }
}

export function SmartInsights() {
  const { state } = useAppContext();
  const { transactions, categories, settings, budgets } = state;

  const insights = useMemo(
    () => generateInsights(transactions, categories),
    [transactions, categories]
  );

  const anomalies = useMemo(
    () => detectAnomalies(transactions, categories),
    [transactions, categories]
  );

  const totalBudget = useMemo(
    () => budgets.reduce((s, b) => s + b.amount, 0),
    [budgets]
  );

  const forecast = useMemo(
    () => forecastSpending(transactions, totalBudget),
    [transactions, totalBudget]
  );

  const categoryForecasts = useMemo(
    () => forecastCategoryBudgets(transactions, budgets, categories),
    [transactions, budgets, categories]
  );

  const hasData = transactions.filter(t => !t.isDeleted).length > 0;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-200 dark:shadow-violet-900/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Smart Insights</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered analysis of your finances</p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-16">
          <Lightbulb className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">No data yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add some transactions to see smart insights</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Insights</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{insights.length}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-red-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Anomalies</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{anomalies.length}</p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Positive</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {insights.filter(i => i.severity === 'positive').length}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Warnings</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {insights.filter(i => i.severity === 'warning').length}
              </p>
            </div>
          </div>

          {/* Insights Section */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4 text-violet-500" />
                Spending Insights
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, idx) => {
                  const color = getInsightColor(insight.severity);
                  const IconComp = INSIGHT_ICONS[insight.icon] || Lightbulb;
                  return (
                    <div
                      key={insight.id}
                      className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${color.light}`}
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color.bg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                          <IconComp className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {insight.title}
                            </p>
                            {insight.change !== undefined && (
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                insight.change > 0 
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                                  : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {insight.change > 0 ? '+' : ''}{insight.change}%
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Anomalies Section */}
          {anomalies.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-red-500" />
                Anomaly Detection
              </h2>
              <div className="space-y-2">
                {anomalies.map((anomaly, idx) => {
                  const transaction = transactions.find(t => t.id === anomaly.transactionId);
                  const cat = transaction ? categories.find(c => c.id === transaction.categoryId) : null;

                  return (
                    <div
                      key={anomaly.id}
                      className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 hover:shadow-md"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        {/* Confidence ring */}
                        <div className="relative w-11 h-11 flex-shrink-0">
                          <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3"
                              className="text-gray-200 dark:text-gray-700" stroke="currentColor" />
                            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="3"
                              strokeLinecap="round"
                              strokeDasharray={`${anomaly.score * 1.13} 113`}
                              className={anomaly.severity === 'high' ? 'text-red-500' : anomaly.severity === 'medium' ? 'text-orange-500' : 'text-yellow-500'}
                              stroke="currentColor" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700 dark:text-gray-300">
                            {anomaly.score}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {anomaly.title}
                            </p>
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                              anomaly.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                              anomaly.severity === 'medium' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' :
                              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {anomaly.severity}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {anomaly.description}
                          </p>
                          {transaction && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                {cat?.name || 'Unknown'}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                {new Date(transaction.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          )}
                        </div>

                        {transaction && (
                          <span className="text-sm font-bold text-red-600 dark:text-red-400 flex-shrink-0">
                            {formatCurrency(transaction.amount, settings)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No anomalies - positive message */}
          {anomalies.length === 0 && insights.length > 0 && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-6 text-center">
              <Shield className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">No anomalies detected</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Your spending patterns look normal</p>
            </div>
          )}

          {/* Spending Forecast Section */}
          {forecast.currentPace > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                Spending Forecast
              </h2>

              {/* Forecast summary */}
              <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Projected month-end total</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(forecast.projectedTotal, settings)}
                    </p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    forecast.status === 'on_track' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                    forecast.status === 'overspending' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {forecast.status === 'on_track' ? '✓ On Track' :
                     forecast.status === 'overspending' ? '⚠ Overspending' : '↓ Under Budget'}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-750 p-2.5">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatCurrency(forecast.currentPace, settings)}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Daily avg</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-750 p-2.5">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{forecast.daysElapsed}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Days elapsed</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-750 p-2.5">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{forecast.daysRemaining}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Days left</p>
                  </div>
                </div>

                {/* Confidence indicator */}
                <div className="mt-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    Confidence: {forecast.confidence} ({forecast.daysElapsed} days of data)
                  </span>
                </div>
              </div>

              {/* Category budget forecasts */}
              {categoryForecasts.length > 0 && (
                <div className="space-y-2">
                  {categoryForecasts.slice(0, 5).map(cf => (
                    <div key={cf.categoryId} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{cf.categoryName}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          cf.status === 'safe' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                          cf.status === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
                          'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {cf.status}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            cf.status === 'safe' ? 'bg-emerald-500' :
                            cf.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, cf.burnRate)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                        <span>{formatCurrency(cf.spent, settings)} of {formatCurrency(cf.budgetLimit, settings)}</span>
                        <span>{cf.burnRate}% used{cf.daysToExhaust !== null ? ` · ${cf.daysToExhaust}d left` : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
