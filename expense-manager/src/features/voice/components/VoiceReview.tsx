/**
 * Shows exactly what was understood before anything is filled in.
 *
 * The important part is the *unresolved* half: `ambiguities` carries every
 * genuine "this could mean two things" the parser hit (chiefly kal/parso, which
 * mean both yesterday and tomorrow). Surfacing those is what stops voice from
 * being a lottery — the user corrects one field instead of distrusting all of
 * them.
 */

import { Check, RotateCcw, AlertCircle } from 'lucide-react';
import type { Account, Category } from '../../../shared/types';
import type { ParsedVoiceTransaction } from '../../../shared/services/voiceParser';
import { PAYMENT_METHODS } from '../../../shared/constants/accounts';
import { Button } from '../../../shared/components/ui/Button';
import { formatCurrency } from '../../../shared/utils/helpers';
import { useAppContext } from '../../../context/AppContext';

interface VoiceReviewProps {
  parsed: ParsedVoiceTransaction;
  categories: Category[];
  accounts: Account[];
  onConfirm: () => void;
  onRetry: () => void;
}

const TYPE_LABELS: Record<ParsedVoiceTransaction['type'], string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</span>
      <span
        className={
          'text-right text-sm ' +
          (muted ? 'italic text-gray-400 dark:text-gray-500' : 'font-medium text-gray-900 dark:text-gray-100')
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Show a friendly date, but always show it — a wrong date is easy to miss. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function VoiceReview({ parsed, categories, accounts, onConfirm, onRetry }: VoiceReviewProps) {
  const { state } = useAppContext();
  const category = categories.find((c) => c.id === parsed.categoryId);
  const parent = category?.parentId ? categories.find((c) => c.id === category.parentId) : undefined;
  const account = accounts.find((a) => a.id === parsed.accountId);
  const toAccount = accounts.find((a) => a.id === parsed.toAccountId);
  const method = PAYMENT_METHODS.find((p) => p.value === parsed.paymentMethod);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <p className="mb-3 rounded-lg bg-gray-50 p-2.5 text-sm italic text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">
          “{parsed.transcript}”
        </p>

        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <Row label="Type" value={TYPE_LABELS[parsed.type]} />
          <Row
            label="Amount"
            value={parsed.amount != null ? formatCurrency(parsed.amount, state.settings) : 'not heard — add it on the next screen'}
            muted={parsed.amount == null}
          />
          <Row
            label="Category"
            value={category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'pick on the next screen'}
            muted={!category}
          />
          {parsed.date && <Row label="Date" value={formatDate(parsed.date)} />}
          {method && <Row label="Paid by" value={method.label} />}
          {account && <Row label={parsed.type === 'transfer' ? 'From' : 'Account'} value={account.name} />}
          {toAccount && <Row label="To" value={toAccount.name} />}
          {parsed.notes && <Row label="Note" value={parsed.notes} />}
        </div>
      </div>

      {parsed.ambiguities.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
          {parsed.ambiguities.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button onClick={onConfirm} icon={<Check size={16} />} className="flex-1">
          Use these details
        </Button>
        <Button variant="secondary" onClick={onRetry} icon={<RotateCcw size={16} />}>
          Say it again
        </Button>
      </div>
    </div>
  );
}
