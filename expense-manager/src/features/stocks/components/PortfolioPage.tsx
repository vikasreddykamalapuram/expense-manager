import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Upload, History, IndianRupee, BarChart3, Briefcase, PieChart } from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import { calculateHoldings, calculatePortfolioStats } from '../../../shared/services/stockService';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { PortfolioHolding, Settings } from '../../../shared/types';

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
  '#3b82f6', '#84cc16', '#e11d48', '#0ea5e9', '#d946ef',
];

type SortKey = 'symbol' | 'name' | 'quantity' | 'avgBuyPrice' | 'totalInvested' | 'assetClass';
type SortDir = 'asc' | 'desc';

export function PortfolioPage() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('totalInvested');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const holdings = useMemo(() => calculateHoldings(state.stockTransactions), [state.stockTransactions]);
  const stats = useMemo(() => calculatePortfolioStats(holdings), [holdings]);

  const activeBrokers = useMemo(() => {
    const set = new Set(state.stockTransactions.map(t => t.broker));
    return set.size;
  }, [state.stockTransactions]);

  const assetBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      const label = h.assetClass.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
      map.set(label, (map.get(label) || 0) + h.totalInvested);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [holdings]);

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    sorted.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      const numA = valA as number;
      const numB = valB as number;
      return sortDir === 'asc' ? numA - numB : numB - numA;
    });
    return sorted;
  }, [holdings, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="text-gray-300 dark:text-gray-600 ml-1">↕</span>;
    return <span className="text-primary-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // Donut chart
  const donutGradient = useMemo(() => {
    if (holdings.length === 0) return '';
    const total = holdings.reduce((s, h) => s + h.totalInvested, 0);
    if (total === 0) return '';
    let cumulative = 0;
    const stops = holdings.map((h, i) => {
      const start = cumulative;
      cumulative += (h.totalInvested / total) * 100;
      return `${CHART_COLORS[i % CHART_COLORS.length]} ${start}% ${cumulative}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [holdings]);

  if (holdings.length === 0 && state.stockTransactions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h1>
        </div>
        <EmptyState
          icon={<TrendingUp size={32} />}
          title="No Portfolio Data"
          description="Start by importing your trade data from your broker"
          action={
            <button
              onClick={() => navigate('/trade-import')}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/trade-import')}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
          >
            <Upload size={16} />
            Import Trades
          </button>
          <button
            onClick={() => navigate('/trades')}
            className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <History size={16} />
            Trade History
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<IndianRupee size={20} />}
          label="Total Invested"
          value={formatCurrency(stats.totalInvested, state.settings)}
          color="bg-blue-500"
        />
        <SummaryCard
          icon={<BarChart3 size={20} />}
          label="Total Charges"
          value={formatCurrency(stats.totalCharges, state.settings)}
          color="bg-amber-500"
        />
        <SummaryCard
          icon={<Briefcase size={20} />}
          label="Holdings"
          value={stats.holdingCount.toString()}
          color="bg-emerald-500"
        />
        <SummaryCard
          icon={<PieChart size={20} />}
          label="Active Brokers"
          value={activeBrokers.toString()}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation Chart */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Portfolio Allocation</h3>
          {donutGradient ? (
            <>
              <div className="flex justify-center mb-4">
                <div className="relative" style={{ width: 160, height: 160 }}>
                  <div className="w-full h-full rounded-full" style={{ background: donutGradient }} />
                  <div className="absolute inset-4 rounded-full bg-white dark:bg-gray-800" />
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {holdings.map((h, i) => {
                  const total = holdings.reduce((s, x) => s + x.totalInvested, 0);
                  const pct = total > 0 ? ((h.totalInvested / total) * 100).toFixed(1) : '0';
                  return (
                    <div key={h.symbol} className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-300">{h.symbol}</span>
                      <span className="text-gray-500 dark:text-gray-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">No data</p>
          )}
        </div>

        {/* Asset Class Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-gray-900 dark:text-gray-100">Asset Class Breakdown</h3>
          {assetBreakdown.length > 0 ? (
            <div className="space-y-3">
              {assetBreakdown.map(([label, amount], i) => {
                const maxAmount = assetBreakdown[0][1];
                const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
                      <span className="text-gray-500 dark:text-gray-400">{formatCurrency(amount, state.settings)}</span>
                    </div>
                    <div className="h-3 rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-3 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">No data</p>
          )}
        </div>
      </div>

      {/* Holdings Table */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Holdings ({holdings.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                <HeaderCell label="Symbol" col="symbol" onSort={handleSort} sortIcon={<SortIcon col="symbol" />} />
                <HeaderCell label="Name" col="name" onSort={handleSort} sortIcon={<SortIcon col="name" />} className="hidden md:table-cell" />
                <HeaderCell label="Qty" col="quantity" onSort={handleSort} sortIcon={<SortIcon col="quantity" />} />
                <HeaderCell label="Avg Price" col="avgBuyPrice" onSort={handleSort} sortIcon={<SortIcon col="avgBuyPrice" />} className="hidden sm:table-cell" />
                <HeaderCell label="Invested" col="totalInvested" onSort={handleSort} sortIcon={<SortIcon col="totalInvested" />} />
                <HeaderCell label="Type" col="assetClass" onSort={handleSort} sortIcon={<SortIcon col="assetClass" />} className="hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedHoldings.map((h) => (
                <HoldingRow key={h.symbol} holding={h} settings={state.settings} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 text-white ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({ label, col, onSort, sortIcon, className }: {
  label: string; col: SortKey; onSort: (k: SortKey) => void; sortIcon: React.ReactNode; className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 ${className || ''}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center">{label}{sortIcon}</span>
    </th>
  );
}

function HoldingRow({ holding, settings }: { holding: PortfolioHolding; settings: Settings }) {
  const assetLabel = holding.assetClass.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const badgeColors: Record<string, string> = {
    equity: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    mutual_fund: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    etf: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    bond: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    gold: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{holding.symbol}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell truncate max-w-[200px]">{holding.name}</td>
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{holding.quantity}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatCurrency(holding.avgBuyPrice, settings)}</td>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{formatCurrency(holding.totalInvested, settings)}</td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[holding.assetClass] || badgeColors.other}`}>
          {assetLabel}
        </span>
      </td>
    </tr>
  );
}
