import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativePlatform, isAndroid } from './platform';

/**
 * Sync the native status bar to the current app theme. Must be called on every
 * theme change (not just at boot), otherwise toggling Light/Dark at runtime
 * leaves the status bar with stale icon colors — e.g. white icons stuck on a
 * white bar in light mode (invisible).
 *
 * Capacitor Style semantics: Style.Light = dark icons (for light backgrounds),
 * Style.Dark = light icons (for dark backgrounds).
 */
export async function syncStatusBarTheme(isDark: boolean): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0a' : '#ffffff' });
    }
  } catch {
    /* status bar plugin unavailable — ignore */
  }
}
