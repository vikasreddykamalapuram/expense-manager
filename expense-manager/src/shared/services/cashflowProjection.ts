import type { Transaction, RecurringRule, BillReminder } from '../types';

/**
 * 30-day cashflow projection.
 *
 * Rolls the current balance forward day by day using three signals:
 *   1. Known recurring rules — income (+) or expense (−) on their nextDueDate
 *      (and every subsequent occurrence within the horizon).
 *   2. Bill reminders — treated as expenses on their next dueDate.
 *   3. A daily-discretionary baseline — average of the last 60 days of
 *      *non-recurring* expenses (i.e. transactions that don't match any
 *      known recurring rule name or bill reminder name). Applied every day.
 *
 * Zero server calls. Runs entirely on-device. Purely deterministic — the
 * same inputs always produce the same projection.
 */

export interface CashflowPoint {
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Projected end-of-day running balance */
  balance: number;
  /** Sum of income events attributed to this day (recurring only) */
  income: number;
  /** Sum of expense events attributed to this day (recurring + bills + baseline) */
  expense: number;
  /** Labels of scheduled events happening this day (for tooltip). */
  events: string[];
}

export interface CashflowProjection {
  points: CashflowPoint[];
  startBalance: number;
  endBalance: number;
  minBalance: number;
  minBalanceDate: string;
  totalIncome: number;
  totalExpense: number;
  dailyBaseline: number;
}

const HORIZON_DAYS = 30;
const BASELINE_LOOKBACK_DAYS = 60;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

/** Advance a nextDueDate by one period. Returns null once past horizon. */
function advance(iso: string, frequency: RecurringRule['frequency']): string {
  const d = new Date(iso);
  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return toISODate(d);
}

/** Compute the next occurrence of a bill reminder given its day-of-month. */
function nextBillDate(today: string, dueDay: number): string {
  const now = new Date(today);
  const y = now.getFullYear();
  const m = now.getMonth();
  // Clamp to the last day of the month if dueDay > days-in-month.
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const day = Math.min(dueDay, daysInMonth);
  let next = new Date(y, m, day);
  if (toISODate(next) < today) {
    // Rolled past — advance one month.
    const nextMonth = new Date(y, m + 1, 1);
    const nm = nextMonth.getMonth();
    const nmDays = new Date(nextMonth.getFullYear(), nm + 1, 0).getDate();
    next = new Date(nextMonth.getFullYear(), nm, Math.min(dueDay, nmDays));
  }
  return toISODate(next);
}

/**
 * Rough classifier: is a transaction "explained" by a known recurring rule or
 * bill reminder? Used to strip these from the discretionary baseline so we
 * don't double-count them.
 */
function isExplained(
  tx: Transaction,
  ruleNames: Set<string>,
  billNames: Set<string>,
): boolean {
  const notes = (tx.notes || '').toLowerCase();
  if (!notes) return false;
  for (const n of ruleNames) if (notes.includes(n)) return true;
  for (const n of billNames) if (notes.includes(n)) return true;
  return false;
}

export function projectCashflow(input: {
  transactions: Transaction[];
  recurringRules: RecurringRule[];
  billReminders: BillReminder[];
  currentBalance: number;
  today?: string;
  horizonDays?: number;
}): CashflowProjection {
  const today = input.today || toISODate(new Date());
  const horizon = input.horizonDays ?? HORIZON_DAYS;
  const endDate = addDays(today, horizon - 1);

  const ruleNames = new Set(
    input.recurringRules
      .filter((r) => r.isActive && !r.isDeleted)
      .map((r) => (r.name || '').toLowerCase())
      .filter(Boolean),
  );
  const billNames = new Set(
    input.billReminders
      .filter((b) => b.isActive && !b.isDeleted)
      .map((b) => (b.name || '').toLowerCase())
      .filter(Boolean),
  );

  // 1. Baseline daily discretionary spend from last 60 days.
  const lookbackStart = addDays(today, -BASELINE_LOOKBACK_DAYS);
  const recentExpenses = input.transactions.filter(
    (t) =>
      t.type === 'expense' &&
      !t.isDeleted &&
      t.date >= lookbackStart &&
      t.date < today &&
      !isExplained(t, ruleNames, billNames),
  );
  const baselineTotal = recentExpenses.reduce((s, t) => s + t.amount, 0);
  const dailyBaseline = baselineTotal / BASELINE_LOOKBACK_DAYS;

  // 2. Materialize every event within the horizon.
  const eventsByDay = new Map<string, CashflowPoint>();
  const bump = (date: string, income: number, expense: number, label: string) => {
    if (date > endDate || date < today) return;
    const existing =
      eventsByDay.get(date) ||
      ({ date, balance: 0, income: 0, expense: 0, events: [] } as CashflowPoint);
    existing.income += income;
    existing.expense += expense;
    if (label) existing.events.push(label);
    eventsByDay.set(date, existing);
  };

  // Recurring rules.
  for (const r of input.recurringRules) {
    if (!r.isActive || r.isDeleted) continue;
    let cursor = r.nextDueDate < today ? today : r.nextDueDate;
    const stop = r.endDate && r.endDate < endDate ? r.endDate : endDate;
    let safety = 400;
    while (cursor <= stop && safety-- > 0) {
      const amt = r.amount || 0;
      if (r.type === 'income') bump(cursor, amt, 0, r.name || 'Income');
      else bump(cursor, 0, amt, r.name || 'Expense');
      const next = advance(cursor, r.frequency);
      if (next === cursor) break;
      cursor = next;
    }
  }

  // Bill reminders — one occurrence per month within horizon.
  for (const b of input.billReminders) {
    if (!b.isActive || b.isDeleted) continue;
    let due = nextBillDate(today, b.dueDate);
    let safety = 12;
    while (due <= endDate && safety-- > 0) {
      bump(due, 0, b.amount, b.name || 'Bill');
      if (b.frequency === 'monthly') due = nextBillDate(addDays(due, 1), b.dueDate);
      else if (b.frequency === 'quarterly') due = addDays(due, 90);
      else if (b.frequency === 'yearly') due = addDays(due, 365);
      else break;
    }
  }

  // 3. Fill every day in [today, endDate] and apply the baseline.
  const points: CashflowPoint[] = [];
  let balance = input.currentBalance;
  let minBal = balance;
  let minBalDate = today;
  let totalIncome = 0;
  let totalExpense = 0;

  for (let i = 0; i < horizon; i++) {
    const date = addDays(today, i);
    const p =
      eventsByDay.get(date) ||
      ({ date, balance: 0, income: 0, expense: 0, events: [] } as CashflowPoint);
    p.expense += dailyBaseline;
    balance = balance + p.income - p.expense;
    p.balance = Math.round(balance);
    totalIncome += p.income;
    totalExpense += p.expense;
    if (balance < minBal) {
      minBal = balance;
      minBalDate = date;
    }
    points.push(p);
  }

  return {
    points,
    startBalance: input.currentBalance,
    endBalance: Math.round(balance),
    minBalance: Math.round(minBal),
    minBalanceDate: minBalDate,
    totalIncome: Math.round(totalIncome),
    totalExpense: Math.round(totalExpense),
    dailyBaseline: Math.round(dailyBaseline),
  };
}

// Re-exported so downstream consumers don't need internal helpers.
export const _internal = { addDays, daysBetween, nextBillDate, advance };
