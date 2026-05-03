import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, Filter, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency, formatDate } from '../../../shared/utils/helpers';
import { StockTransaction, TradeType, Settings } from '../../../shared/types';
import { EmptyState } from '../../../shared/components/ui/EmptyState';

type SortKey = 'date' | 'totalValue' | 'symbol';
type SortDir = 'asc' | 'desc';

const TRADE_TYPE_BADGES: Record<TradeType, string> = {
  buy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  sell: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  dividend: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  bonus: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  split: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ipo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

export function TradeHistoryPage() {
  const { state, actions } = useAppContext();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [brokerFilter, setBrokerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const brokers = useMemo(() => {
    const set = new Set(state.stockTransactions.map(t => t.broker));
    return [...set].sort();
  }, [state.stockTransactions]);

  const filtered = useMemo(() => {
    let result = [...state.stockTransactions];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q)
      );
    }
    if (brokerFilter !== 'all') {
      result = result.filter(t => t.broker === brokerFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter(t => t.type === typeFilter);
    }
    if (dateFrom) {
      result = result.filter(t => t.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(t => t.date <= dateTo);
    }

    result.sort((a, b) => {
      if (sortKey === 'date') {
        return sortDir === 'asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      }
      if (sortKey === 'symbol') {
        return sortDir === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
      }
      return sortDir === 'asc' ? a.totalValue - b.totalValue : b.totalValue - a.totalValue;
    });

    return result;
  }, [state.stockTransactions, search, brokerFilter, typeFilter, dateFrom, dateTo, sortKey, sortDir]);

  const summary = useMemo(() => {
    const buys = filtered.filter(t => t.type === 'buy' || t.type === 'ipo').length;
    const sells = filtered.filter(t => t.type === 'sell').length;
    const divs = filtered.filter(t => t.type === 'dividend').length;
    return { total: filtered.length, buys, sells, divs };
  }, [filtered]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this trade?')) {
      await actions.deleteStockTransaction(id);
    }
  };

  if (state.stockTransactions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/portfolio')} className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trade History</h1>
        </div>
        <EmptyState
          icon={<TrendingUp size={32} />}
          title="No Trades Yet"
          description="Import your trade data to see your trading history"
          action={
            <button onClick={() => navigate('/trade-import')} className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
              Import Trades
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/portfolio')} className="rounded-lg p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trade History</h1>
        </div>
        <button
          onClick={() => navigate('/trade-import')}
          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Import More
        </button>
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap gap-3">
        <StatBadge icon={<Filter size={14} />} label="Total" value={summary.total} color="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700" />
        <StatBadge icon={<TrendingUp size={14} />} label="Buys" value={summary.buys} color="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30" />
        <StatBadge icon={<TrendingDown size={14} />} label="Sells" value={summary.sells} color="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30" />
        <StatBadge icon={<DollarSign size={14} />} label="Dividends" value={summary.divs} color="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30" />
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by symbol or name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${showFilters ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Filter size={16} />
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Broker</label>
              <select
                value={brokerFilter}
                onChange={e => setBrokerFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none"
              >
                <option value="all">All Brokers</option>
                {brokers.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="dividend">Dividend</option>
                <option value="bonus">Bonus</option>
                <option value="split">Split</option>
                <option value="ipo">IPO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-primary-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Trade Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>
                  Date {sortKey === 'date' && <span className="text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('symbol')}>
                  Symbol {sortKey === 'symbol' && <span className="text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Qty</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Price</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('totalValue')}>
                  Total {sortKey === 'totalValue' && <span className="text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">Charges</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">Broker</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((txn) => (
                <TradeRow key={txn.id} txn={txn} settings={state.settings} onDelete={handleDelete} />
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400 dark:text-gray-500">No trades match your filters</div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${color}`}>
      {icon}
      {label}: {value}
    </div>
  );
}

function TradeRow({ txn, settings, onDelete }: {
  txn: StockTransaction;
  settings: Settings;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(txn.date)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 dark:text-gray-100">{txn.symbol}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{txn.name !== txn.symbol ? txn.name : ''}</div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TRADE_TYPE_BADGES[txn.type]}`}>
          {txn.type}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 hidden sm:table-cell">{txn.quantity}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatCurrency(txn.price, settings)}</td>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(txn.totalValue, settings)}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{txn.charges.total > 0 ? formatCurrency(txn.charges.total, settings) : '—'}</td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">{txn.broker}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onDelete(txn.id)}
          className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
