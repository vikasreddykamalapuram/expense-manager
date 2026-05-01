import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { MonthlyStats, CategoryStat } from '../types';
import { getMonthRange, getYearRange, getCurrentMonth } from '../utils/helpers';

export function useTransactions() {
  const { state, dispatch } = useAppContext();
  const { transactions, filters, categories } = state;

  // Helper: look up category from state (includes custom + subcategories)
  const findCategory = (id: string) => categories.find((c) => c.id === id);

  // Helper: get all child category IDs for a parent (for filtering)
  const getCategoryFamily = (categoryId: string): string[] => {
    const children = categories.filter((c) => c.parentId === categoryId).map((c) => c.id);
    return [categoryId, ...children];
  };

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filters.type) {
      result = result.filter((t) => t.type === filters.type);
    }

    if (filters.categoryId) {
      // Include parent + all its subcategories
      const family = getCategoryFamily(filters.categoryId);
      result = result.filter((t) => family.includes(t.categoryId));
    }

    if (filters.accountId) {
      result = result.filter(
        (t) => t.accountId === filters.accountId || t.toAccountId === filters.accountId
      );
    }

    if (filters.dateRange) {
      result = result.filter(
        (t) => t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((t) => {
        const category = findCategory(t.categoryId);
        const parent = category?.parentId ? findCategory(category.parentId) : null;
        return (
          t.notes.toLowerCase().includes(query) ||
          category?.name.toLowerCase().includes(query) ||
          parent?.name.toLowerCase().includes(query) ||
          t.amount.toString().includes(query)
        );
      });
    }

    result.sort((a, b) => {
      const order = filters.sortOrder === 'asc' ? 1 : -1;
      switch (filters.sortBy) {
        case 'amount':
          return (a.amount - b.amount) * order;
        case 'category':
          return a.categoryId.localeCompare(b.categoryId) * order;
        default:
          return a.date.localeCompare(b.date) * order;
      }
    });

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, filters, categories]);

  // Shared helper: build byCategory from a filtered set of transactions
  // Groups by TRANSACTION type (not category type) to ensure expense breakdown
  // only includes expense transaction amounts and income breakdown only income amounts.
  const buildByCategory = (
    txns: typeof transactions,
    totalIncome: number,
    totalExpense: number
  ): CategoryStat[] => {
    // Build separate maps for income and expense transactions
    const expenseMap = new Map<string, { amount: number; count: number }>();
    const incomeMap = new Map<string, { amount: number; count: number }>();

    txns.forEach((t) => {
      if (t.type !== 'income' && t.type !== 'expense') return; // skip transfers
      const map = t.type === 'expense' ? expenseMap : incomeMap;
      const cat = findCategory(t.categoryId);
      const effectiveId = cat?.parentId || t.categoryId;
      const existing = map.get(effectiveId) || { amount: 0, count: 0 };
      map.set(effectiveId, {
        amount: existing.amount + t.amount,
        count: existing.count + 1,
      });
    });

    const result: CategoryStat[] = [];

    // Expense categories — percentage relative to totalExpense
    const expenseDenom = totalExpense || 1;
    expenseMap.forEach(({ amount, count }, categoryId) => {
      const category = findCategory(categoryId);
      result.push({
        categoryId,
        categoryName: category?.name || 'Unknown',
        amount,
        percentage: Math.round((amount / expenseDenom) * 100),
        color: category?.color || '#64748b',
        count,
        type: 'expense',
      });
    });

    // Income categories — percentage relative to totalIncome
    const incomeDenom = totalIncome || 1;
    incomeMap.forEach(({ amount, count }, categoryId) => {
      const category = findCategory(categoryId);
      result.push({
        categoryId,
        categoryName: category?.name || 'Unknown',
        amount,
        percentage: Math.round((amount / incomeDenom) * 100),
        color: category?.color || '#64748b',
        count,
        type: 'income',
      });
    });

    result.sort((a, b) => b.amount - a.amount);
    return result;
  };

  const getMonthlyStats = useMemo(() => {
    return (month: string): MonthlyStats => {
      const range = getMonthRange(month);
      const monthTxns = transactions.filter(
        (t) => t.date >= range.start && t.date <= range.end
      );

      const totalIncome = monthTxns
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = monthTxns
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const byCategory = buildByCategory(monthTxns, totalIncome, totalExpense);

      return { month, totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory };
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories]);

  const getYearlyStats = useMemo(() => {
    return (year: string): MonthlyStats => {
      const range = getYearRange(year);
      const yearTxns = transactions.filter(
        (t) => t.date >= range.start && t.date <= range.end
      );

      const totalIncome = yearTxns
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = yearTxns
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const byCategory = buildByCategory(yearTxns, totalIncome, totalExpense);

      return { month: year, totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory };
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories]);

  const getRangeStats = useMemo(() => {
    return (start: string, end: string): MonthlyStats => {
      const rangeTxns = transactions.filter(
        (t) => t.date >= start && t.date <= end
      );

      const totalIncome = rangeTxns
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const totalExpense = rangeTxns
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

      const byCategory = buildByCategory(rangeTxns, totalIncome, totalExpense);

      return { month: `${start}_${end}`, totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory };
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories]);

  const currentMonthStats = useMemo(() => getMonthlyStats(getCurrentMonth()), [getMonthlyStats]);

  const totalBalance = useMemo(() => {
    const income = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [transactions]);

  return {
    transactions: filteredTransactions,
    allTransactions: transactions,
    currentMonthStats,
    totalBalance,
    recentTransactions,
    getMonthlyStats,
    getYearlyStats,
    getRangeStats,
    dispatch,
  };
}
