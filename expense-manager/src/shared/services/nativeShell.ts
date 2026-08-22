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
import { syncStatusBarTheme } from './statusBar';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { SendIntent } from 'send-intent';
import { isNativePlatform } from './platform';
import { prefs } from './preferences';
import { notificationService } from './notificationService';
import { parseSharedText, buildAddDeepLink } from './shareParser';
import { enqueueDetected, getDetectedQueue, AUTODETECT_ENABLED_KEY } from '../../features/autodetect/detection';
import { NotificationBridge, NOTIF_SOURCE_KEY } from '../../features/autodetect/notificationBridge';

let bootstrapped = false;

export async function bootstrapNativeShell(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;

  if (!isNativePlatform()) return;

  // Status bar: follow the current theme. Re-applied on every theme change by useTheme.
  await syncStatusBarTheme(document.documentElement.classList.contains('dark'));

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
      navigateToDeepLink(path);
    });
  } catch { /* ignore */ }

  // Deep-link handler: fires when the app is opened via https://.../expense-manager/*
  // (App Link) or moneyiq://* (custom scheme). Strip the base URL and hand the
  // path to the router.
  try {
    App.addListener('appUrlOpen', (event) => {
      try {
        // OAuth callbacks arrive as moneyiq://oauth/callback#id_token=…&state=…
        // Route them through the mobile OAuth handler instead of the generic
        // router, otherwise React Router tries to navigate to a non-existent
        // /oauth/callback page. Use a dynamic import so @capacitor/browser
        // stays out of the web bundle and only loads when a real OAuth
        // callback URL arrives on native.
        const isOAuthCallback =
          event.url.startsWith('moneyiq://oauth') ||
          event.url.startsWith('moneyiq:/oauth') ||
          event.url.includes('/oauth/callback');
        if (isOAuthCallback) {
          import('./mobileOAuth')
            .then(({ handleOAuthCallback }) => handleOAuthCallback(event.url))
            .catch(() => { /* module load failed — swallow to avoid crashing app */ });
          return;
        }
        const url = new URL(event.url);
        // Strip the /expense-manager base path if present.
        let path = url.pathname.replace(/^\/expense-manager/, '') || '/';
        if (url.hash) path += url.hash;
        else if (url.search) path += url.search;
        navigateToDeepLink(path);
      } catch { /* ignore malformed URLs */ }
    });
  } catch { /* ignore */ }

  // Share-target handler: when the user shares text (bank SMS, receipt email,
  // payment confirmation) into MoneyIQ, parse it and prefill /add.
  try {
    await handlePendingShareIntent();
    await drainDetectedNotifications();
    App.addListener('appStateChange', ({ isActive }) => {
      // Android delivers the intent when the app is (re)launched; check on
      // every resume so re-shares while backgrounded also work.
      if (isActive) {
        handlePendingShareIntent().catch(() => { /* ignore */ });
        drainDetectedNotifications().catch(() => { /* ignore */ });
      }
    });
  } catch { /* ignore */ }
}

/**
 * When both the master auto-detect flag and the notification source are on,
 * drain financial notifications captured on-device, parse them, and add the
 * candidates to the review queue (user confirms before anything is saved).
 */
async function drainDetectedNotifications(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const autoDetect = await prefs.getBool(AUTODETECT_ENABLED_KEY, false);
    const notifSource = await prefs.getBool(NOTIF_SOURCE_KEY, false);
    if (!autoDetect || !notifSource) return;
    const { notifications } = await NotificationBridge.getPending();
    let added = false;
    for (const n of notifications || []) {
      const text = [n.title, n.text].filter(Boolean).join(' — ');
      const parsed = parseSharedText(text);
      if (!parsed.amount) continue;
      // enqueueDetected returns the *existing* candidate when it de-dupes, which
      // is truthy — compare identity so a repeat alert doesn't yank the user to
      // the review queue with nothing new in it.
      const before = getDetectedQueue().length;
      const candidate = enqueueDetected('notification', parsed, text);
      if (candidate && getDetectedQueue().length > before) added = true;
    }
    if (added) navigateToDeepLink('/detected');
  } catch { /* ignore — plugin absent or no access */ }
}

async function handlePendingShareIntent(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const result = await SendIntent.checkSendIntentReceived();
    // SendIntent returns an empty object when nothing is queued; guard for both
    // `title`/`description` (text share) and `url` (link share) shapes.
    const raw = (result as { title?: string; description?: string; url?: string; type?: string });
    const text = raw.description || raw.title || raw.url;
    if (!text) return;
    const parsed = parseSharedText(text);
    // Privacy-first: when auto-detect is enabled, route the parsed candidate into
    // the review queue (user confirms before it's saved) instead of jumping
    // straight to /add. When disabled, keep the direct prefill behaviour.
    const autoDetect = await prefs.getBool(AUTODETECT_ENABLED_KEY, false);
    if (autoDetect && parsed.amount) {
      enqueueDetected('share', parsed, text);
      navigateToDeepLink('/detected');
    } else {
      navigateToDeepLink(buildAddDeepLink(parsed, '/'));
    }
    // Clear the queued intent so we don't re-fire on next resume.
    try { SendIntent.finish(); } catch { /* ignore */ }
  } catch { /* ignore — no pending intent */ }
}

function navigateToDeepLink(path: string): void {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const target = base + (path.startsWith('/') ? path : '/' + path);
  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
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
