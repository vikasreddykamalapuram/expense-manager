import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { List, CalendarDays } from 'lucide-react';
import { TransactionList } from './TransactionList';
import { FinancialCalendar } from '../../insights/components/FinancialCalendar';
import { useAppContext } from '../../../context/AppContext';
import { classNames } from '../../../shared/utils/helpers';

type ViewMode = 'list' | 'calendar';

const VIEWS: Array<{ id: ViewMode; label: string; icon: typeof List }> = [
  { id: 'list', label: 'List', icon: List },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function TransactionsPage() {
  const { state } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const view: ViewMode = useMemo(() => {
    const v = searchParams.get('view');
    return v === 'calendar' ? 'calendar' : 'list';
  }, [searchParams]);

  const setView = (next: ViewMode) => {
    if (next === 'list') {
      searchParams.delete('view');
    } else {
      searchParams.set('view', next);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Transactions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {state.transactions.length} total transaction{state.transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700" role="tablist" aria-label="Transactions view">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={classNames(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              view === id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {view === 'list' ? <TransactionList /> : <FinancialCalendar />}
    </div>
  );
}
