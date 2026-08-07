/**
 * Mobile "More" bottom sheet — replaces the left drawer on mobile.
 * Slide-up sheet with a 3-column grid of secondary destinations.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, Bell, Sparkles, Target,
  PiggyBank, FileBarChart, Users, Landmark, Tag,
  Settings, X, PlusCircle, Wallet, Scale, ScanLine,
} from 'lucide-react';
import { classNames } from '../utils/helpers';
import { haptic } from '../services/haptics';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const items: ReadonlyArray<{ path: string; icon: typeof PlusCircle; label: string }> = [
  { path: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { path: '/reminders', icon: Bell, label: 'Reminders' },
  { path: '/insights', icon: Sparkles, label: 'Insights' },
  { path: '/budgets', icon: Target, label: 'Budgets' },
  { path: '/savings', icon: PiggyBank, label: 'Savings' },
  { path: '/salary', icon: Wallet, label: 'Salary' },
  { path: '/tax', icon: Scale, label: 'Tax' },
  { path: '/detected', icon: ScanLine, label: 'Detected' },
  { path: '/reports', icon: FileBarChart, label: 'Reports' },
  { path: '/splitwise', icon: Users, label: 'Splitwise' },
  { path: '/accounts', icon: Landmark, label: 'Accounts' },
  { path: '/categories', icon: Tag, label: 'Categories' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const go = (path: string) => {
    haptic.selection();
    onClose();
    navigate(path);
  };

  return (
    <div
      className={classNames(
        'fixed inset-0 z-50 lg:hidden transition-opacity duration-200',
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        role="dialog"
        aria-label="More options"
        className={classNames(
          'absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl',
          'pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto',
          'transform transition-transform duration-300 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>
        <div className="flex items-center justify-between px-5 py-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">More</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 px-4 pt-2 pb-6">
          {items.map(({ path, icon: Icon, label }) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              className="flex flex-col items-center justify-start gap-2 rounded-xl p-3 text-center transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
                <Icon size={20} />
              </span>
              <span className="text-[11px] font-medium leading-tight text-gray-700 dark:text-gray-300">
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
