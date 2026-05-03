import { useState, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  ChevronLeft, ChevronRight, CalendarDays, Target, Plus,
  Pencil, Trash2, AlertTriangle, CheckCircle2, HelpCircle,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Budget, Category, Transaction } from '../../../shared/types';
import { Modal } from '../../../shared/components/ui/Modal';
import { Button } from '../../../shared/components/ui/Button';
import { Input, Select } from '../../../shared/components/ui/Input';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { CategoryIcon } from '../../../shared/components/ui/CategoryIcon';
import {
  formatCurrency, classNames, getCurrentMonth, formatMonth,
  getPreviousMonth, getNextMonth,
} from '../../../shared/utils/helpers';

// ─── Helpers ──────────────────────────────────────────

function getCategorySpending(
  categoryId: string,
  transactions: Transaction[],
  categories: Category[],
  month: string,
): number {
  const subcategoryIds = categories
    .filter((c) => c.parentId === categoryId)
    .map((c) => c.id);
  const allCategoryIds = [categoryId, ...subcategoryIds];

  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.date.slice(0, 7) === month &&
        allCategoryIds.includes(t.categoryId),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

function getProgressColor(pct: number): string {
  if (pct > 90) return 'bg-danger-500';
  if (pct > 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressTextColor(pct: number): string {
  if (pct > 90) return 'text-danger-600 dark:text-danger-400';
  if (pct > 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

// ─── Circular Progress ────────────────────────────────

function CircularProgress({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  let strokeColor = '#10b981'; // green
  if (pct > 90) strokeColor = '#ef4444'; // red
  else if (pct > 75) strokeColor = '#f59e0b'; // amber

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle
          cx="48" cy="48" r={radius}
          stroke="currentColor"
          className="text-gray-200 dark:text-gray-700"
          strokeWidth="8" fill="none"
        />
        <circle
          cx="48" cy="48" r={radius}
          stroke={strokeColor}
          strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className={classNames(
        'absolute text-lg font-bold',
        getProgressTextColor(pct),
      )}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────

export function BudgetsPage() {
  const { state, actions } = useAppContext();
  const { budgets, categories, transactions, settings } = state;

  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // Parent expense categories only
  const parentExpenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense' && !c.parentId),
    [categories],
  );

  // Budgets for the selected month
  const monthBudgets = useMemo(
    () => budgets.filter((b) => b.month === selectedMonth),
    [budgets, selectedMonth],
  );

  // Spending per category (including subcategories)
  const categoryData = useMemo(() => {
    return parentExpenseCategories.map((cat) => {
      const budget = monthBudgets.find((b) => b.categoryId === cat.id);
      const spent = getCategorySpending(cat.id, transactions, categories, selectedMonth);
      const budgetAmount = budget?.amount ?? 0;
      const remaining = budgetAmount - spent;
      const pct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
      return { category: cat, budget, spent, budgetAmount, remaining, pct };
    });
  }, [parentExpenseCategories, monthBudgets, transactions, categories, selectedMonth]);

  // Previous month spending per category
  const prevMonth = getPreviousMonth(selectedMonth);
  const prevMonthSpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    parentExpenseCategories.forEach((cat) => {
      map[cat.id] = getCategorySpending(cat.id, transactions, categories, prevMonth);
    });
    return map;
  }, [parentExpenseCategories, transactions, categories, prevMonth]);

  // Overview stats
  const totalBudget = monthBudgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = categoryData.reduce((s, d) => s + d.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Insights
  const overBudget = categoryData.filter((d) => d.budget && d.spent > d.budgetAmount);
  const onTrack = categoryData.filter((d) => d.budget && d.spent <= d.budgetAmount);
  const unbudgeted = categoryData.filter((d) => !d.budget && d.spent > 0);

  // Handlers
  const handlePrev = () => setSelectedMonth(getPreviousMonth(selectedMonth));
  const handleNext = () => setSelectedMonth(getNextMonth(selectedMonth));
  const handleToday = () => setSelectedMonth(getCurrentMonth());

  const openAddModal = () => {
    setEditingBudget(null);
    setModalOpen(true);
  };

  const openEditModal = (budget: Budget) => {
    setEditingBudget(budget);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    await actions.deleteBudget(id);
  };

  const hasBudgets = monthBudgets.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Budgets</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Plan and track your monthly spending
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAddModal}>
          Set Budget
        </Button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handlePrev}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-[180px] text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
          {formatMonth(selectedMonth)}
        </span>
        <button
          onClick={handleNext}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <ChevronRight size={20} />
        </button>
        {selectedMonth !== getCurrentMonth() && (
          <button
            onClick={handleToday}
            className="ml-2 flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <CalendarDays size={14} /> Today
          </button>
        )}
      </div>

      {/* Overview Cards */}
      {hasBudgets && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Budget</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalBudget, settings)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Spent</p>
            <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(totalSpent, settings)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Remaining</p>
            <p className={classNames(
              'mt-1 text-2xl font-bold',
              totalRemaining >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-danger-600 dark:text-danger-400',
            )}>
              {formatCurrency(Math.abs(totalRemaining), settings)}
              {totalRemaining < 0 && ' over'}
            </p>
          </div>
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
            <CircularProgress pct={overallPct} />
          </div>
        </div>
      )}

      {/* Category Budget List */}
      {!hasBudgets && categoryData.every((d) => d.spent === 0) ? (
        <EmptyState
          icon={<Target size={32} />}
          title="No budgets set"
          description="Start by setting a monthly budget for your expense categories to track your spending."
          action={
            <Button icon={<Plus size={18} />} onClick={openAddModal}>
              Create Your First Budget
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Category Budgets
          </h2>
          <div className="space-y-2">
            {categoryData
              .filter((d) => d.budget || d.spent > 0)
              .sort((a, b) => b.spent - a.spent)
              .map(({ category, budget, spent, budgetAmount, remaining, pct }) => (
                <div
                  key={category.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Category info */}
                    <div className="flex items-center gap-3">
                      <CategoryIcon icon={category.icon} color={category.color} size={18} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {category.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {budget
                            ? `${formatCurrency(spent, settings)} of ${formatCurrency(budgetAmount, settings)}`
                            : `${formatCurrency(spent, settings)} spent · No budget`}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {budget ? (
                        <>
                          <span className={classNames(
                            'text-sm font-semibold',
                            remaining >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-danger-600 dark:text-danger-400',
                          )}>
                            {remaining >= 0
                              ? `${formatCurrency(remaining, settings)} left`
                              : `${formatCurrency(Math.abs(remaining), settings)} over`}
                          </span>
                          <button
                            onClick={() => openEditModal(budget)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(budget.id)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Plus size={14} />}
                          onClick={() => {
                            setEditingBudget({ id: '', categoryId: category.id, amount: 0, month: selectedMonth, createdAt: '' });
                            setModalOpen(true);
                          }}
                        >
                          Set Budget
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {budget && (
                    <div className="mt-3">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={classNames(
                            'h-full rounded-full transition-all duration-500',
                            getProgressColor(pct),
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className={classNames(
                        'mt-1 text-right text-xs font-medium',
                        getProgressTextColor(pct),
                      )}>
                        {Math.round(pct)}% used
                      </p>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Budget Insights */}
      {(overBudget.length > 0 || onTrack.length > 0 || unbudgeted.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Budget Insights
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Over Budget */}
            <InsightCard
              title="Over Budget"
              icon={<AlertTriangle size={18} />}
              color="danger"
              items={overBudget}
              settings={settings}
              prevMonthSpending={prevMonthSpendingMap}
            />
            {/* On Track */}
            <InsightCard
              title="On Track"
              icon={<CheckCircle2 size={18} />}
              color="emerald"
              items={onTrack}
              settings={settings}
              prevMonthSpending={prevMonthSpendingMap}
            />
            {/* Unbudgeted */}
            <InsightCard
              title="Unbudgeted"
              icon={<HelpCircle size={18} />}
              color="amber"
              items={unbudgeted}
              settings={settings}
              prevMonthSpending={prevMonthSpendingMap}
            />
          </div>
        </div>
      )}

      {/* Budget Modal */}
      <BudgetModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingBudget(null); }}
        editingBudget={editingBudget}
        parentExpenseCategories={parentExpenseCategories}
        selectedMonth={selectedMonth}
        existingBudgets={monthBudgets}
        onSave={actions.setBudget}
        settings={settings}
      />
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────

interface InsightCardProps {
  title: string;
  icon: React.ReactNode;
  color: 'danger' | 'emerald' | 'amber';
  items: Array<{
    category: Category;
    spent: number;
    budgetAmount: number;
    budget: Budget | undefined;
  }>;
  settings: { currency: string; currencySymbol: string; dateFormat: string; theme: string; defaultView: string };
  prevMonthSpending: Record<string, number>;
}

const colorMap = {
  danger: {
    bg: 'bg-danger-50 dark:bg-danger-900/20',
    border: 'border-danger-200 dark:border-danger-800',
    title: 'text-danger-700 dark:text-danger-400',
    icon: 'text-danger-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    title: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    title: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-500',
  },
};

function InsightCard({ title, icon, color, items, settings, prevMonthSpending }: InsightCardProps) {
  const c = colorMap[color];
  if (items.length === 0) {
    return (
      <div className={classNames('rounded-xl border p-4', c.bg, c.border)}>
        <div className="flex items-center gap-2 mb-3">
          <span className={c.icon}>{icon}</span>
          <h3 className={classNames('text-sm font-semibold', c.title)}>{title}</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">No categories here</p>
      </div>
    );
  }

  return (
    <div className={classNames('rounded-xl border p-4', c.bg, c.border)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={c.icon}>{icon}</span>
        <h3 className={classNames('text-sm font-semibold', c.title)}>
          {title} ({items.length})
        </h3>
      </div>
      <ul className="space-y-2">
        {items.map(({ category, spent }) => {
          const prev = prevMonthSpending[category.id] || 0;
          const diff = prev > 0 ? ((spent - prev) / prev) * 100 : 0;
          return (
            <li key={category.id} className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {category.name}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 dark:text-gray-300">
                  {formatCurrency(spent, settings)}
                </span>
                {prev > 0 && (
                  <span className={classNames(
                    'flex items-center text-xs',
                    diff > 0 ? 'text-danger-500' : 'text-emerald-500',
                  )}>
                    {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(Math.round(diff))}%
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Budget Modal ─────────────────────────────────────

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBudget: Budget | null;
  parentExpenseCategories: Category[];
  selectedMonth: string;
  existingBudgets: Budget[];
  onSave: (budget: Budget) => Promise<void>;
  settings: { currency: string; currencySymbol: string; dateFormat: string; theme: string; defaultView: string };
}

function BudgetModal({
  isOpen, onClose, editingBudget, parentExpenseCategories,
  selectedMonth, existingBudgets, onSave, settings,
}: BudgetModalProps) {
  const isEdit = editingBudget !== null && editingBudget.id !== '';

  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [applyFuture, setApplyFuture] = useState(false);
  const [futureMonths, setFutureMonths] = useState('3');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  const resetForm = useCallback(() => {
    if (editingBudget) {
      setCategoryId(editingBudget.categoryId);
      setAmount(editingBudget.amount > 0 ? editingBudget.amount.toString() : '');
    } else {
      setCategoryId('');
      setAmount('');
    }
    setApplyFuture(false);
    setFutureMonths('3');
    setSaving(false);
  }, [editingBudget]);

  // Trigger reset when modal opens or editingBudget changes
  useState(() => { resetForm(); });

  // Available categories (not already budgeted, unless editing)
  const availableCategories = parentExpenseCategories.filter(
    (c) =>
      !existingBudgets.some(
        (b) => b.categoryId === c.id && (!isEdit || b.id !== editingBudget?.id),
      ),
  );

  // If editing but category is pre-selected (from "Set Budget" click)
  const allCategoryOptions = isEdit
    ? parentExpenseCategories
    : availableCategories;

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!categoryId || isNaN(parsedAmount) || parsedAmount <= 0) return;
    setSaving(true);

    try {
      const baseBudget: Budget = {
        id: isEdit && editingBudget?.id ? editingBudget.id : uuidv4(),
        categoryId,
        amount: parsedAmount,
        month: selectedMonth,
        createdAt: isEdit && editingBudget?.createdAt ? editingBudget.createdAt : new Date().toISOString(),
      };
      await onSave(baseBudget);

      // Apply to future months
      if (applyFuture) {
        let m = selectedMonth;
        const count = parseInt(futureMonths);
        for (let i = 0; i < count; i++) {
          m = getNextMonth(m);
          await onSave({
            id: uuidv4(),
            categoryId,
            amount: parsedAmount,
            month: m,
            createdAt: new Date().toISOString(),
          });
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Reset form state each time the modal opens
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Budget' : 'Set Budget'}
    >
      <div className="space-y-4" onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}>
        <Select
          label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: '', label: 'Select a category' },
            ...allCategoryOptions.map((c) => ({ value: c.id, label: c.name })),
          ]}
          disabled={isEdit}
        />

        <Input
          label={`Amount (${settings.currencySymbol})`}
          type="number"
          min="0"
          step="100"
          placeholder="e.g. 5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />

        {!isEdit && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={applyFuture}
                onChange={(e) => setApplyFuture(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700"
              />
              Apply to future months
            </label>
            {applyFuture && (
              <Select
                label="Number of months ahead"
                value={futureMonths}
                onChange={(e) => setFutureMonths(e.target.value)}
                options={[
                  { value: '3', label: '3 months' },
                  { value: '6', label: '6 months' },
                  { value: '12', label: '12 months' },
                ]}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!categoryId || !amount || parseFloat(amount) <= 0 || saving}
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
