import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Receipt, HandCoins, TrendingUp, TrendingDown } from 'lucide-react';
import * as splitService from '../services/splitService';
import type { SplitGroup, SplitMember, SplitExpense, SplitSettlement, MemberBalance, DebtEdge } from '../../../shared/types';
import { AddExpenseModal } from './AddExpenseModal';
import { SettleUpModal } from './SettleUpModal';

interface Props {
  groupId: string;
  profileId: string;
  members: SplitMember[];
  onBack: () => void;
  onMembersChanged: () => void;
}

export function GroupDetail({ groupId, profileId, members, onBack, onMembersChanged: _onMembersChanged }: Props) {
  const [group, setGroup] = useState<SplitGroup | null>(null);
  const [expenses, setExpenses] = useState<SplitExpense[]>([]);
  const [settlements, setSettlements] = useState<SplitSettlement[]>([]);
  const [balances, setBalances] = useState<MemberBalance[]>([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState<DebtEdge[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettleUp, setShowSettleUp] = useState(false);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'activity'>('expenses');

  const groupMembers = members.filter(m => group?.memberIds.includes(m.id));

  const loadData = async () => {
    const [g, exp, sett] = await Promise.all([
      splitService.getGroup(groupId),
      splitService.getGroupExpenses(profileId, groupId),
      splitService.getGroupSettlements(profileId, groupId),
    ]);
    setGroup(g || null);
    setExpenses(exp);
    setSettlements(sett);

    if (g) {
      const grpMembers = members.filter(m => g.memberIds.includes(m.id));
      const bal = splitService.computeGroupBalances(exp, sett, grpMembers);
      setBalances(bal);
      setSimplifiedDebts(splitService.simplifyDebts(bal));
    }
  };

  useEffect(() => { loadData(); }, [groupId, profileId, members]);

  if (!group) return <div className="py-12 text-center text-gray-400">Loading...</div>;

  const totalSpent = splitService.getGroupTotal(expenses);
  const getMemberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown';
  const getMemberColor = (id: string) => members.find(m => m.id === id)?.avatarColor || '#6366f1';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {groupMembers.length} members · ₹{totalSpent.toLocaleString()} total
          </p>
        </div>
        <button
          onClick={() => setShowSettleUp(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <HandCoins size={16} />
          Settle Up
        </button>
        <button
          onClick={() => setShowAddExpense(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus size={16} />
          Expense
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['expenses', 'balances', 'activity'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'expenses' && (
        <div className="space-y-2">
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <Receipt size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No expenses yet. Add your first expense!</p>
            </div>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: getMemberColor(exp.paidBy) }}
                >
                  {getMemberName(exp.paidBy).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exp.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {getMemberName(exp.paidBy)} paid · {exp.date} · {exp.splitType} split
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{exp.amount.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="space-y-4">
          {/* Individual Balances */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Member Balances</h3>
            <div className="space-y-2">
              {balances.map(b => (
                <div key={b.memberId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium"
                      style={{ backgroundColor: getMemberColor(b.memberId) }}
                    >
                      {b.memberName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-800 dark:text-gray-200">{b.memberName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {b.balance > 0.01 ? (
                      <TrendingUp size={14} className="text-green-500" />
                    ) : b.balance < -0.01 ? (
                      <TrendingDown size={14} className="text-red-500" />
                    ) : null}
                    <span className={`text-sm font-medium ${
                      b.balance > 0.01 ? 'text-green-600 dark:text-green-400' :
                      b.balance < -0.01 ? 'text-red-600 dark:text-red-400' :
                      'text-gray-500'
                    }`}>
                      {b.balance > 0 ? '+' : ''}₹{b.balance.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simplified Debts */}
          {simplifiedDebts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Simplified Settlements</h3>
              <div className="space-y-2">
                {simplifiedDebts.map((debt, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="font-medium text-red-600 dark:text-red-400">{getMemberName(debt.from)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{getMemberName(debt.to)}</span>
                    <span className="ml-auto font-semibold text-gray-900 dark:text-white">₹{debt.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {balances.every(b => Math.abs(b.balance) < 0.01) && expenses.length > 0 && (
            <div className="text-center py-6 text-green-600 dark:text-green-400 font-medium">
              ✓ All settled up!
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="space-y-2">
          {[...expenses.map(e => ({ type: 'expense' as const, item: e, date: e.createdAt })),
            ...settlements.map(s => ({ type: 'settlement' as const, item: s, date: s.createdAt }))]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                {activity.type === 'expense' ? (
                  <>
                    <Receipt size={18} className="text-primary-500" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{getMemberName((activity.item as SplitExpense).paidBy)}</span>
                        {' added "'}{(activity.item as SplitExpense).description}{'": '}
                        <span className="font-medium">₹{(activity.item as SplitExpense).amount.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(activity.date).toLocaleDateString()}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <HandCoins size={18} className="text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{getMemberName((activity.item as SplitSettlement).fromMemberId)}</span>
                        {' paid '}
                        <span className="font-medium">{getMemberName((activity.item as SplitSettlement).toMemberId)}</span>
                        {': '}
                        <span className="font-medium">₹{(activity.item as SplitSettlement).amount.toLocaleString()}</span>
                      </p>
                      <p className="text-xs text-gray-400">{new Date(activity.date).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          {expenses.length === 0 && settlements.length === 0 && (
            <p className="text-center py-8 text-gray-400">No activity yet</p>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          profileId={profileId}
          groupId={groupId}
          members={groupMembers}
          onClose={() => setShowAddExpense(false)}
          onAdded={() => { setShowAddExpense(false); loadData(); }}
        />
      )}
      {showSettleUp && (
        <SettleUpModal
          profileId={profileId}
          groupId={groupId}
          members={groupMembers}
          debts={simplifiedDebts}
          onClose={() => setShowSettleUp(false)}
          onSettled={() => { setShowSettleUp(false); loadData(); }}
        />
      )}
    </div>
  );
}
