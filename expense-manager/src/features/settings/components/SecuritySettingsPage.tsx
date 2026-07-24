/**
 * Security settings page — configures the app lock (biometric + PIN),
 * screenshot blur, and idle timeout. All state is persisted via
 * @capacitor/preferences (native) or localStorage (web).
 */
import { useEffect, useMemo, useState } from 'react';
import { Fingerprint, ShieldCheck, EyeOff, Timer, KeyRound, ChevronRight } from 'lucide-react';
import { appLock, type AppLockStatus } from '../../../shared/services/appLockService';
import { setPrivacyScreenEnabled } from '../../../shared/services/nativeShell';
import { prefs } from '../../../shared/services/preferences';
import { haptic } from '../../../shared/services/haptics';
import { useAppLock } from '../../../context/AppLockContext';
import { isNativePlatform } from '../../../shared/services/platform';
import { classNames } from '../../../shared/utils/helpers';

const IDLE_CHOICES = [
  { label: 'Immediately', ms: 0 },
  { label: '30 seconds', ms: 30_000 },
  { label: '1 minute', ms: 60_000 },
  { label: '5 minutes', ms: 5 * 60_000 },
  { label: '15 minutes', ms: 15 * 60_000 },
];

export function SecuritySettingsPage() {
  const { refresh } = useAppLock();
  const [status, setStatus] = useState<AppLockStatus | null>(null);
  const [privacyBlur, setPrivacyBlur] = useState(true);
  const [showPinModal, setShowPinModal] = useState<'set' | 'change' | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setStatus(await appLock.status());
    setPrivacyBlur(await prefs.getBool('privacy.screenshotBlur', true));
  };

  useEffect(() => { reload(); }, []);

  const biometryName = useMemo(() => {
    switch (status?.biometryType) {
      case 'faceId':
      case 'face': return 'Face unlock';
      case 'touchId':
      case 'fingerprint': return 'Fingerprint';
      case 'iris': return 'Iris';
      default: return 'Biometric';
    }
  }, [status]);

  const toggleLock = async () => {
    if (!status) return;
    haptic.selection();
    if (status.enabled) {
      await appLock.disable();
    } else {
      if (!status.hasPin) {
        setShowPinModal('set');
        return;
      }
      await appLock.enable();
    }
    await refresh();
    await reload();
  };

  const toggleBiometric = async () => {
    if (!status) return;
    haptic.selection();
    await appLock.setBiometricEnabled(!status.biometricEnabled);
    await reload();
  };

  const togglePrivacyBlur = async () => {
    haptic.selection();
    const next = !privacyBlur;
    await setPrivacyScreenEnabled(next);
    setPrivacyBlur(next);
  };

  const setIdle = async (ms: number) => {
    haptic.selection();
    await appLock.setIdleTimeout(ms);
    await reload();
    await refresh();
  };

  const clearPin = async () => {
    if (!confirm('Remove your PIN? The app lock will be disabled.')) return;
    setBusy(true);
    await appLock.clearPin();
    await appLock.disable();
    setBusy(false);
    await reload();
    await refresh();
  };

  if (!status) {
    return <div className="p-6 text-sm text-gray-500">Loading security settings…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <ShieldCheck size={22} className="text-primary-600" />
          Security
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Protect your financial data with a device-only PIN and biometric unlock.
        </p>
      </header>

      {/* App Lock */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">App lock</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {status.hasPin
                ? 'Require a PIN (and biometric where available) to open the app.'
                : 'Set a 6-digit PIN to enable the app lock.'}
            </p>
          </div>
          <Toggle checked={status.enabled} onChange={toggleLock} disabled={busy} />
        </div>

        {status.hasPin && (
          <button
            onClick={() => setShowPinModal('change')}
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <span className="flex items-center gap-2"><KeyRound size={16} /> Change PIN</span>
            <ChevronRight size={16} />
          </button>
        )}
        {!status.hasPin && (
          <button
            onClick={() => setShowPinModal('set')}
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <span className="flex items-center gap-2"><KeyRound size={16} /> Set 6-digit PIN</span>
            <ChevronRight size={16} />
          </button>
        )}
        {status.hasPin && (
          <button
            onClick={clearPin}
            disabled={busy}
            className="mt-2 w-full rounded-xl px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Remove PIN
          </button>
        )}
      </section>

      {/* Biometric */}
      {isNativePlatform() && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Fingerprint size={20} className="mt-0.5 text-primary-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{biometryName}</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {status.biometricAvailable
                    ? `Use ${biometryName.toLowerCase()} to unlock instead of typing your PIN.`
                    : 'No biometric credentials are enrolled on this device.'}
                </p>
              </div>
            </div>
            <Toggle
              checked={status.biometricEnabled && status.biometricAvailable}
              onChange={toggleBiometric}
              disabled={!status.biometricAvailable}
            />
          </div>
        </section>
      )}

      {/* Idle timeout */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-start gap-3">
          <Timer size={20} className="mt-0.5 text-primary-600" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lock after</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Re-lock the app when it stays in the background longer than this.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {IDLE_CHOICES.map(({ label, ms }) => {
                const selected = status.idleTimeoutMs === ms;
                return (
                  <button
                    key={ms}
                    onClick={() => setIdle(ms)}
                    className={classNames(
                      'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                      selected
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy screen */}
      {isNativePlatform() && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <EyeOff size={20} className="mt-0.5 text-primary-600" />
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Hide in recent apps</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Blur the app in the OS multitasking view and block screenshots of sensitive data.
                </p>
              </div>
            </div>
            <Toggle checked={privacyBlur} onChange={togglePrivacyBlur} />
          </div>
        </section>
      )}

      {showPinModal && (
        <PinModal
          mode={showPinModal}
          onClose={() => setShowPinModal(null)}
          onSaved={async () => {
            await appLock.enable();
            setShowPinModal(null);
            await reload();
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Small toggle switch ──────────────────────────────────
function Toggle({
  checked, onChange, disabled,
}: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={classNames(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={classNames(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

// ─── PIN entry / change modal ─────────────────────────────
function PinModal({
  mode, onClose, onSaved,
}: { mode: 'set' | 'change'; onClose: () => void; onSaved: () => Promise<void> }) {
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(mode === 'change' ? 'current' : 'new');
  const [value, setValue] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDigit = (d: string) => {
    if (busy) return;
    if (value.length >= 6) return;
    haptic.selection();
    const next = value + d;
    setValue(next);
    if (next.length === 6) submit(next);
  };
  const back = () => {
    if (busy) return;
    haptic.light();
    setValue((v) => v.slice(0, -1));
  };

  const submit = async (v: string) => {
    setBusy(true);
    setError(null);
    try {
      if (step === 'current') {
        const ok = await appLock.verifyPin(v);
        if (!ok) { haptic.error(); setError('Incorrect current PIN.'); setValue(''); return; }
        setStep('new');
        setValue('');
      } else if (step === 'new') {
        setNewPin(v);
        setStep('confirm');
        setValue('');
      } else {
        if (v !== newPin) { haptic.error(); setError('PINs do not match.'); setValue(''); setStep('new'); return; }
        await appLock.setPin(v);
        haptic.success();
        await onSaved();
      }
    } finally { setBusy(false); }
  };

  const title = step === 'current' ? 'Enter current PIN'
    : step === 'new' ? 'Choose a new 6-digit PIN'
    : 'Confirm your new PIN';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xs rounded-2xl bg-gray-900 p-6 text-gray-100" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center text-sm font-semibold">{title}</h3>
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <span
              key={i}
              className={classNames(
                'h-3 w-3 rounded-full border',
                i < value.length ? 'border-primary-400 bg-primary-400' : 'border-gray-600',
              )}
            />
          ))}
        </div>
        {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button key={d} onClick={() => handleDigit(d)} disabled={busy}
              className="h-12 rounded-xl bg-gray-800 text-lg font-medium hover:bg-gray-700 disabled:opacity-40 active:scale-95 transition-transform">
              {d}
            </button>
          ))}
          <span />
          <button onClick={() => handleDigit('0')} disabled={busy}
            className="h-12 rounded-xl bg-gray-800 text-lg font-medium hover:bg-gray-700 disabled:opacity-40 active:scale-95 transition-transform">
            0
          </button>
          <button onClick={back} disabled={busy}
            className="h-12 rounded-xl bg-gray-800 text-sm hover:bg-gray-700 disabled:opacity-40">
            ←
          </button>
        </div>
        <button onClick={onClose} className="mt-4 w-full text-center text-xs text-gray-400 hover:text-gray-200">
          Cancel
        </button>
      </div>
    </div>
  );
}
