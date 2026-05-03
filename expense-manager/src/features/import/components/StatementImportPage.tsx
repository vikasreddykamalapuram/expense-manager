import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  FileUp, Upload, CheckCircle2, AlertTriangle, ChevronRight,
  ChevronLeft, Check, Info, FileSpreadsheet, Loader2,
} from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Select } from '../../../shared/components/ui/Input';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { useAppContext } from '../../../context/AppContext';
import { classNames, formatCurrency } from '../../../shared/utils/helpers';
import {
  parseBankStatement,
  type ParseResult,
  type ParsedTransaction,
  type BankFormat,
} from '../../../shared/services/statementParser';
import { parsePdfStatement } from '../../../shared/services/pdfStatementParser';
import type { Transaction, Settings } from '../../../shared/types';

// ─── Wizard Steps ───────────────────────────────────────

type Step = 'upload' | 'preview' | 'review' | 'done';

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: 'upload', label: 'Upload', number: 1 },
  { key: 'preview', label: 'Preview & Map', number: 2 },
  { key: 'review', label: 'Review', number: 3 },
  { key: 'done', label: 'Done', number: 4 },
];

const BANK_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'icici', label: 'ICICI Bank' },
  { value: 'hdfc', label: 'HDFC Bank' },
  { value: 'sbi', label: 'State Bank of India' },
  { value: 'axis', label: 'Axis Bank' },
  { value: 'generic', label: 'Other / Generic' },
];

// ─── Component ──────────────────────────────────────────

export function StatementImportPage() {
  const { state, actions } = useAppContext();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState<Step>('upload');
  const [selectedBank, setSelectedBank] = useState<string>('auto');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Map<number, string>>(new Map());
  const [importedCount, setImportedCount] = useState<number>(0);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [pdfPassword, setPdfPassword] = useState<string>('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [passwordError, setPasswordError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountOptions = useMemo(() => [
    { value: '', label: 'Select an account...' },
    ...state.accounts.filter((a) => a.isActive).map((a) => ({ value: a.id, label: a.name })),
  ], [state.accounts]);

  const expenseCategories = useMemo(
    () => state.categories.filter((c) => c.type === 'expense'),
    [state.categories],
  );

  const incomeCategories = useMemo(
    () => state.categories.filter((c) => c.type === 'income'),
    [state.categories],
  );

  const allCategories = useMemo(
    () => state.categories.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    [state.categories],
  );

  // ─── File handling ──────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext !== 'csv' && ext !== 'pdf') {
      alert('Please upload a CSV or PDF file.');
      return;
    }

    setFileName(file.name);
    const bank = selectedBank === 'auto' ? undefined : (selectedBank as BankFormat);

    const applyResult = (result: ParseResult) => {
      setParseResult(result);
      const initialSelected = new Set<number>();
      result.transactions.forEach((_: ParsedTransaction, idx: number) => initialSelected.add(idx));
      setSelectedRows(initialSelected);
      setCategoryOverrides(new Map());
      setStep('preview');
    };

    if (ext === 'pdf') {
      setParsing(true);
      parsePdfStatement(file, allCategories, bank)
        .then((result) => {
          if (result.errors.length === 1 && result.errors[0] === 'PASSWORD_REQUIRED') {
            setPendingPdfFile(file);
            setPasswordError('');
            setPdfPassword('');
            setShowPasswordPrompt(true);
            return;
          }
          applyResult(result);
        })
        .catch(() => {
          setParseResult({ transactions: [], errors: ['Failed to parse PDF file.'] });
        })
        .finally(() => setParsing(false));
    } else {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target?.result as string;
        if (!content) return;
        const result = parseBankStatement(content, allCategories, bank);
        applyResult(result);
      };
      reader.readAsText(file);
    }
  }, [selectedBank, allCategories]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePasswordSubmit = useCallback(() => {
    if (!pendingPdfFile || !pdfPassword.trim()) return;
    const bank = selectedBank === 'auto' ? undefined : (selectedBank as BankFormat);
    setParsing(true);
    setShowPasswordPrompt(false);

    parsePdfStatement(pendingPdfFile, allCategories, bank, pdfPassword.trim())
      .then((result) => {
        if (result.errors.length === 1 && result.errors[0] === 'PASSWORD_REQUIRED') {
          setPasswordError('Incorrect password. Please try again.');
          setShowPasswordPrompt(true);
          return;
        }
        if (result.errors.some((e) => e.startsWith('Incorrect password'))) {
          setPasswordError('Incorrect password. Please try again.');
          setShowPasswordPrompt(true);
          return;
        }
        setPendingPdfFile(null);
        setPdfPassword('');
        setParseResult(result);
        const initialSelected = new Set<number>();
        result.transactions.forEach((_: ParsedTransaction, idx: number) => initialSelected.add(idx));
        setSelectedRows(initialSelected);
        setCategoryOverrides(new Map());
        setStep('preview');
      })
      .catch(() => {
        setParseResult({ transactions: [], errors: ['Failed to parse PDF file.'] });
        setStep('preview');
      })
      .finally(() => setParsing(false));
  }, [pendingPdfFile, pdfPassword, selectedBank, allCategories]);

  // ─── Duplicate detection ────────────────────────────────

  const duplicateIndices = useMemo((): Set<number> => {
    if (!parseResult) return new Set();
    const dupes = new Set<number>();
    const existing = state.transactions;

    parseResult.transactions.forEach((pt: ParsedTransaction, idx: number) => {
      const isDupe = existing.some(
        (et: Transaction) =>
          et.date === pt.date &&
          Math.abs(et.amount - pt.amount) < 0.01 &&
          et.notes.toLowerCase().includes(pt.description.toLowerCase().slice(0, 20)),
      );
      if (isDupe) dupes.add(idx);
    });

    return dupes;
  }, [parseResult, state.transactions]);

  // Auto-deselect duplicates when entering review step
  const handleGoToReview = useCallback(() => {
    const updated = new Set(selectedRows);
    duplicateIndices.forEach((idx: number) => updated.delete(idx));
    setSelectedRows(updated);
    setStep('review');
  }, [selectedRows, duplicateIndices]);

  // ─── Stats ──────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!parseResult) return { total: 0, categorized: 0, needsReview: 0, selected: 0 };
    const total = parseResult.transactions.length;
    const categorized = parseResult.transactions.filter(
      (t: ParsedTransaction, i: number) => t.categoryId || categoryOverrides.has(i),
    ).length;
    return {
      total,
      categorized,
      needsReview: total - categorized,
      selected: selectedRows.size,
    };
  }, [parseResult, selectedRows, categoryOverrides]);

  const importStats = useMemo(() => {
    if (!parseResult) return { count: 0, totalDebit: 0, totalCredit: 0 };
    let totalDebit = 0;
    let totalCredit = 0;
    let count = 0;

    parseResult.transactions.forEach((t: ParsedTransaction, idx: number) => {
      if (!selectedRows.has(idx)) return;
      count++;
      if (t.type === 'expense') totalDebit += t.amount;
      else if (t.type === 'income') totalCredit += t.amount;
    });

    return { count, totalDebit, totalCredit };
  }, [parseResult, selectedRows]);

  // ─── Row selection ──────────────────────────────────────

  const toggleRow = useCallback((idx: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!parseResult) return;
    if (selectedRows.size === parseResult.transactions.length) {
      setSelectedRows(new Set());
    } else {
      const all = new Set<number>();
      parseResult.transactions.forEach((_: ParsedTransaction, i: number) => all.add(i));
      setSelectedRows(all);
    }
  }, [parseResult, selectedRows]);

  // ─── Category override ─────────────────────────────────

  const handleCategoryChange = useCallback((idx: number, categoryId: string) => {
    setCategoryOverrides((prev) => {
      const next = new Map(prev);
      if (categoryId) next.set(idx, categoryId);
      else next.delete(idx);
      return next;
    });
  }, []);

  // ─── Import ─────────────────────────────────────────────

  const handleImport = useCallback(async () => {
    if (!parseResult || isImporting) return;
    setIsImporting(true);

    try {
      const now = new Date().toISOString();
      const newTransactions: Transaction[] = [];

      parseResult.transactions.forEach((pt: ParsedTransaction, idx: number) => {
        if (!selectedRows.has(idx)) return;

        const overrideCatId = categoryOverrides.get(idx);
        let categoryId = overrideCatId || pt.categoryId || '';

        // If still no category, pick first expense/income category as fallback
        if (!categoryId) {
          const fallback = pt.type === 'income' ? incomeCategories[0] : expenseCategories[0];
          categoryId = fallback?.id || '';
        }

        const txn: Transaction = {
          id: uuidv4(),
          type: pt.type,
          amount: pt.amount,
          categoryId,
          date: pt.date,
          notes: pt.description,
          accountId: selectedAccountId || undefined,
          isRecurring: false,
          createdAt: now,
          updatedAt: now,
        };
        newTransactions.push(txn);
      });

      if (newTransactions.length > 0) {
        const merged = [...state.transactions, ...newTransactions];
        await actions.saveTransactions(merged);
      }

      setImportedCount(newTransactions.length);
      setStep('done');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [parseResult, selectedRows, categoryOverrides, selectedAccountId, state.transactions, actions, incomeCategories, expenseCategories, isImporting]);

  // ─── Reset ──────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setStep('upload');
    setParseResult(null);
    setSelectedRows(new Set());
    setCategoryOverrides(new Map());
    setFileName('');
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* PDF Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <FileUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Password Protected PDF</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enter the password to open this file</p>
              </div>
            </div>
            {passwordError && (
              <div className="mb-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                {passwordError}
              </div>
            )}
            <input
              type="password"
              value={pdfPassword}
              onChange={(e) => setPdfPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit(); }}
              placeholder="Enter PDF password"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => { setShowPasswordPrompt(false); setPendingPdfFile(null); setPdfPassword(''); setPasswordError(''); }}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!pdfPassword.trim()}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Unlock & Import
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Bank Statement</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload a CSV or PDF bank statement to import transactions automatically.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between rounded-xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const stepIdx = STEPS.findIndex((ss) => ss.key === step);
          const isCompleted = i < stepIdx;

          return (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={classNames(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                  )}
                >
                  {isCompleted ? <Check size={16} /> : s.number}
                </div>
                <span
                  className={classNames(
                    'text-sm font-medium hidden sm:inline',
                    isActive ? 'text-primary-700 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400',
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={classNames(
                  'mx-3 h-0.5 flex-1',
                  isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700',
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
        {step === 'upload' && (
          <UploadStep
            selectedBank={selectedBank}
            setSelectedBank={setSelectedBank}
            selectedAccountId={selectedAccountId}
            setSelectedAccountId={setSelectedAccountId}
            accountOptions={accountOptions}
            fileName={fileName}
            parseResult={parseResult}
            parsing={parsing}
            dragOver={dragOver}
            setDragOver={setDragOver}
            handleDrop={handleDrop}
            handleFileInput={handleFileInput}
            fileInputRef={fileInputRef}
          />
        )}

        {step === 'preview' && parseResult && (
          <PreviewStep
            parseResult={parseResult}
            selectedRows={selectedRows}
            categoryOverrides={categoryOverrides}
            expenseCategories={expenseCategories}
            incomeCategories={incomeCategories}
            duplicateIndices={duplicateIndices}
            stats={stats}
            settings={state.settings}
            toggleRow={toggleRow}
            toggleAll={toggleAll}
            handleCategoryChange={handleCategoryChange}
            onBack={() => setStep('upload')}
            onNext={handleGoToReview}
          />
        )}

        {step === 'review' && parseResult && (
          <ReviewStep
            parseResult={parseResult}
            selectedRows={selectedRows}
            duplicateIndices={duplicateIndices}
            importStats={importStats}
            settings={state.settings}
            isImporting={isImporting}
            onBack={() => setStep('preview')}
            onImport={handleImport}
          />
        )}

        {step === 'done' && (
          <DoneStep
            importedCount={importedCount}
            onViewTransactions={() => navigate('/transactions')}
            onImportMore={handleReset}
          />
        )}
      </div>
    </div>
  );
}

// ─── Step 1: Upload ─────────────────────────────────────

interface UploadStepProps {
  selectedBank: string;
  setSelectedBank: (v: string) => void;
  selectedAccountId: string;
  setSelectedAccountId: (v: string) => void;
  accountOptions: { value: string; label: string }[];
  fileName: string;
  parseResult: ParseResult | null;
  parsing: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function UploadStep({
  selectedBank, setSelectedBank,
  selectedAccountId, setSelectedAccountId,
  accountOptions, fileName, parseResult, parsing,
  dragOver, setDragOver,
  handleDrop, handleFileInput, fileInputRef,
}: UploadStepProps) {
  return (
    <div className="p-6 space-y-6">
      {/* Config Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Bank"
          options={BANK_OPTIONS}
          value={selectedBank}
          onChange={(e) => setSelectedBank(e.target.value)}
        />
        <Select
          label="Target Account"
          options={accountOptions}
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
        />
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={classNames(
          'flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
          dragOver
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-gray-700/50',
        )}
      >
        <div className={classNames(
          'rounded-full p-4',
          dragOver ? 'bg-primary-100 dark:bg-primary-900/40' : 'bg-gray-100 dark:bg-gray-700',
        )}>
          {parsing ? (
            <Loader2 className="h-8 w-8 text-primary-600 dark:text-primary-400 animate-spin" />
          ) : (
            <Upload className={classNames(
              'h-8 w-8',
              dragOver ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500',
            )} />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {parsing ? 'Parsing PDF statement...' : fileName ? fileName : 'Drop your bank statement here'}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            or click to browse • CSV or PDF files (max 5MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Errors */}
      {parseResult && parseResult.errors.length > 0 && parseResult.transactions.length === 0 && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Could not parse the file</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-red-700 dark:text-red-400 space-y-0.5">
                {parseResult.errors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
        <Info className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium">Supported banks: ICICI, HDFC, SBI, Axis, and generic CSV/PDF formats.</p>
          <p>Download your statement as CSV or PDF from your bank&apos;s net banking portal.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Preview & Map ──────────────────────────────

interface PreviewStepProps {
  parseResult: ParseResult;
  selectedRows: Set<number>;
  categoryOverrides: Map<number, string>;
  expenseCategories: Array<{ id: string; name: string }>;
  incomeCategories: Array<{ id: string; name: string }>;
  duplicateIndices: Set<number>;
  stats: { total: number; categorized: number; needsReview: number; selected: number };
  settings: Settings;
  toggleRow: (idx: number) => void;
  toggleAll: () => void;
  handleCategoryChange: (idx: number, catId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

function PreviewStep({
  parseResult, selectedRows, categoryOverrides,
  expenseCategories, incomeCategories, duplicateIndices,
  stats, settings, toggleRow, toggleAll, handleCategoryChange,
  onBack, onNext,
}: PreviewStepProps) {
  return (
    <div className="p-6 space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {parseResult.bankName && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
            <FileSpreadsheet size={14} /> {parseResult.bankName}
          </span>
        )}
        {parseResult.accountNumber && (
          <span className="text-gray-500 dark:text-gray-400">A/c: ****{parseResult.accountNumber}</span>
        )}
        {parseResult.statementPeriod && (
          <span className="text-gray-500 dark:text-gray-400">
            {parseResult.statementPeriod.start} to {parseResult.statementPeriod.end}
          </span>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBadge label="Total" value={stats.total} color="blue" />
        <StatBadge label="Selected" value={stats.selected} color="green" />
        <StatBadge label="Categorized" value={stats.categorized} color="purple" />
        <StatBadge label="Needs Review" value={stats.needsReview} color="amber" />
      </div>

      {/* Parse warnings */}
      {parseResult.errors.length > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            {parseResult.errors.length} row(s) skipped due to parse errors
          </p>
        </div>
      )}

      {/* Select All Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          {selectedRows.size === parseResult.transactions.length ? 'Deselect All' : 'Select All'}
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {selectedRows.size} of {parseResult.transactions.length} selected
        </span>
      </div>

      {/* Transaction Table */}
      <div className="max-h-[400px] overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700 z-10">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === parseResult.transactions.length}
                  onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase min-w-[150px]">Category</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {parseResult.transactions.map((txn: ParsedTransaction, idx: number) => {
              const isDupe = duplicateIndices.has(idx);
              const isSelected = selectedRows.has(idx);
              const overrideCatId = categoryOverrides.get(idx);
              const currentCatId = overrideCatId || txn.categoryId || '';
              const hasCat = !!currentCatId;
              const cats = txn.type === 'income' ? incomeCategories : expenseCategories;
              const catOptions = [
                { value: '', label: hasCat ? 'Remove' : 'Select category...' },
                ...cats.map((c) => ({ value: c.id, label: c.name })),
              ];

              return (
                <tr
                  key={idx}
                  className={classNames(
                    'transition-colors',
                    !isSelected && 'opacity-50',
                    isDupe && 'bg-amber-50/50 dark:bg-amber-900/10',
                    !hasCat && isSelected && !isDupe && 'bg-yellow-50/50 dark:bg-yellow-900/10',
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(idx)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{txn.date}</td>
                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-[250px] truncate" title={txn.description}>
                    <div className="flex items-center gap-1">
                      {isDupe && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
                      <span className="truncate">{txn.description}</span>
                    </div>
                  </td>
                  <td className={classNames(
                    'px-3 py-2 text-right font-medium whitespace-nowrap',
                    txn.type === 'income' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                  )}>
                    {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount, settings)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={currentCatId}
                      onChange={(e) => handleCategoryChange(idx, e.target.value)}
                      className={classNames(
                        'w-full rounded border px-2 py-1 text-xs transition-colors dark:bg-gray-700 dark:text-gray-100',
                        hasCat
                          ? 'border-gray-300 dark:border-gray-600'
                          : 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20',
                      )}
                    >
                      {catOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} icon={<ChevronLeft size={16} />}>Back</Button>
        <Button
          onClick={onNext}
          icon={<ChevronRight size={16} />}
          disabled={selectedRows.size === 0}
        >
          Review ({selectedRows.size})
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Import ────────────────────────────

interface ReviewStepProps {
  parseResult: ParseResult;
  selectedRows: Set<number>;
  duplicateIndices: Set<number>;
  importStats: { count: number; totalDebit: number; totalCredit: number };
  settings: Settings;
  isImporting: boolean;
  onBack: () => void;
  onImport: () => void;
}

function ReviewStep({
  parseResult, selectedRows, duplicateIndices,
  importStats, settings, isImporting,
  onBack, onImport,
}: ReviewStepProps) {
  const dupeCount = [...selectedRows].filter((idx) => duplicateIndices.has(idx)).length;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Review Import</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4 text-center">
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{importStats.count}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400">Transactions to import</p>
        </div>
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-4 text-center">
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(importStats.totalDebit, settings)}</p>
          <p className="text-xs text-red-600 dark:text-red-400">Total Debits</p>
        </div>
        <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4 text-center">
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(importStats.totalCredit, settings)}</p>
          <p className="text-xs text-green-600 dark:text-green-400">Total Credits</p>
        </div>
      </div>

      {/* Statement info */}
      {parseResult.bankName && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bank: <span className="font-medium text-gray-700 dark:text-gray-300">{parseResult.bankName}</span>
          {parseResult.statementPeriod && (
            <> • Period: {parseResult.statementPeriod.start} to {parseResult.statementPeriod.end}</>
          )}
        </p>
      )}

      {/* Duplicate Warning */}
      {dupeCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {dupeCount} possible duplicate(s) still selected
            </p>
            <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
              Go back to the preview step to deselect them, or proceed if they are not duplicates.
            </p>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" onClick={onBack} icon={<ChevronLeft size={16} />}>Back</Button>
        <Button
          onClick={onImport}
          disabled={importStats.count === 0 || isImporting}
          icon={isImporting ? undefined : <FileUp size={16} />}
        >
          {isImporting ? 'Importing...' : `Import ${importStats.count} Transactions`}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 4: Done ───────────────────────────────────────

interface DoneStepProps {
  importedCount: number;
  onViewTransactions: () => void;
  onImportMore: () => void;
}

function DoneStep({ importedCount, onViewTransactions, onImportMore }: DoneStepProps) {
  return (
    <div className="p-6">
      <EmptyState
        icon={<CheckCircle2 size={32} className="text-green-500" />}
        title="Import Complete!"
        description={`${importedCount} transaction${importedCount !== 1 ? 's' : ''} imported successfully.`}
        action={
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onImportMore} icon={<Upload size={16} />}>
              Import More
            </Button>
            <Button onClick={onViewTransactions} icon={<ChevronRight size={16} />}>
              View Transactions
            </Button>
          </div>
        }
      />
    </div>
  );
}

// ─── Stat Badge ─────────────────────────────────────────

interface StatBadgeProps {
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

const colorMap: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
  purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300',
};

function StatBadge({ label, value, color }: StatBadgeProps) {
  return (
    <div className={classNames('rounded-lg p-3 text-center', colorMap[color])}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}
