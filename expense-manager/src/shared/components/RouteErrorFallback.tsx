import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Route-level error boundary. Rendered by React Router when a route element
 * throws — most commonly a `Failed to fetch dynamically imported module`
 * error caused by a stale service-worker cache after a deploy.
 *
 * `lazyWithRetry` already tries a silent auto-reload once; if we land here it
 * means the retry also failed, so we surface a manual "Reload app" button that
 * unregisters the SW and clears caches before doing a hard reload.
 */
export function RouteErrorFallback() {
  const error = useRouteError();

  const message = (() => {
    if (isRouteErrorResponse(error)) return `${error.status} — ${error.statusText}`;
    if (error instanceof Error) return error.message;
    return 'Something went wrong.';
  })();

  const isChunkError = /Failed to fetch dynamically imported module|ChunkLoadError|Importing a module script failed/i.test(message);

  const handleHardReload = async () => {
    try {
      window.sessionStorage.removeItem('expenseiq_chunk_reloaded');
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
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2 dark:bg-amber-900/30">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isChunkError ? 'A new version is available' : 'Something went wrong'}
          </h2>
        </div>

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {isChunkError
            ? 'The app was updated in the background and this page needs to reload to pick up the latest version.'
            : 'The page failed to load. You can try reloading the app or head back to the dashboard.'}
        </p>

        {!isChunkError && (
          <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            {message}
          </pre>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={handleHardReload}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            <RefreshCw className="h-4 w-4" />
            Reload app
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
