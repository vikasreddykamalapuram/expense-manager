/**
 * Toast notification system — non-blocking, stackable notifications
 * with slide-in animation, auto-dismiss progress bar, and glassmorphism.
 */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { classNames } from '../../utils/helpers';

// ─── Types ──────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

// ─── Context ────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback: console log if outside provider (e.g., services)
    return { showToast: (_type, message) => console.log('[Toast]', message) };
  }
  return ctx;
}

// Global toast function for non-React code (services)
let globalShowToast: ((type: ToastType, message: string, duration?: number) => void) | null = null;

export function showToastGlobal(type: ToastType, message: string, duration?: number): void {
  if (globalShowToast) globalShowToast(type, message, duration);
}

// ─── Provider ───────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]); // max 5 toasts
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register global reference
  useEffect(() => {
    globalShowToast = showToast;
    return () => { globalShowToast = null; };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none" aria-live="polite">
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} index={index} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Toast Item ─────────────────────────────────────────

function ToastItem({ toast, onDismiss, index }: { toast: Toast; onDismiss: (id: string) => void; index: number }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const exitTimer = setTimeout(() => setIsExiting(true), toast.duration - 200);
      const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => { clearTimeout(exitTimer); clearTimeout(removeTimer); };
    }
  }, [toast, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const icons = {
    success: <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />,
    error: <XCircle size={18} className="text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />,
    info: <Info size={18} className="text-blue-500 flex-shrink-0" />,
  };

  const borderColors = {
    success: 'border-l-green-500',
    error: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-blue-500',
  };

  const progressColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };

  return (
    <div
      className={classNames(
        'pointer-events-auto relative overflow-hidden rounded-xl border border-gray-200/50 dark:border-gray-700/50 border-l-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg px-4 py-3 shadow-lg',
        borderColors[toast.type],
        isExiting ? 'animate-slide-out-right' : 'animate-slide-in-right',
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        {icons[toast.type]}
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{toast.message}</p>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 rounded-md p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
      {/* Auto-dismiss progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100 dark:bg-gray-700">
          <div
            className={classNames('h-full rounded-full', progressColors[toast.type])}
            style={{
              animation: `shrink-width ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
