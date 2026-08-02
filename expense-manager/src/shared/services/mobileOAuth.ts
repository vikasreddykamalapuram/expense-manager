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
 *   4. That page immediately `window.location.replace('moneyiq://oauth/callback#…')`,
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
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to complete the sign-in

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

function buildAuthorizeUrl(provider: 'google' | 'microsoft', state: string, nonce: string): string {
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: AUTH_CONFIG.google.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'id_token',
      scope: 'openid profile email',
      nonce,
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  // Microsoft: use v2.0 authorize endpoint with implicit id_token flow.
  const params = new URLSearchParams({
    client_id: AUTH_CONFIG.microsoft.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'id_token',
    response_mode: 'fragment',
    scope: 'openid profile email',
    nonce,
    state,
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

function clearPending() {
  if (pending) {
    clearTimeout(pending.timeoutId);
    sessionStorage.removeItem(STATE_KEY_PREFIX + pending.provider);
    pending = null;
  }
}

/**
 * Start a mobile OAuth sign-in. Opens the provider in a Chrome Custom Tab
 * and resolves with the raw id_token once the deep-link handler receives it.
 * Only one flow may be in flight at a time.
 */
export function signInMobile(provider: 'google' | 'microsoft'): Promise<string> {
  // Cancel any previous in-flight attempt.
  if (pending) {
    pending.reject(new Error('Cancelled: a new sign-in was started.'));
    clearPending();
  }

  const state = randomBytesBase64Url(16);
  const nonce = randomBytesBase64Url(16);

  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      if (pending && pending.state === state) {
        clearPending();
        reject(new Error('Sign-in timed out. Please try again.'));
      }
    }, REQUEST_TIMEOUT_MS);

    pending = { provider, state, nonce, resolve, reject, timeoutId };
    sessionStorage.setItem(
      STATE_KEY_PREFIX + provider,
      JSON.stringify({ state, nonce, ts: Date.now() }),
    );

    const url = buildAuthorizeUrl(provider, state, nonce);
    Browser.open({ url, presentationStyle: 'popover' }).catch((err) => {
      if (pending && pending.state === state) {
        clearPending();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/**
 * Handle an incoming deep-link URL. Returns true if the URL was an OAuth
 * callback (so the caller should stop further routing), false otherwise.
 * Invoked from nativeShell's `appUrlOpen` listener.
 */
export function handleOAuthCallback(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  const isOAuthUrl =
    parsed.protocol === 'moneyiq:' &&
    (parsed.host === 'oauth' || parsed.pathname.startsWith('/oauth'));
  if (!isOAuthUrl) return false;

  // Close the Custom Tab as soon as we know it's ours.
  Browser.close().catch(() => {
    /* ignore */
  });

  if (!pending) return true; // consumed, but nothing to resolve

  // Tokens come back in the URL fragment: #id_token=...&state=...
  const fragment = parsed.hash?.replace(/^#/, '') ?? '';
  const params = new URLSearchParams(fragment);
  const idToken = params.get('id_token');
  const state = params.get('state');
  const err = params.get('error');
  const errDesc = params.get('error_description');

  if (err) {
    pending.reject(new Error(errDesc || err));
    clearPending();
    return true;
  }

  if (!idToken || !state) {
    pending.reject(new Error('Missing id_token or state in OAuth response.'));
    clearPending();
    return true;
  }

  if (state !== pending.state) {
    pending.reject(new Error('State mismatch — possible CSRF, sign-in aborted.'));
    clearPending();
    return true;
  }

  const savedRaw = sessionStorage.getItem(STATE_KEY_PREFIX + pending.provider);
  if (!savedRaw) {
    pending.reject(new Error('Pending state missing from session storage.'));
    clearPending();
    return true;
  }

  pending.resolve(idToken);
  clearPending();
  return true;
}

/**
 * Cancel any in-flight mobile OAuth request. Safe to call when nothing is pending.
 */
export function cancelMobileOAuth(): void {
  if (pending) {
    pending.reject(new Error('Cancelled by user.'));
    clearPending();
  }
  Browser.close().catch(() => {
    /* ignore */
  });
}

/** True when a mobile OAuth request is currently awaiting its callback. */
export function isMobileOAuthPending(): boolean {
  return pending !== null;
}
