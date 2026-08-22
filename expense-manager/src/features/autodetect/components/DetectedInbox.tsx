import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, Check, X, Trash2, ArrowRight, Landmark, CalendarClock, MessageSquare } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { formatCurrency, classNames } from '../../../shared/utils/helpers';
import { buildAddDeepLink } from '../../../shared/services/shareParser';
import { computeAccountBalance } from '../../../shared/constants/accounts';
import { useDetectedQueue } from '../useDetectedQueue';
import { GmailScanButton } from './GmailScanButton';
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

      <GmailScanButton />

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
              {c.balance != null && <BalanceUpdateRow balance={c.balance} accountHint={c.account} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * E.3: when a detected message reports an available balance, let the user apply
 * it to one of their accounts. We adjust the account's opening balance so its
 * *current* computed balance equals the reported figure (opening += reported − current).
 */
function BalanceUpdateRow({ balance, accountHint }: { balance: number; accountHint?: string }) {
  const { state, actions } = useAppContext();
  const { accounts, transactions, settings } = state;
  const assetAccounts = accounts.filter((a) => a.kind === 'asset');
  const [accountId, setAccountId] = useState<string>(() => {
    if (accountHint) {
      const m = assetAccounts.find((a) => a.name.includes(accountHint));
      if (m) return m.id;
    }
    return assetAccounts[0]?.id || '';
  });
  const [done, setDone] = useState(false);

  if (assetAccounts.length === 0) return null;

  const apply = async () => {
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) return;
    const current = computeAccountBalance(acc, transactions);
    const newOpening = acc.openingBalance + (balance - current);
    await actions.updateAccount(acc.id, { openingBalance: newOpening });
    setDone(true);
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg bg-primary-50/50 dark:bg-primary-900/10 p-2 text-xs">
      <Landmark size={13} className="shrink-0 text-primary-600" />
      <span className="text-gray-600 dark:text-gray-300">Balance {formatCurrency(balance, settings)}</span>
      {done ? (
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-success-600"><Check size={12} /> Updated</span>
      ) : (
        <>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="ml-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 py-1 text-xs"
          >
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button type="button" onClick={apply} className="rounded-md bg-primary-600 px-2 py-1 font-medium text-white hover:bg-primary-700">
            Update
          </button>
        </>
      )}
    </div>
  );
}
