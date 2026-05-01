import { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { MonthlyStats, CategoryStat } from '../types';
import { getCategoryById } from '../constants/categories';
import { getMonthRange, getCurrentMonth } from '../utils/helpers';

export function useTransactions() {
  const { state, dispatch } = useAppContext();
  const { transactions, filters } = state;

  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    if (filters.type) {
      result = result.filter((t) => t.type === filters.type);
    }

    if (filters.categoryId) {
      result = result.filter((t) => t.categoryId === filters.categoryId);
    }

    if (filters.dateRange) {
      result = result.filter(
        (t) => t.date >= filters.dateRange!.start && t.date <= filters.dateRange!.end
      );
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter((t) => {
        const category = getCategoryById(t.categoryId);
        return (
          t.notes.toLowerCase().includes(query) ||
          category?.name.toLowerCase().includes(query) ||
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
  }, [transactions, filters]);

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

      const categoryMap = new Map<string, { amount: number; count: number }>();
      monthTxns.forEach((t) => {
        const existing = categoryMap.get(t.categoryId) || { amount: 0, count: 0 };
        categoryMap.set(t.categoryId, {
          amount: existing.amount + t.amount,
          count: existing.count + 1,
        });
      });

      const totalForPercentage = totalIncome + totalExpense || 1;
      const byCategory: CategoryStat[] = Array.from(categoryMap.entries()).map(
        ([categoryId, { amount, count }]) => {
          const category = getCategoryById(categoryId);
          return {
            categoryId,
            categoryName: category?.name || 'Unknown',
            amount,
            percentage: Math.round((amount / totalForPercentage) * 100),
            color: category?.color || '#64748b',
            count,
          };
        }
      );

      byCategory.sort((a, b) => b.amount - a.amount);

      return { month, totalIncome, totalExpense, balance: totalIncome - totalExpense, byCategory };
    };
  }, [transactions]);

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
    dispatch,
  };
}
