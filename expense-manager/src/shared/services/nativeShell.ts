/**
 * One-time native-shell bootstrap. Runs from main.tsx before React mounts.
 *
 * Responsibilities:
 *  - Configure the StatusBar color/style to match our theme.
 *  - Hide the splash screen once the app has had a moment to render.
 *  - Wire the Android hardware back button to browser-style history nav,
 *    exiting the app only when there's nothing left to pop.
 *  - Enable the privacy screen so the app content is blurred in the OS
 *    recent-apps switcher (respects the user's Settings toggle).
 *
 * All calls are guarded behind isNativePlatform() so this file is safe to
 * import in the plain-web PWA build (the Capacitor plugins have web
 * fallbacks anyway, but we skip them to keep browser behavior unchanged).
 */
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { isNativePlatform, isAndroid } from './platform';
import { prefs } from './preferences';
import { notificationService } from './notificationService';

let bootstrapped = false;

export async function bootstrapNativeShell(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  if (!isNativePlatform()) return;

  // Status bar: follow the current theme (dark class on <html>).
  try {
    const isDark = document.documentElement.classList.contains('dark');
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (isAndroid()) {
      await StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0a' : '#ffffff' });
    }
  } catch { /* ignore */ }

  // Hide the splash screen shortly after the app boots.
  try {
    // Give React one frame to paint the shell so we don't flash white.
    requestAnimationFrame(() => {
      SplashScreen.hide().catch(() => { /* ignore */ });
    });
  } catch { /* ignore */ }

  // Android back button: pop history when possible, minimize otherwise.
  try {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.minimizeApp().catch(() => { /* ignore */ });
      }
    });
  } catch { /* ignore */ }

  // Privacy screen: obscure app content in the OS recent-apps switcher and
  // block screenshots of sensitive financial data. Default on; user can
  // toggle off in Settings. Uses FLAG_SECURE on Android.
  try {
    const enabled = await prefs.getBool('privacy.screenshotBlur', true);
    if (enabled) await PrivacyScreen.enable();
  } catch { /* ignore */ }

  // Local notifications: register the daily-nudge quick-action + deep-link handler.
  try {
    await notificationService.registerHandlers((path) => {
      window.location.hash = ''; // ensure hash router doesn't swallow it
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  } catch { /* ignore */ }
}

/** Toggle the privacy screen at runtime (used by Settings). */
export async function setPrivacyScreenEnabled(enabled: boolean): Promise<void> {
  await prefs.setBool('privacy.screenshotBlur', enabled);
  if (!isNativePlatform()) return;
  try {
    if (enabled) await PrivacyScreen.enable();
    else await PrivacyScreen.disable();
  } catch { /* ignore */ }
}
