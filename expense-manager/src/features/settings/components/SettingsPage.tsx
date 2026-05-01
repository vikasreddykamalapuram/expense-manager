import { useState, useRef } from 'react';
import { Download, Upload, Trash2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Select } from '../../../shared/components/ui/Input';
import { Modal } from '../../../shared/components/ui/Modal';
import { storageService } from '../../../shared/services/storageService';
import { downloadFile } from '../../../shared/utils/helpers';
import { CURRENCIES } from '../../../shared/constants/categories';
import { CSVImportModal } from './CSVImportModal';

export function SettingsPage() {
  const { state, dispatch } = useAppContext();
  const { settings } = state;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleCurrencyChange = (code: string) => {
    const currency = CURRENCIES.find((c) => c.code === code);
    if (currency) {
      dispatch({
        type: 'UPDATE_SETTINGS',
        payload: { currency: currency.code, currencySymbol: currency.symbol },
      });
    }
  };

  const handleExport = () => {
    const data = storageService.exportData();
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
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = storageService.importData(content);
      if (success) {
        setImportStatus('success');
        // Reload state from storage
        const transactions = storageService.getTransactions();
        const newSettings = storageService.getSettings();
        const budgets = storageService.getBudgets();
        const categories = storageService.getAllCategories();
        const accounts = storageService.getAccounts();
        dispatch({
          type: 'IMPORT_DATA',
          payload: { transactions, settings: newSettings, budgets, categories, accounts },
        });
      } else {
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus('idle'), 3000);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearData = () => {
    storageService.clearAllData();
    dispatch({ type: 'SET_TRANSACTIONS', payload: [] });
    dispatch({ type: 'SET_BUDGETS', payload: [] });
    setShowClearConfirm(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Customize your experience</p>
      </div>

      {/* Currency */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Preferences</h3>
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
            onChange={(e) => dispatch({ type: 'UPDATE_SETTINGS', payload: { dateFormat: e.target.value } })}
            options={[
              { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
              { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
              { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              { value: 'DD MMM YYYY', label: 'DD MMM YYYY' },
            ]}
          />
        </div>
      </div>

      {/* Data Management */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">Data Management</h3>
        <div className="space-y-4">
          {/* Export */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Export</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
                JSON Backup (Full)
              </Button>
              <Button variant="secondary" icon={<FileSpreadsheet size={16} />} onClick={handleExportCSV}>
                CSV (Transactions)
              </Button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              JSON: Full backup with all settings · CSV: Transactions only (Excel-compatible)
            </p>
          </div>

          {/* Import */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-medium text-gray-500 mb-2">Import</p>
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
            <p className="mt-1 text-xs text-gray-400">
              CSV: Import from other expense tracker apps · JSON: Restore a previous backup
            </p>
          </div>

          {importStatus === 'success' && (
            <p className="text-sm text-success-600">✓ Data imported successfully!</p>
          )}
          {importStatus === 'error' && (
            <p className="text-sm text-danger-600">✕ Failed to import data. Please check the file format.</p>
          )}

          <div className="border-t border-gray-200 pt-4">
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              onClick={() => setShowClearConfirm(true)}
            >
              Clear All Data
            </Button>
            <p className="mt-2 text-xs text-gray-500">
              This will permanently delete all your transactions, budgets, and categories.
            </p>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-gray-900">About</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>ExpenseIQ</strong> — Personal Finance Manager</p>
          <p>Version 1.0.0</p>
          <p>Data is stored locally in your browser.</p>
          <p className="text-xs text-gray-400 mt-4">
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
            <p className="text-sm text-gray-600">
              This will permanently delete all your transactions, budgets, and custom categories.
              This action cannot be undone.
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900">
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
