import { useState } from 'react';
import { Edit2, Trash2, Search, Filter, ArrowUpDown, Receipt } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Modal } from '../../../shared/components/ui/Modal';
import { TransactionForm } from './TransactionForm';
import { getCategoryById } from '../../../shared/constants/categories';
import { formatCurrency, formatDate, classNames } from '../../../shared/utils/helpers';
import { Transaction, TransactionFilters } from '../../../shared/types';

export function TransactionList() {
  const { state, dispatch } = useAppContext();
  const { transactions } = useTransactions();
  const { settings, filters } = state;
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    setDeleteConfirm(null);
  };

  const updateFilters = (updates: Partial<TransactionFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: updates });
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={filters.searchQuery || ''}
            onChange={(e) => updateFilters({ searchQuery: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            size="md"
            icon={<Filter size={16} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<ArrowUpDown size={16} />}
            onClick={() =>
              updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })
            }
          >
            Sort
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-white p-4 shadow-sm border border-gray-200">
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.type || ''}
            onChange={(e) =>
              updateFilters({ type: (e.target.value as 'income' | 'expense') || undefined })
            }
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <select
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            value={filters.sortBy}
            onChange={(e) => updateFilters({ sortBy: e.target.value as TransactionFilters['sortBy'] })}
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="category">Sort by Category</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'RESET_FILTERS' })}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={<Receipt size={32} />}
          title="No transactions found"
          description="Start tracking your finances by adding your first transaction."
        />
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const category = getCategoryById(tx.categoryId);
            return (
              <div
                key={tx.id}
                className="group flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100 transition-all hover:shadow-md"
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${category?.color}15` }}
                >
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category?.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {category?.name || 'Unknown'}
                    </p>
                    {tx.isRecurring && (
                      <span className="text-[10px] font-medium uppercase text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                        Recurring
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500">
                      {formatDate(tx.date, settings.dateFormat)}
                    </span>
                    {tx.notes && (
                      <span className="text-xs text-gray-400 truncate max-w-[200px]">
                        · {tx.notes}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={classNames(
                      'text-sm font-bold',
                      tx.type === 'income' ? 'text-success-600' : 'text-danger-600'
                    )}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount, settings)}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingTx(tx)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      aria-label="Edit transaction"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(tx.id)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600"
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={!!editingTx} onClose={() => setEditingTx(null)} title="Edit Transaction">
        {editingTx && (
          <TransactionForm
            editTransaction={editingTx}
            onClose={() => setEditingTx(null)}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Transaction"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
