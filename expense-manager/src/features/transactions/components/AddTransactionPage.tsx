import { useLocation, useSearchParams } from 'react-router-dom';
import { TransactionForm } from './TransactionForm';

export function AddTransactionPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Prefer explicit navigation state (in-app navigation) over query params
  // (deep links from shortcuts / widget / share intent).
  const stateType = (location.state as { type?: string })?.type;
  const queryType = searchParams.get('type');
  const initialType = (stateType ?? queryType) as 'income' | 'expense' | 'transfer' | undefined;

  const prefillAmount = searchParams.get('amount') || undefined;
  const prefillNote = searchParams.get('note') || undefined;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Transaction</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Record a new income or expense</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <TransactionForm
          initialType={initialType}
          prefillAmount={prefillAmount}
          prefillNote={prefillNote}
        />
      </div>
    </div>
  );
}

