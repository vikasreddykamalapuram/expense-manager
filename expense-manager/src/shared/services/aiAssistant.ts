import { Transaction, Category, Account, Settings } from '../types';
import { formatCurrency } from '../utils/helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedQuery {
  intent: Intent;
  period: { start: Date; end: Date } | null;
  categoryMatch: string | null;
  accountMatch: string | null;
  searchTerm: string | null;
  amountFilter: { op: 'gt' | 'lt' | 'eq'; value: number } | null;
  limit: number;
}

type Intent =
  | 'income'
  | 'expense'
  | 'category_ranking'
  | 'comparison'
  | 'pattern'
  | 'account'
  | 'time_analysis'
  | 'summary'
  | 'savings'
  | 'search';

interface AssistantContext {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  settings: Settings;
}

export interface AssistantResponse {
  text: string;
}

// ─── Category Emoji Map ──────────────────────────────────────────────────────

const CATEGORY_EMOJIS: Record<string, string> = {
  salary: '💰', freelance: '💻', investment: '📈', business: '🏢', rental: '🏠',
  gift: '🎁', refund: '↩️', dividend: '💹', interest: '🏦', other: '📋',
  food: '🍕', dining: '🍕', grocery: '🛒', groceries: '🛒', restaurant: '🍽️',
  transport: '🚗', car: '🚗', fuel: '⛽', petrol: '⛽', shopping: '🛍️',
  entertainment: '🎬', health: '💊', medical: '💊', education: '📚',
  utilities: '💡', rent: '🏠', home: '🏠', household: '🏠', travel: '✈️',
  insurance: '🛡️', subscription: '📱', phone: '📱', internet: '🌐',
  clothing: '👕', personal: '💄', fitness: '🏋️', gym: '🏋️', default: '📊',
};

function getCategoryEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return CATEGORY_EMOJIS.default;
}

// ─── NLP Parser ──────────────────────────────────────────────────────────────

function parseTimePeriod(query: string): { start: Date; end: Date } | null {
  const now = new Date();
  const lower = query.toLowerCase();

  // "today"
  if (/\btoday\b/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "this week"
  if (/\bthis week\b/.test(lower)) {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "last week"
  if (/\blast week\b/.test(lower)) {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - 7);
    const end = new Date(thisMonday);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "past N days/months"
  const pastMatch = lower.match(/past\s+(\d+)\s+(day|days|month|months|week|weeks)/);
  if (pastMatch) {
    const n = parseInt(pastMatch[1]);
    const unit = pastMatch[2];
    const start = new Date(now);
    if (unit.startsWith('day')) start.setDate(start.getDate() - n);
    else if (unit.startsWith('week')) start.setDate(start.getDate() - n * 7);
    else start.setMonth(start.getMonth() - n);
    return { start, end: new Date(now) };
  }

  // "last N months/days"
  const lastNMatch = lower.match(/last\s+(\d+)\s+(day|days|month|months|week|weeks)/);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1]);
    const unit = lastNMatch[2];
    const start = new Date(now);
    if (unit.startsWith('day')) start.setDate(start.getDate() - n);
    else if (unit.startsWith('week')) start.setDate(start.getDate() - n * 7);
    else start.setMonth(start.getMonth() - n);
    return { start, end: new Date(now) };
  }

  // "this month"
  if (/\bthis month\b/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "last month"
  if (/\blast month\b/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { start, end };
  }

  // "this quarter"
  if (/\bthis quarter\b/.test(lower)) {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "last quarter"
  if (/\blast quarter\b/.test(lower)) {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
    const end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // "Q1", "Q2", "Q3", "Q4"
  const qMatch = lower.match(/\bq([1-4])\b/);
  if (qMatch) {
    const q = parseInt(qMatch[1]) - 1;
    const year = now.getMonth() < q * 3 ? now.getFullYear() - 1 : now.getFullYear();
    const start = new Date(year, q * 3, 1);
    const end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  // "this year"
  if (/\bthis year\b/.test(lower)) {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // "last year"
  if (/\blast year\b/.test(lower)) {
    const start = new Date(now.getFullYear() - 1, 0, 1);
    const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  // "past year"
  if (/\bpast year\b/.test(lower)) {
    const start = new Date(now);
    start.setFullYear(start.getFullYear() - 1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // Financial year: "financial year 2026", "FY 2025-26", "fiscal year 2024", "FY2024"
  const fyMatch = lower.match(/\b(?:financial year|fy|fiscal year)\s*(\d{4})(?:\s*[-–]\s*(\d{2,4}))?/);
  if (fyMatch) {
    let endingYear = parseInt(fyMatch[1]);
    if (fyMatch[2]) {
      // "FY 2025-26" or "FY 2025-2026": the second part is the ending year
      const secondPart = fyMatch[2];
      endingYear = secondPart.length === 2
        ? parseInt(fyMatch[1].substring(0, 2) + secondPart)
        : parseInt(secondPart);
    }
    // Indian FY convention: FY 2026 = April 1, 2025 – March 31, 2026
    const start = new Date(endingYear - 1, 3, 1); // April 1 of previous year
    const end = new Date(endingYear, 2, 31, 23, 59, 59, 999); // March 31 of ending year
    return { start, end };
  }

  // Calendar year: "calendar year 2025", "year 2026", or standalone "2025"
  const calYearMatch = lower.match(/\b(?:calendar year|year)\s+(\d{4})\b/);
  if (calYearMatch) {
    const year = parseInt(calYearMatch[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }
  // Standalone 4-digit year (must not be preceded by "financial year", "fy", "fiscal year", or "year")
  const standaloneYearMatch = lower.match(/\b(20\d{2})\b/);
  if (standaloneYearMatch && !/\b(?:financial year|fy|fiscal year|calendar year|year)\s+\d{4}/.test(lower)) {
    const year = parseInt(standaloneYearMatch[1]);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  // Month names: "January", "Feb", "March 2024"
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const monthRegex = new RegExp(`\\b(${monthNames.join('|')}|${monthAbbr.join('|')})\\s*(\\d{4})?\\b`, 'i');
  const monthMatch = lower.match(monthRegex);
  if (monthMatch) {
    const mName = monthMatch[1].toLowerCase();
    let mIdx = monthNames.indexOf(mName);
    if (mIdx === -1) mIdx = monthAbbr.indexOf(mName);
    const year = monthMatch[2] ? parseInt(monthMatch[2]) : (mIdx > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear());
    const start = new Date(year, mIdx, 1);
    const end = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  return null;
}

function parseIntent(query: string): Intent {
  const lower = query.toLowerCase();

  if (/\b(find|search|show all|show me|where did|list)\b/.test(lower) && !/\b(top|biggest|most|pattern|trend)\b/.test(lower)) return 'search';
  if (/\b(income|earn|salary|earned|earning|revenue)\b/.test(lower) && !/\b(vs|versus|compare|saving)\b/.test(lower)) return 'income';
  if (/\b(spend|spent|expense|expenses|cost|costs|expenditure)\b/.test(lower) && !/\b(vs|versus|compare|top|biggest|most|pattern|trend|saving)\b/.test(lower)) return 'expense';
  if (/\b(top|biggest|most|highest|largest|major|rank)\b/.test(lower) && /\b(categor|spend|expense)\b/.test(lower)) return 'category_ranking';
  if (/\b(compare|vs|versus|income.*expense|expense.*income|saving or spending|spending or saving)\b/.test(lower)) return 'comparison';
  if (/\b(pattern|analyze|trend|overspend|habit|behaviour|behavior)\b/.test(lower)) return 'pattern';
  if (/\b(balance|account|bank|credit card|wallet|which account)\b/.test(lower)) return 'account';
  if (/\b(daily average|day.*(spend|most)|weekend|weekday|average.*day)\b/.test(lower)) return 'time_analysis';
  if (/\b(summary|report|overview|how am i doing|financial|financially)\b/.test(lower)) return 'summary';
  if (/\b(save|saving|savings rate|projected|can i save|budget)\b/.test(lower)) return 'savings';

  // Fallback: if mentions a category or has spending context
  if (/\bhow much\b/.test(lower)) return 'expense';
  return 'summary';
}

function parseCategory(query: string, categories: Category[]): string | null {
  const lower = query.toLowerCase();
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    if (lower.includes(catLower)) return cat.id;
    // Check partial match (e.g., "food" matches "Food & Dining")
    const words = catLower.split(/[\s&/]+/);
    for (const w of words) {
      if (w.length > 3 && lower.includes(w)) return cat.id;
    }
  }
  return null;
}

function parseAccount(query: string, accounts: Account[]): string | null {
  const lower = query.toLowerCase();
  for (const acc of accounts) {
    if (lower.includes(acc.name.toLowerCase())) return acc.id;
    if (acc.institution && lower.includes(acc.institution.toLowerCase())) return acc.id;
  }
  if (/\bcredit card\b/.test(lower)) {
    const cc = accounts.find(a => a.type === 'credit_card');
    if (cc) return cc.id;
  }
  return null;
}

function parseAmountFilter(query: string): { op: 'gt' | 'lt' | 'eq'; value: number } | null {
  const lower = query.toLowerCase();
  const gtMatch = lower.match(/(?:over|above|more than|greater than|>)\s*(\d+[\d,]*)/);
  if (gtMatch) return { op: 'gt', value: parseFloat(gtMatch[1].replace(/,/g, '')) };
  const ltMatch = lower.match(/(?:under|below|less than|<)\s*(\d+[\d,]*)/);
  if (ltMatch) return { op: 'lt', value: parseFloat(ltMatch[1].replace(/,/g, '')) };
  return null;
}

function parseSearchTerm(query: string): string | null {
  const lower = query.toLowerCase();
  // Extract after "for", "at", "on", "from" keywords
  const searchMatch = lower.match(/(?:for|at|from|about|on)\s+["']?([^"'?]+?)["']?\s*(?:\?|$)/);
  if (searchMatch) return searchMatch[1].trim();
  // "show all X purchases" pattern
  const showMatch = lower.match(/(?:show|find|list|search)\s+(?:all\s+)?(.+?)(?:\s+(?:purchases|transactions|payments|expenses))/);
  if (showMatch) return showMatch[1].trim();
  return null;
}

export function parseQuery(query: string, categories: Category[], accounts: Account[]): ParsedQuery {
  return {
    intent: parseIntent(query),
    period: parseTimePeriod(query),
    categoryMatch: parseCategory(query, categories),
    accountMatch: parseAccount(query, accounts),
    searchTerm: parseSearchTerm(query),
    amountFilter: parseAmountFilter(query),
    limit: 5,
  };
}

// ─── Analysis Functions ──────────────────────────────────────────────────────

function filterByPeriod(transactions: Transaction[], period: { start: Date; end: Date } | null): Transaction[] {
  if (!period) return transactions;
  return transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d >= period.start && d <= period.end;
  });
}

function getIncomeForPeriod(ctx: AssistantContext, period: { start: Date; end: Date } | null): { total: number; breakdown: { name: string; amount: number }[] } {
  const txns = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'income');
  const total = txns.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = new Map<string, number>();
  txns.forEach(t => {
    const cat = ctx.categories.find(c => c.id === t.categoryId);
    const name = cat?.name || 'Other';
    byCategory.set(name, (byCategory.get(name) || 0) + t.amount);
  });
  const breakdown = Array.from(byCategory.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { total, breakdown };
}

function getExpensesForPeriod(ctx: AssistantContext, period: { start: Date; end: Date } | null, categoryId?: string | null, accountId?: string | null): { total: number; breakdown: { name: string; amount: number }[]; count: number } {
  let txns = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'expense');
  if (categoryId) txns = txns.filter(t => t.categoryId === categoryId);
  if (accountId) txns = txns.filter(t => t.accountId === accountId);
  const total = txns.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = new Map<string, number>();
  txns.forEach(t => {
    const cat = ctx.categories.find(c => c.id === t.categoryId);
    const name = cat?.name || 'Other';
    byCategory.set(name, (byCategory.get(name) || 0) + t.amount);
  });
  const breakdown = Array.from(byCategory.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  return { total, breakdown, count: txns.length };
}

function getTopCategories(ctx: AssistantContext, type: 'expense' | 'income', period: { start: Date; end: Date } | null, limit: number): { name: string; amount: number; percentage: number }[] {
  const txns = filterByPeriod(ctx.transactions, period).filter(t => t.type === type);
  const total = txns.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = new Map<string, number>();
  txns.forEach(t => {
    const cat = ctx.categories.find(c => c.id === t.categoryId);
    const name = cat?.name || 'Other';
    byCategory.set(name, (byCategory.get(name) || 0) + t.amount);
  });
  return Array.from(byCategory.entries())
    .map(([name, amount]) => ({ name, amount, percentage: total > 0 ? Math.round((amount / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

function getSpendingPatterns(ctx: AssistantContext, period: { start: Date; end: Date } | null): { dailyAvg: number; dayOfWeek: { day: string; avg: number }[]; weekendAvg: number; weekdayAvg: number; totalDays: number } {
  const txns = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'expense');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayTotals = new Array(7).fill(0);
  const dayCounts = new Array(7).fill(0);
  const dateSet = new Set<string>();

  txns.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const day = d.getDay();
    dayTotals[day] += t.amount;
    dayCounts[day]++;
    dateSet.add(t.date);
  });

  const totalDays = dateSet.size || 1;
  const totalSpend = txns.reduce((s, t) => s + t.amount, 0);
  const dailyAvg = totalSpend / totalDays;

  const dayOfWeek = dayNames.map((day, i) => ({
    day,
    avg: dayCounts[i] > 0 ? dayTotals[i] / Math.max(1, Math.ceil(totalDays / 7)) : 0,
  }));

  const weekendSpend = dayTotals[0] + dayTotals[6];
  const weekdaySpend = dayTotals.slice(1, 6).reduce((a, b) => a + b, 0);
  const weekendDays = Math.max(1, Math.ceil(totalDays / 7) * 2);
  const weekdayDaysCount = Math.max(1, Math.ceil(totalDays / 7) * 5);

  return {
    dailyAvg,
    dayOfWeek,
    weekendAvg: weekendSpend / weekendDays,
    weekdayAvg: weekdaySpend / weekdayDaysCount,
    totalDays,
  };
}

function getComparison(ctx: AssistantContext, period: { start: Date; end: Date } | null): { income: number; expenses: number; savings: number; savingsRate: number; prevExpenses: number; changePercent: number } {
  const txns = filterByPeriod(ctx.transactions, period);
  const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  // Previous period for comparison
  let prevExpenses = 0;
  let changePercent = 0;
  if (period) {
    const duration = period.end.getTime() - period.start.getTime();
    const prevStart = new Date(period.start.getTime() - duration);
    const prevEnd = new Date(period.start.getTime() - 1);
    const prevTxns = filterByPeriod(ctx.transactions, { start: prevStart, end: prevEnd });
    prevExpenses = prevTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    changePercent = prevExpenses > 0 ? Math.round(((expenses - prevExpenses) / prevExpenses) * 100) : 0;
  }

  return { income, expenses, savings, savingsRate, prevExpenses, changePercent };
}

function getAccountSummary(ctx: AssistantContext, accountId?: string | null): { accounts: { name: string; type: string; balance: number; txnCount: number; totalSpend: number; totalIncome: number }[] } {
  const targetAccounts = accountId ? ctx.accounts.filter(a => a.id === accountId) : ctx.accounts.filter(a => a.isActive);

  const accounts = targetAccounts.map(acc => {
    const txns = ctx.transactions.filter(t => t.accountId === acc.id || t.toAccountId === acc.id);
    let balance = acc.openingBalance;
    ctx.transactions.forEach(t => {
      if (t.type === 'income' && t.accountId === acc.id) balance += t.amount;
      if (t.type === 'expense' && t.accountId === acc.id) balance -= t.amount;
      if (t.type === 'transfer') {
        if (t.accountId === acc.id) balance -= t.amount;
        if (t.toAccountId === acc.id) balance += t.amount;
      }
    });
    const totalSpend = ctx.transactions.filter(t => t.type === 'expense' && t.accountId === acc.id).reduce((s, t) => s + t.amount, 0);
    const totalIncome = ctx.transactions.filter(t => t.type === 'income' && t.accountId === acc.id).reduce((s, t) => s + t.amount, 0);
    return { name: acc.name, type: acc.type, balance, txnCount: txns.length, totalSpend, totalIncome };
  });

  return { accounts };
}

function searchTransactions(ctx: AssistantContext, searchTerm: string, period: { start: Date; end: Date } | null, amountFilter: { op: 'gt' | 'lt' | 'eq'; value: number } | null): Transaction[] {
  let txns = filterByPeriod(ctx.transactions, period);
  const lower = searchTerm.toLowerCase();

  txns = txns.filter(t => {
    const cat = ctx.categories.find(c => c.id === t.categoryId);
    const acc = ctx.accounts.find(a => a.id === t.accountId);
    return (
      t.notes.toLowerCase().includes(lower) ||
      (cat && cat.name.toLowerCase().includes(lower)) ||
      (acc && acc.name.toLowerCase().includes(lower))
    );
  });

  if (amountFilter) {
    txns = txns.filter(t => {
      if (amountFilter.op === 'gt') return t.amount > amountFilter.value;
      if (amountFilter.op === 'lt') return t.amount < amountFilter.value;
      return t.amount === amountFilter.value;
    });
  }

  return txns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
}

// ─── Response Formatter ──────────────────────────────────────────────────────

function formatPeriodLabel(period: { start: Date; end: Date } | null): string {
  if (!period) return 'all time';
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = period.start.toLocaleDateString('en-IN', opts);
  const end = period.end.toLocaleDateString('en-IN', opts);
  const year = period.end.getFullYear();

  // Check if it's a full month
  if (period.start.getDate() === 1) {
    const endOfMonth = new Date(period.start.getFullYear(), period.start.getMonth() + 1, 0);
    if (period.end.getDate() === endOfMonth.getDate() && period.start.getMonth() === period.end.getMonth()) {
      return period.start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
  }
  return `${start} – ${end}, ${year}`;
}

function fc(amount: number, settings: Settings): string {
  return formatCurrency(amount, settings);
}

// ─── Main Query Processor ────────────────────────────────────────────────────

export function processQuery(query: string, ctx: AssistantContext): AssistantResponse {
  const { categories, accounts, settings } = ctx;
  const parsed = parseQuery(query, categories, accounts);
  const period = parsed.period || getDefaultPeriod();
  const periodLabel = formatPeriodLabel(parsed.period || getDefaultPeriod());

  try {
    switch (parsed.intent) {
      case 'income': {
        const { total, breakdown } = getIncomeForPeriod(ctx, period);
        if (total === 0) return { text: `You don't have any income recorded for ${periodLabel}. Try adding income transactions or asking about a different time period.` };
        let text = `💰 Your total income for ${periodLabel} is **${fc(total, settings)}**\n\n`;
        if (breakdown.length > 1) {
          text += `**Breakdown:**\n`;
          breakdown.slice(0, 5).forEach(b => {
            text += `  ${getCategoryEmoji(b.name)} ${b.name}: ${fc(b.amount, settings)}\n`;
          });
        }
        return { text };
      }

      case 'expense': {
        const { total, breakdown, count } = getExpensesForPeriod(ctx, period, parsed.categoryMatch, parsed.accountMatch);
        if (total === 0) return { text: `No expenses found for ${periodLabel}. Looks like you're saving well! 🎉` };
        const catName = parsed.categoryMatch ? categories.find(c => c.id === parsed.categoryMatch)?.name : null;
        let text = catName
          ? `${getCategoryEmoji(catName)} You spent **${fc(total, settings)}** on **${catName}** during ${periodLabel} (${count} transactions)\n\n`
          : `💸 Your total expenses for ${periodLabel} are **${fc(total, settings)}** across ${count} transactions\n\n`;
        if (!catName && breakdown.length > 1) {
          text += `**Top categories:**\n`;
          const totalAmt = breakdown.reduce((s, b) => s + b.amount, 0);
          breakdown.slice(0, 5).forEach(b => {
            const pct = Math.round((b.amount / totalAmt) * 100);
            text += `  ${getCategoryEmoji(b.name)} ${b.name}: ${fc(b.amount, settings)} (${pct}%)\n`;
          });
        }
        // Add comparison with previous period
        const comp = getComparison(ctx, period);
        if (comp.prevExpenses > 0) {
          const dir = comp.changePercent > 0 ? '📈 up' : '📉 down';
          text += `\nThat's ${dir} **${Math.abs(comp.changePercent)}%** compared to the previous period (${fc(comp.prevExpenses, settings)}).`;
        }
        return { text };
      }

      case 'category_ranking': {
        const top = getTopCategories(ctx, 'expense', period, parsed.limit);
        if (top.length === 0) return { text: `No expense data found for ${periodLabel}.` };
        let text = `📊 **Top spending categories** for ${periodLabel}:\n\n`;
        top.forEach((cat, i) => {
          const bar = '█'.repeat(Math.max(1, Math.round(cat.percentage / 5)));
          text += `  ${i + 1}. ${getCategoryEmoji(cat.name)} **${cat.name}** — ${fc(cat.amount, settings)} (${cat.percentage}%)\n     ${bar}\n`;
        });
        return { text };
      }

      case 'comparison': {
        const comp = getComparison(ctx, period);
        let text = `📊 **Income vs Expenses** for ${periodLabel}:\n\n`;
        text += `  💰 Income:   ${fc(comp.income, settings)}\n`;
        text += `  💸 Expenses: ${fc(comp.expenses, settings)}\n`;
        text += `  ${comp.savings >= 0 ? '✅' : '⚠️'} Net:      ${fc(comp.savings, settings)}\n\n`;
        if (comp.income > 0) {
          text += comp.savings >= 0
            ? `Great! You're saving **${comp.savingsRate}%** of your income. 🎉`
            : `⚠️ You're spending **${Math.abs(comp.savingsRate)}%** more than you earn. Consider reviewing your expenses.`;
        } else {
          text += `No income recorded for this period. Add income transactions for a complete picture.`;
        }
        return { text };
      }

      case 'pattern': {
        const patterns = getSpendingPatterns(ctx, period);
        const top = getTopCategories(ctx, 'expense', period, 3);
        let text = `🔍 **Spending Pattern Analysis** for ${periodLabel}:\n\n`;
        text += `📅 Daily average spending: **${fc(patterns.dailyAvg, settings)}**\n\n`;
        text += `**Day-of-week breakdown:**\n`;
        patterns.dayOfWeek.forEach(d => {
          const bar = '▓'.repeat(Math.max(0, Math.round(d.avg / (patterns.dailyAvg || 1) * 3)));
          text += `  ${d.day.slice(0, 3)}: ${fc(d.avg, settings)} ${bar}\n`;
        });
        text += `\n🏖️ Weekend avg: ${fc(patterns.weekendAvg, settings)} | 💼 Weekday avg: ${fc(patterns.weekdayAvg, settings)}\n`;
        if (top.length > 0) {
          text += `\n**Biggest spending areas:**\n`;
          top.forEach(t => {
            text += `  ${getCategoryEmoji(t.name)} ${t.name}: ${fc(t.amount, settings)} (${t.percentage}%)\n`;
          });
          if (top[0].percentage > 40) {
            text += `\n💡 **Insight:** ${top[0].name} accounts for ${top[0].percentage}% of spending. Consider setting a budget to manage this category.`;
          }
        }
        return { text };
      }

      case 'account': {
        const { accounts: accSummary } = getAccountSummary(ctx, parsed.accountMatch);
        if (accSummary.length === 0) return { text: `No accounts found. Add accounts in the Accounts section to track balances.` };
        let text = `🏦 **Account Summary:**\n\n`;
        accSummary.forEach(a => {
          const typeIcon = a.type === 'credit_card' ? '💳' : a.type === 'wallet' ? '👛' : a.type === 'cash' ? '💵' : '🏦';
          text += `${typeIcon} **${a.name}** (${a.type.replace('_', ' ')})\n`;
          text += `   Balance: ${fc(a.balance, settings)} | Transactions: ${a.txnCount}\n`;
          if (a.totalSpend > 0) text += `   Total spent: ${fc(a.totalSpend, settings)}`;
          if (a.totalIncome > 0) text += ` | Total received: ${fc(a.totalIncome, settings)}`;
          text += `\n\n`;
        });
        return { text };
      }

      case 'time_analysis': {
        const patterns = getSpendingPatterns(ctx, period);
        let text = `⏰ **Time-based Spending Analysis** for ${periodLabel}:\n\n`;
        text += `📊 Daily average: **${fc(patterns.dailyAvg, settings)}**\n`;
        text += `🏖️ Weekend average: **${fc(patterns.weekendAvg, settings)}**\n`;
        text += `💼 Weekday average: **${fc(patterns.weekdayAvg, settings)}**\n\n`;
        const sorted = [...patterns.dayOfWeek].sort((a, b) => b.avg - a.avg);
        text += `📈 Highest spending day: **${sorted[0].day}** (${fc(sorted[0].avg, settings)} avg)\n`;
        text += `📉 Lowest spending day: **${sorted[sorted.length - 1].day}** (${fc(sorted[sorted.length - 1].avg, settings)} avg)\n`;
        if (patterns.weekendAvg > patterns.weekdayAvg * 1.5) {
          text += `\n💡 **Insight:** You spend significantly more on weekends. Consider planning weekend activities with a budget in mind.`;
        }
        return { text };
      }

      case 'summary': {
        const comp = getComparison(ctx, period);
        const top = getTopCategories(ctx, 'expense', period, 3);
        const patterns = getSpendingPatterns(ctx, period);
        let text = `📋 **Financial Summary** for ${periodLabel}:\n\n`;
        text += `💰 Income: **${fc(comp.income, settings)}**\n`;
        text += `💸 Expenses: **${fc(comp.expenses, settings)}**\n`;
        text += `${comp.savings >= 0 ? '✅' : '⚠️'} Net savings: **${fc(comp.savings, settings)}**`;
        if (comp.income > 0) text += ` (${comp.savingsRate}% savings rate)`;
        text += `\n\n`;
        text += `📅 Daily average spend: ${fc(patterns.dailyAvg, settings)}\n\n`;
        if (top.length > 0) {
          text += `**Top expense categories:**\n`;
          top.forEach(t => {
            text += `  ${getCategoryEmoji(t.name)} ${t.name}: ${fc(t.amount, settings)} (${t.percentage}%)\n`;
          });
        }
        if (comp.prevExpenses > 0) {
          const dir = comp.changePercent > 0 ? 'more' : 'less';
          text += `\n📈 You spent **${Math.abs(comp.changePercent)}%** ${dir} than the previous period.`;
        }
        if (comp.savings < 0) {
          text += `\n\n⚠️ **Alert:** You're spending more than you earn. Review discretionary spending to get back on track.`;
        } else if (comp.savingsRate > 30) {
          text += `\n\n🌟 **Great job!** A ${comp.savingsRate}% savings rate is excellent!`;
        }
        return { text };
      }

      case 'savings': {
        const comp = getComparison(ctx, period);
        let text = `💰 **Savings Analysis** for ${periodLabel}:\n\n`;
        text += `Income: ${fc(comp.income, settings)}\n`;
        text += `Expenses: ${fc(comp.expenses, settings)}\n`;
        text += `Savings: **${fc(comp.savings, settings)}**\n`;
        if (comp.income > 0) {
          text += `Savings rate: **${comp.savingsRate}%**\n\n`;
          // Projected annual savings
          const daysInPeriod = period ? Math.max(1, Math.round((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24))) : 30;
          const dailySavings = comp.savings / daysInPeriod;
          const projectedAnnual = dailySavings * 365;
          text += `📈 Projected annual savings: **${fc(projectedAnnual, settings)}**\n`;
          text += `📅 Daily savings rate: ${fc(dailySavings, settings)}/day\n`;
          if (comp.savingsRate < 20) {
            text += `\n💡 **Tip:** Aim for at least 20% savings rate. Try reducing top expense categories to increase savings.`;
          } else if (comp.savingsRate >= 30) {
            text += `\n🌟 Excellent savings rate! You're well on track for financial goals.`;
          }
        } else {
          text += `\nNo income recorded. Add income transactions for savings analysis.`;
        }
        return { text };
      }

      case 'search': {
        const term = parsed.searchTerm || query.replace(/\b(find|search|show|list|all|me|my|the|transactions?|purchases?|payments?|expenses?)\b/gi, '').trim();
        if (!term) return { text: `What would you like to search for? Try "find transactions for groceries" or "show Amazon purchases".` };
        const results = searchTransactions(ctx, term, parsed.period, parsed.amountFilter);
        if (results.length === 0) return { text: `No transactions found matching "${term}" for ${periodLabel}. Try different keywords or time period.` };
        let text = `🔎 Found **${results.length}** transaction${results.length > 1 ? 's' : ''} matching "${term}":\n\n`;
        results.forEach(t => {
          const cat = categories.find(c => c.id === t.categoryId);
          const d = new Date(t.date + 'T00:00:00');
          const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const icon = t.type === 'income' ? '💚' : '🔴';
          text += `  ${icon} ${dateStr} — ${fc(t.amount, settings)} — ${cat?.name || 'Uncategorized'}${t.notes ? ` (${t.notes})` : ''}\n`;
        });
        return { text };
      }

      default:
        return { text: `I can help you with:\n• Income & expense queries\n• Category breakdowns\n• Spending patterns & trends\n• Account balances\n• Financial summaries\n• Transaction search\n\nTry asking "What did I spend this month?" or "Show my financial summary"` };
    }
  } catch {
    return { text: `I had trouble processing that query. Try rephrasing, for example:\n• "What's my spending this month?"\n• "Top expense categories"\n• "Compare income vs expenses"` };
  }
}

function getDefaultPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
