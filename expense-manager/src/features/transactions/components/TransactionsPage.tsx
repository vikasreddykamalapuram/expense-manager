import { TransactionList } from './TransactionList';
import { useAppContext } from '../../../context/AppContext';

export function TransactionsPage() {
  const { state } = useAppContext();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500">
            {state.transactions.length} total transaction{state.transactions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
      <TransactionList />
    </div>
  );
}
