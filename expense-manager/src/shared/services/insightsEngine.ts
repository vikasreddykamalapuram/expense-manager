import { Transaction, Category } from '../types';

export interface Insight {
  id: string;
  type: 'spending_spike' | 'category_trend' | 'period_comparison' | 'unusual_day' | 'savings_opportunity' | 'streak';
  severity: 'info' | 'warning' | 'positive';
  title: string;
  description: string;
  icon: string; // lucide icon name
  value?: number;
  change?: number; // percentage change
}

function getMonthKey(date: string): string {
  return date.slice(0, 7); // YYYY-MM
}

function getDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Generate smart spending insights from transaction data
 */
export function generateInsights(
  transactions: Transaction[],
  categories: Category[],
  currentMonth?: string
): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();
  const thisMonth = currentMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [y, m] = thisMonth.split('-').map(Number);
  const lastMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;

  const expenses = transactions.filter(t => t.type === 'expense' && !t.isDeleted);
  const thisMonthExpenses = expenses.filter(t => getMonthKey(t.date) === thisMonth);
  const lastMonthExpenses = expenses.filter(t => getMonthKey(t.date) === lastMonth);

  // 1. Period-over-period comparison
  const thisMonthTotal = thisMonthExpenses.reduce((s, t) => s + t.amount, 0);
  const lastMonthTotal = lastMonthExpenses.reduce((s, t) => s + t.amount, 0);

  if (lastMonthTotal > 0 && thisMonthTotal > 0) {
    const change = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    if (Math.abs(change) >= 10) {
      insights.push({
        id: 'period-comparison',
        type: 'period_comparison',
        severity: change > 0 ? 'warning' : 'positive',
        title: change > 0 ? 'Spending increased' : 'Spending decreased',
        description: `You spent ${Math.abs(change).toFixed(0)}% ${change > 0 ? 'more' : 'less'} this month compared to last month`,
        icon: change > 0 ? 'TrendingUp' : 'TrendingDown',
        value: thisMonthTotal,
        change: Math.round(change),
      });
    }
  }

  // 2. Category trends — find categories with biggest increase
  const categoryMap = new Map<string, { name: string; thisMonth: number; lastMonth: number }>();
  const catLookup = new Map(categories.map(c => [c.id, c]));

  for (const t of thisMonthExpenses) {
    const cat = catLookup.get(t.categoryId);
    const name = cat?.name || 'Unknown';
    const entry = categoryMap.get(t.categoryId) || { name, thisMonth: 0, lastMonth: 0 };
    entry.thisMonth += t.amount;
    categoryMap.set(t.categoryId, entry);
  }
  for (const t of lastMonthExpenses) {
    const cat = catLookup.get(t.categoryId);
    const name = cat?.name || 'Unknown';
    const entry = categoryMap.get(t.categoryId) || { name, thisMonth: 0, lastMonth: 0 };
    entry.lastMonth += t.amount;
    categoryMap.set(t.categoryId, entry);
  }

  // Find biggest rising category
  let biggestRise = { catId: '', change: 0, name: '' };
  for (const [catId, data] of categoryMap) {
    if (data.lastMonth > 0 && data.thisMonth > data.lastMonth) {
      const pctChange = ((data.thisMonth - data.lastMonth) / data.lastMonth) * 100;
      if (pctChange > biggestRise.change && data.thisMonth >= 500) {
        biggestRise = { catId, change: pctChange, name: data.name };
      }
    }
  }
  if (biggestRise.change >= 30) {
    insights.push({
      id: `cat-trend-${biggestRise.catId}`,
      type: 'category_trend',
      severity: 'warning',
      title: `${biggestRise.name} spending rising`,
      description: `Up ${biggestRise.change.toFixed(0)}% vs last month — review if needed`,
      icon: 'ArrowUpRight',
      change: Math.round(biggestRise.change),
    });
  }

  // Find biggest drop (positive insight)
  let biggestDrop = { catId: '', change: 0, name: '' };
  for (const [catId, data] of categoryMap) {
    if (data.lastMonth > 0 && data.thisMonth < data.lastMonth) {
      const pctChange = ((data.lastMonth - data.thisMonth) / data.lastMonth) * 100;
      if (pctChange > biggestDrop.change && data.lastMonth >= 500) {
        biggestDrop = { catId, change: pctChange, name: data.name };
      }
    }
  }
  if (biggestDrop.change >= 30) {
    insights.push({
      id: `cat-drop-${biggestDrop.catId}`,
      type: 'category_trend',
      severity: 'positive',
      title: `${biggestDrop.name} spending reduced`,
      description: `Down ${biggestDrop.change.toFixed(0)}% vs last month — great job!`,
      icon: 'ArrowDownRight',
      change: -Math.round(biggestDrop.change),
    });
  }

  // 3. Highest spending day
  const dailySpending: Map<string, number> = new Map();
  for (const t of thisMonthExpenses) {
    dailySpending.set(t.date, (dailySpending.get(t.date) || 0) + t.amount);
  }

  if (dailySpending.size > 0) {
    const sorted = [...dailySpending.entries()].sort((a, b) => b[1] - a[1]);
    const [peakDate, peakAmount] = sorted[0];
    const avgDaily = thisMonthTotal / dailySpending.size;

    if (peakAmount > avgDaily * 2.5 && peakAmount >= 1000) {
      const dayStr = new Date(peakDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      insights.push({
        id: 'unusual-day',
        type: 'unusual_day',
        severity: 'info',
        title: `Peak spending on ${dayStr}`,
        description: `₹${peakAmount.toLocaleString('en-IN')} spent — ${(peakAmount / avgDaily).toFixed(1)}× your daily average`,
        icon: 'Calendar',
        value: peakAmount,
      });
    }
  }

  // 4. Spending-free days streak
  const daysThisMonth = getDaysInMonth(thisMonth);
  const daysSoFar = Math.min(now.getDate(), daysThisMonth);
  const daysWithSpending = new Set(thisMonthExpenses.map(t => t.date));
  const spendFreeDays = daysSoFar - daysWithSpending.size;

  if (spendFreeDays >= 5) {
    insights.push({
      id: 'spend-free-streak',
      type: 'streak',
      severity: 'positive',
      title: `${spendFreeDays} no-spend days this month`,
      description: `You've had ${spendFreeDays} days without expenses — building good habits!`,
      icon: 'Flame',
      value: spendFreeDays,
    });
  }

  // 5. Weekend vs weekday spending pattern
  let weekdayTotal = 0, weekdayDays = 0, weekendTotal = 0, weekendDays = 0;
  const weekdayDates = new Set<string>();
  const weekendDates = new Set<string>();

  for (const t of thisMonthExpenses) {
    const day = new Date(t.date).getDay();
    if (day === 0 || day === 6) {
      weekendTotal += t.amount;
      weekendDates.add(t.date);
    } else {
      weekdayTotal += t.amount;
      weekdayDates.add(t.date);
    }
  }
  weekdayDays = weekdayDates.size || 1;
  weekendDays = weekendDates.size || 1;

  const avgWeekday = weekdayTotal / weekdayDays;
  const avgWeekend = weekendTotal / weekendDays;

  if (avgWeekend > avgWeekday * 1.8 && weekendTotal >= 2000) {
    insights.push({
      id: 'weekend-spending',
      type: 'spending_spike',
      severity: 'info',
      title: 'Weekend spending is high',
      description: `You spend ${(avgWeekend / avgWeekday).toFixed(1)}× more on weekends than weekdays`,
      icon: 'Sun',
    });
  }

  // 6. Top category dominance
  if (thisMonthTotal > 0) {
    const topCat = [...categoryMap.entries()]
      .sort((a, b) => b[1].thisMonth - a[1].thisMonth)[0];
    if (topCat) {
      const pct = (topCat[1].thisMonth / thisMonthTotal) * 100;
      if (pct >= 40) {
        insights.push({
          id: 'top-category-dominance',
          type: 'savings_opportunity',
          severity: 'info',
          title: `${topCat[1].name} dominates spending`,
          description: `${pct.toFixed(0)}% of your expenses go to ${topCat[1].name} — consider diversifying or cutting back`,
          icon: 'PieChart',
          value: topCat[1].thisMonth,
          change: Math.round(pct),
        });
      }
    }
  }

  // 7. Income vs Expense ratio insight
  const incomes = transactions.filter(t => t.type === 'income' && !t.isDeleted && getMonthKey(t.date) === thisMonth);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);

  if (totalIncome > 0 && thisMonthTotal > 0) {
    const savingsRate = ((totalIncome - thisMonthTotal) / totalIncome) * 100;
    if (savingsRate >= 30) {
      insights.push({
        id: 'good-savings-rate',
        type: 'savings_opportunity',
        severity: 'positive',
        title: `Saving ${savingsRate.toFixed(0)}% of income`,
        description: `Great job! You're saving ₹${(totalIncome - thisMonthTotal).toLocaleString('en-IN')} this month`,
        icon: 'Piggy Bank',
        value: totalIncome - thisMonthTotal,
      });
    } else if (savingsRate < 10 && savingsRate >= 0) {
      insights.push({
        id: 'low-savings-rate',
        type: 'savings_opportunity',
        severity: 'warning',
        title: `Only saving ${savingsRate.toFixed(0)}% of income`,
        description: `Try to save at least 20% — currently ₹${(totalIncome - thisMonthTotal).toLocaleString('en-IN')}`,
        icon: 'AlertTriangle',
        value: totalIncome - thisMonthTotal,
      });
    }
  }

  return insights.slice(0, 6); // Max 6 insights at a time
}
