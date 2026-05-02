import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, CalendarDays,
  Settings, Wallet, Menu, X, Landmark, Tag, ChevronDown,
  Plus, LogIn, LogOut,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { classNames } from '../utils/helpers';
import { useAppContext } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import { FloatingAssistant } from '../../features/assistant/components/FloatingAssistant';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';
import { PWAInstallPrompt } from './PWAInstallPrompt';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/add', icon: PlusCircle, label: 'Add New' },
  { path: '/analytics', icon: CalendarDays, label: 'Analytics' },
  { path: '/accounts', icon: Landmark, label: 'Accounts' },
  { path: '/categories', icon: Tag, label: 'Categories' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { state, actions } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  useTheme();
  const navigate = useNavigate();
  const { profiles, activeProfileId } = state;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 dark:border-gray-700 px-6">
          <div className="rounded-xl bg-primary-600 p-2">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">ExpenseIQ</h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Finance Manager</p>
          </div>
          <button
            className="ml-auto rounded-lg p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                )
              }
              end={path === '/'}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 dark:border-gray-700 p-4">
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

          {/* User Avatar / Login */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2">
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

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Floating AI Assistant */}
      <FloatingAssistant />

      {/* PWA Prompts */}
      <PWAUpdatePrompt />
      <PWAInstallPrompt />
    </div>
  );
}
