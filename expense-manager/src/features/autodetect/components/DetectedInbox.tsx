import { useNavigate } from 'react-router-dom';
import { ScanLine, Check, X, Trash2, ArrowRight, Landmark, CalendarClock, MessageSquare } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { formatCurrency, classNames } from '../../../shared/utils/helpers';
import { buildAddDeepLink } from '../../../shared/services/shareParser';
import { useDetectedQueue } from '../useDetectedQueue';
import type { DetectedCandidate } from '../detection';

const sourceLabel: Record<DetectedCandidate['source'], string> = {
  share: 'Shared',
  notification: 'Notification',
  gmail: 'Email',
};

export function DetectedInbox() {
  const { state } = useAppContext();
  const { settings } = state;
  const navigate = useNavigate();
  const { queue, count, dismiss, clear } = useDetectedQueue();

  const review = (c: DetectedCandidate) => {
    navigate(buildAddDeepLink({ amount: c.amount, note: c.note, type: c.type }));
    dismiss(c.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <ScanLine size={24} /> Detected transactions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review auto-detected transactions before they're added. Nothing is saved until you confirm.
          </p>
        </div>
        {count > 0 && (
          <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={clear}>
            Clear all
          </Button>
        )}
      </div>

      {count === 0 ? (
        <EmptyState
          icon={<ScanLine size={40} />}
          title="Nothing to review"
          description="When you share a bank SMS or payment message into MoneyIQ (and once notification/email detection is enabled), detected transactions will appear here for you to confirm."
        />
      ) : (
        <div className="space-y-3">
          {queue.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={classNames(
                        'text-lg font-bold',
                        c.type === 'income' ? 'text-success-600' : 'text-gray-900 dark:text-gray-100'
                      )}
                    >
                      {c.type === 'income' ? '+' : c.type === 'expense' ? '-' : ''}
                      {c.amount != null ? formatCurrency(c.amount, settings) : '—'}
                    </span>
                    <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {sourceLabel[c.source]}
                    </span>
                  </div>
                  {c.merchant && (
                    <p className="mt-0.5 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{c.merchant}</p>
                  )}
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                    {c.account && (
                      <span className="inline-flex items-center gap-1"><Landmark size={12} /> ••{c.account}</span>
                    )}
                    {c.date && (
                      <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {c.date}</span>
                    )}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-400 dark:text-gray-500 inline-flex items-center gap-1">
                      <MessageSquare size={12} /> Original message
                    </summary>
                    <p className="mt-1 rounded bg-gray-50 dark:bg-gray-900 p-2 text-xs text-gray-500 dark:text-gray-400 break-words">
                      {c.rawText}
                    </p>
                  </details>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => dismiss(c.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-danger-600 dark:hover:bg-gray-700"
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" icon={<Check size={15} />} className="flex-1" onClick={() => review(c)}>
                  Review &amp; add <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
