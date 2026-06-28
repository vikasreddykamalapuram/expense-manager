import { Transaction, Category, Account, Settings, Budget, RecurringRule, StockTransaction, PortfolioHolding } from '../types';
import { formatCurrency, getCurrentMonth, getMonthRange } from '../utils/helpers';
import { calculateHealthScore, HealthScoreResult } from './healthScore';

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
  | 'search'
  | 'greeting'
  | 'help'
  | 'thanks'
  | 'advice'
  | 'budget'
  | 'recurring'
  | 'health_score'
  | 'portfolio'
  | 'prediction'
  | 'when';

export interface AssistantContext {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  settings: Settings;
  budgets?: Budget[];
  recurringRules?: RecurringRule[];
  stockTransactions?: StockTransaction[];
}

export interface AssistantResponse {
  text: string;
  intent?: Intent;
}

// ─── Conversation context for follow-ups ─────────────────────────────────────

let lastIntent: Intent | null = null;
let lastPeriod: { start: Date; end: Date } | null = null;
let lastCategoryMatch: string | null = null;

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

  // ── Conversational intents (check first) ──
  if (/^(hi|hello|hey|hola|namaste|good\s*(morning|afternoon|evening|night)|what'?s\s*up|howdy|sup)\b/i.test(lower.trim())) return 'greeting';
  if (/\b(thank|thanks|thankyou|thank\s*you|thx|great\s*job|awesome|perfect|nice|wonderful|amazing|brilliant|well\s*done)\b/.test(lower) && lower.length < 50) return 'thanks';
  if (/\b(help|what can you do|what do you do|features|commands|capabilities|how to use|guide me|show me what|your abilities)\b/.test(lower)) return 'help';

  // ── Follow-up detection ──
  if (/\b(tell me more|more details|elaborate|expand|what else|go on|continue|and\?|details)\b/.test(lower) && lastIntent) return lastIntent;
  if (/\b(what about|how about|same for|and for)\s+(last month|previous|this week|last week|this year)/i.test(lower) && lastIntent) return lastIntent;

  // ── Hindi-English mix ──
  if (/\b(kitna|kharcha|kharche|kamai|bachat|paisa|paise|rupay|rupees|batao|dikhao|bata)\b/.test(lower)) {
    if (/\b(kamai|income|salary)\b/.test(lower)) return 'income';
    if (/\b(kharcha|kharche|spend)\b/.test(lower)) return 'expense';
    if (/\b(bachat|saving|save)\b/.test(lower)) return 'savings';
    return 'expense';
  }

  // ── "When" queries ──
  if (/\b(when\s+(did|was|is)|last\s+time\s+i|when.*(last|next|pay|paid|bought))\b/.test(lower)) return 'when';

  // ── Financial advice ──
  if (/\b(advice|tips?|suggest|recommendation|how\s+to\s+save|budgeting\s+tips?|50.?30.?20|should\s+i\s+invest|financial\s+plan|money\s+management|emergency\s+fund)\b/.test(lower)) return 'advice';

  // ── Budget queries ──
  if (/\b(budget|within\s+budget|budget\s+(left|remaining|status|check)|over\s*spend|am\s+i\s+over|underspend)\b/.test(lower) && !/\b(tips?|advice|how\s+to)\b/.test(lower)) return 'budget';

  // ── Recurring/subscription queries ──
  if (/\b(recurring|subscription|subscriptions|fixed\s+(cost|expense)|monthly\s+(bill|commitment)|auto.?pay|emi|installment|standing\s+order)\b/.test(lower)) return 'recurring';

  // ── Health score ──
  if (/\b(health\s*score|financial\s*health|how\s*healthy|health\s*check|financial\s*status|finance\s*score|money\s*health)\b/.test(lower)) return 'health_score';

  // ── Portfolio/stocks ──
  if (/\b(portfolio|stock|stocks|holding|holdings|investment\s+summary|trading|shares|equity|mutual\s+fund|etf|nifty|sensex|demat)\b/.test(lower)) return 'portfolio';

  // ── Prediction/forecast ──
  if (/\b(predict|forecast|project|projected|end\s+of\s+month|month\s*end|estimate|estimated|will\s+i\s+spend|trending)\b/.test(lower)) return 'prediction';

  // ── Original intents ──
  if (/\b(find|search|show all|show me|where did|list)\b/.test(lower) && !/\b(top|biggest|most|pattern|trend)\b/.test(lower)) return 'search';
  if (/\b(income|earn|salary|earned|earning|revenue)\b/.test(lower) && !/\b(vs|versus|compare|saving)\b/.test(lower)) return 'income';
  if (/\b(spend|spent|expense|expenses|cost|costs|expenditure)\b/.test(lower) && !/\b(vs|versus|compare|top|biggest|most|pattern|trend|saving)\b/.test(lower)) return 'expense';
  if (/\b(top|biggest|most|highest|largest|major|rank)\b/.test(lower) && /\b(categor|spend|expense)\b/.test(lower)) return 'category_ranking';
  if (/\b(compare|vs|versus|income.*expense|expense.*income|saving or spending|spending or saving)\b/.test(lower)) return 'comparison';
  if (/\b(pattern|analyze|trend|overspend|habit|behaviour|behavior)\b/.test(lower)) return 'pattern';
  if (/\b(balance|account|bank|credit card|wallet|which account)\b/.test(lower)) return 'account';
  if (/\b(daily average|day.*(spend|most)|weekend|weekday|average.*day)\b/.test(lower)) return 'time_analysis';
  if (/\b(summary|report|overview|how am i doing)\b/.test(lower)) return 'summary';
  if (/\b(save|saving|savings rate|can i save)\b/.test(lower)) return 'savings';

  // ── Smart fallback: fuzzy match against known entities ──
  if (/\bhow much\b/.test(lower)) return 'expense';

  // Instead of falling through to summary, return null-ish — handled by processQuery
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

// ─── Proactive Insights Generator ────────────────────────────────────────────

function generateInsight(ctx: AssistantContext, period: { start: Date; end: Date }): string {
  const insights: string[] = [];

  // Compare category spending vs 3-month average
  const now = new Date();
  const threeMonthStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const threeMonthTxns = ctx.transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return t.type === 'expense' && d >= threeMonthStart && d <= now;
  });
  const currentTxns = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'expense');

  if (threeMonthTxns.length > 0 && currentTxns.length > 0) {
    const byCat3m = new Map<string, number>();
    threeMonthTxns.forEach(t => {
      const cat = ctx.categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      byCat3m.set(name, (byCat3m.get(name) || 0) + t.amount);
    });
    const byCatNow = new Map<string, number>();
    currentTxns.forEach(t => {
      const cat = ctx.categories.find(c => c.id === t.categoryId);
      const name = cat?.name || 'Other';
      byCatNow.set(name, (byCatNow.get(name) || 0) + t.amount);
    });

    for (const [catName, currentAmt] of byCatNow) {
      const avg3m = (byCat3m.get(catName) || 0) / 3;
      if (avg3m > 0 && currentAmt > avg3m * 1.25) {
        const pctHigher = Math.round(((currentAmt - avg3m) / avg3m) * 100);
        insights.push(`💡 Your **${catName}** spending is **${pctHigher}%** higher than your 3-month average`);
        break;
      }
    }
  }

  // Find biggest spending day of week
  if (currentTxns.length > 5) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayTotals = new Array(7).fill(0);
    currentTxns.forEach(t => {
      const d = new Date(t.date + 'T00:00:00');
      dayTotals[d.getDay()] += t.amount;
    });
    const maxDay = dayTotals.indexOf(Math.max(...dayTotals));
    if (dayTotals[maxDay] > 0) {
      insights.push(`📊 Fun fact: **${dayNames[maxDay]}** is your biggest spending day`);
    }
  }

  if (insights.length === 0) return '';
  return '\n\n---\n' + insights.slice(0, 2).join('\n');
}

// ─── New Intent Handlers ─────────────────────────────────────────────────────

function handleGreeting(ctx: AssistantContext): string {
  const period = getDefaultPeriod();
  const comp = getComparison(ctx, period);
  const greetings = ['Hey there! 👋', 'Hello! 😊', 'Hi! 👋', 'Hey! 🙌'];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];

  let text = `${greeting} Welcome back to ExpenseIQ!\n\n`;
  text += `Here's a quick snapshot for this month:\n`;
  text += `  💰 Income: **${fc(comp.income, ctx.settings)}**\n`;
  text += `  💸 Expenses: **${fc(comp.expenses, ctx.settings)}**\n`;
  text += `  ${comp.savings >= 0 ? '✅' : '⚠️'} Net: **${fc(comp.savings, ctx.settings)}**\n`;

  if (comp.income > 0 && comp.savingsRate > 20) {
    text += `\n🌟 You're saving **${comp.savingsRate}%** of your income — great job!`;
  } else if (comp.income > 0 && comp.savings < 0) {
    text += `\n⚠️ You're spending more than you earn this month. Want some tips?`;
  }

  text += `\n\nAsk me anything or try: "Am I within budget?" or "Financial health check"`;
  return text;
}

function handleHelp(): string {
  return `🤖 **Here's what I can help with:**\n
📊 **Spending & Income**
  • "What did I spend this month?"
  • "Show my income this year"
  • "How much on groceries?"

📈 **Analysis & Trends**
  • "Top expense categories"
  • "Analyze my spending patterns"
  • "Compare income vs expenses"
  • "Daily spending average"

💰 **Budgets & Savings**
  • "Am I within budget?"
  • "Budget status"
  • "Savings analysis"
  • "Tips to save more"

🏥 **Financial Health**
  • "Financial health check"
  • "What's my health score?"

🔁 **Recurring & Predictions**
  • "My recurring expenses"
  • "Monthly subscriptions"
  • "Predict month-end spending"

📈 **Portfolio**
  • "Portfolio summary"
  • "Stock holdings"

🔎 **Search & Lookup**
  • "Find transactions for food"
  • "When did I last pay rent?"
  • "Show Amazon purchases"

⏰ **Time periods:** today, this week, last month, Q1, this year, FY 2025, past 3 months
💡 **Pro tip:** I can also understand Hindi-English mix like "kitna kharcha hua?"`;
}

function handleThanks(): string {
  const responses = [
    "You're welcome! 😊 Let me know if you need anything else.",
    "Happy to help! 🙌 Feel free to ask more questions.",
    "Glad I could help! 💪 Your finances are in good hands.",
    "Anytime! 😄 I'm here whenever you need me.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

function handleAdvice(ctx: AssistantContext): string {
  const period = getDefaultPeriod();
  const comp = getComparison(ctx, period);
  const top = getTopCategories(ctx, 'expense', period, 5);

  let text = `💡 **Financial Advice & Tips**\n\n`;

  // 50/30/20 analysis
  if (comp.income > 0) {
    const needsTarget = comp.income * 0.5;
    const wantsTarget = comp.income * 0.3;
    const savingsTarget = comp.income * 0.2;

    text += `📐 **50/30/20 Rule Analysis** (based on your income of ${fc(comp.income, ctx.settings)}):\n`;
    text += `  🏠 Needs (50%): Target ${fc(needsTarget, ctx.settings)}\n`;
    text += `  🎯 Wants (30%): Target ${fc(wantsTarget, ctx.settings)}\n`;
    text += `  💰 Savings (20%): Target ${fc(savingsTarget, ctx.settings)} | Actual: ${fc(comp.savings, ctx.settings)} (${comp.savingsRate}%)\n\n`;

    if (comp.savingsRate < 20) {
      text += `⚠️ You're saving **${comp.savingsRate}%** — below the recommended 20%. `;
      text += `You need to save **${fc(savingsTarget - comp.savings, ctx.settings)}** more.\n\n`;
    } else {
      text += `✅ You're exceeding the 20% savings target — excellent!\n\n`;
    }
  }

  // Emergency fund
  const threeMonthExpenses = comp.expenses * 6;
  text += `🚨 **Emergency Fund Target:** ${fc(threeMonthExpenses, ctx.settings)} (6 months of expenses)\n\n`;

  // Actionable tips based on data
  text += `📝 **Personalized Tips:**\n`;
  if (top.length > 0 && top[0].percentage > 35) {
    text += `  1. ${getCategoryEmoji(top[0].name)} **${top[0].name}** is ${top[0].percentage}% of spending. Set a budget to cap it.\n`;
  }
  if (comp.savingsRate < 10) {
    text += `  2. Try the "pay yourself first" method — auto-transfer 10% of income to savings on payday.\n`;
  }
  if (top.length >= 3) {
    const discretionary = top.filter(t =>
      /entertainment|shopping|dining|restaurant|travel|subscription/i.test(t.name)
    );
    if (discretionary.length > 0) {
      const discretionaryTotal = discretionary.reduce((s, t) => s + t.amount, 0);
      text += `  3. Discretionary spending (${discretionary.map(d => d.name).join(', ')}): ${fc(discretionaryTotal, ctx.settings)}. Consider a 10% cut.\n`;
    }
  }
  text += `  ${top.length > 0 ? top.length >= 3 && /entertainment|shopping|dining|restaurant|travel|subscription/i.test(top.map(t => t.name).join(' ')) ? '4' : '3' : '2'}. Review subscriptions regularly — unused ones are silent budget killers.\n`;

  return text;
}

function handleBudget(ctx: AssistantContext): string {
  const budgets = ctx.budgets || [];
  if (budgets.length === 0) {
    return `📊 **Budget Status**\n\nYou haven't set up any budgets yet! Go to the Budgets section to create budget limits for your spending categories.\n\n💡 **Tip:** Start with your top 3 expense categories. Setting a budget helps you stay in control.`;
  }

  const currentMonth = getCurrentMonth();
  const { start, end } = getMonthRange(currentMonth);
  const monthBudgets = budgets.filter(b => b.month === currentMonth);

  if (monthBudgets.length === 0) {
    return `📊 **Budget Status**\n\nNo budgets set for this month (${currentMonth}). You have ${budgets.length} budget(s) for other months.\n\n💡 Set budgets for the current month to track your spending.`;
  }

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;

  let text = `📊 **Budget Status** for ${currentMonth} (${daysLeft} days left)\n\n`;
  let totalBudget = 0;
  let totalSpent = 0;
  let overBudgetCount = 0;

  for (const b of monthBudgets) {
    const cat = ctx.categories.find(c => c.id === b.categoryId);
    const catName = cat?.name || 'Unknown';
    const spent = ctx.transactions
      .filter(t => t.type === 'expense' && t.categoryId === b.categoryId && t.date >= start && t.date <= end)
      .reduce((s, t) => s + t.amount, 0);
    const remaining = b.amount - spent;
    const pct = Math.round((spent / b.amount) * 100);
    const status = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';

    totalBudget += b.amount;
    totalSpent += spent;
    if (pct >= 100) overBudgetCount++;

    const bar = '█'.repeat(Math.min(10, Math.round(pct / 10))) + '░'.repeat(Math.max(0, 10 - Math.round(pct / 10)));
    text += `${status} ${getCategoryEmoji(catName)} **${catName}**\n`;
    text += `   ${bar} ${pct}%\n`;
    text += `   Spent: ${fc(spent, ctx.settings)} / ${fc(b.amount, ctx.settings)}`;
    text += remaining >= 0 ? ` (${fc(remaining, ctx.settings)} left)\n\n` : ` (**${fc(Math.abs(remaining), ctx.settings)} over!**)\n\n`;
  }

  const totalPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
  text += `**Overall:** ${fc(totalSpent, ctx.settings)} / ${fc(totalBudget, ctx.settings)} (${totalPct}%)`;

  if (overBudgetCount > 0) {
    text += `\n⚠️ ${overBudgetCount} budget${overBudgetCount > 1 ? 's' : ''} exceeded! Review spending in ${overBudgetCount > 1 ? 'these categories' : 'this category'}.`;
  } else if (totalPct < 70) {
    text += `\n✅ You're on track! Spending well within budget.`;
  }

  return text;
}

function handleRecurring(ctx: AssistantContext): string {
  const rules = ctx.recurringRules || [];
  if (rules.length === 0) {
    return `🔁 **Recurring Expenses**\n\nYou haven't set up any recurring rules yet. Go to the Recurring section to add monthly bills, subscriptions, and EMIs.\n\n💡 Tracking recurring expenses helps you understand your fixed commitments.`;
  }

  const activeRules = rules.filter(r => r.isActive);
  const expenseRules = activeRules.filter(r => r.type === 'expense');
  const incomeRules = activeRules.filter(r => r.type === 'income');

  let text = `🔁 **Recurring Transactions** (${activeRules.length} active)\n\n`;

  if (expenseRules.length > 0) {
    let monthlyTotal = 0;
    text += `**💸 Recurring Expenses:**\n`;
    expenseRules.forEach(r => {
      const cat = ctx.categories.find(c => c.id === r.categoryId);
      const catName = cat?.name || 'Other';
      let monthlyAmount = r.amount;
      if (r.frequency === 'weekly') monthlyAmount = r.amount * 4.33;
      else if (r.frequency === 'daily') monthlyAmount = r.amount * 30;
      else if (r.frequency === 'yearly') monthlyAmount = r.amount / 12;
      monthlyTotal += monthlyAmount;

      const nextDue = r.nextDueDate ? new Date(r.nextDueDate + 'T00:00:00') : null;
      const dueStr = nextDue ? nextDue.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A';
      text += `  ${getCategoryEmoji(catName)} **${r.name}** — ${fc(r.amount, ctx.settings)} (${r.frequency})\n`;
      text += `     Next due: ${dueStr}\n`;
    });
    text += `\n📊 **Total monthly commitment:** ${fc(monthlyTotal, ctx.settings)}\n`;
  }

  if (incomeRules.length > 0) {
    text += `\n**💰 Recurring Income:**\n`;
    incomeRules.forEach(r => {
      text += `  ${getCategoryEmoji(r.name)} **${r.name}** — ${fc(r.amount, ctx.settings)} (${r.frequency})\n`;
    });
  }

  return text;
}

function handleHealthScore(ctx: AssistantContext): string {
  const budgets = ctx.budgets || [];
  let result: HealthScoreResult;
  try {
    result = calculateHealthScore(ctx.transactions, budgets, ctx.accounts, ctx.categories);
  } catch {
    // Fallback simple calculation
    const period = getDefaultPeriod();
    const comp = getComparison(ctx, period);
    const savingsRate = comp.income > 0 ? Math.round((comp.savings / comp.income) * 100) : 0;
    const score = Math.min(100, Math.max(0, savingsRate * 2 + 30));
    return `🏥 **Financial Health Score: ${score}/100**\n\n` +
      `Based on your savings rate of ${savingsRate}%.\n` +
      `Set up budgets and track more data for a detailed health assessment.`;
  }

  const gradeEmoji: Record<string, string> = { 'A+': '🌟', 'A': '✅', 'B': '👍', 'C': '⚠️', 'D': '🔶', 'F': '🔴' };
  let text = `🏥 **Financial Health Score: ${result.totalScore}/100** ${gradeEmoji[result.grade] || ''} Grade: **${result.grade}**\n\n`;

  text += `**Score Breakdown:**\n`;
  result.factors.forEach(f => {
    const statusEmoji = f.status === 'excellent' ? '🟢' : f.status === 'good' ? '🔵' : f.status === 'fair' ? '🟡' : '🔴';
    text += `  ${statusEmoji} ${f.icon} ${f.name}: **${Math.round(f.score)}/100** — ${f.description}\n`;
  });

  if (result.tips.length > 0) {
    text += `\n💡 **Improvement Tips:**\n`;
    result.tips.slice(0, 3).forEach((tip, i) => {
      text += `  ${i + 1}. ${tip}\n`;
    });
  }

  return text;
}

function handlePortfolio(ctx: AssistantContext): string {
  const stockTxns = ctx.stockTransactions || [];
  if (stockTxns.length === 0) {
    return `📈 **Portfolio Summary**\n\nNo stock transactions found. Add trades in the Portfolio section to track your investments.\n\n💡 Track your buy/sell transactions to see portfolio performance.`;
  }

  // Calculate holdings
  const holdingsMap = new Map<string, PortfolioHolding>();
  for (const txn of stockTxns) {
    const existing = holdingsMap.get(txn.symbol);
    if (txn.type === 'buy' || txn.type === 'ipo') {
      if (existing) {
        const totalQty = existing.quantity + txn.quantity;
        const totalInvested = existing.totalInvested + txn.totalValue;
        existing.quantity = totalQty;
        existing.totalInvested = totalInvested;
        existing.avgBuyPrice = totalQty > 0 ? totalInvested / totalQty : 0;
        existing.totalCharges += txn.charges.total;
      } else {
        holdingsMap.set(txn.symbol, {
          symbol: txn.symbol,
          name: txn.name,
          exchange: txn.exchange,
          assetClass: txn.assetClass,
          quantity: txn.quantity,
          avgBuyPrice: txn.price,
          totalInvested: txn.totalValue,
          totalCharges: txn.charges.total,
          broker: txn.broker,
        });
      }
    } else if (txn.type === 'sell' && existing) {
      existing.quantity -= txn.quantity;
      if (existing.quantity > 0) {
        existing.totalInvested = existing.avgBuyPrice * existing.quantity;
      }
    }
  }

  const holdings = Array.from(holdingsMap.values()).filter(h => h.quantity > 0);
  let text = `📈 **Portfolio Summary** (${holdings.length} holding${holdings.length !== 1 ? 's' : ''})\n\n`;

  if (holdings.length === 0) {
    text += `All positions closed. No active holdings.\n`;
    text += `Total trades: ${stockTxns.length}`;
    return text;
  }

  let totalInvested = 0;
  let totalCharges = 0;

  // Group by asset class
  const byAssetClass = new Map<string, PortfolioHolding[]>();
  holdings.forEach(h => {
    totalInvested += h.totalInvested;
    totalCharges += h.totalCharges;
    const group = byAssetClass.get(h.assetClass) || [];
    group.push(h);
    byAssetClass.set(h.assetClass, group);
  });

  for (const [assetClass, group] of byAssetClass) {
    const label = assetClass.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    text += `**${label}:**\n`;
    group.sort((a, b) => b.totalInvested - a.totalInvested);
    group.forEach(h => {
      text += `  📊 **${h.symbol}** (${h.name})\n`;
      text += `     ${h.quantity} units @ avg ${fc(h.avgBuyPrice, ctx.settings)} = ${fc(h.totalInvested, ctx.settings)}\n`;
    });
    text += '\n';
  }

  text += `**Total invested:** ${fc(totalInvested, ctx.settings)}\n`;
  text += `**Total charges:** ${fc(totalCharges, ctx.settings)}\n`;
  text += `**Trades:** ${stockTxns.length}`;

  return text;
}

function handlePrediction(ctx: AssistantContext): string {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const daysPassed = now.getDate();
  const daysLeft = daysInMonth - daysPassed;

  const period = { start: monthStart, end: now };
  const expenses = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'expense');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const dailyAvg = daysPassed > 0 ? totalSpent / daysPassed : 0;
  const projected = dailyAvg * daysInMonth;
  const remaining = projected - totalSpent;

  let text = `🔮 **Month-End Spending Forecast**\n\n`;
  text += `📅 Day ${daysPassed} of ${daysInMonth} (${daysLeft} days left)\n`;
  text += `💸 Spent so far: **${fc(totalSpent, ctx.settings)}**\n`;
  text += `📊 Daily average: **${fc(dailyAvg, ctx.settings)}**/day\n`;
  text += `🔮 Projected total: **${fc(projected, ctx.settings)}**\n`;
  text += `📈 Estimated remaining: **${fc(remaining, ctx.settings)}**\n\n`;

  // Compare with budget
  const budgets = ctx.budgets || [];
  const currentMonth = getCurrentMonth();
  const monthBudgets = budgets.filter(b => b.month === currentMonth);
  if (monthBudgets.length > 0) {
    const totalBudget = monthBudgets.reduce((s, b) => s + b.amount, 0);
    if (projected > totalBudget) {
      text += `⚠️ **Warning:** At this rate, you'll exceed your budget by **${fc(projected - totalBudget, ctx.settings)}**!\n`;
      const safeDaily = (totalBudget - totalSpent) / Math.max(1, daysLeft);
      text += `💡 To stay within budget, limit spending to **${fc(safeDaily, ctx.settings)}/day** for the rest of the month.`;
    } else {
      text += `✅ On track! You'll be **${fc(totalBudget - projected, ctx.settings)}** under budget.`;
    }
  }

  // Compare with last month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  const lastMonthExpenses = filterByPeriod(ctx.transactions, { start: lastMonthStart, end: lastMonthEnd })
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  if (lastMonthExpenses > 0) {
    const diff = projected - lastMonthExpenses;
    const pct = Math.round(Math.abs(diff / lastMonthExpenses) * 100);
    text += `\n\n📊 vs last month (${fc(lastMonthExpenses, ctx.settings)}): `;
    text += diff > 0 ? `trending **${pct}% higher** 📈` : `trending **${pct}% lower** 📉`;
  }

  return text;
}

function handleWhen(query: string, ctx: AssistantContext): string {
  const lower = query.toLowerCase();

  // Extract what they're looking for
  const patterns = [
    /when\s+did\s+i\s+(?:last\s+)?(?:pay|paid|spend|spent|buy|bought|get|got)\s+(?:for\s+)?(.+?)[?.?]?$/,
    /last\s+time\s+i\s+(?:paid|spent|bought)\s+(?:for\s+)?(.+?)[?.?]?$/,
    /when\s+(?:was|is)\s+(?:my\s+)?(?:last|next)\s+(.+?)[?.?]?$/,
    /when\s+did\s+i\s+(.+?)[?.?]?$/,
  ];

  let searchTerm = '';
  for (const p of patterns) {
    const m = lower.match(p);
    if (m) { searchTerm = m[1].trim(); break; }
  }

  if (!searchTerm) {
    searchTerm = lower.replace(/\b(when|did|i|last|pay|paid|time|the|my|next|is|was|have)\b/g, '').trim();
  }

  if (!searchTerm) {
    return `🤔 I couldn't figure out what to look for. Try: "When did I last pay rent?" or "When did I last buy groceries?"`;
  }

  // Search transactions
  const matching = ctx.transactions
    .filter(t => {
      const cat = ctx.categories.find(c => c.id === t.categoryId);
      const acc = ctx.accounts.find(a => a.id === t.accountId);
      const searchLower = searchTerm.toLowerCase();
      return (
        t.notes.toLowerCase().includes(searchLower) ||
        (cat && cat.name.toLowerCase().includes(searchLower)) ||
        (acc && acc.name.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (matching.length === 0) {
    return `🔍 I couldn't find any transactions matching "${searchTerm}". Try different keywords.`;
  }

  const latest = matching[0];
  const cat = ctx.categories.find(c => c.id === latest.categoryId);
  const d = new Date(latest.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const daysAgo = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));

  let text = `📅 **Last "${searchTerm}" transaction:**\n\n`;
  text += `  📆 Date: **${dateStr}** (${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`})\n`;
  text += `  💰 Amount: **${fc(latest.amount, ctx.settings)}**\n`;
  text += `  ${getCategoryEmoji(cat?.name || '')} Category: ${cat?.name || 'Uncategorized'}\n`;
  if (latest.notes) text += `  📝 Note: ${latest.notes}\n`;

  if (matching.length > 1) {
    text += `\n📊 You've had **${matching.length}** "${searchTerm}" transactions total.`;
    const totalSpent = matching.reduce((s, t) => s + t.amount, 0);
    text += ` Total: ${fc(totalSpent, ctx.settings)}`;
  }

  return text;
}

// ─── Fuzzy Entity Matching for Better Fallback ───────────────────────────────

function tryFuzzyEntityMatch(query: string, ctx: AssistantContext): string | null {
  const lower = query.toLowerCase();

  // Check if query mentions any category name (even partially)
  for (const cat of ctx.categories) {
    const catLower = cat.name.toLowerCase();
    const words = catLower.split(/[\s&/,]+/).filter(w => w.length > 2);
    for (const w of words) {
      if (lower.includes(w)) {
        // Treat as a contextual expense query for that category
        const period = getDefaultPeriod();
        const periodLabel = formatPeriodLabel(period);
        const txns = filterByPeriod(ctx.transactions, period).filter(t => t.type === 'expense' && t.categoryId === cat.id);
        const total = txns.reduce((s, t) => s + t.amount, 0);
        if (total > 0) {
          return `${getCategoryEmoji(cat.name)} Your **${cat.name}** spending for ${periodLabel}: **${fc(total, ctx.settings)}** (${txns.length} transactions)`;
        }
        return `${getCategoryEmoji(cat.name)} No ${cat.name} expenses found for ${periodLabel}.`;
      }
    }
  }

  // Check if query mentions any account
  for (const acc of ctx.accounts) {
    if (lower.includes(acc.name.toLowerCase()) || (acc.institution && lower.includes(acc.institution.toLowerCase()))) {
      const { accounts: accSummary } = getAccountSummary(ctx, acc.id);
      if (accSummary.length > 0) {
        const a = accSummary[0];
        return `🏦 **${a.name}** balance: **${fc(a.balance, ctx.settings)}** | ${a.txnCount} transactions`;
      }
    }
  }

  return null;
}

// ─── Main Query Processor ────────────────────────────────────────────────────

export function processQuery(query: string, ctx: AssistantContext): AssistantResponse {
  const { categories, accounts, settings } = ctx;
  const parsed = parseQuery(query, categories, accounts);

  // Use previous period for follow-up queries
  const isFollowUp = /\b(tell me more|more details|elaborate|what about|how about|same for|and for|continue)\b/i.test(query.toLowerCase());
  const period = parsed.period || (isFollowUp && lastPeriod ? lastPeriod : getDefaultPeriod());
  const periodLabel = formatPeriodLabel(parsed.period || (isFollowUp && lastPeriod ? lastPeriod : getDefaultPeriod()));

  // Use previous category for follow-up
  if (isFollowUp && !parsed.categoryMatch && lastCategoryMatch) {
    parsed.categoryMatch = lastCategoryMatch;
  }

  // Store context for follow-ups
  lastIntent = parsed.intent;
  lastPeriod = period;
  lastCategoryMatch = parsed.categoryMatch;

  try {
    switch (parsed.intent) {
      // ── New conversational intents ──
      case 'greeting':
        return { text: handleGreeting(ctx), intent: 'greeting' };

      case 'help':
        return { text: handleHelp(), intent: 'help' };

      case 'thanks':
        return { text: handleThanks(), intent: 'thanks' };

      case 'advice':
        return { text: handleAdvice(ctx), intent: 'advice' };

      case 'budget':
        return { text: handleBudget(ctx), intent: 'budget' };

      case 'recurring':
        return { text: handleRecurring(ctx), intent: 'recurring' };

      case 'health_score':
        return { text: handleHealthScore(ctx), intent: 'health_score' };

      case 'portfolio':
        return { text: handlePortfolio(ctx), intent: 'portfolio' };

      case 'prediction':
        return { text: handlePrediction(ctx), intent: 'prediction' };

      case 'when':
        return { text: handleWhen(query, ctx), intent: 'when' };
      case 'income': {
        const { total, breakdown } = getIncomeForPeriod(ctx, period);
        if (total === 0) return { text: `You don't have any income recorded for ${periodLabel}. Try adding income transactions or asking about a different time period.`, intent: 'income' };
        let text = `💰 Your total income for ${periodLabel} is **${fc(total, settings)}**\n\n`;
        if (breakdown.length > 1) {
          text += `**Breakdown:**\n`;
          breakdown.slice(0, 5).forEach(b => {
            text += `  ${getCategoryEmoji(b.name)} ${b.name}: ${fc(b.amount, settings)}\n`;
          });
        }
        text += generateInsight(ctx, period);
        return { text, intent: 'income' };
      }

      case 'expense': {
        const { total, breakdown, count } = getExpensesForPeriod(ctx, period, parsed.categoryMatch, parsed.accountMatch);
        if (total === 0) return { text: `No expenses found for ${periodLabel}. Looks like you're saving well! 🎉`, intent: 'expense' };
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
        const comp = getComparison(ctx, period);
        if (comp.prevExpenses > 0) {
          const dir = comp.changePercent > 0 ? '📈 up' : '📉 down';
          text += `\nThat's ${dir} **${Math.abs(comp.changePercent)}%** compared to the previous period (${fc(comp.prevExpenses, settings)}).`;
        }
        text += generateInsight(ctx, period);
        return { text, intent: 'expense' };
      }

      case 'category_ranking': {
        const top = getTopCategories(ctx, 'expense', period, parsed.limit);
        if (top.length === 0) return { text: `No expense data found for ${periodLabel}.`, intent: 'category_ranking' };
        let text = `📊 **Top spending categories** for ${periodLabel}:\n\n`;
        top.forEach((cat, i) => {
          const bar = '█'.repeat(Math.max(1, Math.round(cat.percentage / 5)));
          text += `  ${i + 1}. ${getCategoryEmoji(cat.name)} **${cat.name}** — ${fc(cat.amount, settings)} (${cat.percentage}%)\n     ${bar}\n`;
        });
        text += generateInsight(ctx, period);
        return { text, intent: 'category_ranking' };
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
        text += generateInsight(ctx, period);
        return { text, intent: 'comparison' };
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
        return { text, intent: 'pattern' };
      }

      case 'account': {
        const { accounts: accSummary } = getAccountSummary(ctx, parsed.accountMatch);
        if (accSummary.length === 0) return { text: `No accounts found. Add accounts in the Accounts section to track balances.`, intent: 'account' };
        let text = `🏦 **Account Summary:**\n\n`;
        accSummary.forEach(a => {
          const typeIcon = a.type === 'credit_card' ? '💳' : a.type === 'wallet' ? '👛' : a.type === 'cash' ? '💵' : '🏦';
          text += `${typeIcon} **${a.name}** (${a.type.replace('_', ' ')})\n`;
          text += `   Balance: ${fc(a.balance, settings)} | Transactions: ${a.txnCount}\n`;
          if (a.totalSpend > 0) text += `   Total spent: ${fc(a.totalSpend, settings)}`;
          if (a.totalIncome > 0) text += ` | Total received: ${fc(a.totalIncome, settings)}`;
          text += `\n\n`;
        });
        return { text, intent: 'account' };
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
        return { text, intent: 'time_analysis' };
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
        text += generateInsight(ctx, period);
        return { text, intent: 'summary' };
      }

      case 'savings': {
        const comp = getComparison(ctx, period);
        let text = `💰 **Savings Analysis** for ${periodLabel}:\n\n`;
        text += `Income: ${fc(comp.income, settings)}\n`;
        text += `Expenses: ${fc(comp.expenses, settings)}\n`;
        text += `Savings: **${fc(comp.savings, settings)}**\n`;
        if (comp.income > 0) {
          text += `Savings rate: **${comp.savingsRate}%**\n\n`;
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
        return { text, intent: 'savings' };
      }

      case 'search': {
        const term = parsed.searchTerm || query.replace(/\b(find|search|show|list|all|me|my|the|transactions?|purchases?|payments?|expenses?)\b/gi, '').trim();
        if (!term) return { text: `What would you like to search for? Try "find transactions for groceries" or "show Amazon purchases".`, intent: 'search' };
        const results = searchTransactions(ctx, term, parsed.period, parsed.amountFilter);
        if (results.length === 0) return { text: `No transactions found matching "${term}" for ${periodLabel}. Try different keywords or time period.`, intent: 'search' };
        let text = `🔎 Found **${results.length}** transaction${results.length > 1 ? 's' : ''} matching "${term}":\n\n`;
        results.forEach(t => {
          const cat = categories.find(c => c.id === t.categoryId);
          const d = new Date(t.date + 'T00:00:00');
          const dateStr = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const icon = t.type === 'income' ? '💚' : '🔴';
          text += `  ${icon} ${dateStr} — ${fc(t.amount, settings)} — ${cat?.name || 'Uncategorized'}${t.notes ? ` (${t.notes})` : ''}\n`;
        });
        return { text, intent: 'search' };
      }

      default: {
        // Smart fallback: try fuzzy entity matching before showing generic help
        const fuzzyResult = tryFuzzyEntityMatch(query, ctx);
        if (fuzzyResult) {
          return { text: fuzzyResult, intent: 'search' };
        }
        return {
          text: `🤔 I'm not sure what you're asking about. Here are some things I can help with:\n\n` +
            `💸 **Spending:** "What did I spend this month?"\n` +
            `📊 **Analysis:** "Top expense categories"\n` +
            `📈 **Trends:** "Analyze my spending patterns"\n` +
            `💰 **Budget:** "Am I within budget?"\n` +
            `🏥 **Health:** "Financial health check"\n` +
            `🔁 **Recurring:** "My recurring expenses"\n` +
            `🔮 **Forecast:** "Predict month-end spending"\n` +
            `💡 **Advice:** "Tips to save more"\n\n` +
            `Type "help" for the full list of capabilities!`,
          intent: 'help',
        };
      }
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
