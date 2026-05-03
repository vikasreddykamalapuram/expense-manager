import { Transaction, Budget, Account, Category, Settings } from '../types';
import { getCurrentMonth, getPreviousMonth, getMonthRange } from '../utils/helpers';

// ── Types ────────────────────────────────────────────────

export interface HealthFactor {
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  description: string;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  icon: string;
}

export interface HealthScoreResult {
  totalScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  factors: HealthFactor[];
  tips: string[];
}

type Grade = HealthScoreResult['grade'];

// ── Helpers ──────────────────────────────────────────────

function getStatus(score: number): HealthFactor['status'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function getGrade(score: number): Grade {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function getLastNMonths(n: number): string[] {
  const months: string[] = [];
  let current = getCurrentMonth();
  for (let i = 0; i < n; i++) {
    months.unshift(current);
    current = getPreviousMonth(current);
  }
  return months;
}

/** Filter out balance-adjustment pseudo-categories */
function isBalanceAdjustment(categoryId: string, categories: Category[]): boolean {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return false;
  const name = cat.name.toLowerCase();
  return name.includes('modified bal') || name.includes('balance adj') || name.includes('balance adjustment');
}

function monthlyIncomeExpense(
  month: string,
  transactions: Transaction[],
  categories: Category[],
): { income: number; expense: number } {
  const { start, end } = getMonthRange(month);
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.date < start || t.date > end) continue;
    if (isBalanceAdjustment(t.categoryId, categories)) continue;
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += t.amount;
  }
  return { income, expense };
}

// ── Factor 1: Savings Rate (30 %) ────────────────────────

function calcSavingsRate(transactions: Transaction[], categories: Category[]): { score: number; rate: number } {
  const months = getLastNMonths(3);
  let totalIncome = 0;
  let totalExpense = 0;

  for (const m of months) {
    const { income, expense } = monthlyIncomeExpense(m, transactions, categories);
    totalIncome += income;
    totalExpense += expense;
  }

  if (totalIncome === 0) return { score: 0, rate: 0 };

  const rate = ((totalIncome - totalExpense) / totalIncome) * 100;
  let score: number;
  if (rate >= 30) score = 100;
  else if (rate >= 20) score = 80;
  else if (rate >= 10) score = 60;
  else if (rate >= 0) score = 40;
  else score = 0;

  return { score, rate };
}

// ── Factor 2: Budget Adherence (25 %) ────────────────────

function calcBudgetAdherence(
  transactions: Transaction[],
  budgets: Budget[],
  categories: Category[],
): { score: number; adherenceRate: number; hasBudgets: boolean } {
  const currentMonth = getCurrentMonth();
  const monthBudgets = budgets.filter((b) => b.month === currentMonth);

  if (monthBudgets.length === 0) return { score: 50, adherenceRate: -1, hasBudgets: false };

  const { start, end } = getMonthRange(currentMonth);
  let withinBudget = 0;

  for (const budget of monthBudgets) {
    const spent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.categoryId === budget.categoryId &&
          t.date >= start &&
          t.date <= end &&
          !isBalanceAdjustment(t.categoryId, categories),
      )
      .reduce((s, t) => s + t.amount, 0);

    if (spent <= budget.amount) withinBudget++;
  }

  const adherenceRate = (withinBudget / monthBudgets.length) * 100;
  let score: number;
  if (adherenceRate >= 100) score = 100;
  else if (adherenceRate >= 80) score = 80;
  else if (adherenceRate >= 60) score = 60;
  else if (adherenceRate >= 40) score = 40;
  else score = 20;

  return { score, adherenceRate, hasBudgets: true };
}

// ── Factor 3: Debt-to-Income Ratio (20 %) ────────────────

function calcDebtToIncome(
  transactions: Transaction[],
  accounts: Account[],
  categories: Category[],
): { score: number; ratio: number; hasDebt: boolean } {
  const liabilityAccounts = accounts.filter((a) => a.kind === 'liability' && a.isActive);

  if (liabilityAccounts.length === 0) return { score: 100, ratio: 0, hasDebt: false };

  // Calculate current liability balances
  let totalLiability = 0;
  for (const acc of liabilityAccounts) {
    let balance = acc.openingBalance; // for liabilities this is amount owed (positive)
    for (const t of transactions) {
      if (t.type === 'expense' && t.accountId === acc.id) balance += t.amount;
      if (t.type === 'income' && t.accountId === acc.id) balance -= t.amount;
      if (t.type === 'transfer' && t.toAccountId === acc.id) balance -= t.amount;
      if (t.type === 'transfer' && t.accountId === acc.id) balance += t.amount;
    }
    totalLiability += Math.max(0, balance);
  }

  // Average monthly income (last 3 months)
  const months = getLastNMonths(3);
  let totalIncome = 0;
  for (const m of months) {
    totalIncome += monthlyIncomeExpense(m, transactions, categories).income;
  }
  const avgMonthlyIncome = totalIncome / 3;

  if (avgMonthlyIncome === 0) return { score: 20, ratio: 100, hasDebt: true };

  const ratio = (totalLiability / avgMonthlyIncome) * 100;
  let score: number;
  if (ratio < 20) score = 100;
  else if (ratio < 35) score = 80;
  else if (ratio < 50) score = 60;
  else if (ratio < 75) score = 40;
  else score = 20;

  return { score, ratio, hasDebt: true };
}

// ── Factor 4: Expense Diversity (15 %) ───────────────────

function calcExpenseDiversity(
  transactions: Transaction[],
  categories: Category[],
): { score: number; topCategoryPct: number } {
  const currentMonth = getCurrentMonth();
  const { start, end } = getMonthRange(currentMonth);

  const expenseTxns = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.date >= start &&
      t.date <= end &&
      !isBalanceAdjustment(t.categoryId, categories),
  );

  const total = expenseTxns.reduce((s, t) => s + t.amount, 0);
  if (total === 0) return { score: 50, topCategoryPct: 0 };

  // Group by parent category
  const catMap = new Map<string, number>();
  for (const t of expenseTxns) {
    const cat = categories.find((c) => c.id === t.categoryId);
    const effectiveId = cat?.parentId || t.categoryId;
    catMap.set(effectiveId, (catMap.get(effectiveId) || 0) + t.amount);
  }

  // Shannon entropy
  const n = catMap.size;
  if (n <= 1) return { score: 40, topCategoryPct: 100 };

  let entropy = 0;
  let maxPct = 0;
  for (const amount of catMap.values()) {
    const p = amount / total;
    if (p > 0) entropy -= p * Math.log2(p);
    const pct = p * 100;
    if (pct > maxPct) maxPct = pct;
  }

  const maxEntropy = Math.log2(n);
  const normalized = maxEntropy > 0 ? entropy / maxEntropy : 0;

  let score: number;
  if (maxPct > 50) {
    // Penalise heavy concentration
    score = Math.min(40, Math.round(normalized * 100));
  } else if (normalized >= 0.8) {
    score = 100;
  } else if (normalized >= 0.6) {
    score = 70;
  } else {
    score = 40;
  }

  return { score, topCategoryPct: Math.round(maxPct) };
}

// ── Factor 5: Financial Consistency (10 %) ───────────────

function calcConsistency(
  transactions: Transaction[],
  categories: Category[],
): { score: number; months: number } {
  const months = getLastNMonths(6);
  const savingsArr: number[] = [];

  for (const m of months) {
    const { income, expense } = monthlyIncomeExpense(m, transactions, categories);
    if (income > 0 || expense > 0) {
      savingsArr.push(income - expense);
    }
  }

  if (savingsArr.length < 3) return { score: 50, months: savingsArr.length };

  const mean = savingsArr.reduce((a, b) => a + b, 0) / savingsArr.length;
  const variance = savingsArr.reduce((s, v) => s + (v - mean) ** 2, 0) / savingsArr.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (relative to mean income magnitude)
  const avgIncome =
    months.reduce((s, m) => s + monthlyIncomeExpense(m, transactions, categories).income, 0) /
    months.length;
  if (avgIncome === 0) return { score: 50, months: savingsArr.length };

  const cv = stdDev / avgIncome;

  let score: number;
  if (cv < 0.15) score = 100;
  else if (cv < 0.3) score = 70;
  else score = 40;

  return { score, months: savingsArr.length };
}

// ── Tips Generator ───────────────────────────────────────

function generateTips(
  factors: HealthFactor[],
  meta: {
    savingsRate: number;
    hasBudgets: boolean;
    hasDebt: boolean;
    topCategoryPct: number;
    debtRatio: number;
  },
): string[] {
  const tips: string[] = [];
  const sorted = [...factors].sort((a, b) => a.score - b.score);

  for (const f of sorted) {
    if (tips.length >= 5) break;

    if (f.name === 'Savings Rate' && f.score < 80) {
      if (meta.savingsRate < 0) {
        tips.push('You\'re spending more than you earn — review expenses and cut non-essentials.');
      } else if (meta.savingsRate < 10) {
        tips.push('Aim to save at least 10% of your income — automate transfers to a savings account.');
      } else {
        tips.push('Increase your savings rate — aim for at least 20% of income.');
      }
    }

    if (f.name === 'Budget Adherence' && f.score <= 50) {
      if (!meta.hasBudgets) {
        tips.push('Set budgets for your top expense categories to track spending effectively.');
      } else {
        tips.push('You\'re exceeding most budgets — review limits or reduce discretionary spending.');
      }
    }

    if (f.name === 'Debt-to-Income' && f.score < 80 && meta.hasDebt) {
      if (meta.debtRatio > 50) {
        tips.push('Your debt is over 50% of income — consider restructuring or accelerating repayments.');
      } else {
        tips.push('Keep debt-to-income below 20% for a strong financial position.');
      }
    }

    if (f.name === 'Expense Diversity' && f.score < 70) {
      tips.push(
        meta.topCategoryPct > 50
          ? `${meta.topCategoryPct}% of expenses go to one category — diversify or negotiate lower costs.`
          : 'Spread expenses more evenly across categories to reduce concentration risk.',
      );
    }

    if (f.name === 'Consistency' && f.score < 70) {
      tips.push('Stabilise monthly savings — set up recurring savings transfers on payday.');
    }
  }

  if (tips.length === 0) {
    tips.push('Great job! Keep maintaining your healthy financial habits.');
  }

  return tips;
}

// ── Main Calculator ──────────────────────────────────────

export function calculateHealthScore(
  transactions: Transaction[],
  budgets: Budget[],
  accounts: Account[],
  categories: Category[],
  _settings: Settings,
): HealthScoreResult {
  const savings = calcSavingsRate(transactions, categories);
  const budget = calcBudgetAdherence(transactions, budgets, categories);
  const debt = calcDebtToIncome(transactions, accounts, categories);
  const diversity = calcExpenseDiversity(transactions, categories);
  const consistency = calcConsistency(transactions, categories);

  const factors: HealthFactor[] = [
    {
      name: 'Savings Rate',
      score: savings.score,
      weight: 30,
      weightedScore: Math.round((savings.score * 30) / 100),
      description:
        savings.rate >= 0
          ? `Saving ${Math.round(savings.rate)}% of income (3-month avg)`
          : 'Spending exceeds income over the last 3 months',
      status: getStatus(savings.score),
      icon: 'PiggyBank',
    },
    {
      name: 'Budget Adherence',
      score: budget.score,
      weight: 25,
      weightedScore: Math.round((budget.score * 25) / 100),
      description: budget.hasBudgets
        ? `${Math.round(budget.adherenceRate)}% of budgets are on track this month`
        : 'No budgets set — add budgets to improve this score',
      status: getStatus(budget.score),
      icon: 'Target',
    },
    {
      name: 'Debt-to-Income',
      score: debt.score,
      weight: 20,
      weightedScore: Math.round((debt.score * 20) / 100),
      description: debt.hasDebt
        ? `Debt is ${Math.round(debt.ratio)}% of monthly income`
        : 'No outstanding debts — excellent!',
      status: getStatus(debt.score),
      icon: 'CreditCard',
    },
    {
      name: 'Expense Diversity',
      score: diversity.score,
      weight: 15,
      weightedScore: Math.round((diversity.score * 15) / 100),
      description:
        diversity.topCategoryPct > 50
          ? `Top category uses ${diversity.topCategoryPct}% of expenses`
          : 'Expenses are well spread across categories',
      status: getStatus(diversity.score),
      icon: 'PieChart',
    },
    {
      name: 'Consistency',
      score: consistency.score,
      weight: 10,
      weightedScore: Math.round((consistency.score * 10) / 100),
      description:
        consistency.months < 3
          ? 'Not enough data yet — keep tracking!'
          : consistency.score >= 70
            ? 'Savings behaviour is steady month-to-month'
            : 'Monthly savings vary significantly — aim for stability',
      status: getStatus(consistency.score),
      icon: 'Activity',
    },
  ];

  const totalScore = factors.reduce((s, f) => s + f.weightedScore, 0);
  const grade = getGrade(totalScore);

  const tips = generateTips(factors, {
    savingsRate: savings.rate,
    hasBudgets: budget.hasBudgets,
    hasDebt: debt.hasDebt,
    topCategoryPct: diversity.topCategoryPct,
    debtRatio: debt.ratio,
  });

  return { totalScore, grade, factors, tips };
}

/** Compute score for a given month (for trend chart). */
export function calculateMonthlyScore(
  month: string,
  transactions: Transaction[],
  budgets: Budget[],
  accounts: Account[],
  categories: Category[],
  settings: Settings,
): number {
  // Filter transactions up to and including the target month
  const { end } = getMonthRange(month);
  const filtered = transactions.filter((t) => t.date <= end);
  const monthBudgets = budgets.filter((b) => b.month === month);
  return calculateHealthScore(filtered, monthBudgets, accounts, categories, settings).totalScore;
}
