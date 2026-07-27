/**
 * AppLockProvider — the gate that sits between the app shell and the router.
 * Responsibilities:
 *   1. On mount: check if a lock is configured, and if so start in a locked
 *      state so the LockScreen renders before any user data is visible.
 *   2. Subscribe to Capacitor App.appStateChange (or the web
 *      visibilitychange fallback) so we can lock whenever the app has been
 *      backgrounded longer than the user's configured idle timeout.
 *   3. Provide a `useAppLock()` hook so Settings can toggle the lock on/off
 *      and other components can trigger a manual lock.
 *
 * We deliberately keep this OUTSIDE React Router so unlock doesn't unmount
 * the AppProvider/Dexie context on every relock.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { appLock } from '../shared/services/appLockService';
import { isNativePlatform } from '../shared/services/platform';
import { LockScreen } from '../shared/components/LockScreen';

interface AppLockContextValue {
  isLocked: boolean;
  isConfigured: boolean;
  refresh: () => Promise<void>;
  lockNow: () => void;
  /** Skip the next background→foreground lock check (e.g. before opening a native file picker). Automatically clears after use or after 2 minutes. */
  suppressNextBackground: () => void;
}

const AppLockContext = createContext<AppLockContextValue | undefined>(undefined);

export function useAppLock(): AppLockContextValue {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used inside AppLockProvider');
  return ctx;
}

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  // While we're figuring out the initial lock state (async prefs read),
  // we render nothing so we don't flash the app UI to a user who should
  // be seeing the LockScreen.
  const [initializing, setInitializing] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const idleTimeoutMsRef = useRef<number>(appLock.DEFAULT_IDLE_MS);
  const lastBackgroundedAtRef = useRef<number | null>(null);
  const suppressUntilRef = useRef<number>(0);

  const suppressNextBackground = useCallback(() => {
    // Suppress lock for the next 2 minutes — long enough for a file picker or a quick app switch.
    suppressUntilRef.current = Date.now() + 2 * 60_000;
  }, []);

  const refresh = useCallback(async () => {
    const status = await appLock.status();
    const configured = status.enabled && status.hasPin;
    setIsConfigured(configured);
    idleTimeoutMsRef.current = status.idleTimeoutMs;
    if (!configured) setIsLocked(false);
  }, []);

  // Initial load — decide whether to boot into a locked state.
  useEffect(() => {
    (async () => {
      const status = await appLock.status();
      const configured = status.enabled && status.hasPin;
      setIsConfigured(configured);
      idleTimeoutMsRef.current = status.idleTimeoutMs;
      setIsLocked(configured); // start locked whenever the lock is configured
      setInitializing(false);
    })();
  }, []);

  // Lock-on-background: when the app goes inactive, remember when; on
  // resume, lock again if the gap exceeded the idle timeout.
  useEffect(() => {
    if (!isConfigured) return;

    const onBackground = () => {
      lastBackgroundedAtRef.current = Date.now();
    };
    const onForeground = () => {
      const bg = lastBackgroundedAtRef.current;
      if (bg === null) return;
      const elapsed = Date.now() - bg;
      lastBackgroundedAtRef.current = null;
      // If a component signalled that a native-picker-style background is expected, skip this lock check.
      if (Date.now() < suppressUntilRef.current) {
        suppressUntilRef.current = 0;
        return;
      }
      if (elapsed >= idleTimeoutMsRef.current) setIsLocked(true);
    };

    // Native path: Capacitor App events fire reliably on Android/iOS.
    if (isNativePlatform()) {
      const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) onBackground();
        else onForeground();
      });
      return () => { sub.then((s) => s.remove()).catch(() => { /* ignore */ }); };
    }

    // Web fallback: visibilitychange approximates background/foreground.
    const onVis = () => (document.hidden ? onBackground() : onForeground());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [isConfigured]);

  // File pickers and other native chooser dialogs briefly move the WebView to the
  // background on Android. Suppress the next lock check whenever the user opens
  // a file input so their pick doesn't get lost behind the lock screen.
  useEffect(() => {
    if (!isConfigured) return;
    const onPointerDown = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t instanceof HTMLInputElement && t.type === 'file') {
        suppressUntilRef.current = Date.now() + 2 * 60_000;
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [isConfigured]);

  const value: AppLockContextValue = {
    isLocked,
    isConfigured,
    refresh,
    lockNow: () => { if (isConfigured) setIsLocked(true); },
    suppressNextBackground,
  };

  if (initializing) return null;

  return (
    <AppLockContext.Provider value={value}>
      {isLocked ? <LockScreen onUnlock={() => setIsLocked(false)} /> : children}
    </AppLockContext.Provider>
  );
}
