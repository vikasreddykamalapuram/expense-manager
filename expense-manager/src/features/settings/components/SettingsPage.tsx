import { useState, useRef, useEffect } from 'react';
import { Download, Upload, Trash2, AlertTriangle, FileSpreadsheet, Cloud, CloudOff, LogOut, RefreshCw, CheckCircle2, XCircle, Sun, Moon, Monitor } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../shared/hooks/useTheme';
import { Button } from '../../../shared/components/ui/Button';
import { Select } from '../../../shared/components/ui/Input';
import { Modal } from '../../../shared/components/ui/Modal';
import { downloadFile, classNames } from '../../../shared/utils/helpers';
import { CURRENCIES } from '../../../shared/constants/categories';
import { CSVImportModal } from './CSVImportModal';
import { backupService, BackupMetadata } from '../../../shared/services/backupService';

export function SettingsPage() {
  const { state, actions } = useAppContext();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'backing-up' | 'restoring' | 'success' | 'error'>('idle');
  const [backupMessage, setBackupMessage] = useState('');
  const [backupInfo, setBackupInfo] = useState<BackupMetadata | null>(null);
  const [loadingBackupInfo, setLoadingBackupInfo] = useState(false);

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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Customize your experience</p>
      </div>

      {/* Currency */}
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
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All Data
            </Button>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              This will permanently delete all your transactions, budgets, and categories.
            </p>
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

      {/* App Info */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">About</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <p><strong>ExpenseIQ</strong> — Personal Finance Manager</p>
          <p>Version 2.0.0</p>
          <p>Data is stored locally in your browser (IndexedDB).</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            Total transactions: {state.transactions.length} · 
            Storage: ~{Math.round(JSON.stringify(state.transactions).length / 1024)}KB
          </p>
        </div>
      </div>

      {/* Clear Confirmation */}
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

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
      />
    </div>
  );
}
