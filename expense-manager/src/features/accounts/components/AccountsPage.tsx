import { useState, useMemo } from 'react';
import {
  Plus, Edit2, Trash2, Landmark, CreditCard, HandCoins, Smartphone,
  Banknote, TrendingUp, TrendingDown, Wallet, AlertTriangle, LucideIcon,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { StatCard } from '../../../shared/components/ui/StatCard';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { Modal } from '../../../shared/components/ui/Modal';
import { AccountForm } from './AccountForm';
import { Account, AccountType } from '../../../shared/types';
import { ACCOUNT_TYPE_META, BANK_SUBTYPES, LOAN_SUBTYPES, computeAccountBalance } from '../../../shared/constants/accounts';
import { formatCurrency, classNames } from '../../../shared/utils/helpers';

const iconMap: Record<string, LucideIcon> = {
  Landmark, CreditCard, HandCoins, Smartphone, Banknote,
};

const typeOrder: AccountType[] = ['bank', 'credit_card', 'loan', 'wallet', 'cash'];

export function AccountsPage() {
  const { state, actions } = useAppContext();
  const { accounts, transactions, settings } = state;
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((acc) => {
      map.set(acc.id, computeAccountBalance(acc, transactions));
    });
    return map;
  }, [accounts, transactions]);

  const summary = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    accounts.forEach((acc) => {
      const bal = accountBalances.get(acc.id) || 0;
      if (acc.kind === 'asset') totalAssets += bal;
      else totalLiabilities += bal;
    });
    return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
  }, [accounts, accountBalances]);

  const groupedAccounts = useMemo(() => {
    const groups = new Map<AccountType, Account[]>();
    typeOrder.forEach((t) => groups.set(t, []));
    accounts.forEach((acc) => {
      const list = groups.get(acc.type) || [];
      list.push(acc);
      groups.set(acc.type, list);
    });
    return groups;
  }, [accounts]);

  const handleDelete = (id: string) => {
    const linkedTxns = transactions.filter(
      (t) => t.accountId === id || t.toAccountId === id
    );
    if (linkedTxns.length > 0) {
      linkedTxns.forEach((t) => {
        const updates: Record<string, string | undefined> = {};
        if (t.accountId === id) updates.accountId = undefined;
        if (t.toAccountId === id) updates.toAccountId = undefined;
        actions.updateTransaction(t.id, updates);
      });
    }
    actions.deleteAccount(id);
    setDeleteConfirm(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-sm text-gray-500">
            Manage your bank accounts, credit cards, loans, and wallets
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={() => setShowForm(true)}>
          Add Account
        </Button>
      </div>

      {/* Summary Cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Assets"
            value={formatCurrency(summary.totalAssets, settings)}
            icon={<TrendingUp size={24} />}
            variant="income"
          />
          <StatCard
            title="Total Liabilities"
            value={formatCurrency(summary.totalLiabilities, settings)}
            icon={<TrendingDown size={24} />}
            variant="expense"
          />
          <StatCard
            title="Net Worth"
            value={formatCurrency(summary.netWorth, settings)}
            icon={<Wallet size={24} />}
            variant={summary.netWorth >= 0 ? 'balance' : 'expense'}
          />
        </div>
      )}

      {/* Account Groups */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={40} />}
          title="No accounts yet"
          description="Add your bank accounts, credit cards, and loans to track where your money flows."
          action={
            <Button icon={<Plus size={18} />} onClick={() => setShowForm(true)}>
              Add Your First Account
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {typeOrder.map((type) => {
            const group = groupedAccounts.get(type) || [];
            if (group.length === 0) return null;
            const meta = ACCOUNT_TYPE_META[type];
            const Icon = iconMap[meta.icon] || Landmark;

            return (
              <div key={type}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon size={18} className="text-gray-500" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                    {meta.label}s
                  </h2>
                  <span className="text-xs text-gray-400">({group.length})</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((acc) => {
                    const balance = accountBalances.get(acc.id) || 0;
                    const isLiability = acc.kind === 'liability';

                    return (
                      <div
                        key={acc.id}
                        className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-10 w-10 items-center justify-center rounded-xl"
                              style={{ backgroundColor: `${acc.color}15` }}
                            >
                              <Icon size={20} style={{ color: acc.color }} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{acc.name}</p>
                              <div className="flex items-center gap-1.5">
                                {acc.subtype && (
                                  <span className="text-xs text-gray-400">
                                    {[...BANK_SUBTYPES, ...LOAN_SUBTYPES].find((s) => s.value === acc.subtype)?.label || acc.subtype}
                                  </span>
                                )}
                                {acc.institution && acc.subtype && <span className="text-xs text-gray-300">·</span>}
                                {acc.institution && (
                                  <span className="text-xs text-gray-500">{acc.institution}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setEditingAccount(acc);
                                setShowForm(true);
                              }}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              aria-label="Edit account"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(acc.id)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600"
                              aria-label="Delete account"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-gray-500">
                            {isLiability ? 'Outstanding' : 'Balance'}
                          </p>
                          <p
                            className={classNames(
                              'text-xl font-bold',
                              isLiability
                                ? balance > 0 ? 'text-danger-600' : 'text-success-600'
                                : balance >= 0 ? 'text-gray-900' : 'text-danger-600'
                            )}
                          >
                            {isLiability && balance > 0 && '-'}
                            {formatCurrency(Math.abs(balance), settings)}
                          </p>

                          {acc.type === 'credit_card' && acc.creditLimit && (
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>Available Credit</span>
                                <span>{formatCurrency(Math.max(0, acc.creditLimit - balance), settings)}</span>
                              </div>
                              <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.min(100, (balance / acc.creditLimit) * 100)}%`,
                                    backgroundColor: (balance / acc.creditLimit) > 0.8 ? '#ef4444' : acc.color,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {acc.interestRate !== undefined && acc.interestRate > 0 && (
                            <p className="mt-1 text-xs text-gray-400">
                              {acc.interestRate}% p.a.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingAccount(null);
        }}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
        size="md"
      >
        <AccountForm
          editAccount={editingAccount || undefined}
          onClose={() => {
            setShowForm(false);
            setEditingAccount(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        size="sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="text-danger-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this account? Linked transactions will be unassigned.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Delete Account
          </Button>
        </div>
      </Modal>
    </div>
  );
}
