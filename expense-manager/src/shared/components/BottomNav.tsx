/**
 * Bottom navigation bar — mobile only (hidden on lg+).
 * Provides tap targets for the 4 most-used destinations plus a "More"
 * button that opens the existing sidebar drawer so we don't duplicate
 * the full nav list. Includes iOS safe-area padding for the home
 * indicator via env(safe-area-inset-bottom).
 */
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, CalendarDays, TrendingUp, Menu } from 'lucide-react';
import { classNames } from '../utils/helpers';

interface BottomNavProps {
  onOpenMore: () => void;
}

const tabs: ReadonlyArray<{ path: string; icon: typeof LayoutDashboard; label: string; end?: boolean }> = [
  { path: '/', icon: LayoutDashboard, label: 'Home', end: true },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/analytics', icon: CalendarDays, label: 'Analytics' },
  { path: '/portfolio', icon: TrendingUp, label: 'Portfolio' },
];

export function BottomNav({ onOpenMore }: BottomNavProps) {
  return (
    <nav
      role="navigation"
      aria-label="Primary mobile navigation"
      className={classNames(
        'fixed inset-x-0 bottom-0 z-30 lg:hidden',
        'border-t border-gray-200 bg-white/95 backdrop-blur-lg',
        'dark:border-gray-700 dark:bg-gray-800/95',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {tabs.map(({ path, icon: Icon, label, end }) => (
          <li key={path} className="flex-1">
            <NavLink
              to={path}
              end={end}
              className={({ isActive }) =>
                classNames(
                  'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  'min-h-[56px]',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
                )
              }
              aria-label={label}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={classNames(
                      'flex h-6 w-12 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-primary-50 dark:bg-primary-900/40' : '',
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <button
            type="button"
            onClick={onOpenMore}
            className="flex w-full min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            aria-label="Open full menu"
          >
            <span className="flex h-6 w-12 items-center justify-center">
              <Menu size={20} />
            </span>
            <span>More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
