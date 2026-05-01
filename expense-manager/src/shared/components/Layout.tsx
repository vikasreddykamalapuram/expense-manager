import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, PlusCircle, CalendarDays,
  Settings, Wallet, Menu, X, Landmark, Tag, ChevronDown,
  Plus,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { classNames } from '../utils/helpers';
import { useAppContext } from '../../context/AppContext';
import { storageService } from '../services/storageService';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { path: '/add', icon: PlusCircle, label: 'Add New' },
  { path: '/monthly', icon: CalendarDays, label: 'Monthly View' },
  { path: '/accounts', icon: Landmark, label: 'Accounts' },
  { path: '/categories', icon: Tag, label: 'Categories' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { state, dispatch } = useAppContext();
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
    dispatch({ type: 'SWITCH_PROFILE', payload: profileId });
    setProfileDropdownOpen(false);
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const profile = {
      id: uuidv4(),
      name: newProfileName.trim(),
      icon: '📊',
      createdAt: new Date().toISOString(),
    };
    const updatedProfiles = storageService.addProfile(profile);
    dispatch({ type: 'SET_PROFILES', payload: updatedProfiles });
    dispatch({ type: 'SWITCH_PROFILE', payload: profile.id });
    setNewProfileName('');
    setShowNewProfile(false);
    setProfileDropdownOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-xl transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-100 px-6">
          <div className="rounded-xl bg-primary-600 p-2">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">ExpenseIQ</h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">Finance Manager</p>
          </div>
          <button
            className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-gray-100 lg:hidden"
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
                    ? 'bg-primary-50 text-primary-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
        <div className="border-t border-gray-100 p-4">
          <div className="rounded-xl bg-gradient-to-r from-primary-500 to-primary-700 p-4 text-white">
            <p className="text-xs font-medium opacity-80">Track smarter.</p>
            <p className="mt-0.5 text-sm font-bold">Spend wiser.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-8">
          <button
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
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
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span>{activeProfile?.icon || '💰'}</span>
              <span className="max-w-[120px] truncate">{activeProfile?.name || 'Personal'}</span>
              <ChevronDown size={14} className={classNames(
                'text-gray-400 transition-transform',
                profileDropdownOpen ? 'rotate-180' : ''
              )} />
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-50">
                <div className="p-2">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Profiles</p>
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleSwitchProfile(p.id)}
                      className={classNames(
                        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                        p.id === activeProfileId
                          ? 'bg-primary-50 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
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
                <div className="border-t border-gray-100 p-2">
                  {showNewProfile ? (
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                        placeholder="Profile name..."
                        className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <Plus size={16} />
                      New Profile
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white">V</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
