import { useState } from 'react';
import { Edit2, Trash2, Search, Filter, ArrowUpDown, Receipt, ArrowLeftRight, Camera } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useTransactions } from '../../../shared/hooks/useTransactions';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Modal } from '../../../shared/components/ui/Modal';
import { ReceiptViewer } from '../../../shared/components/ReceiptViewer';
import { TransactionForm } from './TransactionForm';
import { PAYMENT_METHODS } from '../../../shared/constants/accounts';
import { formatCurrency, formatDate, classNames } from '../../../shared/utils/helpers';
import { Transaction, TransactionFilters } from '../../../shared/types';
import { SwipeableRow } from '../../../shared/components/ui/SwipeableRow';
import { haptic } from '../../../shared/services/haptics';

export function TransactionList() {
  const { state, actions } = useAppContext();
  const { transactions } = useTransactions();
  const { settings, filters, categories } = state;
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewingReceiptId, setViewingReceiptId] = useState<string | null>(null);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const handleDelete = (id: string) => {
    actions.deleteTransaction(id);
    haptic.success();
    setDeleteConfirm(null);
  };

  const updateFilters = (updates: Partial<TransactionFilters>) => {
    actions.setFilters(updates);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search transactions..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
        <div className="flex flex-wrap gap-2 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-1.5 text-sm"
            value={filters.type || ''}
            onChange={(e) =>
              updateFilters({ type: (e.target.value as 'income' | 'expense' | 'transfer') || undefined })
            }
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          {state.accounts.length > 0 && (
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-1.5 text-sm"
              value={filters.accountId || ''}
              onChange={(e) => updateFilters({ accountId: e.target.value || undefined })}
            >
              <option value="">All Accounts</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <select
            className="rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-1.5 text-sm"
            value={filters.sortBy}
            onChange={(e) => updateFilters({ sortBy: e.target.value as TransactionFilters['sortBy'] })}
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="category">Sort by Category</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => actions.resetFilters()}>
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
            const parentCat = category?.parentId ? getCategoryById(category.parentId) : null;
            const account = tx.accountId ? state.accounts.find((a) => a.id === tx.accountId) : null;
            const toAccount = tx.toAccountId ? state.accounts.find((a) => a.id === tx.toAccountId) : null;
            const isTransfer = tx.type === 'transfer';
            const displayColor = parentCat?.color || category?.color;
            const displayName = isTransfer
              ? `${account?.name || 'Unknown'} → ${toAccount?.name || 'Unknown'}`
              : parentCat
                ? `${parentCat.name} › ${category?.name}`
                : category?.name || 'Unknown';
            return (
              <SwipeableRow key={tx.id} onDelete={() => setDeleteConfirm(tx.id)}>
                <div
                  className="group flex items-center gap-4 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 transition-all hover:shadow-md"
                >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: isTransfer ? '#3b82f615' : `${displayColor}15` }}
                >
                  {isTransfer ? (
                    <ArrowLeftRight size={16} className="text-primary-600" />
                  ) : (
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: displayColor }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {isTransfer ? 'Transfer' : displayName}
                    </p>
                    {tx.isRecurring && (
                      <span className="text-[10px] font-medium uppercase text-primary-600 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded">
                        Recurring
                      </span>
                    )}
                    {tx.receiptId && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingReceiptId(tx.receiptId!);
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        aria-label="View receipt"
                        title="View receipt"
                      >
                        <Camera size={14} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isTransfer ? (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-400">From:</span> {account?.name || 'Unknown'}
                        <span className="mx-1.5 text-primary-400">→</span>
                        <span className="font-medium text-gray-600 dark:text-gray-400">To:</span> {toAccount?.name || 'Unknown'}
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(tx.date, settings.dateFormat)}
                        </span>
                        {account && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            · {account.name}
                          </span>
                        )}
                      </>
                    )}
                    {isTransfer && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        · {formatDate(tx.date, settings.dateFormat)}
                      </span>
                    )}
                    {tx.notes && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
                        · {tx.notes}
                      </span>
                    )}
                    {tx.paymentMethod && (
                      <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        {PAYMENT_METHODS.find((pm) => pm.value === tx.paymentMethod)?.label || tx.paymentMethod}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={classNames(
                      'text-sm font-bold',
                      tx.type === 'income' ? 'text-success-600'
                        : tx.type === 'transfer' ? 'text-primary-600'
                        : 'text-danger-600'
                    )}
                  >
                    {tx.type === 'income' ? '+' : tx.type === 'transfer' ? '' : '-'}
                    {formatCurrency(tx.amount, settings)}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setEditingTx(tx)}
                      className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300"
                      aria-label="Edit transaction"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(tx.id)}
                      className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-danger-50 hover:text-danger-600"
                      aria-label="Delete transaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                </div>
              </SwipeableRow>
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
        <p className="text-sm text-gray-600 dark:text-gray-400">
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

      {/* Receipt Viewer */}
      {viewingReceiptId && (
        <ReceiptViewer
          receiptId={viewingReceiptId}
          isOpen={true}
          onClose={() => setViewingReceiptId(null)}
        />
      )}
    </div>
  );
}
