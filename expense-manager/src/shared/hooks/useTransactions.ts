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
  // Separates income and expense, computes percentage against the correct total
  const buildByCategory = (
    txns: typeof transactions,
    totalIncome: number,
    totalExpense: number
  ): CategoryStat[] => {
    const categoryMap = new Map<string, { amount: number; count: number; type: 'income' | 'expense' }>();
    // Only income and expense transactions (no transfers)
    txns.filter((t) => t.type === 'income' || t.type === 'expense').forEach((t) => {
      const cat = findCategory(t.categoryId);
      const effectiveId = cat?.parentId || t.categoryId;
      const existing = categoryMap.get(effectiveId) || { amount: 0, count: 0, type: t.type as 'income' | 'expense' };
      categoryMap.set(effectiveId, {
        amount: existing.amount + t.amount,
        count: existing.count + 1,
        type: existing.type, // keep the first-seen type
      });
    });

    const byCategory: CategoryStat[] = Array.from(categoryMap.entries()).map(
      ([categoryId, { amount, count }]) => {
        const category = findCategory(categoryId);
        // Use correct denominator: expense categories relative to totalExpense, income to totalIncome
        const isExpense = category?.type === 'expense';
        const denominator = (isExpense ? totalExpense : totalIncome) || 1;
        return {
          categoryId,
          categoryName: category?.name || 'Unknown',
          amount,
          percentage: Math.round((amount / denominator) * 100),
          color: category?.color || '#64748b',
          count,
        };
      }
    );

    byCategory.sort((a, b) => b.amount - a.amount);
    return byCategory;
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
