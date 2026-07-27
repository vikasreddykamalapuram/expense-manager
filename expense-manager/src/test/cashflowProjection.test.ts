import { describe, it, expect } from 'vitest';
import { projectCashflow } from '../shared/services/cashflowProjection';
import type { Transaction, RecurringRule, BillReminder } from '../shared/types';

const iso = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const mkTx = (overrides: Partial<Transaction>): Transaction => ({
  id: 't' + Math.random(),
  date: iso(-1),
  amount: 100,
  categoryId: 'c1',
  type: 'expense',
  notes: '',
  paymentMethod: 'cash',
  isRecurring: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('projectCashflow', () => {
  it('returns 30 points starting today', () => {
    const p = projectCashflow({
      transactions: [],
      recurringRules: [],
      billReminders: [],
      currentBalance: 10000,
    });
    expect(p.points.length).toBe(30);
    expect(p.startBalance).toBe(10000);
  });

  it('applies daily discretionary baseline from last 60 days', () => {
    // 30 expenses of 100 over the last 30 days = ~ 100/day baseline
    const txns: Transaction[] = [];
    for (let i = 1; i <= 30; i++) {
      txns.push(mkTx({ id: 'x' + i, date: iso(-i), amount: 100, type: 'expense', notes: 'coffee' }));
    }
    const p = projectCashflow({
      transactions: txns,
      recurringRules: [],
      billReminders: [],
      currentBalance: 5000,
    });
    // Baseline should be positive (some average daily burn)
    expect(p.dailyBaseline).toBeGreaterThan(0);
    // End balance strictly less than start balance
    expect(p.endBalance).toBeLessThan(p.startBalance);
  });

  it('adds recurring income on due dates', () => {
    const rule: RecurringRule = {
      id: 'r1',
      name: 'Salary',
      type: 'income',
      amount: 50000,
      categoryId: 'c1',
      notes: '',
      frequency: 'monthly',
      startDate: iso(-30),
      nextDueDate: iso(5),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const p = projectCashflow({
      transactions: [],
      recurringRules: [rule],
      billReminders: [],
      currentBalance: 1000,
    });
    expect(p.totalIncome).toBeGreaterThanOrEqual(50000);
    // Some day should register a salary event
    const salaryDays = p.points.filter((pt) => pt.events.some((e) => e.includes('Salary')));
    expect(salaryDays.length).toBeGreaterThan(0);
  });

  it('detects a projected shortfall when spend far exceeds balance', () => {
    // Baseline ~ 500/day, only 1000 starting balance
    const txns: Transaction[] = [];
    for (let i = 1; i <= 30; i++) {
      txns.push(mkTx({ id: 's' + i, date: iso(-i), amount: 500, type: 'expense', notes: 'daily' }));
    }
    const p = projectCashflow({
      transactions: txns,
      recurringRules: [],
      billReminders: [],
      currentBalance: 1000,
    });
    expect(p.minBalance).toBeLessThan(0);
    expect(p.minBalanceDate).toBeTruthy();
  });

  it('respects bill reminders as recurring monthly expenses', () => {
    const bill: BillReminder = {
      id: 'b1',
      name: 'Rent',
      amount: 15000,
      category: 'rent',
      dueDate: ((new Date().getDate() + 5 - 1) % 28) + 1, // 5 days ahead, clamped to 1-28
      frequency: 'monthly',
      isAutoPay: false,
      reminderDays: [3, 1],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const p = projectCashflow({
      transactions: [],
      recurringRules: [],
      billReminders: [bill],
      currentBalance: 50000,
    });
    // Rent should appear at least once in the events list
    const rentDay = p.points.find((pt) => pt.events.some((e) => e.includes('Rent')));
    expect(rentDay).toBeTruthy();
  });
});
