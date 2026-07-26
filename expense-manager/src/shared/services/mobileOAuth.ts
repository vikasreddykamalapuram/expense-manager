/**
 * Mobile OAuth flow for Google / Microsoft on Capacitor (Android/iOS).
 *
 * The web popup flow (`ux_mode="popup"` in Google Identity Services and
 * `msal.loginPopup()`) does not work inside a Capacitor WebView — the
 * WebView blocks `window.open` to a cross-origin URL and MSAL's popup
 * broker can't reach back into the parent frame.
 *
 * On mobile we use the standard OAuth 2.0 implicit / id_token flow:
 *
 *   1. Build an authorize URL with `response_type=id_token` (Google) or
 *      `response_type=id_token` + `response_mode=fragment` (Microsoft).
 *   2. Open that URL in a Chrome Custom Tab via `@capacitor/browser`.
 *   3. Provider redirects to our hosted landing page
 *      (`https://vikasreddykamalapuram.github.io/expense-manager/oauth/callback.html`).
 *   4. That page immediately `window.location.replace('expenseiq://oauth/callback#…')`,
 *      which triggers our AndroidManifest intent-filter and hands control
 *      back to MainActivity.
 *   5. `App.addListener('appUrlOpen')` in `nativeShell.ts` sees the custom
 *      scheme URL and forwards it to `handleOAuthCallback` below, which
 *      validates state/nonce and resolves the pending sign-in promise.
 *
 * Web/PWA callers do not use this file — they keep the existing GIS popup
 * and MSAL popup flows in LoginPage.tsx.
 */
import { Browser } from '@capacitor/browser';
import { AUTH_CONFIG } from '../config/auth';

const REDIRECT_URI = 'https://vikasreddykamalapuram.github.io/expense-manager/oauth/callback.html';
const STATE_KEY_PREFIX = 'em_oauth_pending_';

interface PendingRequest {
  provider: 'google' | 'microsoft';
  state: string;
  nonce: string;
  resolve: (idToken: string) => void;
  reject: (err: Error) => void;
  timeoutId: number;
}

let pending: PendingRequest | null = null;

function randomBytesBase64Url(len: number): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function abortPending(reason: string): void {
  if (!pending) return;
  clearTimeout(pending.timeoutId);
  pending.reject(new Error(reason));
  pending = null;
}

export function isMobileOAuthPending(): boolean {
  return pending !== null;
}

async function openAuthorizeUrl(url: string): Promise<void> {
  await Browser.open({ url, presentationStyle: 'popover' });
}

function buildGoogleUrl(nonce: string, state: string): string {
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.google.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    state,
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildMicrosoftUrl(nonce: string, state: string): string {
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.microsoft.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token',
    response_mode: 'fragment',
    scope: 'openid email profile',
    nonce,
    state,
    prompt: 'select_account',
  });
  return `${AUTH_CONFIG.microsoft.authority}/oauth2/v2.0/authorize?${params.toString()}`;
}

/**
 * Kick off a mobile OAuth flow. Resolves with the raw id_token JWT once the
 * user completes sign-in and Android delivers the callback URL. Rejects if
 * the user cancels, the state doesn't match, or nothing arrives within 5min.
 */
export function signInMobile(provider: 'google' | 'microsoft'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (pending) abortPending('New sign-in started; abandoning previous attempt.');

    const nonce = randomBytesBase64Url(16);
    const state = randomBytesBase64Url(16);
    sessionStorage.setItem(STATE_KEY_PREFIX + provider, state);

    const url = provider === 'google' ? buildGoogleUrl(nonce, state) : buildMicrosoftUrl(nonce, state);

    const timeoutId = window.setTimeout(() => {
      abortPending('Sign-in timed out. Please try again.');
    }, 5 * 60 * 1000);

    pending = { provider, state, nonce, resolve, reject, timeoutId };

    openAuthorizeUrl(url).catch((err) => {
      abortPending(err instanceof Error ? err.message : 'Failed to open sign-in page.');
    });
  });
}

/**
 * Called by the appUrlOpen listener in nativeShell.ts when a URL with our
 * custom scheme arrives (`expenseiq://oauth/callback#id_token=…&state=…`).
 * Returns `true` if we consumed the URL, `false` if it wasn't an OAuth
 * callback (so the caller can fall back to regular deep-link routing).
 */
export function handleOAuthCallback(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const isOAuthPath = parsed.host === 'oauth' || parsed.pathname.startsWith('/oauth');
  if (!isOAuthPath) return false;

  // Providers may return either fragment (#id_token=…) or query (?error=…).
  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const params = new URLSearchParams(fragment || parsed.search.replace(/^\?/, ''));

  const err = params.get('error');
  const idToken = params.get('id_token');
  const state = params.get('state');

  // Close the Custom Tab if it's still up (best-effort; Android sometimes
  // handles this automatically once the intent fires).
  Browser.close().catch(() => { /* ignore */ });

  if (!pending) {
    // Stale callback (app was restarted, or user tried a second time). Silently ignore.
    return true;
  }

  const expectedState = sessionStorage.getItem(STATE_KEY_PREFIX + pending.provider);
  sessionStorage.removeItem(STATE_KEY_PREFIX + pending.provider);

  if (err) {
    abortPending(`Sign-in failed (${err}).`);
    return true;
  }
  if (!idToken) {
    abortPending('Sign-in returned no token.');
    return true;
  }
  if (!state || !expectedState || state !== expectedState) {
    abortPending('Sign-in verification failed (state mismatch).');
    return true;
  }

  clearTimeout(pending.timeoutId);
  const { resolve } = pending;
  pending = null;
  resolve(idToken);
  return true;
}

/**
 * Best-effort cancellation hook — called from LoginPage when the user
 * navigates away from the sign-in screen while a Custom Tab is still open.
 */
export function cancelMobileOAuth(): void {
  Browser.close().catch(() => { /* ignore */ });
  abortPending('Sign-in cancelled.');
}
