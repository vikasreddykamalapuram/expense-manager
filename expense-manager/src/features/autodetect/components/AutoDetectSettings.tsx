import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, MessageSquare, Bell, Mail, ArrowRight, ShieldCheck, RefreshCw, FlaskConical, AlertTriangle } from 'lucide-react';
import { prefs } from '../../../shared/services/preferences';
import { isNativePlatform } from '../../../shared/services/platform';
import { parseSharedText } from '../../../shared/services/shareParser';
import { AUTODETECT_ENABLED_KEY, enqueueDetected } from '../detection';
import { NotificationBridge, NOTIF_SOURCE_KEY, type NotificationBridgeStatus } from '../notificationBridge';
import { isPluginMissing, describeNativeError } from '../nativeErrors';
import { GmailScanButton } from './GmailScanButton';

/** Representative bank alert used by the self-test to prove the parser works. */
const SELF_TEST_SMS =
  'HDFC Bank: Rs.1,250.00 debited from a/c XX4521 on 12-05-26 to SWIGGY. UPI Ref 123456789.';

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function AutoDetectSettings() {
  const navigate = useNavigate();
  const native = isNativePlatform();
  const [enabled, setEnabled] = useState(false);
  const [notifOn, setNotifOn] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const [status, setStatus] = useState<NotificationBridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [selfTest, setSelfTest] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);

  const refreshStatus = async () => {
    if (!native) return;
    setBusy(true);
    try {
      const s = await NotificationBridge.getStatus();
      setStatus(s);
      setNotifGranted(s.granted);
      setNativeError(null);
    } catch (e) {
      // Older installed build without getStatus — fall back to the grant check
      // so the row still reports something truthful instead of staying blank.
      setStatus(null);
      try {
        const r = await NotificationBridge.isEnabled();
        setNotifGranted(r.enabled);
        setNativeError(null);
      } catch (inner) {
        setNotifGranted(false);
        // Both calls failing means the native side is absent entirely — say so
        // rather than leaving the controls looking mysteriously dead.
        setNativeError(describeNativeError(isPluginMissing(e) ? e : inner));
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    prefs.getBool(AUTODETECT_ENABLED_KEY, false).then(setEnabled);
    prefs.getBool(NOTIF_SOURCE_KEY, false).then(setNotifOn);
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  const toggle = async (v: boolean) => {
    setEnabled(v);
    await prefs.setBool(AUTODETECT_ENABLED_KEY, v);
  };

  const toggleNotif = async (v: boolean) => {
    setNotifOn(v);
    await prefs.setBool(NOTIF_SOURCE_KEY, v);
    // If turning on without system access granted, take the user to the grant screen.
    if (v && native && !notifGranted) {
      try {
        await NotificationBridge.openSettings();
        setNativeError(null);
      } catch (e) {
        setNativeError(describeNativeError(e));
      }
    }
  };

  const openSystemSettings = async () => {
    try {
      await NotificationBridge.openSettings();
      setNativeError(null);
    } catch (e) {
      setNativeError(describeNativeError(e));
    }
  };

  const recheckGrant = async () => {
    await refreshStatus();
  };

  /**
   * Runs a known-good bank alert through the real parser and review queue, so a
   * failure can be attributed to either the parser or the OS notification feed
   * rather than being an unexplained "nothing happens".
   */
  const runSelfTest = () => {
    const parsed = parseSharedText(SELF_TEST_SMS);
    if (!parsed.amount) {
      setSelfTest('Parser failed to read the sample amount — please report this.');
      return;
    }
    const added = enqueueDetected('notification', parsed, SELF_TEST_SMS);
    setSelfTest(
      added
        ? `Parsed ₹${parsed.amount}${parsed.merchant ? ` at ${parsed.merchant}` : ''} — added to the review queue.`
        : 'Parsed correctly, but this sample is already in the review queue.',
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ScanLine size={18} className="text-primary-600" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Auto-detect transactions</h3>
        </div>
        <Toggle checked={enabled} onChange={toggle} />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/10 p-3 text-xs text-gray-600 dark:text-gray-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" />
        <span>
          <strong>Privacy first.</strong> Detection runs entirely on your device. Detected transactions go to a
          review queue and are <strong>never saved until you confirm</strong> them. Nothing is uploaded.
        </span>
      </div>

      {native && nativeError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 p-3 text-xs text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{nativeError}</span>
        </div>
      )}

      <div className="space-y-2">
        {/* Shared messages — always available via the system share sheet */}
        <SourceRow icon={<MessageSquare size={16} />} title="Shared messages" desc="Share a bank SMS or payment message into MoneyIQ from any app." badge="active" />

        {/* Bank notifications — native only, requires notification access */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              <Bell size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Bank notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Read transaction alerts on-device. Requires one-time notification access.
              </p>
              {native && notifOn && !notifGranted && (
                <button type="button" onClick={recheckGrant} className="mt-1 text-xs font-medium text-primary-600 hover:underline">
                  Grant access, then tap to re-check
                </button>
              )}
            </div>
              {native ? (
                <div className="flex flex-col items-end gap-1">
                  <Toggle checked={notifOn} onChange={toggleNotif} disabled={!enabled} />
                  {notifOn && (
                    <span className={`text-[10px] font-medium ${notifGranted ? 'text-success-600' : 'text-amber-600'}`}>
                      {notifGranted ? 'Access granted' : 'Access needed'}
                    </span>
                  )}
                </div>
              ) : (
                <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">Android only</span>
              )}
            </div>

            {native && notifOn && (
              <div className="mt-3 space-y-2 rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Diagnostics</p>
                  <button
                    type="button"
                    onClick={recheckGrant}
                    disabled={busy}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={busy ? 'animate-spin' : undefined} /> Refresh
                  </button>
                </div>

                {status ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <Diag label="Access granted" value={status.granted ? 'Yes' : 'No'} bad={!status.granted} />
                    <Diag label="Listener running" value={status.connected ? 'Yes' : 'No'} bad={!status.connected} />
                    <Diag label="Captured (all time)" value={String(status.capturedTotal)} bad={status.capturedTotal === 0} />
                    <Diag label="Waiting to import" value={String(status.buffered)} />
                    <Diag
                      label="Last capture"
                      value={status.lastCapturedAt ? new Date(status.lastCapturedAt).toLocaleString() : 'Never'}
                      bad={!status.lastCapturedAt}
                    />
                  </dl>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Diagnostics unavailable — update to the latest app build to see capture stats.
                  </p>
                )}

                {status && status.granted && !status.connected && (
                  <p className="text-xs text-amber-600">
                    Access is granted but Android has not started the listener. Turn notification access off and
                    on again in system settings, then reopen MoneyIQ.
                  </p>
                )}
                {status && status.connected && status.capturedTotal === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Listening, but no bank alert has arrived yet. Only notifications containing an amount and a
                    transaction word (debited, credited, spent…) are captured.
                  </p>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={runSelfTest}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                  >
                    <FlaskConical size={12} /> Run self-test
                  </button>
                  <button
                    type="button"
                    onClick={() => { void openSystemSettings(); }}
                    className="text-xs font-medium text-primary-600 hover:underline"
                  >
                    Open system settings
                  </button>
                </div>
                {selfTest && <p className="text-xs text-gray-600 dark:text-gray-300">{selfTest}</p>}
              </div>
            )}
        </div>

        {/* Gmail — read-only scan (incremental scope, on demand) */}
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 p-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              <Mail size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Gmail (read-only)</p>
                <span className="rounded-full bg-success-100 px-1.5 py-0.5 text-[10px] font-medium text-success-700">Active</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Scan recent bank/payment emails on demand. We only read message previews — nothing is stored or shared.
              </p>
              <div className="mt-2">
                <GmailScanButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/detected')}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
      >
        Open review queue <ArrowRight size={14} />
      </button>
    </div>
  );
}

function Diag({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
      <dd className={`truncate font-medium ${bad ? 'text-amber-600' : 'text-gray-700 dark:text-gray-200'}`}>{value}</dd>
    </div>
  );
}

function SourceRow({ icon, title, desc, badge }: { icon: React.ReactNode; title: string; desc: string; badge: 'active' | 'soon' }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 dark:border-gray-700 p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{title}</p>
          {badge === 'active' ? (
            <span className="rounded-full bg-success-100 px-1.5 py-0.5 text-[10px] font-medium text-success-700">Active</span>
          ) : (
            <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">Coming soon</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </div>
  );
}
