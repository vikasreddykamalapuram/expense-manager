import { Transaction, Category, Budget } from '../types';

export interface BudgetSuggestion {
  categoryId: string;
  /** Rounded, ready-to-use monthly budget. */
  suggested: number;
  /** Raw average monthly spend the suggestion is based on. */
  basis: number;
  /** How many of the looked-back months had spend in this category. */
  monthsWithData: number;
}

export interface SuggestParams {
  transactions: Transaction[];
  categories: Category[];
  existingBudgets: Budget[];
  /** Target month (YYYY-MM) the budgets are for. */
  month: string;
  /** How many complete months of history to average over. */
  monthsBack?: number;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** The `monthsBack` complete months immediately before `month` (excludes the target month itself). */
function priorMonths(month: string, monthsBack: number): string[] {
  const [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

/** Round up to the nearest ₹100 (or ₹500 above ₹10k) for tidy budget figures. */
function roundBudget(n: number): number {
  if (n <= 0) return 0;
  const step = n > 10000 ? 500 : 100;
  return Math.ceil(n / step) * step;
}

/**
 * Suggest a monthly budget for each top-level expense category, based on the
 * user's average spend over the last `monthsBack` complete months. Spend in a
 * category includes its subcategories. Categories that already have a budget for
 * the target month are skipped. Pure/deterministic — safe to unit test.
 */
export function suggestBudgets(params: SuggestParams): BudgetSuggestion[] {
  const { transactions, categories, existingBudgets, month, monthsBack = 3 } = params;
  const months = priorMonths(month, monthsBack);
  const monthsSet = new Set(months);

  const budgetedCategoryIds = new Set(
    existingBudgets.filter((b) => b.month === month && !b.isDeleted).map((b) => b.categoryId)
  );

  const parents = categories.filter((c) => c.type === 'expense' && !c.parentId);

  const suggestions: BudgetSuggestion[] = [];
  for (const parent of parents) {
    if (budgetedCategoryIds.has(parent.id)) continue;
    const ids = new Set([parent.id, ...categories.filter((c) => c.parentId === parent.id).map((c) => c.id)]);

    const perMonth = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const mk = t.date.slice(0, 7);
      if (!monthsSet.has(mk)) continue;
      if (!ids.has(t.categoryId)) continue;
      perMonth.set(mk, (perMonth.get(mk) || 0) + t.amount);
    }

    const monthsWithData = perMonth.size;
    if (monthsWithData === 0) continue;

    const total = [...perMonth.values()].reduce((s, v) => s + v, 0);
    const basis = total / monthsWithData; // average over months that actually had spend
    const suggested = roundBudget(basis);
    if (suggested <= 0) continue;

    suggestions.push({ categoryId: parent.id, suggested, basis, monthsWithData });
  }

  return suggestions.sort((a, b) => b.suggested - a.suggested);
}
