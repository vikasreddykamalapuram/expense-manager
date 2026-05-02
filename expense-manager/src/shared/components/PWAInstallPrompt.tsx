import { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone);
}

function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Don't show if dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Already running as installed PWA
    if (isInStandaloneMode()) return;

    // iOS Safari — show manual guide
    if (isIOS()) {
      if (isIOSSafari()) {
        setShowIOSGuide(true);
      }
      // Non-Safari on iOS can't install — don't show anything
      return;
    }

    // Android / Desktop — use beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // iOS Safari install guide
  if (showIOSGuide) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm animate-slide-up">
        <div className="rounded-xl border border-primary-200 bg-white p-4 shadow-lg dark:border-primary-800 dark:bg-gray-800">
          <div className="flex items-start gap-3">
            <Download size={20} className="mt-0.5 text-primary-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Install ExpenseIQ</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">1</span>
                  <span>Tap the <Share size={14} className="inline -mt-0.5 text-primary-500" /> Share button below</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">2</span>
                  <span>Scroll down and tap <PlusSquare size={14} className="inline -mt-0.5 text-primary-500" /> <strong>Add to Home Screen</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-100 text-[10px] font-bold text-primary-700 dark:bg-primary-900 dark:text-primary-300">3</span>
                  <span>Tap <strong>Add</strong> to install</span>
                </div>
              </div>
            </div>
            <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Android / Desktop native install
  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm animate-slide-up">
      <div className="flex items-center gap-3 rounded-xl border border-primary-200 bg-white p-4 shadow-lg dark:border-primary-800 dark:bg-gray-800">
        <Download size={20} className="text-primary-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Install ExpenseIQ</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Add to home screen for the best experience</p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Install
        </button>
        <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
