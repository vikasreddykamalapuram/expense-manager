/**
 * LockScreen — full-screen unlock UI shown by AppLockProvider whenever the
 * app is locked. Tries biometric first (if enabled + available), then falls
 * back to a 6-digit PIN pad. After 5 wrong PIN attempts we throttle with an
 * exponential backoff so an attacker can't brute-force at machine speed.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Fingerprint, Lock, Delete } from 'lucide-react';
import { appLock } from '../services/appLockService';
import { haptic } from '../services/haptics';
import { classNames } from '../utils/helpers';

interface Props {
  onUnlock: () => void;
}

const MAX_ATTEMPTS_BEFORE_BACKOFF = 5;

export function LockScreen({ onUnlock }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [biometryType, setBiometryType] = useState<'faceId' | 'touchId' | 'fingerprint' | 'face' | 'iris' | 'none'>('none');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const attemptedBiometricRef = useRef(false);

  // Tick every second while cooling down so the countdown updates.
  useEffect(() => {
    if (lockedUntil === null) return;
    const t = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const remainingSeconds = lockedUntil !== null
    ? Math.max(0, Math.ceil((lockedUntil - nowMs) / 1000))
    : 0;
  const throttled = remainingSeconds > 0;

  // Try biometric once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await appLock.status();
      if (cancelled) return;
      setBiometryType(status.biometryType);
      setBiometricAvailable(status.biometricAvailable && status.biometricEnabled);
      if (
        status.biometricAvailable &&
        status.biometricEnabled &&
        !attemptedBiometricRef.current
      ) {
        attemptedBiometricRef.current = true;
        setBusy(true);
        const ok = await appLock.promptBiometric();
        if (cancelled) return;
        setBusy(false);
        if (ok) { haptic.success(); onUnlock(); }
      }
    })();
    return () => { cancelled = true; };
  }, [onUnlock]);

  const submitPin = async (value: string) => {
    if (throttled || busy) return;
    setBusy(true);
    const ok = await appLock.verifyPin(value);
    setBusy(false);
    if (ok) {
      haptic.success();
      setError(null);
      setAttempts(0);
      onUnlock();
      return;
    }
    haptic.error();
    setPin('');
    const nextAttempts = attempts + 1;
    setAttempts(nextAttempts);
    if (nextAttempts >= MAX_ATTEMPTS_BEFORE_BACKOFF) {
      // 30s * 2^(attempts - MAX) capped at 5 minutes
      const extra = Math.min(300, 30 * Math.pow(2, nextAttempts - MAX_ATTEMPTS_BEFORE_BACKOFF));
      setLockedUntil(Date.now() + extra * 1000);
      setError(`Too many attempts. Try again in ${extra}s.`);
    } else {
      setError('Incorrect PIN.');
    }
  };

  const tapDigit = (d: string) => {
    if (throttled || busy) return;
    if (pin.length >= appLock.PIN_LENGTH) return;
    haptic.selection();
    const next = pin + d;
    setPin(next);
    if (next.length === appLock.PIN_LENGTH) submitPin(next);
  };
  const backspace = () => {
    if (throttled || busy) return;
    if (!pin) return;
    haptic.light();
    setPin((p) => p.slice(0, -1));
  };
  const retryBiometric = async () => {
    if (throttled || busy || !biometricAvailable) return;
    setBusy(true);
    const ok = await appLock.promptBiometric();
    setBusy(false);
    if (ok) { haptic.success(); onUnlock(); }
  };

  const bioIcon = <Fingerprint size={28} />;
  const bioLabel = biometryType === 'faceId' || biometryType === 'face' ? 'Use Face ID' : 'Use Fingerprint';

  const dots = useMemo(() => Array.from({ length: appLock.PIN_LENGTH }), []);
  const keypad: (string | 'bio' | 'del')[] = [
    '1','2','3','4','5','6','7','8','9',
    biometricAvailable ? 'bio' : '', '0', 'del',
  ];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gray-950 text-gray-100 pt-16 pb-10">
      {/* Header */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl bg-primary-600/20 p-4">
          <Lock size={28} className="text-primary-400" />
        </div>
        <h1 className="text-lg font-semibold">ExpenseIQ locked</h1>
        <p className="text-sm text-gray-400">Enter your PIN to continue</p>

        {/* PIN dots */}
        <div className="mt-6 flex gap-3">
          {dots.map((_, i) => (
            <span
              key={i}
              className={classNames(
                'h-3 w-3 rounded-full border transition-colors',
                i < pin.length ? 'border-primary-400 bg-primary-400' : 'border-gray-600 bg-transparent',
              )}
            />
          ))}
        </div>

        {error && (
          <p className="mt-3 text-xs font-medium text-red-400" role="alert">
            {throttled ? `Too many attempts. Try again in ${remainingSeconds}s.` : error}
          </p>
        )}
      </div>

      {/* Keypad */}
      <div className="grid w-full max-w-xs grid-cols-3 gap-3 px-6">
        {keypad.map((k, i) => {
          if (k === '') return <span key={i} />;
          if (k === 'bio') {
            return (
              <button
                key={i}
                onClick={retryBiometric}
                aria-label={bioLabel}
                disabled={throttled || busy}
                className="flex h-16 items-center justify-center rounded-2xl bg-gray-900 text-primary-400 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                {bioIcon}
              </button>
            );
          }
          if (k === 'del') {
            return (
              <button
                key={i}
                onClick={backspace}
                aria-label="Backspace"
                disabled={throttled || busy}
                className="flex h-16 items-center justify-center rounded-2xl bg-gray-900 text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
              >
                <Delete size={22} />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => tapDigit(k)}
              disabled={throttled || busy}
              className="flex h-16 items-center justify-center rounded-2xl bg-gray-900 text-2xl font-medium text-gray-100 hover:bg-gray-800 active:scale-95 disabled:opacity-40 transition-transform"
              aria-label={`Digit ${k}`}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
