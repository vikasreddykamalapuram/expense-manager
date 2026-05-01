import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check,
  AlertTriangle, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { Select } from '../../../shared/components/ui/Input';
import { Modal } from '../../../shared/components/ui/Modal';
import { storageService } from '../../../shared/services/storageService';
import { Transaction } from '../../../shared/types';
import {
  parseCSV, ParsedCSV, ColumnMapping, guessColumnMapping,
  detectDateFormat, processCSVImport, matchCategory,
  ImportResult, ParsedTransaction,
} from '../../../shared/utils/csvParser';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'result';

export function CSVImportModal({ isOpen, onClose }: CSVImportModalProps) {
  const { state, dispatch } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [csv, setCsv] = useState<ParsedCSV | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '', amount: '', category: '', notes: '', type: '', account: '',
  });
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [defaultType, setDefaultType] = useState<'income' | 'expense'>('expense');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [showSkipped, setShowSkipped] = useState(false);
  const [parseError, setParseError] = useState('');

  const reset = () => {
    setStep('upload');
    setCsv(null);
    setFileName('');
    setMapping({ date: '', amount: '', category: '', notes: '', type: '', account: '' });
    setDateFormat('DD/MM/YYYY');
    setDefaultType('expense');
    setImportResult(null);
    setImportedCount(0);
    setShowSkipped(false);
    setParseError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Step 1: Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError('');
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = parseCSV(content);
        if (parsed.headers.length === 0 || parsed.rowCount === 0) {
          setParseError('The file appears to be empty or has no data rows.');
          return;
        }
        setCsv(parsed);

        // Auto-detect column mapping
        const autoMapping = guessColumnMapping(parsed.headers);
        setMapping(autoMapping);

        // Auto-detect date format from first mapped column
        if (autoMapping.date) {
          const dateIdx = parsed.headers.indexOf(autoMapping.date);
          if (dateIdx >= 0) {
            const dateSamples = parsed.rows.slice(0, 20).map((r) => r[dateIdx] || '');
            const detected = detectDateFormat(dateSamples);
            if (detected !== 'unknown') setDateFormat(detected);
          }
        }

        setStep('mapping');
      } catch {
        setParseError('Failed to parse the CSV file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Step 2 → 3: Process mapping and preview
  const handleProceedToPreview = () => {
    if (!csv) return;
    const result = processCSVImport(
      csv,
      mapping,
      dateFormat as Parameters<typeof processCSVImport>[2],
      defaultType,
    );
    setImportResult(result);
    setStep('preview');
  };

  // Step 3 → 4: Actually import
  const handleImport = () => {
    if (!importResult) return;

    const now = new Date().toISOString();
    const { categories } = state;
    let currentCategories = [...categories];
    let addedCategoryCount = 0;

    const transactions: Transaction[] = importResult.parsed.map((p: ParsedTransaction) => {
      // Match category to existing or create new
      let categoryId = matchCategory(p.category);

      // Check if matched category exists in state
      if (categoryId && !currentCategories.find((c) => c.id === categoryId)) {
        categoryId = null;
      }

      // Try exact name match from existing categories
      if (!categoryId) {
        const existing = currentCategories.find(
          (c) => c.name.toLowerCase() === p.category.toLowerCase() && c.type === p.type
        );
        if (existing) {
          categoryId = existing.id;
        }
      }

      // Create new custom category if no match
      if (!categoryId) {
        const newCatId = `import-${p.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        // Check if we already created this in this import batch
        const alreadyCreated = currentCategories.find((c) => c.id === newCatId);
        if (alreadyCreated) {
          categoryId = alreadyCreated.id;
        } else {
          const newCategory = {
            id: newCatId,
            name: p.category,
            type: p.type,
            icon: p.type === 'income' ? 'TrendingUp' : 'Tag',
            color: p.type === 'income' ? '#10b981' : '#64748b',
            isCustom: true,
          };
          dispatch({ type: 'ADD_CATEGORY', payload: newCategory });
          currentCategories = [...currentCategories, newCategory];
          addedCategoryCount++;
          categoryId = newCatId;
        }
      }

      return {
        id: uuidv4(),
        type: p.type,
        amount: p.amount,
        categoryId: categoryId!,
        date: p.date,
        notes: p.notes,
        isRecurring: false,
        createdAt: now,
        updatedAt: now,
      };
    });

    // Batch save all transactions
    const existingTxns = state.transactions;
    const allTxns = [...existingTxns, ...transactions];
    dispatch({ type: 'SET_TRANSACTIONS', payload: allTxns });

    // Persist to localStorage
    storageService.saveTransactions(allTxns);

    setImportedCount(transactions.length);
    setStep('result');

    // Log summary
    console.log(`CSV Import: ${transactions.length} transactions imported, ${addedCategoryCount} new categories created, ${importResult.skipped.length} rows skipped`);
  };

  const mappingValid = mapping.date && mapping.amount;
  const headerOptions = csv
    ? [{ value: '', label: '— Skip —' }, ...csv.headers.map((h) => ({ value: h, label: h }))]
    : [];

  const stepNumber = step === 'upload' ? 1 : step === 'mapping' ? 2 : step === 'preview' ? 3 : 4;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import from CSV" size="xl">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Map Columns' },
          { num: 3, label: 'Preview' },
          { num: 4, label: 'Done' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              stepNumber >= s.num
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              {stepNumber > s.num ? <Check size={14} /> : s.num}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              stepNumber >= s.num ? 'text-primary-700' : 'text-gray-400'
            }`}>{s.label}</span>
            {i < 3 && <div className={`h-px w-6 ${stepNumber > s.num ? 'bg-primary-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="rounded-full bg-primary-100 p-3">
              <FileSpreadsheet className="text-primary-600" size={28} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                Click to upload a CSV file
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports .csv files exported from expense tracker apps
              </p>
            </div>
            {fileName && (
              <p className="text-sm text-primary-600 font-medium">Selected: {fileName}</p>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />
          {parseError && (
            <div className="flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            <p className="font-medium mb-1">💡 Tips:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Export your data as CSV from your iPhone expense app</li>
              <li>If your app exports .xls/.xlsx, open in Excel/Google Sheets and save as CSV</li>
              <li>The file should have a header row with column names</li>
              <li>At minimum, Date and Amount columns are required</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 'mapping' && csv && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            We found <strong>{csv.rowCount}</strong> rows with <strong>{csv.headers.length}</strong> columns.
            Map your CSV columns to the right fields:
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Date Column *"
              value={mapping.date}
              onChange={(e) => setMapping({ ...mapping, date: e.target.value })}
              options={headerOptions}
            />
            <Select
              label="Amount Column *"
              value={mapping.amount}
              onChange={(e) => setMapping({ ...mapping, amount: e.target.value })}
              options={headerOptions}
            />
            <Select
              label="Category Column"
              value={mapping.category}
              onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
              options={headerOptions}
            />
            <Select
              label="Type Column (Income/Expense)"
              value={mapping.type}
              onChange={(e) => setMapping({ ...mapping, type: e.target.value })}
              options={headerOptions}
            />
            <Select
              label="Notes / Description Column"
              value={mapping.notes}
              onChange={(e) => setMapping({ ...mapping, notes: e.target.value })}
              options={headerOptions}
            />
            <Select
              label="Account / Wallet Column"
              value={mapping.account}
              onChange={(e) => setMapping({ ...mapping, account: e.target.value })}
              options={headerOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-gray-200 pt-3">
            <Select
              label="Date Format"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2024)' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2024)' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2024-12-31)' },
                { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (31-12-2024)' },
                { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY (12-31-2024)' },
                { value: 'DD/MM/YY', label: 'DD/MM/YY (31/12/24)' },
                { value: 'MM/DD/YY', label: 'MM/DD/YY (12/31/24)' },
                { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2024/12/31)' },
                { value: 'DD MMM YYYY', label: 'DD MMM YYYY (31 Dec 2024)' },
                { value: 'MMM DD, YYYY', label: 'MMM DD, YYYY (Dec 31, 2024)' },
              ]}
            />
            <Select
              label="Default Type (when no type column)"
              value={defaultType}
              onChange={(e) => setDefaultType(e.target.value as 'income' | 'expense')}
              options={[
                { value: 'expense', label: 'Expense (most common)' },
                { value: 'income', label: 'Income' },
              ]}
            />
          </div>

          {/* Sample data preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Sample Data (first 3 rows)</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {csv.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csv.rows.slice(0, 3).map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              disabled={!mappingValid}
              icon={<ArrowRight size={14} />}
              onClick={handleProceedToPreview}
            >
              Preview Import
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && importResult && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-success-50 p-3 text-center">
              <p className="text-2xl font-bold text-success-700">{importResult.parsed.length}</p>
              <p className="text-xs text-success-600">Ready to import</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{importResult.skipped.length}</p>
              <p className="text-xs text-amber-600">Skipped rows</p>
            </div>
            <div className="rounded-lg bg-primary-50 p-3 text-center">
              <p className="text-2xl font-bold text-primary-700">
                {new Set(importResult.parsed.map((p) => p.category)).size}
              </p>
              <p className="text-xs text-primary-600">Unique categories</p>
            </div>
          </div>

          {/* Category mapping preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Category Mapping</p>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-200 p-2 space-y-1">
              {Array.from(new Set(importResult.parsed.map((p) => p.category))).sort().map((cat) => {
                const matched = matchCategory(cat);
                const existingCat = matched ? state.categories.find((c) => c.id === matched) : null;
                const nameMatch = !existingCat
                  ? state.categories.find((c) => c.name.toLowerCase() === cat.toLowerCase())
                  : null;
                return (
                  <div key={cat} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-gray-700 min-w-[120px] truncate">{cat}</span>
                    <ArrowRight size={10} className="text-gray-300 shrink-0" />
                    {existingCat ? (
                      <span className="text-success-600">✓ {existingCat.name}</span>
                    ) : nameMatch ? (
                      <span className="text-success-600">✓ {nameMatch.name}</span>
                    ) : (
                      <span className="text-amber-600">+ New category will be created</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview table */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">
              Transaction Preview (first 10 of {importResult.parsed.length})
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 text-left font-medium text-gray-600">Date</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">Type</th>
                    <th className="px-2 py-2 text-right font-medium text-gray-600">Amount</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">Category</th>
                    <th className="px-2 py-2 text-left font-medium text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.parsed.slice(0, 10).map((p, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{p.date}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          p.type === 'income'
                            ? 'bg-success-100 text-success-700'
                            : 'bg-danger-100 text-danger-700'
                        }`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium text-gray-900">{p.amount.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-gray-700 max-w-[150px] truncate">{p.category}</td>
                      <td className="px-2 py-1.5 text-gray-500 max-w-[200px] truncate">{p.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Skipped rows */}
          {importResult.skipped.length > 0 && (
            <div>
              <button
                onClick={() => setShowSkipped(!showSkipped)}
                className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                {showSkipped ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {importResult.skipped.length} skipped row(s) — click to {showSkipped ? 'hide' : 'view'}
              </button>
              {showSkipped && (
                <div className="mt-1 max-h-24 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-1">
                  {importResult.skipped.map((s, i) => (
                    <p key={i} className="text-xs text-amber-700">
                      Row {s.rowIndex}: {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setStep('mapping')}>
              Back
            </Button>
            <Button
              disabled={importResult.parsed.length === 0}
              icon={<Upload size={14} />}
              onClick={handleImport}
            >
              Import {importResult.parsed.length} Transactions
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 'result' && (
        <div className="space-y-4 text-center py-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
            <Check className="text-success-600" size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Import Successful!</h3>
            <p className="text-sm text-gray-600 mt-1">
              <strong>{importedCount}</strong> transactions have been imported into your account.
            </p>
            {importResult && importResult.skipped.length > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {importResult.skipped.length} row(s) were skipped due to invalid data.
              </p>
            )}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={handleClose}>
              Done
            </Button>
            <Button variant="secondary" onClick={reset}>
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
