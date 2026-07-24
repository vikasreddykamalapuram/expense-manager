/**
 * Notification settings — controls the daily-nudge and bill-reminder
 * schedules registered with @capacitor/local-notifications. Web users see
 * a disabled panel with an explanatory hint (the API only works on native).
 */
import { useEffect, useState } from 'react';
import { Bell, BellOff, Clock, CalendarClock } from 'lucide-react';
import { notificationService } from '../../../shared/services/notificationService';
import { prefs } from '../../../shared/services/preferences';
import { haptic } from '../../../shared/services/haptics';
import { useAppContext } from '../../../context/AppContext';
import { isNativePlatform } from '../../../shared/services/platform';

interface NotifState {
  dailyEnabled: boolean;
  dailyHour: number;
  dailyMinute: number;
  billsEnabled: boolean;
}

const DEFAULT_STATE: NotifState = {
  dailyEnabled: false,
  dailyHour: 20,
  dailyMinute: 0,
  billsEnabled: true,
};

export function NotificationSettingsPage() {
  const { state } = useAppContext();
  const [cfg, setCfg] = useState<NotifState>(DEFAULT_STATE);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'ok' | 'denied' | 'unknown'>('unknown');
  const native = isNativePlatform();

  useEffect(() => {
    (async () => {
      const [dailyEnabled, hour, minute, billsEnabled] = await Promise.all([
        prefs.getBool('notif.dailyEnabled', false),
        prefs.getNumber('notif.dailyHour', 20),
        prefs.getNumber('notif.dailyMinute', 0),
        prefs.getBool('notif.billsEnabled', true),
      ]);
      setCfg({ dailyEnabled, dailyHour: hour, dailyMinute: minute, billsEnabled });
    })();
  }, []);

  const persist = async (next: NotifState) => {
    setCfg(next);
    await Promise.all([
      prefs.setBool('notif.dailyEnabled', next.dailyEnabled),
      prefs.setNumber('notif.dailyHour', next.dailyHour),
      prefs.setNumber('notif.dailyMinute', next.dailyMinute),
      prefs.setBool('notif.billsEnabled', next.billsEnabled),
    ]);
  };

  const applyDaily = async (next: NotifState) => {
    if (!native) return;
    setBusy(true);
    try {
      if (next.dailyEnabled) {
        const ok = await notificationService.scheduleDailyNudge(next.dailyHour, next.dailyMinute);
        setStatus(ok ? 'ok' : 'denied');
      } else {
        await notificationService.cancelDailyNudge();
        setStatus('ok');
      }
    } finally {
      setBusy(false);
    }
  };

  const applyBills = async (next: NotifState) => {
    if (!native) return;
    setBusy(true);
    try {
      if (next.billsEnabled) {
        await notificationService.syncBillReminders(state.billReminders);
        setStatus('ok');
      } else {
        // Cancel all — reuse sync with an empty list would still schedule; instead
        // simply call the platform cancel with hashed ids of current reminders.
        await notificationService.syncBillReminders([]);
        setStatus('ok');
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleDaily = async () => {
    haptic.selection();
    const next = { ...cfg, dailyEnabled: !cfg.dailyEnabled };
    await persist(next);
    await applyDaily(next);
  };

  const toggleBills = async () => {
    haptic.selection();
    const next = { ...cfg, billsEnabled: !cfg.billsEnabled };
    await persist(next);
    await applyBills(next);
  };

  const changeTime = async (hour: number, minute: number) => {
    const next = { ...cfg, dailyHour: hour, dailyMinute: minute };
    await persist(next);
    if (cfg.dailyEnabled) await applyDaily(next);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Bell size={22} /> Notifications
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Nudges and bill reminders delivered by your device.
        </p>
      </header>

      {!native && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Local notifications require the installed mobile app. On the web your
          browser handles notifications separately — this page is a preview.
        </div>
      )}

      {status === 'denied' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Notification permission was denied. Enable it in your device Settings for ExpenseIQ.
        </div>
      )}

      <section className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
        <Row
          icon={cfg.dailyEnabled ? <Bell size={18} /> : <BellOff size={18} />}
          title="Daily add-expense nudge"
          hint="One reminder each day to log what you spent."
          checked={cfg.dailyEnabled}
          onToggle={toggleDaily}
          disabled={busy || !native}
        />
        <div className="flex items-center gap-3 p-4">
          <Clock size={18} className="text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Nudge time</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">When the daily reminder fires.</p>
          </div>
          <input
            type="time"
            value={`${String(cfg.dailyHour).padStart(2, '0')}:${String(cfg.dailyMinute).padStart(2, '0')}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(':').map(Number);
              if (!Number.isNaN(h) && !Number.isNaN(m)) changeTime(h, m);
            }}
            disabled={!cfg.dailyEnabled || !native}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 disabled:opacity-50"
          />
        </div>
        <Row
          icon={<CalendarClock size={18} />}
          title="Bill-reminder notifications"
          hint="Fires at 9am on each bill's due date."
          checked={cfg.billsEnabled}
          onToggle={toggleBills}
          disabled={busy || !native}
        />
      </section>
    </div>
  );
}

interface RowProps {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function Row({ icon, title, hint, checked, onToggle, disabled }: RowProps) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        className={
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ' +
          (checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600')
        }
      >
        <span
          className={
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition ' +
            (checked ? 'translate-x-5' : 'translate-x-0.5')
          }
        />
      </button>
    </div>
  );
}
