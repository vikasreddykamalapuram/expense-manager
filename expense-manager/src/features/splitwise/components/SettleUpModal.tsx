import { useState } from 'react';
import { X } from 'lucide-react';
import * as splitService from '../services/splitService';
import type { SplitMember, DebtEdge } from '../../../shared/types';

interface Props {
  profileId: string;
  groupId: string;
  members: SplitMember[];
  debts: DebtEdge[];
  onClose: () => void;
  onSettled: () => void;
}

export function SettleUpModal({ profileId, groupId, members, debts, onClose, onSettled }: Props) {
  const [fromMemberId, setFromMemberId] = useState(debts[0]?.from || members[0]?.id || '');
  const [toMemberId, setToMemberId] = useState(debts[0]?.to || members[1]?.id || '');
  const [amount, setAmount] = useState(debts[0]?.amount.toString() || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!fromMemberId || !toMemberId || fromMemberId === toMemberId || amountNum <= 0) return;

    setSaving(true);
    await splitService.addSettlement(profileId, {
      groupId,
      fromMemberId,
      toMemberId,
      amount: amountNum,
      date,
      notes: notes.trim() || undefined,
    });
    setSaving(false);
    onSettled();
  };

  const handleQuickSettle = (debt: DebtEdge) => {
    setFromMemberId(debt.from);
    setToMemberId(debt.to);
    setAmount(debt.amount.toString());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settle Up</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Suggested settlements */}
          {debts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Suggested settlements:</p>
              <div className="space-y-1">
                {debts.map((debt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleQuickSettle(debt)}
                    className="w-full flex items-center gap-2 p-2 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left border border-gray-100 dark:border-gray-700"
                  >
                    <span className="text-red-600 dark:text-red-400 font-medium">{getMemberName(debt.from)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-green-600 dark:text-green-400 font-medium">{getMemberName(debt.to)}</span>
                    <span className="ml-auto font-semibold text-gray-900 dark:text-white">₹{debt.amount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Who is paying?</label>
              <select
                value={fromMemberId}
                onChange={e => setFromMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paying to?</label>
              <select
                value={toMemberId}
                onChange={e => setToMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {members.filter(m => m.id !== fromMemberId).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={!fromMemberId || !toMemberId || fromMemberId === toMemberId || !parseFloat(amount) || saving}
              className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Recording...' : 'Record Settlement'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
