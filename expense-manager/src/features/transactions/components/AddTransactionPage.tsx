import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { TransactionForm } from './TransactionForm';

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
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <TransactionForm
          initialType={initialType}
          prefillAmount={prefillAmount}
          prefillNote={prefillNote}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}


