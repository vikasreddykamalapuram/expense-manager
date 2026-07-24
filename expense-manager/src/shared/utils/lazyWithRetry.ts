import { lazy, type ComponentType } from 'react';

/**
 * When we deploy new code, the browser's cached index.html may still reference
 * old JS chunk hashes that no longer exist on the server. The dynamic import
 * then rejects with "Failed to fetch dynamically imported module" and React
 * shows an error boundary. This helper catches that specific failure once,
 * clears any stale service-worker caches, and does a single hard reload so
 * the user picks up the fresh HTML + chunk map — completely transparent.
 *
 * A sessionStorage flag prevents an infinite reload loop when the failure is
 * caused by something other than stale chunks (e.g., real network outage).
 */
const RELOAD_FLAG = 'expenseiq_chunk_reloaded';

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      // Success: clear the guard so future stale-chunk errors can trigger a reload again.
      try { window.sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
      return mod;
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      const alreadyReloaded = (() => {
        try { return window.sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch { return false; }
      })();

      if (alreadyReloaded) {
        // We already tried; give up so the ErrorBoundary can show the user a manual reload button.
        throw err;
      }

      try { window.sessionStorage.setItem(RELOAD_FLAG, '1'); } catch { /* ignore */ }

      // Bust service-worker caches so the reload gets fresh HTML + chunks.
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
      } catch { /* ignore */ }

      window.location.reload();
      // Return a never-resolving promise so React doesn't render anything before reload kicks in.
      return new Promise<{ default: T }>(() => { /* pending forever */ });
    }
  });
}
