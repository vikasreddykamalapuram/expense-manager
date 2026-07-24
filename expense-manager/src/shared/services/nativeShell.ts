/**
 * One-time native-shell bootstrap. Runs from main.tsx before React mounts.
 *
 * Responsibilities:
 *  - Configure the StatusBar color/style to match our theme.
 *  - Hide the splash screen once the app has had a moment to render.
 *  - Wire the Android hardware back button to browser-style history nav,
 *    exiting the app only when there's nothing left to pop.
 *
 * All calls are guarded behind isNativePlatform() so this file is safe to
 * import in the plain-web PWA build (the Capacitor plugins have web
 * fallbacks anyway, but we skip them to keep browser behavior unchanged).
 */
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isNativePlatform, isAndroid } from './platform';

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
}
