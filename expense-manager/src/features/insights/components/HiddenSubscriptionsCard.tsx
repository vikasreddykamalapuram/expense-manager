import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Repeat, Check, X } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { detectRecurringPatterns, type RecurringPattern } from '../../../shared/services/recurringDetection';
import { formatCurrency } from '../../../shared/utils/helpers';
import { showToastGlobal } from '../../../shared/components/ui/Toast';
import { haptic } from '../../../shared/services/haptics';
import type { RecurringRule } from '../../../shared/types';

/**
 * Surfaces recurring spend patterns detected in transaction history that
 * aren't yet tracked as RecurringRules. One-click "Promote" adds a rule
 * so the app can auto-generate the next occurrence.
 */
export function HiddenSubscriptionsCard() {
  const { state, actions } = useAppContext();
  const { transactions, categories, recurringRules, settings } = state;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const patterns = useMemo(() => {
    return detectRecurringPatterns(transactions, categories);
  }, [transactions, categories]);

  // Filter out patterns whose amount + category already matches an active rule
  // (rough deduplication so we don't nag users about rules they've already set).
  const existingSignatures = useMemo(() => {
    const sigs = new Set<string>();
    for (const r of recurringRules) {
      if (r.isActive && !r.isDeleted) {
        sigs.add(`${r.categoryId}|${Math.round(r.amount / 10) * 10}`);
      }
    }
    return sigs;
  }, [recurringRules]);

  const hidden = useMemo(
    () =>
      patterns.filter((p) => {
        const sig = `${p.categoryId}|${Math.round(p.amount / 10) * 10}`;
        return !existingSignatures.has(sig) && !dismissed.has(p.id);
      }),
    [patterns, existingSignatures, dismissed],
  );

  if (hidden.length === 0) return null;

  const promote = async (p: RecurringPattern) => {
    const now = new Date().toISOString();
    const rule: RecurringRule = {
      id: uuidv4(),
      name: p.notes || `${p.categoryName} (auto-detected)`,
      type: 'expense',
      amount: p.amount,
      categoryId: p.categoryId,
      notes: `Promoted from detected pattern (${p.occurrences} occurrences, ${p.confidence}% confidence)`,
      frequency: p.frequency === 'weekly' ? 'weekly' : p.frequency === 'biweekly' ? 'weekly' : p.frequency === 'quarterly' ? 'monthly' : 'monthly',
      startDate: p.lastDate,
      nextDueDate: p.nextExpectedDate,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await actions.addRecurringRule(rule);
      haptic.success();
      showToastGlobal('success', `Promoted "${rule.name}" to recurring rule`);
      setDismissed((prev) => new Set(prev).add(p.id));
    } catch {
      showToastGlobal('error', 'Failed to promote rule');
    }
  };

  const dismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
        <Repeat className="w-4 h-4 text-amber-500" />
        Hidden subscriptions
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
        We spotted these repeating charges. Promote them to recurring rules so ExpenseIQ can auto-generate
        the next transaction.
      </p>
      <div className="space-y-2">
        {hidden.map((p, idx) => (
          <div
            key={p.id}
            className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 hover:shadow-md"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {p.notes || p.categoryName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatCurrency(p.amount, settings)} · {p.frequency} · {p.occurrences}× · next{' '}
                  <span className="font-medium">{p.nextExpectedDate}</span>
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 max-w-[120px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        p.confidence >= 80 ? 'bg-emerald-500' : p.confidence >= 60 ? 'bg-amber-500' : 'bg-gray-400'
                      }`}
                      style={{ width: `${p.confidence}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                    {p.confidence}% match
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => promote(p)}
                  className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium px-3 py-1.5 flex items-center gap-1 transition-colors"
                  aria-label="Promote to recurring rule"
                >
                  <Check className="w-3.5 h-3.5" />
                  Promote
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(p.id)}
                  className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
