/**
 * Haptic feedback service — thin wrapper around @capacitor/haptics.
 *
 * On the web, all calls are no-ops (the plugin has a web implementation but
 * it falls back to Vibration API which most desktop browsers ignore anyway).
 * A single `haptic.setEnabled(false)` kill-switch lets the Settings screen
 * disable feedback globally, and we cache the preference in localStorage so
 * the choice survives reloads without needing to hit IndexedDB.
 */
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNativePlatform } from './platform';

const STORAGE_KEY = 'expenseiq_haptics_enabled';

function isEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Default: on when running natively, off in the browser.
    if (raw === null) return isNativePlatform();
    return raw !== 'false';
  } catch {
    return isNativePlatform();
  }
}

function setEnabled(value: boolean) {
  try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
}

async function safe<T>(fn: () => Promise<T>): Promise<void> {
  if (!isEnabled()) return;
  if (!isNativePlatform()) return; // browser: skip to avoid noisy fallbacks
  try { await fn(); } catch { /* haptics are best-effort */ }
}

export const haptic = {
  isEnabled,
  setEnabled,
  /** Subtle bump — use for taps on secondary controls. */
  light: () => safe(() => Haptics.impact({ style: ImpactStyle.Light })),
  /** Medium bump — default for confirmations and FAB taps. */
  medium: () => safe(() => Haptics.impact({ style: ImpactStyle.Medium })),
  /** Strong bump — use sparingly for destructive confirms. */
  heavy: () => safe(() => Haptics.impact({ style: ImpactStyle.Heavy })),
  /** Success pattern — for save/add operations. */
  success: () => safe(() => Haptics.notification({ type: NotificationType.Success })),
  /** Warning pattern — for validation blocks. */
  warning: () => safe(() => Haptics.notification({ type: NotificationType.Warning })),
  /** Error pattern — for failures. */
  error: () => safe(() => Haptics.notification({ type: NotificationType.Error })),
  /** Selection tick — use for picker/slider changes. */
  selection: () => safe(() => Haptics.selectionStart().then(() => Haptics.selectionEnd())),
};
