import { useState, useMemo } from 'react';
import { Bell, Plus, Trash2, Check, Edit2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../../context/AppContext';
import { BillReminder, BillCategory, BillFrequency } from '../../../shared/types';
import { Modal } from '../../../shared/components/ui/Modal';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { formatCurrency, classNames } from '../../../shared/utils/helpers';
import {
  getUpcomingBills,
  getOverdueBills,
  getDueSoonBills,
  markAsPaid,
  BILL_CATEGORY_ICONS,
  BILL_CATEGORY_LABELS,
  BILL_FREQUENCY_LABELS,
  BillWithDueInfo,
} from '../../../shared/services/billReminderService';

const REMINDER_DAY_OPTIONS = [0, 1, 3, 7];

const defaultFormState = {
  name: '',
  amount: '',
  category: 'utility' as BillCategory,
  dueDate: '1',
  frequency: 'monthly' as BillFrequency,
  accountId: '',
  isAutoPay: false,
  reminderDays: [3, 1] as number[],
  notes: '',
};

export function BillRemindersPage() {
  const { state, actions } = useAppContext();
  const { billReminders, accounts, settings } = state;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const overdueBills = useMemo(() => getOverdueBills(billReminders, today), [billReminders, today]);
  const dueSoonBills = useMemo(() => getDueSoonBills(billReminders, today, 7), [billReminders, today]);
  const upcomingBills = useMemo(() => getUpcomingBills(billReminders, today, 30), [billReminders, today]);
  const autoPayBills = useMemo(
    () => upcomingBills.filter((b) => b.reminder.isAutoPay && !b.isPaid),
    [upcomingBills],
  );
  const upcomingNonDueSoon = useMemo(
    () =>
      upcomingBills.filter(
        (b) =>
          b.daysUntilDue > 7 &&
          !b.isPaid &&
          !b.reminder.isAutoPay,
      ),
    [upcomingBills],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(defaultFormState);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (reminder: BillReminder) => {
    setEditingId(reminder.id);
    setForm({
      name: reminder.name,
      amount: String(reminder.amount),
      category: reminder.category,
      dueDate: String(reminder.dueDate),
      frequency: reminder.frequency,
      accountId: reminder.accountId || '',
      isAutoPay: reminder.isAutoPay,
      reminderDays: [...reminder.reminderDays],
      notes: reminder.notes || '',
    });
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) e.amount = 'Valid amount is required';
    if (!form.dueDate || isNaN(Number(form.dueDate)) || Number(form.dueDate) < 1 || Number(form.dueDate) > 31)
      e.dueDate = 'Day must be 1-31';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const now = new Date().toISOString();
    const reminder: BillReminder = {
      id: editingId || uuidv4(),
      name: form.name.trim(),
      amount: Number(form.amount),
      category: form.category,
      dueDate: Number(form.dueDate),
      frequency: form.frequency,
      accountId: form.accountId || undefined,
      isAutoPay: form.isAutoPay,
      reminderDays: form.reminderDays,
      isActive: true,
      notes: form.notes.trim() || undefined,
      createdAt: editingId
        ? billReminders.find((r) => r.id === editingId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    if (editingId) {
      await actions.updateBillReminder(editingId, reminder);
    } else {
      await actions.addBillReminder(reminder);
    }
    setShowModal(false);
  };

  const handleMarkPaid = async (bill: BillWithDueInfo) => {
    const updated = markAsPaid(bill.reminder);
    await actions.updateBillReminder(updated.id, updated);
  };

  const handleDelete = async (id: string) => {
    await actions.deleteBillReminder(id);
    setDeleteConfirmId(null);
  };

  const toggleReminderDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      reminderDays: prev.reminderDays.includes(day)
        ? prev.reminderDays.filter((d) => d !== day)
        : [...prev.reminderDays, day].sort((a, b) => b - a),
    }));
  };

  const formatDueLabel = (daysUntilDue: number) => {
    if (daysUntilDue < 0) return `${Math.abs(daysUntilDue)}d overdue`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue === 1) return 'Due tomorrow';
    return `Due in ${daysUntilDue}d`;
  };

  const renderBillCard = (bill: BillWithDueInfo) => {
    const { reminder, daysUntilDue, isPaid } = bill;
    const icon = BILL_CATEGORY_ICONS[reminder.category] || '📋';

    let statusColor = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    let borderColor = 'border-gray-200 dark:border-gray-700';
    if (isPaid) {
      statusColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      borderColor = 'border-green-200 dark:border-green-800';
    } else if (daysUntilDue < 0) {
      statusColor = 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      borderColor = 'border-red-300 dark:border-red-800';
    } else if (daysUntilDue <= 3) {
      statusColor = 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      borderColor = 'border-orange-300 dark:border-orange-800';
    } else if (reminder.isAutoPay) {
      statusColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      borderColor = 'border-emerald-200 dark:border-emerald-800';
    }

    return (
      <div
        key={reminder.id}
        className={classNames(
          'flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-750',
          borderColor,
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-gray-700">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{reminder.name}</p>
            {reminder.isAutoPay && (
              <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Auto-Pay
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {BILL_CATEGORY_LABELS[reminder.category]} · {BILL_FREQUENCY_LABELS[reminder.frequency]} · Day {reminder.dueDate}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(reminder.amount, settings)}
          </p>
          <span className={classNames('inline-block rounded-full px-2 py-0.5 text-xs font-medium', statusColor)}>
            {isPaid ? '✓ Paid' : formatDueLabel(daysUntilDue)}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!isPaid && (
            <button
              onClick={() => handleMarkPaid(bill)}
              className="rounded-lg p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
              title="Mark as Paid"
            >
              <Check size={16} />
            </button>
          )}
          <button
            onClick={() => openEdit(reminder)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            title="Edit"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => setDeleteConfirmId(reminder.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, bills: BillWithDueInfo[], colorClass: string) => {
    if (bills.length === 0) return null;
    return (
      <div>
        <h3 className={classNames('mb-3 text-sm font-semibold uppercase tracking-wide', colorClass)}>
          {title} ({bills.length})
        </h3>
        <div className="space-y-2">{bills.map(renderBillCard)}</div>
      </div>
    );
  };

  // Calendar mini-view: current month
  const calendarData = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const billsByDay = new Map<number, BillReminder[]>();

    billReminders.filter((r) => r.isActive).forEach((r) => {
      const day = Math.min(r.dueDate, daysInMonth);
      const existing = billsByDay.get(day) || [];
      existing.push(r);
      billsByDay.set(day, existing);
    });

    return { firstDay, daysInMonth, billsByDay, year, month };
  }, [billReminders, today]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bill Reminders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {dueSoonBills.length > 0 && `${dueSoonBills.length} bill${dueSoonBills.length > 1 ? 's' : ''} due this week`}
            {dueSoonBills.length > 0 && overdueBills.length > 0 && ' · '}
            {overdueBills.length > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">
                {overdueBills.length} overdue
              </span>
            )}
            {dueSoonBills.length === 0 && overdueBills.length === 0 && 'No upcoming bills'}
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openAdd}>
          Add Reminder
        </Button>
      </div>

      {billReminders.length === 0 ? (
        <EmptyState
          icon={<Bell size={40} />}
          title="No Bill Reminders"
          description="Set up reminders for your recurring bills like rent, utilities, EMIs, and subscriptions. Never miss a payment again!"
          action={
            <Button icon={<Plus size={18} />} onClick={openAdd}>
              Add Your First Reminder
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Bill Lists */}
          <div className="space-y-6 lg:col-span-2">
            {renderSection('Overdue', overdueBills, 'text-red-600 dark:text-red-400')}
            {renderSection('Due This Week', dueSoonBills, 'text-orange-600 dark:text-orange-400')}
            {renderSection('Auto-Pay', autoPayBills, 'text-emerald-600 dark:text-emerald-400')}
            {renderSection('Upcoming', upcomingNonDueSoon, 'text-gray-500 dark:text-gray-400')}

            {overdueBills.length === 0 &&
              dueSoonBills.length === 0 &&
              autoPayBills.length === 0 &&
              upcomingNonDueSoon.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500">All bills are paid for this period! 🎉</p>
              )}
          </div>

          {/* Calendar sidebar */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              {new Date(calendarData.year, calendarData.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="py-1 font-medium text-gray-400 dark:text-gray-500">{d}</div>
              ))}
              {Array.from({ length: calendarData.firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                const day = i + 1;
                const bills = calendarData.billsByDay.get(day);
                const isToday = day === today.getDate();
                return (
                  <div
                    key={day}
                    className={classNames(
                      'relative rounded-md py-1',
                      isToday && 'bg-primary-100 font-bold text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
                      !isToday && 'text-gray-700 dark:text-gray-300',
                    )}
                  >
                    {day}
                    {bills && bills.length > 0 && (
                      <div className="absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                        {bills.slice(0, 3).map((_, idx) => (
                          <div
                            key={idx}
                            className={classNames(
                              'h-1 w-1 rounded-full',
                              day < today.getDate() ? 'bg-red-400' : 'bg-primary-500',
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 space-y-1">
              {Array.from(calendarData.billsByDay.entries())
                .sort(([a], [b]) => a - b)
                .map(([day, bills]) => (
                  <div key={day} className="flex items-center gap-2 text-xs">
                    <span className="w-5 text-right font-medium text-gray-500 dark:text-gray-400">{day}</span>
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {bills.map((b) => `${BILL_CATEGORY_ICONS[b.category]} ${b.name}`).join(', ')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Reminder' : 'Add Reminder'} size="md">
        <div className="space-y-4">
          <Input
            label="Bill Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={errors.name}
            helperText={errors.name}
            placeholder="e.g. Electricity Bill"
          />

          <Input
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            error={errors.amount}
            helperText={errors.amount}
            placeholder="0.00"
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as BillCategory }))}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {Object.entries(BILL_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {BILL_CATEGORY_ICONS[value]} {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Due Date (Day of Month)"
              type="number"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              error={errors.dueDate}
              helperText={errors.dueDate}
              min={1}
              max={31}
            />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as BillFrequency }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {Object.entries(BILL_FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Account (optional)</label>
              <select
                value={form.accountId}
                onChange={(e) => setForm((p) => ({ ...p, accountId: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">No account</option>
                {accounts.filter((a) => a.isActive).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={form.isAutoPay}
                onChange={(e) => setForm((p) => ({ ...p, isAutoPay: e.target.checked }))}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-600" />
            </label>
            <span className="text-sm text-gray-700 dark:text-gray-300">Auto-Pay enabled</span>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Remind me (days before)
            </label>
            <div className="flex gap-2">
              {REMINDER_DAY_OPTIONS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleReminderDay(day)}
                  className={classNames(
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    form.reminderDays.includes(day)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600',
                  )}
                >
                  {day === 0 ? 'On day' : `${day}d`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              placeholder="e.g. Account #12345"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editingId ? 'Update' : 'Add Reminder'}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Reminder" size="sm">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this reminder? This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
