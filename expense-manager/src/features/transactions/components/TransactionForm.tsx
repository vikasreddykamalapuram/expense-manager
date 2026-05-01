import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { PAYMENT_METHODS } from '../../../shared/constants/accounts';
import { getToday, classNames } from '../../../shared/utils/helpers';
import { Transaction, PaymentMethod } from '../../../shared/types';

interface TransactionFormProps {
  editTransaction?: Transaction;
  onClose?: () => void;
}

export function TransactionForm({ editTransaction, onClose }: TransactionFormProps) {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const isEditing = !!editTransaction;
  const { accounts, categories } = state;

  const [type, setType] = useState<'income' | 'expense' | 'transfer'>(editTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || '');
  const [date, setDate] = useState(editTransaction?.date || getToday());
  const [notes, setNotes] = useState(editTransaction?.notes || '');
  const [accountId, setAccountId] = useState(editTransaction?.accountId || '');
  const [toAccountId, setToAccountId] = useState(editTransaction?.toAccountId || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(editTransaction?.paymentMethod || '');
  const [isRecurring, setIsRecurring] = useState(editTransaction?.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState(
    editTransaction?.recurringFrequency || 'monthly'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Use state categories (includes custom) instead of hardcoded getCategoriesByType
  const filteredCategories = type === 'transfer'
    ? []
    : categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));
  const activeAccounts = accounts.filter((a) => a.isActive);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (type !== 'transfer' && !categoryId) newErrors.categoryId = 'Please select a category';
    if (!date) newErrors.date = 'Please select a date';
    if (type === 'transfer') {
      if (!accountId) newErrors.accountId = 'Select source account';
      if (!toAccountId) newErrors.toAccountId = 'Select destination account';
      if (accountId && toAccountId && accountId === toAccountId) {
        newErrors.toAccountId = 'Source and destination must be different';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date().toISOString();
    const txData = {
      type,
      amount: parseFloat(amount),
      categoryId: type === 'transfer' ? 'transfer' : categoryId,
      date,
      notes,
      accountId: accountId || undefined,
      toAccountId: type === 'transfer' ? toAccountId || undefined : undefined,
      paymentMethod: paymentMethod || undefined,
      isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency as Transaction['recurringFrequency'] : undefined,
    };

    if (isEditing && editTransaction) {
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: { id: editTransaction.id, updates: txData },
      });
    } else {
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: { id: uuidv4(), ...txData, createdAt: now, updatedAt: now },
      });
    }

    if (onClose) {
      onClose();
    } else {
      navigate('/transactions');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Type Toggle */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => { setType('expense'); setCategoryId(''); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'expense'
              ? 'bg-danger-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowUpCircle size={16} />
          Expense
        </button>
        <button
          type="button"
          onClick={() => { setType('income'); setCategoryId(''); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'income'
              ? 'bg-success-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowDownCircle size={16} />
          Income
        </button>
        <button
          type="button"
          onClick={() => { setType('transfer'); setCategoryId(''); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'transfer'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowLeftRight size={16} />
          Transfer
        </button>
      </div>

      {/* Amount */}
      <Input
        label="Amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        error={errors.amount}
        className="text-2xl font-bold"
      />

      {/* Account Selection */}
      {activeAccounts.length > 0 && (
        <div className={type === 'transfer' ? 'grid grid-cols-2 gap-4' : ''}>
          <Select
            label={type === 'transfer' ? 'From Account' : type === 'income' ? 'Credit To' : 'Debit From'}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            error={errors.accountId}
            options={[
              { value: '', label: type === 'transfer' ? 'Select source...' : 'Select account (optional)...' },
              ...activeAccounts.map((a) => ({
                value: a.id,
                label: `${a.name}${a.institution ? ` (${a.institution})` : ''}`,
              })),
            ]}
          />
          {type === 'transfer' && (
            <Select
              label="To Account"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              error={errors.toAccountId}
              options={[
                { value: '', label: 'Select destination...' },
                ...activeAccounts
                  .filter((a) => a.id !== accountId)
                  .map((a) => ({
                    value: a.id,
                    label: `${a.name}${a.institution ? ` (${a.institution})` : ''}`,
                  })),
              ]}
            />
          )}
        </div>
      )}

      {/* Category (not for transfers) */}
      {type !== 'transfer' && (
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          error={errors.categoryId}
          options={[
            { value: '', label: 'Select a category...' },
            ...filteredCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      )}

      {/* Payment Method */}
      <Select
        label="Payment Method"
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        options={[
          { value: '', label: 'Select payment method (optional)...' },
          ...PAYMENT_METHODS.map((pm) => ({ value: pm.value, label: pm.label })),
        ]}
      />

      {/* Date */}
      <Input
        label="Date"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        error={errors.date}
      />

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-gray-700">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          placeholder={type === 'transfer' ? 'e.g., CC bill payment, EMI...' : 'Add a description...'}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Recurring */}
      {type !== 'transfer' && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Recurring transaction</span>
          </label>
          {isRecurring && (
            <Select
              value={recurringFrequency}
              onChange={(e) => setRecurringFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]}
              className="w-32"
            />
          )}
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Update Transaction' : type === 'transfer' ? 'Transfer' : 'Add Transaction'}
        </Button>
        {onClose && (
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
