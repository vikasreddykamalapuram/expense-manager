import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import type { PaymentMethod } from '../../../shared/types';
import { takeScannedReceipt } from '../../import/receiptHandoff';
import { TransactionForm } from './TransactionForm';
import { QuickAddTransaction } from './QuickAddTransaction';

const ADD_MODE_KEY = 'moneyiq_add_mode';

export function AddTransactionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Prefer explicit navigation state (in-app navigation) over query params
  // (deep links from shortcuts / widget / share intent).
  const stateType = (location.state as { type?: string })?.type;
  const queryType = searchParams.get('type');
  const initialType = (stateType ?? queryType) as 'income' | 'expense' | 'transfer' | undefined;

  const prefillAmount = searchParams.get('amount') || undefined;
  const prefillNote = searchParams.get('note') || undefined;
  const prefillDate = searchParams.get('date') || undefined;
  const prefillPaymentMethod = (searchParams.get('method') as PaymentMethod | null) || undefined;

  // A receipt scan hands its image over out-of-band (a File can't ride in a
  // URL). Claim it once on mount so a later visit to /add can't reuse it.
  const [scannedReceipt] = useState<File | null>(() => takeScannedReceipt());

  const [mode, setMode] = useState<'quick' | 'classic'>(() => {
    // The quick keypad has no date or payment-method field, so a scan would
    // silently drop what it just read. Force the full form in that case.
    if (scannedReceipt || prefillDate || prefillPaymentMethod) return 'classic';
    try { return localStorage.getItem(ADD_MODE_KEY) === 'classic' ? 'classic' : 'quick'; } catch { return 'quick'; }
  });
  const chooseMode = (m: 'quick' | 'classic') => {
    setMode(m);
    try { localStorage.setItem(ADD_MODE_KEY, m); } catch { /* ignore */ }
  };

  // Cancel: if we have history to pop, go back; otherwise fall back to the
  // transactions list. Covers both in-app nav and deep-link entries.
  const handleClose = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/transactions');
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Transaction</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Record a new income or expense</p>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cancel and go back"
          className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* Entry-mode toggle — Quick (fast keypad) vs Classic (full form) */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
        {(['quick', 'classic'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => chooseMode(m)}
            className={
              'flex-1 rounded-md py-1.5 font-medium capitalize transition-colors ' +
              (mode === m
                ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')
            }
          >
            {m}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm sm:p-6">
        {mode === 'quick' ? (
          <QuickAddTransaction
            initialType={initialType}
            prefillAmount={prefillAmount}
            prefillNote={prefillNote}
            onClose={handleClose}
          />
        ) : (
          <TransactionForm
            initialType={initialType}
            prefillAmount={prefillAmount}
            prefillNote={prefillNote}
            prefillDate={prefillDate}
            prefillPaymentMethod={prefillPaymentMethod}
            prefillReceiptFile={scannedReceipt}
            onClose={handleClose}
          />
        )}
      </div>
    </div>
  );
}


