import { describe, it, expect } from 'vitest';
import { suggestBudgets } from '../shared/services/budgetSuggestions';
import type { Transaction, Category, Budget } from '../shared/types';

const cats: Category[] = [
  { id: 'food', name: 'Food', type: 'expense', icon: 'X', color: '#000', isCustom: false },
  { id: 'food-out', name: 'Restaurants', type: 'expense', icon: 'X', color: '#000', isCustom: false, parentId: 'food' },
  { id: 'travel', name: 'Travel', type: 'expense', icon: 'X', color: '#000', isCustom: false },
  { id: 'salary', name: 'Salary', type: 'income', icon: 'X', color: '#000', isCustom: false },
];

const tx = (over: Partial<Transaction>): Transaction => ({
  id: 't' + Math.random(),
  date: '2026-05-10',
  amount: 100,
  categoryId: 'food',
  type: 'expense',
  notes: '',
  paymentMethod: 'cash',
  isRecurring: false,
  createdAt: '2026-05-10T00:00:00Z',
  updatedAt: '2026-05-10T00:00:00Z',
  ...over,
});

describe('suggestBudgets (target month 2026-08, 3 months back = May/Jun/Jul)', () => {
  const month = '2026-08';

  it('averages spend over months with data and rounds up to ₹100', () => {
    const transactions: Transaction[] = [
      tx({ categoryId: 'food', date: '2026-05-05', amount: 1000 }),
      tx({ categoryId: 'food', date: '2026-06-05', amount: 2000 }),
      tx({ categoryId: 'food-out', date: '2026-07-05', amount: 950 }), // subcategory counts toward parent
    ];
    const res = suggestBudgets({ transactions, categories: cats, existingBudgets: [], month });
    const food = res.find((r) => r.categoryId === 'food');
    // avg = (1000+2000+950)/3 = 1316.67 -> round up to 1400
    expect(food).toBeTruthy();
    expect(food!.monthsWithData).toBe(3);
    expect(food!.suggested).toBe(1400);
  });

  it('ignores the current/target month and income', () => {
    const transactions: Transaction[] = [
      tx({ categoryId: 'food', date: '2026-08-05', amount: 5000 }), // target month — ignored
      tx({ categoryId: 'salary', date: '2026-07-05', amount: 90000, type: 'income' }),
    ];
    const res = suggestBudgets({ transactions, categories: cats, existingBudgets: [], month });
    expect(res.find((r) => r.categoryId === 'food')).toBeUndefined();
    expect(res.find((r) => r.categoryId === 'salary')).toBeUndefined();
  });

  it('skips categories that already have a budget for the target month', () => {
    const transactions: Transaction[] = [tx({ categoryId: 'travel', date: '2026-06-05', amount: 3000 })];
    const budgets: Budget[] = [{ id: 'b1', categoryId: 'travel', amount: 2000, month: '2026-08', createdAt: '' }];
    const res = suggestBudgets({ transactions, categories: cats, existingBudgets: budgets, month });
    expect(res.find((r) => r.categoryId === 'travel')).toBeUndefined();
  });

  it('returns suggestions sorted by amount descending', () => {
    const transactions: Transaction[] = [
      tx({ categoryId: 'food', date: '2026-06-05', amount: 500 }),
      tx({ categoryId: 'travel', date: '2026-06-05', amount: 8000 }),
    ];
    const res = suggestBudgets({ transactions, categories: cats, existingBudgets: [], month });
    expect(res.map((r) => r.categoryId)).toEqual(['travel', 'food']);
  });

  it('returns nothing when there is no prior spend', () => {
    expect(suggestBudgets({ transactions: [], categories: cats, existingBudgets: [], month })).toEqual([]);
  });
});
