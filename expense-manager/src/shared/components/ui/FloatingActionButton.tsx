/**
 * Floating Action Button (FAB) — mobile quick-add for transactions.
 * Shows on mobile screens only (hidden on desktop where sidebar has "Add New").
 * Expands into a speed-dial menu with staggered animations.
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { classNames } from '../../utils/helpers';
import { haptic } from '../../services/haptics';

interface FABAction {
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const fabRef = useRef<HTMLDivElement>(null);

  // Hide FAB on pages where it's not useful
  const hiddenPaths = ['/add', '/login', '/onboarding'];
  const shouldHide = hiddenPaths.some((p) => location.pathname.includes(p));

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [isOpen]);

  // Close on navigation
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  if (shouldHide) return null;

  const actions: FABAction[] = [
    {
      label: 'Expense',
      icon: <TrendingDown size={20} />,
      color: 'bg-red-500 hover:bg-red-600 shadow-red-500/30',
      onClick: () => navigate('/add', { state: { type: 'expense' } }),
    },
    {
      label: 'Income',
      icon: <TrendingUp size={20} />,
      color: 'bg-green-500 hover:bg-green-600 shadow-green-500/30',
      onClick: () => navigate('/add', { state: { type: 'income' } }),
    },
    {
      label: 'Transfer',
      icon: <ArrowLeftRight size={20} />,
      color: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30',
      onClick: () => navigate('/add', { state: { type: 'transfer' } }),
    },
  ];

  return (
    <div
      ref={fabRef}
      className="fixed bottom-24 right-6 z-40 lg:bottom-6 lg:hidden"
      aria-label="Quick add transaction"
    >
      {/* Backdrop blur when open */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] -z-10 animate-fade-in" />
      )}

      {/* Speed-dial actions with staggered animation */}
      <div
        className={classNames(
          'absolute bottom-16 right-0 flex flex-col-reverse gap-3 transition-all duration-300',
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        {actions.map((action, index) => (
          <div
            key={action.label}
            className={classNames(
              'flex items-center gap-2 transition-all duration-300',
              isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
            )}
            style={{ transitionDelay: isOpen ? `${index * 60}ms` : '0ms' }}
          >
            <span className="rounded-lg bg-gray-900/80 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
              {action.label}
            </span>
            <button
              onClick={() => { haptic.light(); action.onClick(); }}
              className={classNames(
                'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95',
                action.color
              )}
              aria-label={`Add ${action.label}`}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB button with ring pulse */}
      <div className="relative">
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-20" />
        )}
        <button
          onClick={() => { haptic.medium(); setIsOpen(!isOpen); }}
          className={classNames(
            'relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 active:scale-90',
            isOpen
              ? 'bg-gray-700 dark:bg-gray-600 shadow-gray-700/30'
              : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 hover:shadow-2xl hover:shadow-primary-500/30'
          )}
          aria-label={isOpen ? 'Close quick actions' : 'Open quick actions'}
          aria-expanded={isOpen}
        >
          <Plus
            size={24}
            className={classNames(
              'text-white transition-transform duration-300',
              isOpen ? 'rotate-45' : 'rotate-0'
            )}
          />
        </button>
      </div>
    </div>
  );
}
