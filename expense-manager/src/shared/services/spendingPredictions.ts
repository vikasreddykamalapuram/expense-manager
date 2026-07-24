import { Transaction, Budget } from '../types';

export interface SpendingForecast {
  projectedTotal: number;       // Estimated end-of-month total
  currentPace: number;          // Daily average spending rate
  daysRemaining: number;
  daysElapsed: number;
  status: 'on_track' | 'overspending' | 'underspending';
  projectedSurplus: number;     // Positive = under budget, negative = over
  confidence: 'high' | 'medium' | 'low';
}

export interface CategoryForecast {
  categoryId: string;
  categoryName: string;
  spent: number;
  budgetLimit: number;
  projected: number;
  burnRate: number;             // % of budget used
  status: 'safe' | 'warning' | 'danger';
  daysToExhaust: number | null; // Days until budget runs out at current pace
}

/**
 * Forecast end-of-month spending based on current pace
 */
export function forecastSpending(
  transactions: Transaction[],
  totalBudget: number,
  currentMonth?: string
): SpendingForecast {
  const now = new Date();
  const month = currentMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysElapsed = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = daysInMonth - daysElapsed;

  const monthExpenses = transactions.filter(
    t => t.type === 'expense' && !t.isDeleted && t.date.startsWith(month)
  );
  const totalSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);

  const dailyAvg = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
  const projectedTotal = totalSpent + (dailyAvg * daysRemaining);

  const projectedSurplus = totalBudget > 0 ? totalBudget - projectedTotal : 0;

  let status: SpendingForecast['status'] = 'on_track';
  if (totalBudget > 0) {
    const paceRatio = projectedTotal / totalBudget;
    if (paceRatio > 1.1) status = 'overspending';
    else if (paceRatio < 0.8) status = 'underspending';
  }

  // Confidence based on how many days of data we have
  let confidence: SpendingForecast['confidence'] = 'low';
  if (daysElapsed >= 20) confidence = 'high';
  else if (daysElapsed >= 10) confidence = 'medium';

  return {
    projectedTotal,
    currentPace: dailyAvg,
    daysRemaining,
    daysElapsed,
    status,
    projectedSurplus,
    confidence,
  };
}

/**
 * Forecast spending per budget category
 */
export function forecastCategoryBudgets(
  transactions: Transaction[],
  budgets: Budget[],
  categories: { id: string; name: string }[],
  currentMonth?: string
): CategoryForecast[] {
  const now = new Date();
  const month = currentMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daysElapsed = Math.min(now.getDate(), daysInMonth);
  const daysRemaining = daysInMonth - daysElapsed;

  const monthExpenses = transactions.filter(
    t => t.type === 'expense' && !t.isDeleted && t.date.startsWith(month)
  );

  const catLookup = new Map(categories.map(c => [c.id, c.name]));
  const forecasts: CategoryForecast[] = [];

  for (const budget of budgets) {
    const catExpenses = monthExpenses.filter(t => t.categoryId === budget.categoryId);
    const spent = catExpenses.reduce((s, t) => s + t.amount, 0);
    const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
    const projected = spent + (dailyAvg * daysRemaining);
    const burnRate = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

    let daysToExhaust: number | null = null;
    if (dailyAvg > 0 && spent < budget.amount) {
      daysToExhaust = Math.ceil((budget.amount - spent) / dailyAvg);
    }

    let status: CategoryForecast['status'] = 'safe';
    if (burnRate >= 90 || projected > budget.amount * 1.1) status = 'danger';
    else if (burnRate >= 70 || projected > budget.amount * 0.9) status = 'warning';

    forecasts.push({
      categoryId: budget.categoryId,
      categoryName: catLookup.get(budget.categoryId) || 'Unknown',
      spent,
      budgetLimit: budget.amount,
      projected,
      burnRate: Math.round(burnRate),
      status,
      daysToExhaust,
    });
  }

  return forecasts.sort((a, b) => b.burnRate - a.burnRate);
}
