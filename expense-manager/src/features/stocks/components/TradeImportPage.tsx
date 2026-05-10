import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertCircle, FileSpreadsheet,
  ChevronRight, Loader2, X, ExternalLink,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../../context/AppContext';
import { parseTradeData, BrokerFormat } from '../../../shared/services/brokerParser';
import { StockTransaction } from '../../../shared/types';
import { getUntrackedSymbols } from '../../../shared/services/stockPriceService';

type Step = 'upload' | 'preview' | 'review' | 'done';

const BROKER_OPTIONS: { value: BrokerFormat | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'zerodha', label: 'Zerodha' },
  { value: 'groww', label: 'Groww' },
  { value: 'angelone', label: 'Angel One' },
  { value: 'paytmmoney', label: 'Paytm Money' },
  { value: 'geojit', label: 'Geojit' },
  { value: 'sbi_securities', label: 'SBI Securities' },
  { value: 'upstox', label: 'Upstox' },
  { value: 'kotak', label: 'Kotak Securities' },
  { value: 'icici_direct', label: 'ICICI Direct' },
  { value: 'hdfc_securities', label: 'HDFC Securities' },
  { value: 'generic', label: 'Other / Generic' },
];

export function TradeImportPage() {
  const { state, actions } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [brokerHint, setBrokerHint] = useState<BrokerFormat | 'auto'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [detectedBroker, setDetectedBroker] = useState('');
  const [parsedTxns, setParsedTxns] = useState<Omit<StockTransaction, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importCount, setImportCount] = useState(0);
  const [untrackedSymbols, setUntrackedSymbols] = useState<string[]>([]);

  // Detect duplicates against existing transactions
  const duplicateIndices = useMemo(() => {
    const existingKeys = new Set(
      state.stockTransactions.map(t => `${t.date}|${t.symbol}|${t.type}|${t.quantity}|${t.price}`)
    );
    const dupes = new Set<number>();
    parsedTxns.forEach((txn, i) => {
      const key = `${txn.date}|${txn.symbol}|${txn.type}|${txn.quantity}|${txn.price}`;
      if (existingKeys.has(key)) dupes.add(i);
    });
    return dupes;
  }, [parsedTxns, state.stockTransactions]);

  const readFileContent = useCallback(async (file: File): Promise<string> => {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_csv(sheet);
    }
    return file.text();
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name);
    setIsLoading(true);
    setParseErrors([]);

    try {
      const content = await readFileContent(file);
      const hint = brokerHint === 'auto' ? undefined : brokerHint;
      const result = parseTradeData(content, hint);

      setParsedTxns(result.transactions);
      setDetectedBroker(result.broker);
      setParseErrors(result.errors);

      // Pre-select all non-duplicate trades
      const sel = new Set<number>();
      result.transactions.forEach((_, i) => {
        if (!duplicateIndices.has(i)) sel.add(i);
      });
      setSelectedIndices(sel);

      setStep('preview');
    } catch (err) {
      setParseErrors([`Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setIsLoading(false);
    }
  }, [brokerHint, readFileContent, duplicateIndices]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const toggleSelect = (i: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIndices.size === parsedTxns.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsedTxns.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      const toImport: StockTransaction[] = [];
      parsedTxns.forEach((txn, i) => {
        if (selectedIndices.has(i)) {
          toImport.push({
            ...txn,
            id: uuidv4(),
            createdAt: now,
            updatedAt: now,
          });
        }
      });
      await actions.addStockTransactions(toImport);
      setImportCount(toImport.length);

      // Check for symbols not yet tracked in prices.json
      const importedSymbols = [...new Set(toImport.map(t => t.symbol))];
      try {
        const untracked = await getUntrackedSymbols(importedSymbols);
        setUntrackedSymbols(untracked);
      } catch {
        // Non-critical — don't block import
      }

      setStep('done');
    } catch (err) {
      setParseErrors([`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep('upload');
    setParsedTxns([]);
    setParseErrors([]);
    setSelectedIndices(new Set());
    setFileName('');
    setDetectedBroker('');
    setImportCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/portfolio')} className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Trades</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'review', 'done'] as Step[]).map((s, i) => {
          const labels = ['Upload', 'Preview', 'Review', 'Done'];
          const stepIndex = ['upload', 'preview', 'review', 'done'].indexOf(step);
          const isActive = i === stepIndex;
          const isCompleted = i < stepIndex;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${isCompleted ? 'bg-green-500 text-white' : isActive ? 'bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {isCompleted ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>{labels[i]}</span>
              {i < 3 && <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm space-y-6">
          {/* Broker Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Broker</label>
            <select
              value={brokerHint}
              onChange={e => setBrokerHint(e.target.value as BrokerFormat | 'auto')}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {BROKER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Drop Zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors"
          >
            {isLoading ? (
              <Loader2 size={40} className="text-primary-500 animate-spin mb-3" />
            ) : (
              <FileSpreadsheet size={40} className="text-gray-400 dark:text-gray-500 mb-3" />
            )}
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {isLoading ? 'Parsing file...' : 'Drop your CSV or Excel file here'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">or click to browse • .csv, .xlsx</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Errors</span>
              </div>
              {parseErrors.map((err, i) => (
                <p key={i} className="text-sm text-red-600 dark:text-red-400">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  File: <span className="text-gray-900 dark:text-gray-100">{fileName}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Broker detected: <span className="font-medium text-primary-600 dark:text-primary-400">{detectedBroker}</span>
                  {' • '}{parsedTxns.length} trades found
                </p>
              </div>
              <button onClick={resetWizard} className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
          </div>

          {parseErrors.length > 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">{parseErrors.length} warning(s)</p>
              {parseErrors.slice(0, 5).map((err, i) => (
                <p key={i} className="text-sm text-amber-600 dark:text-amber-400">{err}</p>
              ))}
              {parseErrors.length > 5 && <p className="text-sm text-amber-500">...and {parseErrors.length - 5} more</p>}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Price</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {parsedTxns.slice(0, 100).map((txn, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{txn.date}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{txn.symbol}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${txn.type === 'buy' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : txn.type === 'sell' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {txn.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{txn.quantity}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">₹{txn.price.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">₹{txn.totalValue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedTxns.length > 100 && (
              <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2 text-center text-xs text-gray-400">
                Showing first 100 of {parsedTxns.length} trades
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={resetWizard} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Back
            </button>
            <button
              onClick={() => setStep('review')}
              disabled={parsedTxns.length === 0}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">{selectedIndices.size}</span> of {parsedTxns.length} trades selected for import
                {duplicateIndices.size > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 ml-2">
                    ({duplicateIndices.size} potential duplicate{duplicateIndices.size > 1 ? 's' : ''})
                  </span>
                )}
              </p>
              <button onClick={toggleAll} className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
                {selectedIndices.size === parsedTxns.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIndices.size === parsedTxns.length}
                        onChange={toggleAll}
                        className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Symbol</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Qty</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {parsedTxns.map((txn, i) => {
                    const isDupe = duplicateIndices.has(i);
                    return (
                      <tr key={i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isDupe ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIndices.has(i)}
                            onChange={() => toggleSelect(i)}
                            className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{txn.date}</td>
                        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{txn.symbol}</td>
                        <td className="px-4 py-2 capitalize text-gray-700 dark:text-gray-300">{txn.type}</td>
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{txn.quantity}</td>
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-100">₹{txn.totalValue.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2">
                          {isDupe ? (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              Duplicate
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              New
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep('preview')} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIndices.size === 0 || isLoading}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              Import {selectedIndices.size} Trade{selectedIndices.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
              <CheckCircle2 size={40} className="text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Import Complete!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Successfully imported <span className="font-semibold text-gray-900 dark:text-gray-100">{importCount}</span> trade{importCount !== 1 ? 's' : ''}
            {detectedBroker && <> from <span className="font-semibold text-primary-600 dark:text-primary-400">{detectedBroker}</span></>}
          </p>

          {/* Untracked symbols notice */}
          {untrackedSymbols.length > 0 && (
            <div className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                    {untrackedSymbols.length} symbol{untrackedSymbols.length !== 1 ? 's' : ''} not yet tracked for live prices
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    {untrackedSymbols.join(', ')}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                    Prices will be available after the next GitHub Action run. To fetch immediately:
                  </p>
                  <a
                    href={`https://github.com/vikasreddykamalapuram/expense-manager/actions/workflows/update-prices.yml`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
                  >
                    Trigger price update workflow <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <button
              onClick={() => navigate('/portfolio')}
              className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              View Portfolio
            </button>
            <button
              onClick={() => navigate('/trades')}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Trade History
            </button>
            <button
              onClick={resetWizard}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
