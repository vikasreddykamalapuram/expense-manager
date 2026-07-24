import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, CalendarDays,
  Settings, Wallet, Menu, X, Landmark, Tag, ChevronDown,
  Plus, LogIn, LogOut, Target, RefreshCw, FileUp, FileBarChart, Heart, TrendingUp, Bell,
  Cloud, AlertCircle, Users, PanelLeftClose, PanelLeftOpen, Sparkles, PiggyBank, CalendarRange, Scale, ShieldCheck,
} from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { classNames } from '../utils/helpers';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { useTheme } from '../hooks/useTheme';
import { getOverdueBills } from '../services/billReminderService';
import { FloatingAssistant } from '../../features/assistant/components/FloatingAssistant';
import { FloatingActionButton } from './ui/FloatingActionButton';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { BottomNav } from './BottomNav';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from './ui/PullToRefreshIndicator';
import { clearPriceCache } from '../services/stockPriceService';
import { notificationService } from '../services/notificationService';
import { prefs } from '../services/preferences';
import { useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/recurring', icon: RefreshCw, label: 'Recurring' },
  { path: '/reminders', icon: Bell, label: 'Reminders' },
  { path: '/add', icon: PlusCircle, label: 'Add New' },
  { path: '/analytics', icon: CalendarDays, label: 'Analytics' },
  { path: '/insights', icon: Sparkles, label: 'Insights' },
  { path: '/calendar', icon: CalendarRange, label: 'Calendar' },
  { path: '/benchmark', icon: Scale, label: 'Benchmark' },
  { path: '/budgets', icon: Target, label: 'Budgets' },
  { path: '/savings', icon: PiggyBank, label: 'Savings' },
  { path: '/reports', icon: FileBarChart, label: 'Reports' },
  { path: '/health', icon: Heart, label: 'Health Score' },
  { path: '/portfolio', icon: TrendingUp, label: 'Portfolio' },
  { path: '/splitwise', icon: Users, label: 'Splitwise' },
  { path: '/accounts', icon: Landmark, label: 'Accounts' },
  { path: '/categories', icon: Tag, label: 'Categories' },
  { path: '/import', icon: FileUp, label: 'Import' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/settings/security', icon: ShieldCheck, label: 'Security' },
  { path: '/settings/notifications', icon: Bell, label: 'Notifications' },
];

export function Layout() {
  const { state, actions } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const { syncStatus } = useSync();
  useTheme();
  useKeyboardShortcuts();
  const navigate = useNavigate();
  const location = useLocation();
  const { profiles, activeProfileId, billReminders } = state;

  // Pull-to-refresh: reload profile data + bust the stock price cache on the portfolio page.
  const pull = usePullToRefresh({
    onRefresh: async () => {
      if (location.pathname.startsWith('/portfolio')) clearPriceCache();
      await actions.reloadProfileData();
    },
  });

  // Overdue bills badge count
  const overdueBillsCount = useMemo(() => getOverdueBills(billReminders).length, [billReminders]);

  // Keep bill-reminder local notifications in sync with the store. Fires on mount
  // and whenever the reminders list changes; the service handles permissions
  // and no-ops on the web.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await prefs.getBool('notif.billsEnabled', true);
      if (cancelled || !enabled) return;
      notificationService.syncBillReminders(billReminders).catch(() => { /* ignore */ });
    })();
    return () => { cancelled = true; };
  }, [billReminders]);

  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    try { return localStorage.getItem('expenseiq_sidebar_pinned') === 'true'; } catch { return false; }
  });
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const sidebarExpanded = sidebarPinned || sidebarHovered;
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const togglePin = () => {
    const next = !sidebarPinned;
    setSidebarPinned(next);
    try { localStorage.setItem('expenseiq_sidebar_pinned', String(next)); } catch { /* */ }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
        setShowNewProfile(false);
        setNewProfileName('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleSwitchProfile = (profileId: string) => {
    actions.switchProfile(profileId);
    setProfileDropdownOpen(false);
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    const profile = {
      id: uuidv4(),
      name: newProfileName.trim(),
      icon: '📊',
      createdAt: new Date().toISOString(),
    };
    await actions.addProfile(profile);
    await actions.switchProfile(profile.id);
    setNewProfileName('');
    setShowNewProfile(false);
    setProfileDropdownOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — Collapsible on desktop, slide-in on mobile */}
      <aside
        role="navigation"
        aria-label="Main navigation"
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={classNames(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-gray-800 shadow-xl transition-all duration-300 ease-in-out',
          // Mobile: slide in/out
          'lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: width transition
          sidebarExpanded ? 'w-64' : 'lg:w-[68px] w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 dark:border-gray-700 px-4 overflow-hidden">
          <div className="rounded-xl bg-primary-600 p-2 shrink-0">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div className={classNames(
            'transition-opacity duration-200 min-w-0',
            sidebarExpanded ? 'opacity-100' : 'lg:opacity-0 lg:w-0 opacity-100'
          )}>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">ExpenseIQ</h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 whitespace-nowrap">Finance Manager</p>
          </div>
          {/* Mobile close */}
          <button
            className="ml-auto rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 lg:hidden shrink-0"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
          {/* Desktop pin toggle */}
          <button
            className={classNames(
              'ml-auto rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 hidden shrink-0 transition-opacity',
              sidebarExpanded ? 'lg:block' : 'lg:hidden'
            )}
            onClick={togglePin}
            title={sidebarPinned ? 'Collapse sidebar' : 'Pin sidebar open'}
          >
            {sidebarPinned ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ path, icon: Icon, label }) => {
            const badgeCount = path === '/reminders' ? overdueBillsCount : 0;
            return (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              title={!sidebarExpanded ? label : undefined}
              className={({ isActive }) =>
                classNames(
                  'group relative flex items-center rounded-xl text-sm font-medium transition-all',
                  sidebarExpanded ? 'gap-3 px-3 py-2.5' : 'lg:justify-center lg:px-0 lg:py-2.5 gap-3 px-3 py-2.5',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                )
              }
              end={path === '/'}
            >
              <div className="relative shrink-0">
                <Icon size={20} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={classNames(
                'whitespace-nowrap transition-opacity duration-200',
                sidebarExpanded ? 'opacity-100' : 'lg:hidden opacity-100'
              )}>
                {label}
              </span>
              {/* Tooltip for collapsed state */}
              {!sidebarExpanded && (
                <span className="absolute left-full ml-2 hidden lg:group-hover:block z-[60] rounded-lg bg-gray-900 dark:bg-gray-700 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap">
                  {label}
                  {badgeCount > 0 && ` (${badgeCount} overdue)`}
                </span>
              )}
            </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={classNames(
          'border-t border-gray-100 dark:border-gray-700 p-3 transition-opacity duration-200',
          sidebarExpanded ? 'opacity-100' : 'lg:opacity-0 lg:h-0 lg:p-0 lg:overflow-hidden opacity-100'
        )}>
          {isAuthenticated && user ? (
            <div className="rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white">
              <p className="text-xs font-medium opacity-80">Signed in via {user.provider === 'google' ? 'Google' : 'Microsoft'}</p>
              <p className="mt-0.5 text-sm font-bold truncate">{user.name}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 p-4 text-white">
              <p className="text-xs font-medium opacity-80">Track smarter.</p>
              <p className="mt-0.5 text-sm font-bold">Spend wiser.</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 lg:px-8">
          <button
            className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />

          {/* Profile Switcher */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <span>{activeProfile?.icon || '💰'}</span>
              <span className="max-w-[120px] truncate">{activeProfile?.name || 'Personal'}</span>
              <ChevronDown size={14} className={classNames(
                'text-gray-400 dark:text-gray-500 transition-transform',
                profileDropdownOpen ? 'rotate-180' : ''
              )} />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-50">
                <div className="p-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Profiles</p>
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSwitchProfile(p.id)}
                      className={classNames(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                        p.id === activeProfileId
                          ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      <span className="text-base">{p.icon}</span>
                      <span className="flex-1 text-left truncate">{p.name}</span>
                      {p.id === activeProfileId && (
                        <span className="h-2 w-2 rounded-full bg-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 p-2">
                  {showNewProfile ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                        placeholder="Profile name..."
                        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                      <button
                        onClick={handleCreateProfile}
                        disabled={!newProfileName.trim()}
                        className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewProfile(true)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Plus size={16} />
                      New Profile
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sync Status Indicator */}
          {syncStatus.state !== 'disabled' && (
            <button
              onClick={() => navigate('/settings')}
              className={classNames(
                'rounded-lg p-1.5 transition-colors',
                syncStatus.state === 'idle' ? 'text-success-500 hover:bg-success-50 dark:hover:bg-success-900/20' :
                syncStatus.state === 'syncing' ? 'text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20' :
                'text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20'
              )}
              title={
                syncStatus.state === 'idle' ? `Synced${syncStatus.lastSyncAt ? ` · ${new Date(syncStatus.lastSyncAt).toLocaleTimeString()}` : ''}` :
                syncStatus.state === 'syncing' ? 'Syncing...' :
                `Sync error: ${syncStatus.lastError || 'Unknown'}`
              }
            >
              {syncStatus.state === 'idle' && <Cloud size={16} />}
              {syncStatus.state === 'syncing' && <RefreshCw size={16} className="animate-spin" />}
              {syncStatus.state === 'error' && <AlertCircle size={16} />}
            </button>
          )}

          {/* User Avatar / Login */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Go to Settings"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{user.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[120px]">{user.email}</p>
                </div>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-8 w-8 rounded-full border-2 border-primary-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </button>
              <button
                onClick={() => { logout(); }}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </header>

        {/* Page Content — extra bottom padding on mobile so BottomNav doesn't cover content */}
        <main
          id="main-content"
          ref={pull.containerRef as React.RefObject<HTMLElement>}
          className="flex-1 overflow-y-auto p-4 pb-24 lg:p-8 lg:pb-8"
          role="main"
        >
          <PullToRefreshIndicator {...pull} />
          <Outlet />
        </main>
      </div>

      {/* Floating AI Assistant */}
      <FloatingAssistant />

      {/* Mobile FAB */}
      <FloatingActionButton />

      {/* Mobile bottom navigation */}
      <BottomNav onOpenMore={() => setSidebarOpen(true)} />

      {/* PWA Prompts */}
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
    </div>
  );
}
