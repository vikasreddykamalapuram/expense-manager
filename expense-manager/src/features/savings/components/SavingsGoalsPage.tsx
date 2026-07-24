import { useState } from 'react';
import { Plus, Target, Trash2, TrendingUp, Calendar, Trophy, Sparkles, X, PiggyBank } from 'lucide-react';
import { useSavingsGoals } from '../../../shared/hooks/useSavingsGoals';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';

const GOAL_ICONS = ['🏠', '🚗', '✈️', '💻', '📱', '🎓', '💍', '🏖️', '🎯', '💰', '🛡️', '🎁'];
const GOAL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'];

interface GoalFormData {
  name: string;
  targetAmount: string;
  deadline: string;
  icon: string;
  color: string;
}

function ProgressRing({ progress, size = 80, strokeWidth = 6, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700" stroke="currentColor"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

function getMilestone(progress: number): { label: string; emoji: string } | null {
  if (progress >= 100) return { label: 'Goal achieved!', emoji: '🎉' };
  if (progress >= 75) return { label: '75% there!', emoji: '🔥' };
  if (progress >= 50) return { label: 'Halfway!', emoji: '⚡' };
  if (progress >= 25) return { label: 'Great start!', emoji: '🌟' };
  return null;
}

function getDaysRemaining(deadline?: string): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function SavingsGoalsPage() {
  const { state } = useAppContext();
  const { goals, loading, addGoal, deleteGoal, addContribution } = useSavingsGoals();
  const [showForm, setShowForm] = useState(false);
  const [contributionGoalId, setContributionGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');
  const [formData, setFormData] = useState<GoalFormData>({
    name: '', targetAmount: '', deadline: '', icon: '🎯', color: '#6366f1',
  });

  const handleAddGoal = async () => {
    if (!formData.name || !formData.targetAmount) return;
    await addGoal({
      name: formData.name,
      targetAmount: parseFloat(formData.targetAmount),
      deadline: formData.deadline || undefined,
      icon: formData.icon,
      color: formData.color,
    });
    setFormData({ name: '', targetAmount: '', deadline: '', icon: '🎯', color: '#6366f1' });
    setShowForm(false);
  };

  const handleContribute = async () => {
    if (!contributionGoalId || !contributionAmount) return;
    await addContribution(contributionGoalId, parseFloat(contributionAmount));
    setContributionGoalId(null);
    setContributionAmount('');
  };

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.savedAmount, 0);
  const completedGoals = goals.filter(g => g.completedAt).length;

  // Recommend monthly savings based on income/expense
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthIncome = state.transactions
    .filter(t => t.type === 'income' && !t.isDeleted && t.date.startsWith(thisMonth))
    .reduce((s, t) => s + t.amount, 0);
  const recommendedSavings = monthIncome > 0 ? Math.round(monthIncome * 0.2) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
            <PiggyBank className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Savings Goals</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Track your financial goals</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" /> New Goal
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Active Goals</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{goals.length - completedGoals}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Completed</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{completedGoals}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Saved</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalSaved, state.settings)}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Target</span>
          </div>
          <p className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(totalTarget, state.settings)}</p>
        </div>
      </div>

      {/* Recommended Savings */}
      {recommendedSavings > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Recommended monthly savings: {formatCurrency(recommendedSavings, state.settings)}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Based on 20% of your income ({formatCurrency(monthIncome, state.settings)})
            </p>
          </div>
        </div>
      )}

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600">
          <PiggyBank className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400">No savings goals yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 mb-4">Create your first goal to start saving</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all"
          >
            Create Goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0;
            const milestone = getMilestone(progress);
            const daysLeft = getDaysRemaining(goal.deadline);
            const monthlyNeeded = daysLeft && daysLeft > 0
              ? (goal.targetAmount - goal.savedAmount) / (daysLeft / 30)
              : null;

            return (
              <div
                key={goal.id}
                className={`rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                  goal.completedAt ? 'ring-2 ring-emerald-400 dark:ring-emerald-600' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Progress Ring */}
                  <ProgressRing progress={progress} color={goal.color} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{goal.icon}</span>
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">{goal.name}</h3>
                    </div>

                    {/* Amount progress */}
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatCurrency(goal.savedAmount, state.settings)}
                      <span className="text-gray-400 dark:text-gray-500"> / {formatCurrency(goal.targetAmount, state.settings)}</span>
                    </p>

                    {/* Milestone badge */}
                    {milestone && (
                      <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300">
                        <span>{milestone.emoji}</span>
                        <span>{milestone.label}</span>
                      </div>
                    )}

                    {/* Deadline + monthly needed */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {daysLeft !== null && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}
                        </span>
                      )}
                      {monthlyNeeded && monthlyNeeded > 0 && !goal.completedAt && (
                        <span className="text-indigo-500 dark:text-indigo-400">
                          Need {formatCurrency(Math.round(monthlyNeeded), state.settings)}/mo
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1">
                    {!goal.completedAt && (
                      <button
                        onClick={() => { setContributionGoalId(goal.id); setContributionAmount(''); }}
                        className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                        title="Add contribution"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4 w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, progress)}%`, backgroundColor: goal.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Contribution Modal */}
      {contributionGoalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setContributionGoalId(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">Add Contribution</h3>
              <button onClick={() => setContributionGoalId(null)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <input
              type="number"
              placeholder="Amount"
              value={contributionAmount}
              onChange={e => setContributionAmount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none mb-4"
              autoFocus
            />
            <button
              onClick={handleContribute}
              disabled={!contributionAmount || parseFloat(contributionAmount) <= 0}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium transition-all active:scale-[0.97]"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* New Goal Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 max-w-[90vw] shadow-xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New Savings Goal</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Goal name (e.g., Emergency Fund)"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
              />

              <input
                type="number"
                placeholder="Target amount"
                value={formData.targetAmount}
                onChange={e => setFormData(prev => ({ ...prev, targetAmount: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Deadline (optional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={e => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Icon picker */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setFormData(prev => ({ ...prev, icon }))}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                        formData.icon === icon
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 ring-2 ring-emerald-500 scale-110'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 block">Color</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                      className={`w-7 h-7 rounded-full transition-all ${
                        formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleAddGoal}
              disabled={!formData.name || !formData.targetAmount}
              className="w-full mt-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium transition-all active:scale-[0.97]"
            >
              Create Goal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
