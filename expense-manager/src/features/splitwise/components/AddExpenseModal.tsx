import { useState } from 'react';
import { X } from 'lucide-react';
import * as splitService from '../services/splitService';
import type { SplitMember, SplitType, SplitShare } from '../../../shared/types';

interface Props {
  profileId: string;
  groupId: string;
  members: SplitMember[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddExpenseModal({ profileId, groupId, members, onClose, onAdded }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(members[0]?.id || '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Custom splits for percentage/exact/shares
  const [customValues, setCustomValues] = useState<Record<string, string>>(
    Object.fromEntries(members.map(m => [m.id, '']))
  );

  const amountNum = parseFloat(amount) || 0;

  const computeSplits = (): SplitShare[] => {
    switch (splitType) {
      case 'equal':
        return splitService.computeEqualSplits(amountNum, members.map(m => m.id));
      case 'percentage':
        return splitService.computePercentageSplits(
          amountNum,
          members.map(m => ({ memberId: m.id, percent: parseFloat(customValues[m.id]) || 0 }))
        );
      case 'exact':
        return members.map(m => ({ memberId: m.id, amount: parseFloat(customValues[m.id]) || 0 }));
      case 'shares':
        return splitService.computeSharesSplits(
          amountNum,
          members.map(m => ({ memberId: m.id, shareCount: parseFloat(customValues[m.id]) || 0 }))
        );
      default:
        return [];
    }
  };

  const getValidationError = (): string | null => {
    if (!description.trim()) return 'Description is required';
    if (amountNum <= 0) return 'Amount must be positive';
    if (!paidBy) return 'Select who paid';

    if (splitType === 'percentage') {
      const total = members.reduce((s, m) => s + (parseFloat(customValues[m.id]) || 0), 0);
      if (Math.abs(total - 100) > 0.01) return `Percentages must add up to 100% (currently ${total.toFixed(1)}%)`;
    }
    if (splitType === 'exact') {
      const total = members.reduce((s, m) => s + (parseFloat(customValues[m.id]) || 0), 0);
      if (Math.abs(total - amountNum) > 0.01) return `Exact amounts must add up to ₹${amountNum} (currently ₹${total.toFixed(2)})`;
    }
    if (splitType === 'shares') {
      const total = members.reduce((s, m) => s + (parseFloat(customValues[m.id]) || 0), 0);
      if (total <= 0) return 'At least one share must be greater than 0';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (getValidationError()) return;
    setSaving(true);
    await splitService.addExpense(profileId, {
      groupId,
      description: description.trim(),
      amount: amountNum,
      paidBy,
      splitType,
      splits: computeSplits(),
      date,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    onAdded();
  };

  const error = getValidationError();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Expense</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Dinner at restaurant"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹) *</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Paid By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid by *</label>
            <select
              value={paidBy}
              onChange={e => setPaidBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Split Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Split Method</label>
            <div className="grid grid-cols-4 gap-1">
              {(['equal', 'percentage', 'exact', 'shares'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSplitType(type)}
                  className={`py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                    splitType === type
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Custom split inputs */}
          {splitType !== 'equal' && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {splitType === 'percentage' && 'Enter % for each member (must total 100%)'}
                {splitType === 'exact' && `Enter exact amount for each member (must total ₹${amountNum})`}
                {splitType === 'shares' && 'Enter share count for each member'}
              </p>
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{m.name}</span>
                  <input
                    type="number"
                    value={customValues[m.id]}
                    onChange={e => setCustomValues(prev => ({ ...prev, [m.id]: e.target.value }))}
                    placeholder={splitType === 'percentage' ? '%' : splitType === 'shares' ? '1' : '0.00'}
                    step={splitType === 'shares' ? '1' : '0.01'}
                    min="0"
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-gray-400 w-6">
                    {splitType === 'percentage' ? '%' : splitType === 'shares' ? '×' : '₹'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Validation Error */}
          {error && amount && description && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!!error || saving}
            className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
