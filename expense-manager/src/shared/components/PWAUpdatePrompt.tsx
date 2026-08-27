import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    const handleSWUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.registration) {
        setRegistration(detail.registration);
        setShowUpdate(true);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setRegistration(reg);
                setShowUpdate(true);
              }
            });
          }
        });
      });
    }

    window.addEventListener('swUpdated', handleSWUpdate);
    return () => window.removeEventListener('swUpdated', handleSWUpdate);
  }, []);

  const handleUpdate = () => {
    setShowUpdate(false);

    // Reload only once, and only after the new worker is actually in control.
    // Reloading immediately after postMessage races the activation: the page
    // comes back under the old worker while the new one is still swapping the
    // precache underneath it, which leaves stale chunk references behind.
    let reloaded = false;
    const reloadOnce = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });
    }

    // With registerType 'autoUpdate' the new worker skips waiting by itself, so
    // there is usually nothing waiting to message — post only when there is.
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // If the worker already controls the page, controllerchange never fires.
    // Don't leave the user stuck on a dismissed prompt.
    window.setTimeout(reloadOnce, 3000);
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm animate-slide-up">
      <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-white p-4 shadow-lg dark:border-primary-800 dark:bg-gray-800">
        <RefreshCw size={20} className="text-primary-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Update available</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">A new version of MoneyIQ is ready</p>
        </div>
        <button
          onClick={handleUpdate}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  );
}
