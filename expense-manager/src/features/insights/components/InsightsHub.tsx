import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Heart, Scale } from 'lucide-react';
import { SmartInsights } from './SmartInsights';
import { HealthScorePage } from '../../health/components/HealthScorePage';
import { ExpenseBenchmark } from './ExpenseBenchmark';
import { classNames } from '../../../shared/utils/helpers';

type HubTab = 'insights' | 'health' | 'benchmark';

const TABS: Array<{ id: HubTab; label: string; icon: typeof Sparkles; path: string }> = [
  { id: 'insights', label: 'Insights', icon: Sparkles, path: '/insights' },
  { id: 'health', label: 'Health Score', icon: Heart, path: '/insights/health' },
  { id: 'benchmark', label: 'Benchmark', icon: Scale, path: '/insights/benchmark' },
];

function tabFromPath(pathname: string): HubTab {
  if (pathname.includes('/health')) return 'health';
  if (pathname.includes('/benchmark')) return 'benchmark';
  return 'insights';
}

export function InsightsHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => tabFromPath(location.pathname), [location.pathname]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Insights</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Understand your money — patterns, health, and how you compare.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(({ id, label, icon: Icon, path }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(path, { replace: true })}
            className={classNames(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'insights' && <SmartInsights />}
        {activeTab === 'health' && <HealthScorePage />}
        {activeTab === 'benchmark' && <ExpenseBenchmark />}
      </div>
    </div>
  );
}
