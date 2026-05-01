import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { getCategoriesByType } from '../../../shared/constants/categories';
import { getToday, classNames } from '../../../shared/utils/helpers';
import { Transaction } from '../../../shared/types';

interface TransactionFormProps {
  editTransaction?: Transaction;
  onClose?: () => void;
}

export function TransactionForm({ editTransaction, onClose }: TransactionFormProps) {
  const { dispatch } = useAppContext();
  const navigate = useNavigate();
  const isEditing = !!editTransaction;

  const [type, setType] = useState<'income' | 'expense'>(editTransaction?.type || 'expense');
  const [amount, setAmount] = useState(editTransaction?.amount.toString() || '');
  const [categoryId, setCategoryId] = useState(editTransaction?.categoryId || '');
  const [date, setDate] = useState(editTransaction?.date || getToday());
  const [notes, setNotes] = useState(editTransaction?.notes || '');
  const [isRecurring, setIsRecurring] = useState(editTransaction?.isRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState(
    editTransaction?.recurringFrequency || 'monthly'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = getCategoriesByType(type);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!categoryId) newErrors.categoryId = 'Please select a category';
    if (!date) newErrors.date = 'Please select a date';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const now = new Date().toISOString();

    if (isEditing && editTransaction) {
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: {
          id: editTransaction.id,
          updates: {
            type,
            amount: parseFloat(amount),
            categoryId,
            date,
            notes,
            isRecurring,
            recurringFrequency: isRecurring ? recurringFrequency as Transaction['recurringFrequency'] : undefined,
          },
        },
      });
    } else {
      dispatch({
        type: 'ADD_TRANSACTION',
        payload: {
          id: uuidv4(),
          type,
          amount: parseFloat(amount),
          categoryId,
          date,
          notes,
          isRecurring,
          recurringFrequency: isRecurring ? recurringFrequency as Transaction['recurringFrequency'] : undefined,
          createdAt: now,
          updatedAt: now,
        },
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
      <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => { setType('expense'); setCategoryId(''); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'expense'
              ? 'bg-danger-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowUpCircle size={18} />
          Expense
        </button>
        <button
          type="button"
          onClick={() => { setType('income'); setCategoryId(''); }}
          className={classNames(
            'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all',
            type === 'income'
              ? 'bg-success-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <ArrowDownCircle size={18} />
          Income
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

      {/* Category */}
      <Select
        label="Category"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        error={errors.categoryId}
        options={[
          { value: '', label: 'Select a category...' },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
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
          placeholder="Add a description..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Recurring */}
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

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" className="flex-1">
          {isEditing ? 'Update Transaction' : 'Add Transaction'}
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
