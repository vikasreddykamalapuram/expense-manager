import { TransactionForm } from './TransactionForm';

export function AddTransactionPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Add Transaction</h1>
        <p className="text-sm text-gray-500">Record a new income or expense</p>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <TransactionForm />
      </div>
    </div>
  );
}
