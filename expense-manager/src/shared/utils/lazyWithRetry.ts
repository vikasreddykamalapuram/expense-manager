import { lazy, type ComponentType } from 'react';

/**
 * When we deploy new code, the browser's cached index.html may still reference
 * old JS chunk hashes that no longer exist on the server. The dynamic import
 * then rejects with "Failed to fetch dynamically imported module" and React
 * shows an error boundary. This helper catches that specific failure, clears
 * any stale service-worker caches, and reloads so the user picks up the fresh
 * HTML + chunk map — completely transparent.
 *
 * The reload must be *bounded*. A page loads several lazy chunks, so a guard
 * that any successful import can clear is not a guard at all: one working
 * chunk re-arms the reload for a still-broken one and the tab reload-loops
 * until the renderer is killed. Instead we count attempts inside a short
 * window, which both bounds the loop and lets a genuinely new deploy days
 * later recover on its own.
 */
const RELOAD_KEY = 'moneyiq_chunk_reload';
const MAX_RELOADS = 2;
const WINDOW_MS = 60_000;

interface Attempts {
  n: number;
  t: number;
}

function readAttempts(now: number): number {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Partial<Attempts>;
    if (typeof parsed?.n !== 'number' || typeof parsed?.t !== 'number') return 0;
    // Outside the window this is a fresh incident, not a loop.
    return now - parsed.t > WINDOW_MS ? 0 : parsed.n;
  } catch {
    return 0;
  }
}

/**
 * Record a recovery attempt and report whether we may reload.
 * Exported so the loop bound can be tested without driving a real reload.
 */
export function claimReloadAttempt(now: number = Date.now()): boolean {
  const attempts = readAttempts(now);
  if (attempts >= MAX_RELOADS) return false;
  try {
    window.sessionStorage.setItem(RELOAD_KEY, JSON.stringify({ n: attempts + 1, t: now }));
  } catch {
    // Storage unavailable (private mode). Without a counter we cannot prove we
    // are not looping, so refuse rather than risk one.
    return false;
  }
  return true;
}

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
      return await factory();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;

      // Budget exhausted: give up so the ErrorBoundary can offer a manual
      // reload instead of thrashing the renderer.
      if (!claimReloadAttempt()) throw err;

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
