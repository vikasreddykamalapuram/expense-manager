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
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    setShowUpdate(false);
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm animate-slide-up">
      <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-white p-4 shadow-lg dark:border-primary-800 dark:bg-gray-800">
        <RefreshCw size={20} className="text-primary-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Update available</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">A new version of ExpenseIQ is ready</p>
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
