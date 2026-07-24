import { Transaction } from '../types';

export interface RecurringPattern {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  frequency: 'monthly' | 'weekly' | 'biweekly' | 'quarterly';
  confidence: number; // 0-100
  lastDate: string;
  nextExpectedDate: string;
  occurrences: number;
  notes: string; // common notes from matched transactions
  isSubscription: boolean; // likely a subscription (fixed amount, monthly)
}

/**
 * Detect recurring spending patterns from transaction history
 */
export function detectRecurringPatterns(
  transactions: Transaction[],
  categories: { id: string; name: string }[],
): RecurringPattern[] {
  const expenses = transactions
    .filter(t => t.type === 'expense' && !t.isDeleted)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (expenses.length < 6) return [];

  const catLookup = new Map(categories.map(c => [c.id, c.name]));
  const patterns: RecurringPattern[] = [];

  // Group by category + similar amounts
  const groups = new Map<string, Transaction[]>();
  for (const t of expenses) {
    const key = t.categoryId;
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  }

  for (const [catId, txns] of groups) {
    if (txns.length < 3) continue;

    // Sub-group by similar amounts (within 10% tolerance)
    const amountGroups = groupByAmount(txns, 0.1);

    for (const group of amountGroups) {
      if (group.length < 3) continue;

      // Sort by date
      const sorted = group.sort((a, b) => a.date.localeCompare(b.date));
      
      // Calculate intervals between consecutive transactions
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const daysDiff = dateDiffDays(sorted[i - 1].date, sorted[i].date);
        intervals.push(daysDiff);
      }

      if (intervals.length < 2) continue;

      // Detect frequency
      const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
      const frequency = classifyFrequency(avgInterval);
      if (!frequency) continue;

      // Calculate consistency (lower variance = higher confidence)
      const expectedInterval = getExpectedInterval(frequency);
      const deviations = intervals.map(i => Math.abs(i - expectedInterval) / expectedInterval);
      const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length;
      const confidence = Math.max(30, Math.round(100 - avgDeviation * 100));

      if (confidence < 50) continue;

      const avgAmount = group.reduce((s, t) => s + t.amount, 0) / group.length;
      const lastTxn = sorted[sorted.length - 1];
      const isSubscription = frequency === 'monthly' && 
        deviations.every(d => d < 0.15) && 
        group.every(t => Math.abs(t.amount - avgAmount) / avgAmount < 0.05);

      // Predict next date
      const nextDate = predictNextDate(lastTxn.date, frequency);

      // Find most common note
      const notesCounts = new Map<string, number>();
      for (const t of group) {
        if (t.notes) notesCounts.set(t.notes, (notesCounts.get(t.notes) || 0) + 1);
      }
      const topNote = [...notesCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      patterns.push({
        id: `pattern-${catId}-${Math.round(avgAmount)}`,
        categoryId: catId,
        categoryName: catLookup.get(catId) || 'Unknown',
        amount: Math.round(avgAmount),
        frequency,
        confidence,
        lastDate: lastTxn.date,
        nextExpectedDate: nextDate,
        occurrences: group.length,
        notes: topNote,
        isSubscription,
      });
    }
  }

  return patterns
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 15);
}

function groupByAmount(txns: Transaction[], tolerance: number): Transaction[][] {
  const groups: Transaction[][] = [];
  const used = new Set<string>();

  for (const t of txns) {
    if (used.has(t.id)) continue;
    const group = [t];
    used.add(t.id);

    for (const other of txns) {
      if (used.has(other.id)) continue;
      if (Math.abs(other.amount - t.amount) / t.amount <= tolerance) {
        group.push(other);
        used.add(other.id);
      }
    }
    groups.push(group);
  }
  return groups;
}

function dateDiffDays(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function classifyFrequency(avgDays: number): RecurringPattern['frequency'] | null {
  if (avgDays >= 5 && avgDays <= 10) return 'weekly';
  if (avgDays >= 12 && avgDays <= 17) return 'biweekly';
  if (avgDays >= 25 && avgDays <= 38) return 'monthly';
  if (avgDays >= 80 && avgDays <= 100) return 'quarterly';
  return null;
}

function getExpectedInterval(freq: RecurringPattern['frequency']): number {
  switch (freq) {
    case 'weekly': return 7;
    case 'biweekly': return 14;
    case 'monthly': return 30;
    case 'quarterly': return 90;
  }
}

function predictNextDate(lastDate: string, frequency: RecurringPattern['frequency']): string {
  const d = new Date(lastDate);
  switch (frequency) {
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'biweekly': d.setDate(d.getDate() + 14); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate total monthly recurring cost from detected patterns
 */
export function getMonthlyRecurringCost(patterns: RecurringPattern[]): number {
  return patterns.reduce((total, p) => {
    switch (p.frequency) {
      case 'weekly': return total + p.amount * 4.33;
      case 'biweekly': return total + p.amount * 2.17;
      case 'monthly': return total + p.amount;
      case 'quarterly': return total + p.amount / 3;
    }
  }, 0);
}
