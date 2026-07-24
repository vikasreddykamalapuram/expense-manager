import { Transaction, Category } from '../types';

export interface AnomalyFlag {
  id: string;
  transactionId: string;
  type: 'amount_outlier' | 'rare_category' | 'unusual_time' | 'first_merchant' | 'frequency_spike';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  score: number; // 0-100 anomaly confidence
}

/**
 * Detect anomalies in transactions using statistical methods
 */
export function detectAnomalies(
  transactions: Transaction[],
  categories: Category[],
): AnomalyFlag[] {
  const anomalies: AnomalyFlag[] = [];
  const expenses = transactions.filter(t => t.type === 'expense' && !t.isDeleted);

  if (expenses.length < 5) return [];

  const catLookup = new Map(categories.map(c => [c.id, c]));

  // Sort by date descending — analyze recent transactions
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const recentWindow = sorted.slice(0, 30); // Last 30 transactions

  // 1. Amount outlier detection (IQR method)
  const amounts = expenses.map(t => t.amount).sort((a, b) => a - b);
  const q1 = amounts[Math.floor(amounts.length * 0.25)];
  const q3 = amounts[Math.floor(amounts.length * 0.75)];
  const iqr = q3 - q1;
  const upperFence = q3 + 2 * iqr; // Use 2×IQR (more lenient than 1.5)
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;

  for (const t of recentWindow) {
    if (t.amount > upperFence && t.amount > mean * 3) {
      const zScore = iqr > 0 ? (t.amount - mean) / (iqr * 0.7413) : 0; // approximate std
      anomalies.push({
        id: `outlier-${t.id}`,
        transactionId: t.id,
        type: 'amount_outlier',
        severity: zScore > 4 ? 'high' : zScore > 3 ? 'medium' : 'low',
        title: 'Unusually large expense',
        description: `₹${t.amount.toLocaleString('en-IN')} is ${(t.amount / mean).toFixed(1)}× your average expense`,
        score: Math.min(95, Math.round(50 + zScore * 10)),
      });
    }
  }

  // 2. Rare category detection
  const categoryCounts = new Map<string, number>();
  for (const t of expenses) {
    categoryCounts.set(t.categoryId, (categoryCounts.get(t.categoryId) || 0) + 1);
  }
  const totalTxns = expenses.length;

  for (const t of recentWindow.slice(0, 10)) { // Only check last 10
    const count = categoryCounts.get(t.categoryId) || 0;
    const frequency = count / totalTxns;
    const cat = catLookup.get(t.categoryId);

    if (frequency < 0.03 && count <= 2 && cat) {
      anomalies.push({
        id: `rare-cat-${t.id}`,
        transactionId: t.id,
        type: 'rare_category',
        severity: 'low',
        title: `Rare category: ${cat.name}`,
        description: `You've only used "${cat.name}" ${count} time${count > 1 ? 's' : ''} before`,
        score: Math.round(40 + (1 - frequency) * 30),
      });
    }
  }

  // 3. Category spending spike (per-category amount outlier)
  const categoryAmounts = new Map<string, number[]>();
  for (const t of expenses) {
    const arr = categoryAmounts.get(t.categoryId) || [];
    arr.push(t.amount);
    categoryAmounts.set(t.categoryId, arr);
  }

  for (const t of recentWindow.slice(0, 15)) {
    const catAmounts = categoryAmounts.get(t.categoryId);
    if (!catAmounts || catAmounts.length < 4) continue;

    const catMean = catAmounts.reduce((s, a) => s + a, 0) / catAmounts.length;
    const catSorted = [...catAmounts].sort((a, b) => a - b);
    const catQ3 = catSorted[Math.floor(catSorted.length * 0.75)];

    if (t.amount > catQ3 * 2.5 && t.amount > catMean * 3) {
      const cat = catLookup.get(t.categoryId);
      // Skip if already flagged as amount outlier
      if (anomalies.some(a => a.transactionId === t.id)) continue;

      anomalies.push({
        id: `cat-spike-${t.id}`,
        transactionId: t.id,
        type: 'frequency_spike',
        severity: 'medium',
        title: `High for ${cat?.name || 'this category'}`,
        description: `₹${t.amount.toLocaleString('en-IN')} is ${(t.amount / catMean).toFixed(1)}× the category average`,
        score: Math.round(55 + Math.min(30, (t.amount / catMean - 1) * 10)),
      });
    }
  }

  // Sort by score descending and limit
  return anomalies
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

/**
 * Check if a single transaction is anomalous (for real-time flagging)
 */
export function isTransactionAnomalous(
  transaction: Transaction,
  historicalTransactions: Transaction[],
  _categories: Category[],
): AnomalyFlag | null {
  if (transaction.type !== 'expense') return null;

  const expenses = historicalTransactions.filter(t => t.type === 'expense' && !t.isDeleted);
  if (expenses.length < 5) return null;

  const amounts = expenses.map(t => t.amount).sort((a, b) => a - b);
  const q1 = amounts[Math.floor(amounts.length * 0.25)];
  const q3 = amounts[Math.floor(amounts.length * 0.75)];
  const iqr = q3 - q1;
  const upperFence = q3 + 2.5 * iqr;
  const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;

  if (transaction.amount > upperFence && transaction.amount > mean * 3) {
    return {
      id: `outlier-${transaction.id}`,
      transactionId: transaction.id,
      type: 'amount_outlier',
      severity: 'high',
      title: 'Unusually large expense',
      description: `₹${transaction.amount.toLocaleString('en-IN')} is ${(transaction.amount / mean).toFixed(1)}× your average`,
      score: 85,
    };
  }

  return null;
}
