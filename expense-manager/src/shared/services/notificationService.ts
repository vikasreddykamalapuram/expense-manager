/**
 * Local notifications service. Thin wrapper over
 * @capacitor/local-notifications that also degrades gracefully on the web
 * (it silently no-ops so the same call sites work in both environments).
 *
 * Two kinds of schedules today:
 *   1. Daily 8pm nudge — "Log today's expenses". Scheduled once, repeats
 *      forever until the user disables it.
 *   2. Bill reminders — one-shot per due date, fired at 9am on the day of.
 *      Re-computed whenever the reminders list changes.
 *
 * We use deterministic numeric IDs so re-syncing is idempotent:
 *   - Daily nudge:   1
 *   - Bill:          hash(reminder.id) & 0x7fffffff  (positive int)
 */
import { LocalNotifications, PermissionStatus, ScheduleOptions } from '@capacitor/local-notifications';
import { isNativePlatform } from './platform';
import type { BillReminder } from '../types';

const DAILY_NUDGE_ID = 1;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

async function ensurePermission(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  const status: PermissionStatus = await LocalNotifications.checkPermissions();
  if (status.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

export const notificationService = {
  isSupported: () => isNativePlatform(),

  async requestPermission(): Promise<boolean> {
    return ensurePermission();
  },

  async scheduleDailyNudge(hour = 20, minute = 0): Promise<boolean> {
    if (!(await ensurePermission())) return false;
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_NUDGE_ID }] });
    const opts: ScheduleOptions = {
      notifications: [
        {
          id: DAILY_NUDGE_ID,
          title: 'Log today\'s expenses',
          body: 'Two seconds now saves you hours later — tap to add.',
          schedule: { on: { hour, minute }, allowWhileIdle: true, repeats: true },
          actionTypeId: 'ADD_EXPENSE',
          extra: { deepLink: '/add' },
        },
      ],
    };
    await LocalNotifications.schedule(opts);
    return true;
  },

  async cancelDailyNudge(): Promise<void> {
    if (!isNativePlatform()) return;
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_NUDGE_ID }] });
  },

  /**
   * Re-schedule every active bill reminder as a one-shot local notification
   * fired at 09:00 on its next due date. Cancels stale schedules first so
   * this is safe to call whenever reminders change.
   */
  async syncBillReminders(reminders: BillReminder[]): Promise<void> {
    if (!(await ensurePermission())) return;
    const active = reminders.filter((r) => r.isActive);
    // Cancel first (idempotent) using the same deterministic IDs.
    const toCancel = active.map((r) => ({ id: hashId(r.id) }));
    if (toCancel.length) await LocalNotifications.cancel({ notifications: toCancel });

    const now = new Date();
    const notifications = active.map((r) => {
      const next = new Date(now.getFullYear(), now.getMonth(), r.dueDate, 9, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setMonth(next.getMonth() + 1);
      }
      return {
        id: hashId(r.id),
        title: `${r.name} is due`,
        body: `Amount ${r.amount}. Tap to review.`,
        schedule: { at: next, allowWhileIdle: true },
        extra: { deepLink: '/reminders' },
      };
    });
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  },

  /**
   * Wire tap-to-deep-link. Call once at app boot.
   */
  async registerHandlers(onDeepLink: (path: string) => void): Promise<void> {
    if (!isNativePlatform()) return;
    // Quick-action button on the daily nudge.
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'ADD_EXPENSE',
            actions: [{ id: 'add', title: 'Add expense' }],
          },
        ],
      });
    } catch {
      // registerActionTypes can throw if called twice; safe to ignore.
    }
    LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const link = (event.notification.extra as { deepLink?: string } | undefined)?.deepLink;
      if (link) onDeepLink(link);
    });
  },
};
