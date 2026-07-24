import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, AlertTriangle, FileSpreadsheet, Cloud, CloudOff, LogOut, RefreshCw, CheckCircle2, XCircle, Sun, Moon, Monitor, Palette, Check, RefreshCcw, Smartphone, Shield, Database, Unplug, ArrowUpDown, Wifi, WifiOff } from 'lucide-react';
import type { AccentColor, DarkMode } from '../../../shared/types';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { useSync } from '../../../context/SyncContext';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useSupabaseAuth } from '../../../shared/hooks/useSupabaseAuth';
import { useSupabaseRealtime } from '../../../shared/hooks/useSupabaseRealtime';
import { Button } from '../../../shared/components/ui/Button';
import { Select } from '../../../shared/components/ui/Input';
import { Modal } from '../../../shared/components/ui/Modal';
import { downloadFile, classNames } from '../../../shared/utils/helpers';
import { CURRENCIES } from '../../../shared/constants/categories';
import { CSVImportModal } from './CSVImportModal';
import { backupService, BackupMetadata } from '../../../shared/services/backupService';
import { backendSync, backendFullPush, clearBackendSyncState } from '../../../shared/services/supabaseSyncService';

export function SettingsPage() {
  const { state, actions } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const { syncStatus, enableSyncForUser, disableSyncForUser, syncNow, deleteCloudData, deviceName } = useSync();
  const { theme, effectiveTheme, setTheme, accentColor, setAccentColor, darkMode, setDarkMode } = useTheme();
  const supabase = useSupabaseAuth();
  const realtime = useSupabaseRealtime();
  const { settings } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearPortfolioConfirm, setShowClearPortfolioConfirm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backing-up' | 'restoring' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupInfo, setBackupInfo] = useState<BackupMetadata | null>(null);
  const [loadingBackupInfo, setLoadingBackupInfo] = useState(false);
  const [syncActionStatus, setSyncActionStatus] = useState<'idle' | 'enabling' | 'syncing' | 'deleting'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [showDeleteSyncConfirm, setShowDeleteSyncConfirm] = useState(false);
  const [backendConnecting, setBackendConnecting] = useState(false);
  const [backendMessage, setBackendMessage] = useState('');

  // Load backup info when authenticated
  useEffect(() => {
    if (isAuthenticated && user?.provider) {
      setLoadingBackupInfo(true);
      backupService.getBackupInfo(user.provider)
        .then(setBackupInfo)
        .catch(() => setBackupInfo(null))
        .finally(() => setLoadingBackupInfo(false));
    }
  }, [isAuthenticated, user?.provider]);

  const handleCloudBackup = async () => {
    if (!user?.provider) return;
    setBackupStatus('backing-up');
    setBackupMessage('');
    const result = await backupService.backup(user.provider, state.activeProfileId);
    setBackupStatus(result.success ? 'success' : 'error');
    setBackupMessage(result.message);
    if (result.metadata) setBackupInfo(result.metadata);
    setTimeout(() => setBackupStatus('idle'), 5000);
  };

  const handleCloudRestore = async () => {
    if (!user?.provider) return;
    setBackupStatus('restoring');
    setBackupMessage('');
    const result = await backupService.restore(user.provider);
    if (result.success && result.data) {
      const importSuccess = await actions.importData(result.data);
      setBackupStatus(importSuccess ? 'success' : 'error');
      setBackupMessage(importSuccess ? 'Data restored from cloud backup!' : 'Failed to import cloud backup data.');
    } else {
      setBackupStatus('error');
      setBackupMessage(result.message);
    }
    setTimeout(() => setBackupStatus('idle'), 5000);
  };

  const handleCurrencyChange = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    if (currency) {
      actions.updateSettings({ currency: currency.code, currencySymbol: currency.symbol });
    }
  };

  const handleExport = async () => {
    const data = await actions.exportData();
    const date = new Date().toISOString().split('T')[0];
    downloadFile(data, `expense-manager-backup-${date}.json`);
  };

  const handleExportCSV = () => {
    const { transactions, categories } = state;
    const findCat = (id: string) => categories.find((c) => c.id === id);
    const header = 'Date,Type,Amount,Category,Subcategory,Notes,Payment Method';
    const rows = transactions.map((t) => {
      const cat = findCat(t.categoryId);
      const parent = cat?.parentId ? findCat(cat.parentId) : null;
      const categoryName = parent ? parent.name : (cat?.name || 'Unknown');
      const subName = parent ? (cat?.name || '') : '';
      const escapeCsv = (s: string) => s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      return [
        t.date,
        t.type,
        t.amount.toFixed(2),
        escapeCsv(categoryName),
        escapeCsv(subName),
        escapeCsv(t.notes || ''),
        t.paymentMethod || '',
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const date = new Date().toISOString().split('T')[0];
    downloadFile(csv, `expense-manager-${date}.csv`, 'text/csv');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const success = await actions.importData(content);
      setImportStatus(success ? 'success' : 'error');
      setTimeout(() => setImportStatus('idle'), 3000);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearData = async () => {
    await actions.clearAllData();
    setShowClearConfirm(false);
  };

  const handleClearPortfolioData = async () => {
    await actions.clearPortfolioData();
    setShowClearPortfolioConfirm(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Customize your experience</p>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Preferences</h3>
        <div className="space-y-4">
          <Select
            label="Currency"
            value={settings.currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            options={CURRENCIES.map((c) => ({
              value: c.code,
              label: `${c.symbol} — ${c.name} (${c.code})`,
            }))}
          />
          <Select
            label="Date Format"
            value={settings.dateFormat}
            onChange={(e) => actions.updateSettings({ dateFormat: e.target.value })}
            options={[
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
            ]}
          />
        </div>
      </div>

      {/* Style */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Palette size={18} className="text-primary-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Style</h3>
        </div>
        <div className="space-y-5">
          {/* Theme mode */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, label: 'Light', icon: Sun },
                { value: 'dark' as const, label: 'Dark', icon: Moon },
                { value: 'system' as const, label: 'System', icon: Monitor },
              ]).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={classNames(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                    theme === value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-500'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Dark style - only visible when dark mode is active */}
          {effectiveTheme === 'dark' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Dark Style</label>
              <div className="flex gap-2">
                {([
                  { value: 'default' as DarkMode, label: 'Default Gray', swatch: '#1f2937' },
                  { value: 'black' as DarkMode, label: 'AMOLED Black', swatch: '#000000' },
                ]).map(({ value, label, swatch }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDarkMode(value)}
                    className={classNames(
                      'flex flex-1 items-center justify-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                      darkMode === value
                        ? 'border-primary-500 bg-primary-900/30 text-primary-400'
                        : 'border-gray-600 bg-gray-700 text-gray-400 hover:bg-gray-600'
                    )}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-gray-500"
                      style={{ backgroundColor: swatch }}
                    />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Accent color */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Accent Color</label>
            <div className="grid grid-cols-5 gap-3">
              {([
                { value: 'blue' as AccentColor, label: 'Blue', hex: '#3b82f6' },
                { value: 'purple' as AccentColor, label: 'Purple', hex: '#8b5cf6' },
                { value: 'emerald' as AccentColor, label: 'Emerald', hex: '#10b981' },
                { value: 'pink' as AccentColor, label: 'Pink', hex: '#ec4899' },
                { value: 'orange' as AccentColor, label: 'Orange', hex: '#f97316' },
                { value: 'cyan' as AccentColor, label: 'Cyan', hex: '#06b6d4' },
                { value: 'rose' as AccentColor, label: 'Rose', hex: '#f43f5e' },
                { value: 'magenta' as AccentColor, label: 'Magenta', hex: '#d946ef' },
                { value: 'amber' as AccentColor, label: 'Amber', hex: '#f59e0b' },
                { value: 'teal' as AccentColor, label: 'Teal', hex: '#14b8a6' },
              ]).map(({ value, label, hex }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAccentColor(value)}
                  className="group flex flex-col items-center gap-1.5"
                  title={label}
                >
                  <span
                    className={classNames(
                      'relative flex h-10 w-10 items-center justify-center rounded-full transition-all',
                      accentColor === value
                        ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800'
                        : 'hover:scale-110'
                    )}
                    style={{
                      backgroundColor: hex,
                      ...(accentColor === value ? { ringColor: hex } : {}),
                    }}
                  >
                    {accentColor === value && (
                      <Check size={18} className="text-white drop-shadow-sm" strokeWidth={3} />
                    )}
                  </span>
                  <span className={classNames(
                    'text-[11px]',
                    accentColor === value
                      ? 'font-semibold text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  )}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profiles */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Profiles</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Click a profile to switch to it. Use profiles to separate data — e.g., personal vs imported data.
        </p>
        <div className="space-y-2">
          {state.profiles.map((p) => {
            const isActive = p.id === state.activeProfileId;
            return (
              <button
                key={p.id}
                onClick={() => !isActive && actions.switchProfile(p.id)}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isActive
                    ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/30 dark:border-primary-500 cursor-default'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-200 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 cursor-pointer'
                }`}
              >
                <span className="text-lg">{p.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">
                    {isActive && <span className="text-primary-600 dark:text-primary-400 font-medium">Active · </span>}
                    Created {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {p.id !== 'default' && !isActive && (
                  <div
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete profile "${p.name}"? All data in this profile will be lost.`)) {
                        actions.deleteProfile(p.id);
                      }
                    }}
                    className="rounded p-1.5 text-gray-400 dark:text-gray-500 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400 transition-colors"
                    title="Delete profile"
                  >
                    <Trash2 size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Data Management</h3>
        <div className="space-y-4">
          {/* Export */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Export</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
                JSON Backup (Full)
              </Button>
              <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={handleExportCSV}>
                CSV (Transactions)
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              JSON: Full backup with all settings · CSV: Transactions only (Excel-compatible)
            </p>
          </div>

          {/* Import */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Import</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                icon={<FileSpreadsheet size={16} />}
                onClick={() => setShowCSVImport(true)}
              >
                Import from CSV
              </Button>
              <Button
                variant="secondary"
                icon={<Upload size={16} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Restore JSON Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              CSV: Import from other expense tracker apps · JSON: Restore a previous backup
            </p>
          </div>

          {importStatus === 'success' && (
            <p className="text-sm text-success-600">✓ Data imported successfully!</p>
          )}
          {importStatus === 'error' && (
            <p className="text-sm text-danger-600">✕ Failed to import data. Please check the file format.</p>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Danger Zone</p>
            <div className="flex flex-col gap-3">
              <div>
                <Button
                  variant="secondary"
                  icon={<Trash2 size={16} />}
                  onClick={() => setShowClearPortfolioConfirm(true)}
                  className="!text-danger-600 !border-danger-300 hover:!bg-danger-50 dark:!border-danger-700 dark:hover:!bg-danger-900/20"
                >
                  Clear Portfolio Data
                </Button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Deletes all stock/trading transactions. Expense data remains untouched.
                </p>
              </div>
              <div>
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} />}
                  onClick={() => setShowClearConfirm(true)}
                >
                  Clear All Data
                </Button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Permanently deletes all transactions, budgets, and categories.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Account</h3>
        {isAuthenticated && user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="h-12 w-12 rounded-full border-2 border-gray-200 dark:border-gray-700" referrerPolicy="no-referrer" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">{user.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  Signed in via {user.provider === 'google' ? 'Google' : 'Microsoft'}
                </p>
              </div>
            </div>
            <Button variant="secondary" icon={<LogOut size={16} />} onClick={logout}>
              Sign Out
            </Button>
          </div>
        ) : (
          <div className="text-center py-4">
            <CloudOff className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Sign in to enable cloud backup and sync across devices.
            </p>
            <Button variant="primary" onClick={() => window.location.href = '/login'}>
              Sign In
            </Button>
          </div>
        )}
      </div>

      {/* Cloud Backup */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Cloud Backup</h3>
        {isAuthenticated && user ? (
          <div className="space-y-4">
            {/* Last backup info */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud size={16} className="text-primary-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user.provider === 'google' ? 'Google Drive' : 'OneDrive'} Backup
                </span>
              </div>
              {loadingBackupInfo ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <RefreshCw size={12} className="animate-spin" /> Checking...
                </p>
              ) : backupInfo ? (
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>Last backup: {new Date(backupInfo.modifiedTime).toLocaleString()}</p>
                  <p>Size: {(backupInfo.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">No backup found yet</p>
              )}
            </div>

            {/* Backup / Restore buttons */}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="primary"
                icon={backupStatus === 'backing-up' ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
                onClick={handleCloudBackup}
                disabled={backupStatus === 'backing-up' || backupStatus === 'restoring'}
              >
                {backupStatus === 'backing-up' ? 'Backing up...' : 'Backup Now'}
              </Button>
              <Button
                variant="secondary"
                icon={backupStatus === 'restoring' ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                onClick={handleCloudRestore}
                disabled={backupStatus === 'backing-up' || backupStatus === 'restoring'}
              >
                {backupStatus === 'restoring' ? 'Restoring...' : 'Restore from Cloud'}
              </Button>
            </div>

            {/* Status messages */}
            {backupStatus === 'success' && (
              <p className="text-sm text-success-600 flex items-center gap-1">
                <CheckCircle2 size={14} /> {backupMessage}
              </p>
            )}
            {backupStatus === 'error' && (
              <p className="text-sm text-danger-600 flex items-center gap-1">
                <XCircle size={14} /> {backupMessage}
              </p>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Backups are stored in your {user.provider === 'google' ? 'Google Drive' : 'OneDrive'} app data folder (hidden from your main files).
              Only the active profile is backed up.
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <Cloud className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to enable cloud backup</p>
          </div>
        )}
      </div>

      {/* Cross-Device Sync */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCcw size={18} className="text-primary-500" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Cross-Device Sync</h3>
        </div>

        {isAuthenticated && user ? (
          <div className="space-y-4">
            {/* Sync Status */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {syncStatus.state === 'idle' && <CheckCircle2 size={16} className="text-success-500" />}
                  {syncStatus.state === 'syncing' && <RefreshCw size={16} className="text-primary-500 animate-spin" />}
                  {syncStatus.state === 'error' && <XCircle size={16} className="text-danger-500" />}
                  {syncStatus.state === 'disabled' && <CloudOff size={16} className="text-gray-400" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {syncStatus.state === 'idle' && 'Synced'}
                    {syncStatus.state === 'syncing' && 'Syncing...'}
                    {syncStatus.state === 'error' && 'Sync Error'}
                    {syncStatus.state === 'disabled' && 'Sync Disabled'}
                  </span>
                </div>
                {syncStatus.state !== 'disabled' && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    via {user.provider === 'google' ? 'Google Drive' : 'OneDrive'}
                  </span>
                )}
              </div>

              {syncStatus.lastSyncAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last synced: {new Date(syncStatus.lastSyncAt).toLocaleString()}
                </p>
              )}
              {syncStatus.lastError && (
                <p className="text-xs text-danger-500 mt-1">{syncStatus.lastError}</p>
              )}
            </div>

            {/* Device Info */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Smartphone size={14} />
              <span>This device: {deviceName}</span>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 p-3">
              <Shield size={14} className="text-primary-500 mt-0.5 shrink-0" />
              <p className="text-xs text-primary-700 dark:text-primary-300">
                Your data is encrypted with AES-256-GCM before leaving this device. Only you can read it — not even {user.provider === 'google' ? 'Google' : 'Microsoft'} can access your financial data.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 sm:flex-row">
              {syncStatus.state === 'disabled' ? (
                <Button
                  variant="primary"
                  icon={syncActionStatus === 'enabling' ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                  disabled={syncActionStatus !== 'idle'}
                  onClick={async () => {
                    setSyncActionStatus('enabling');
                    setSyncMessage('');
                    const ok = await enableSyncForUser();
                    setSyncMessage(ok ? 'Sync enabled! Your data will sync automatically.' : 'Failed to enable sync. Please try again.');
                    setSyncActionStatus('idle');
                    if (ok) setTimeout(() => setSyncMessage(''), 5000);
                  }}
                >
                  Enable Sync
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    icon={syncActionStatus === 'syncing' ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                    disabled={syncActionStatus !== 'idle' || syncStatus.state === 'syncing'}
                    onClick={async () => {
                      setSyncActionStatus('syncing');
                      setSyncMessage('');
                      const ok = await syncNow();
                      setSyncMessage(ok ? 'Sync complete!' : 'Sync failed. Check your connection.');
                      setSyncActionStatus('idle');
                      setTimeout(() => setSyncMessage(''), 5000);
                    }}
                  >
                    Sync Now
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await disableSyncForUser();
                      setSyncMessage('Sync disabled.');
                      setTimeout(() => setSyncMessage(''), 3000);
                    }}
                  >
                    Disable Sync
                  </Button>
                </>
              )}
            </div>

            {/* Delete cloud data */}
            {syncStatus.state !== 'disabled' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <Button
                  variant="secondary"
                  icon={<Trash2 size={14} />}
                  onClick={() => setShowDeleteSyncConfirm(true)}
                  className="!text-danger-600 !border-danger-300 hover:!bg-danger-50 dark:!border-danger-700 dark:hover:!bg-danger-900/20 text-xs"
                >
                  Delete All Cloud Sync Data
                </Button>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Removes all sync data from the cloud. Local data is not affected.
                </p>
              </div>
            )}

            {syncMessage && (
              <p className={classNames(
                'text-sm flex items-center gap-1',
                syncMessage.includes('Failed') || syncMessage.includes('failed') ? 'text-danger-600' : 'text-success-600'
              )}>
                {syncMessage.includes('Failed') || syncMessage.includes('failed') ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                {syncMessage}
              </p>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Sync automatically when you switch back to this tab, or 5 seconds after any data change.
              All data is end-to-end encrypted.
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <RefreshCcw className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Sign in to sync data across your devices</p>
          </div>
        )}
      </div>

      {/* Backend Database Status */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Database size={18} />
          Cloud Database
        </h3>

        {!supabase.isConfigured ? (
          <div className="text-center py-4">
            <Database className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Backend not configured</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> in your .env file
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={classNames(
                  'h-2.5 w-2.5 rounded-full',
                  supabase.isConnected ? 'bg-success-500' : 'bg-gray-300 dark:bg-gray-600'
                )} />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {supabase.isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {supabase.isConnected && supabase.user && (
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {supabase.user.email}
                </span>
              )}
            </div>

            {/* User info when connected */}
            {supabase.isConnected && (
              <div className="bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-success-700 dark:text-success-400 text-sm">
                  <CheckCircle2 size={16} />
                  <span>Backend connected — data sync is available</span>
                </div>
                {supabase.lastSyncAt && (
                  <p className="text-xs text-success-600 dark:text-success-500 mt-1 ml-6">
                    Last synced: {new Date(supabase.lastSyncAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Realtime status */}
            {supabase.isConnected && (
              <div className={classNames(
                'rounded-lg p-3 border',
                realtime.status === 'connected'
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : realtime.status === 'error'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {realtime.status === 'connected' ? (
                      <Wifi size={16} className="text-blue-600 dark:text-blue-400" />
                    ) : realtime.status === 'connecting' ? (
                      <RefreshCw size={16} className="text-gray-500 animate-spin" />
                    ) : (
                      <WifiOff size={16} className="text-gray-400 dark:text-gray-500" />
                    )}
                    <span className={classNames(
                      realtime.status === 'connected' ? 'text-blue-700 dark:text-blue-400' :
                      realtime.status === 'error' ? 'text-amber-700 dark:text-amber-400' :
                      'text-gray-600 dark:text-gray-400'
                    )}>
                      {realtime.status === 'connected' ? 'Live sync active' :
                       realtime.status === 'connecting' ? 'Connecting...' :
                       realtime.status === 'error' ? `Realtime error: ${realtime.error}` :
                       'Realtime disconnected'}
                    </span>
                  </div>
                  {realtime.status === 'connected' && realtime.eventsReceived > 0 && (
                    <span className="text-xs text-blue-500 dark:text-blue-400">
                      {realtime.eventsReceived} live {realtime.eventsReceived === 1 ? 'update' : 'updates'}
                    </span>
                  )}
                </div>
                {realtime.status === 'connected' && (
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 ml-6">
                    Changes on other devices appear here instantly
                  </p>
                )}
                {realtime.status !== 'connected' && realtime.status !== 'connecting' && (
                  <div className="mt-2 ml-6">
                    <button
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      onClick={() => realtime.startRealtimeSync()}
                    >
                      Start live sync
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error display */}
            {supabase.error && (
              <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-3">
                <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400 text-sm">
                  <XCircle size={16} />
                  <span>{supabase.error}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              {!supabase.isConnected ? (
                <Button
                  variant="primary"
                  icon={backendConnecting ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                  disabled={!isAuthenticated || backendConnecting}
                  onClick={async () => {
                    if (!user?.provider) return;
                    setBackendConnecting(true);
                    setBackendMessage('');

                    // Get the ID token from the current session
                    const idToken = sessionStorage.getItem(
                      user.provider === 'google' ? 'em_google_id_token' : 'em_microsoft_id_token'
                    );

                    if (!idToken) {
                      setBackendMessage('No auth token found. Please sign out and sign in again.');
                      setBackendConnecting(false);
                      return;
                    }

                    const success = user.provider === 'google'
                      ? await supabase.bridgeGoogleAuth(idToken)
                      : await supabase.bridgeMicrosoftAuth(idToken);

                    setBackendMessage(
                      success
                        ? 'Connected to backend successfully!'
                        : 'Failed to connect. Check Supabase provider config.'
                    );
                    setBackendConnecting(false);
                    if (success) setTimeout(() => setBackendMessage(''), 5000);
                  }}
                >
                  Connect to Backend
                </Button>
              ) : (
                <>
                  <Button
                    variant="primary"
                    icon={backendConnecting ? <RefreshCw size={16} className="animate-spin" /> : <ArrowUpDown size={16} />}
                    disabled={backendConnecting}
                    onClick={async () => {
                      setBackendConnecting(true);
                      setBackendMessage('Syncing...');
                      const result = await backendSync(state.activeProfileId);
                      setBackendConnecting(false);
                      if (result.success) {
                        setBackendMessage(`Sync complete! Pushed ${result.pushed}, pulled ${result.pulled} records.`);
                      } else {
                        setBackendMessage(`Sync failed: ${result.error}`);
                      }
                      setTimeout(() => setBackendMessage(''), 8000);
                    }}
                  >
                    Sync Now
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Upload size={16} />}
                    disabled={backendConnecting}
                    onClick={async () => {
                      setBackendConnecting(true);
                      setBackendMessage('Pushing all local data...');
                      const result = await backendFullPush(state.activeProfileId);
                      setBackendConnecting(false);
                      if (result.success) {
                        setBackendMessage(`Full push complete! ${result.pushed} records synced.`);
                      } else {
                        setBackendMessage(`Push failed: ${result.error}`);
                      }
                      setTimeout(() => setBackendMessage(''), 8000);
                    }}
                  >
                    Push All Data
                  </Button>
                  <Button
                    variant="secondary"
                    icon={<Unplug size={16} />}
                    onClick={async () => {
                      realtime.stopRealtimeSync();
                      clearBackendSyncState();
                      await supabase.signOutSupabase();
                      setBackendMessage('Disconnected from backend.');
                      setTimeout(() => setBackendMessage(''), 3000);
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </div>

            {!isAuthenticated && !supabase.isConnected && (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Sign in with Google or Microsoft first, then connect to the cloud database.
              </p>
            )}

            {backendMessage && (
              <p className={classNames(
                'text-sm flex items-center gap-1',
                backendMessage.includes('Failed') || backendMessage.includes('No auth') ? 'text-danger-600' : 'text-success-600'
              )}>
                {backendMessage.includes('Failed') || backendMessage.includes('No auth') ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                {backendMessage}
              </p>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Cloud database enables real-time sync across devices with automatic backup.
              Your local data remains the primary store — the app works fully offline.
            </p>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">About</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>ExpenseIQ</strong> — Personal Finance Manager</p>
          <p>
            Version {import.meta.env.VITE_APP_VERSION || 'dev'}
            {import.meta.env.VITE_BUILD_TIME && (
              <span className="text-xs text-gray-400 ml-2">
                (built {new Date(import.meta.env.VITE_BUILD_TIME as string).toLocaleString()})
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                const info = `ExpenseIQ v${import.meta.env.VITE_APP_VERSION || 'dev'} · build ${import.meta.env.VITE_BUILD_TIME || 'n/a'} · ${navigator.userAgent}`;
                navigator.clipboard?.writeText(info).catch(() => { /* ignore */ });
              }}
              className="ml-3 text-xs text-primary-600 hover:underline"
              title="Copy version + user agent to clipboard"
            >
              Copy
            </button>
          </p>
          <p>Data is stored locally in your browser (IndexedDB) with optional encrypted cloud sync.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Total transactions: {state.transactions.length} · 
            Storage: ~{Math.round(JSON.stringify(state.transactions).length / 1024)}KB
          </p>
        </div>
      </div>

      {/* Clear All Confirmation */}
      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear All Data"
        size="sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="text-danger-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete all your transactions, budgets, and custom categories.
              This action cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              We recommend exporting your data before clearing.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearData}>
            Clear Everything
          </Button>
        </div>
      </Modal>

      {/* Clear Portfolio Confirmation */}
      <Modal
        isOpen={showClearPortfolioConfirm}
        onClose={() => setShowClearPortfolioConfirm(false)}
        title="Clear Portfolio Data"
        size="sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="text-danger-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will permanently delete all your stock and trading transactions
              ({state.stockTransactions.length} records). Your expense data, budgets, and
              categories will not be affected.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowClearPortfolioConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClearPortfolioData}>
            Clear Portfolio
          </Button>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
      />

      {/* Delete Sync Data Confirmation */}
      <Modal
        isOpen={showDeleteSyncConfirm}
        onClose={() => setShowDeleteSyncConfirm(false)}
        title="Delete Cloud Sync Data"
        size="sm"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-danger-100 p-2">
            <AlertTriangle className="text-danger-600" size={20} />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This will delete all sync data from the cloud, including the encryption key and all sync deltas.
              Sync will be disabled on all devices.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              Your local data on this device will not be affected.
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteSyncConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={syncActionStatus === 'deleting'}
            onClick={async () => {
              setSyncActionStatus('deleting');
              const ok = await deleteCloudData();
              setSyncMessage(ok ? 'Cloud sync data deleted.' : 'Failed to delete cloud data.');
              setSyncActionStatus('idle');
              setShowDeleteSyncConfirm(false);
              setTimeout(() => setSyncMessage(''), 5000);
            }}
          >
            {syncActionStatus === 'deleting' ? 'Deleting...' : 'Delete Cloud Data'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
