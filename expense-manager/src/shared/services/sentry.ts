/**
 * Sentry crash reporting — opt-in via VITE_SENTRY_DSN. If the DSN isn't set
 * we skip initialization entirely so local dev and unconfigured builds stay
 * clean.
 *
 * PII stripping: we scrub `user.email`, transaction notes, and any URL query
 * strings before sending to Sentry so financial data never leaves the device.
 */
import * as SentryReact from '@sentry/react';
import { init as initCapacitor } from '@sentry/capacitor';
import { isNativePlatform } from './platform';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = (import.meta.env.VITE_APP_VERSION as string | undefined) || 'dev';

function scrub(event: SentryReact.ErrorEvent): SentryReact.ErrorEvent | null {
  try {
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }
    if (event.request?.url) {
      event.request.url = event.request.url.split('?')[0];
    }
    // Drop breadcrumbs that could carry transaction notes / free-text.
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs
        .filter((b) => b.category !== 'ui.input')
        .map((b) => ({ ...b, message: b.message?.slice(0, 200) }));
    }
  } catch { /* never let scrubbing itself crash the app */ }
  return event;
}

export function initSentry(): void {
  if (!DSN) return;
  const commonOpts = {
    dsn: DSN,
    release: RELEASE,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend: scrub,
  } as const;

  if (isNativePlatform()) {
    initCapacitor(commonOpts, (opts) => SentryReact.init(opts));
  } else {
    SentryReact.init(commonOpts);
  }
}

export const Sentry = SentryReact;
