import { BillReminder } from '../types';

/**
 * Calculate the next due date for a bill reminder based on its frequency.
 */
export function getNextDueDate(reminder: BillReminder, referenceDate: Date = new Date()): Date {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = reminder.dueDate;

  // Clamp day to valid range for the month
  const clampDay = (y: number, m: number, d: number) => {
    const maxDay = new Date(y, m + 1, 0).getDate();
    return Math.min(d, maxDay);
  };

  const defaultDate = new Date(year, month, clampDay(year, month, day));
  let dueDate: Date = defaultDate;

  switch (reminder.frequency) {
    case 'monthly': {
      const thisMonthDay = clampDay(year, month, day);
      const thisMonthDue = new Date(year, month, thisMonthDay);
      if (thisMonthDue >= referenceDate) {
        dueDate = thisMonthDue;
      } else {
        const nextMonth = month + 1;
        const nextY = nextMonth > 11 ? year + 1 : year;
        const nextM = nextMonth > 11 ? 0 : nextMonth;
        dueDate = new Date(nextY, nextM, clampDay(nextY, nextM, day));
      }
      break;
    }
    case 'quarterly': {
      let found = false;
      for (let q = 0; q < 5; q++) {
        const m = month + q * 3;
        const targetY = year + Math.floor(m / 12);
        const targetM = m % 12;
        const candidate = new Date(targetY, targetM, clampDay(targetY, targetM, day));
        if (candidate >= referenceDate) {
          dueDate = candidate;
          found = true;
          break;
        }
      }
      if (!found) {
        dueDate = new Date(year, month, clampDay(year, month, day));
      }
      break;
    }
    case 'yearly': {
      const thisYearDay = clampDay(year, month, day);
      const thisYearDue = new Date(year, month, thisYearDay);
      if (thisYearDue >= referenceDate) {
        dueDate = thisYearDue;
      } else {
        dueDate = new Date(year + 1, month, clampDay(year + 1, month, day));
      }
      break;
    }
    case 'one_time': {
      // For one-time bills, use the stored lastPaidDate context or current month
      const thisDay = clampDay(year, month, day);
      dueDate = new Date(year, month, thisDay);
      if (dueDate < referenceDate) {
        const nextMonth = month + 1;
        const nextY = nextMonth > 11 ? year + 1 : year;
        const nextM = nextMonth > 11 ? 0 : nextMonth;
        dueDate = new Date(nextY, nextM, clampDay(nextY, nextM, day));
      }
      break;
    }
    default:
      dueDate = new Date(year, month, clampDay(year, month, day));
  }

  return dueDate;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86400000;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

function isPaidThisPeriod(reminder: BillReminder, dueDate: Date): boolean {
  if (!reminder.lastPaidDate) return false;
  const lastPaid = new Date(reminder.lastPaidDate + 'T00:00:00');
  // Consider paid if lastPaidDate is within 15 days before the due date
  const diffDays = daysBetween(lastPaid, dueDate);
  return diffDays >= -5 && diffDays <= 15;
}

export interface BillWithDueInfo {
  reminder: BillReminder;
  nextDueDate: Date;
  daysUntilDue: number;
  isPaid: boolean;
}

/**
 * Get all active bills due within the next N days.
 */
export function getUpcomingBills(reminders: BillReminder[], today: Date = new Date(), daysAhead: number = 30): BillWithDueInfo[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return reminders
    .filter((r) => r.isActive)
    .map((r) => {
      const nextDue = getNextDueDate(r, startOfToday);
      const daysUntil = daysBetween(startOfToday, nextDue);
      return {
        reminder: r,
        nextDueDate: nextDue,
        daysUntilDue: daysUntil,
        isPaid: isPaidThisPeriod(r, nextDue),
      };
    })
    .filter((b) => b.daysUntilDue <= daysAhead)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Get bills that are overdue (past due date and not paid this period).
 */
export function getOverdueBills(reminders: BillReminder[], today: Date = new Date()): BillWithDueInfo[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return reminders
    .filter((r) => r.isActive)
    .map((r) => {
      const nextDue = getNextDueDate(r, new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1));
      const daysUntil = daysBetween(startOfToday, nextDue);
      return {
        reminder: r,
        nextDueDate: nextDue,
        daysUntilDue: daysUntil,
        isPaid: isPaidThisPeriod(r, nextDue),
      };
    })
    .filter((b) => b.daysUntilDue < 0 && !b.isPaid)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * Get bills due within N days (not overdue).
 */
export function getDueSoonBills(reminders: BillReminder[], today: Date = new Date(), daysAhead: number = 7): BillWithDueInfo[] {
  return getUpcomingBills(reminders, today, daysAhead).filter((b) => b.daysUntilDue >= 0 && !b.isPaid);
}

/**
 * Request notification permission and show browser notifications for due bills.
 */
export async function checkAndNotify(reminders: BillReminder[]): Promise<void> {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }

  if (Notification.permission !== 'granted') return;

  const today = new Date();
  const dueSoon = getDueSoonBills(reminders, today, 3);
  const overdue = getOverdueBills(reminders, today);

  for (const bill of overdue) {
    new Notification(`⚠️ Overdue: ${bill.reminder.name}`, {
      body: `₹${bill.reminder.amount} was due ${Math.abs(bill.daysUntilDue)} day(s) ago`,
      icon: '/icons/icon-192.png',
    });
  }

  for (const bill of dueSoon) {
    const label = bill.daysUntilDue === 0 ? 'Due Today' : `Due in ${bill.daysUntilDue} day(s)`;
    new Notification(`🔔 ${label}: ${bill.reminder.name}`, {
      body: `₹${bill.reminder.amount}`,
      icon: '/icons/icon-192.png',
    });
  }
}

/**
 * Return an updated reminder marked as paid.
 */
export function markAsPaid(reminder: BillReminder, date: Date = new Date()): BillReminder {
  return {
    ...reminder,
    lastPaidDate: toISODate(date),
    updatedAt: new Date().toISOString(),
  };
}

/** Category emoji map */
export const BILL_CATEGORY_ICONS: Record<string, string> = {
  utility: '💡',
  credit_card: '💳',
  rent: '🏠',
  loan_emi: '🏦',
  subscription: '📱',
  insurance: '🛡️',
  other: '📋',
};

export const BILL_CATEGORY_LABELS: Record<string, string> = {
  utility: 'Utility',
  credit_card: 'Credit Card',
  rent: 'Rent',
  loan_emi: 'Loan / EMI',
  subscription: 'Subscription',
  insurance: 'Insurance',
  other: 'Other',
};

export const BILL_FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
  one_time: 'One-time',
};
