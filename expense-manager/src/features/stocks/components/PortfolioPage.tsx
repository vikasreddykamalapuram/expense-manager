import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Upload, History, IndianRupee, BarChart3,
  Briefcase, PieChart, RefreshCw, AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import {
  calculateHoldings, calculatePortfolioStats, calculateTradingStats,
  enrichHoldingsWithPrices,
} from '../../../shared/services/stockService';
import { fetchBatchPrices, getAllCachedPrices } from '../../../shared/services/stockPriceService';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { PortfolioHolding, Settings } from '../../../shared/types';

const CHART_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#a855f7',
  '#3b82f6', '#84cc16', '#e11d48', '#0ea5e9', '#d946ef',
];

type SortKey = 'symbol' | 'name' | 'quantity' | 'avgBuyPrice' | 'totalInvested' | 'currentPrice' | 'currentValue' | 'unrealizedPL' | 'unrealizedPLPercent' | 'dayChangePercent';
type SortDir = 'asc' | 'desc';
type AnalyticsTab = 'diversification' | 'performance' | 'insights';

export function PortfolioPage() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('totalInvested');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('diversification');
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [priceMap, setPriceMap] = useState<Map<string, import('../../../shared/services/stockPriceService').StockPrice>>(new Map());

  const baseHoldings = useMemo(() => calculateHoldings(state.stockTransactions), [state.stockTransactions]);
  const tradingStats = useMemo(() => calculateTradingStats(state.stockTransactions), [state.stockTransactions]);

  const holdings = useMemo(
    () => enrichHoldingsWithPrices(baseHoldings, priceMap),
    [baseHoldings, priceMap]
  );

  const stats = useMemo(() => calculatePortfolioStats(holdings), [holdings]);
  const hasLivePrices = holdings.some(h => h.currentPrice != null);

  // Load cached prices immediately on mount
  useEffect(() => {
    if (baseHoldings.length > 0) {
      const cached = getAllCachedPrices();
      if (cached.size > 0) {
        setPriceMap(cached);
        const timestamps = [...cached.values()].map(p => p.lastUpdated).filter(Boolean);
        if (timestamps.length > 0) setLastUpdated(timestamps[0]);
      }
    }
  }, [baseHoldings]);

  const fetchPrices = useCallback(async () => {
    if (baseHoldings.length === 0) return;
    setPricesLoading(true);
    setPriceError(false);
    try {
      const prices = await fetchBatchPrices(baseHoldings);
      if (prices.size > 0) {
        setPriceMap(prices);
        setLastUpdated(new Date().toISOString());
      } else {
        setPriceError(true);
      }
    } catch {
      setPriceError(true);
    } finally {
      setPricesLoading(false);
    }
  }, [baseHoldings]);

  // Auto-fetch on mount
  useEffect(() => {
    if (baseHoldings.length > 0) {
      fetchPrices();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedHoldings = useMemo(() => {
    const sorted = [...holdings];
    sorted.sort((a, b) => {
      const valA = a[sortKey as keyof PortfolioHolding];
      const valB = b[sortKey as keyof PortfolioHolding];
      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
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

  const formatTs = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fetchPrices}
            disabled={pricesLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={pricesLoading ? 'animate-spin' : ''} />
            {pricesLoading ? 'Fetching...' : 'Refresh Prices'}
          </button>
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

      {/* Last updated & error banner */}
      {lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <Clock size={12} /> Prices last updated: {formatTs(lastUpdated)}
        </p>
      )}
      {priceError && !hasLivePrices && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle size={16} />
          Live prices unavailable. Showing invested values only.
        </div>
      )}

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
          label="Current Value"
          value={hasLivePrices ? formatCurrency(stats.totalCurrentValue, state.settings) : (pricesLoading ? 'Fetching...' : 'N/A')}
          color="bg-emerald-500"
          loading={pricesLoading && !hasLivePrices}
        />
        <SummaryCard
          icon={stats.totalUnrealizedPL >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          label="Total P&L"
          value={hasLivePrices
            ? `${formatCurrency(Math.abs(stats.totalUnrealizedPL), state.settings)} (${stats.totalUnrealizedPL >= 0 ? '+' : '-'}${Math.abs(stats.totalUnrealizedPLPercent).toFixed(2)}%)`
            : 'N/A'}
          color={stats.totalUnrealizedPL >= 0 ? 'bg-green-500' : 'bg-red-500'}
          valueColor={hasLivePrices ? (stats.totalUnrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : undefined}
        />
        <SummaryCard
          icon={<Briefcase size={20} />}
          label="Today's Change"
          value={hasLivePrices
            ? `${stats.totalDayChange >= 0 ? '+' : ''}${formatCurrency(stats.totalDayChange, state.settings)}`
            : 'N/A'}
          color={stats.totalDayChange >= 0 ? 'bg-teal-500' : 'bg-orange-500'}
          valueColor={hasLivePrices ? (stats.totalDayChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : undefined}
        />
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
                <HeaderCell label="Avg Buy" col="avgBuyPrice" onSort={handleSort} sortIcon={<SortIcon col="avgBuyPrice" />} className="hidden sm:table-cell" />
                <HeaderCell label="CMP" col="currentPrice" onSort={handleSort} sortIcon={<SortIcon col="currentPrice" />} />
                <HeaderCell label="Invested" col="totalInvested" onSort={handleSort} sortIcon={<SortIcon col="totalInvested" />} className="hidden lg:table-cell" />
                <HeaderCell label="Value" col="currentValue" onSort={handleSort} sortIcon={<SortIcon col="currentValue" />} className="hidden lg:table-cell" />
                <HeaderCell label="P&L" col="unrealizedPL" onSort={handleSort} sortIcon={<SortIcon col="unrealizedPL" />} />
                <HeaderCell label="Day" col="dayChangePercent" onSort={handleSort} sortIcon={<SortIcon col="dayChangePercent" />} className="hidden md:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedHoldings.map(h => (
                <HoldingRow key={h.symbol} holding={h} settings={state.settings} loading={pricesLoading && !h.currentPrice} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Portfolio Analytics */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 dark:border-gray-700">
          <div className="flex">
            {(['diversification', 'performance', 'insights'] as AnalyticsTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setAnalyticsTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
                  analyticsTab === tab
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">
          {analyticsTab === 'diversification' && (
            <DiversificationTab stats={stats} settings={state.settings} />
          )}
          {analyticsTab === 'performance' && (
            <PerformanceTab stats={stats} holdings={holdings} settings={state.settings} hasLivePrices={hasLivePrices} />
          )}
          {analyticsTab === 'insights' && (
            <InsightsTab stats={stats} holdings={holdings} tradingStats={tradingStats} settings={state.settings} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────

function SummaryCard({ icon, label, value, color, valueColor, loading }: {
  icon: React.ReactNode; label: string; value: string; color: string; valueColor?: string; loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 text-white ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {loading ? (
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-lg font-bold truncate ${valueColor || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
          )}
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
      className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap ${className || ''}`}
      onClick={() => onSort(col)}
    >
      <span className="flex items-center">{label}{sortIcon}</span>
    </th>
  );
}

function HoldingRow({ holding, settings, loading }: { holding: PortfolioHolding; settings: Settings; loading?: boolean }) {
  const navigate = useNavigate();
  const plColor = (holding.unrealizedPL ?? 0) >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';
  const dayColor = (holding.dayChange ?? 0) >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => navigate(`/portfolio/${holding.symbol}`)}>
      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{holding.symbol}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden md:table-cell truncate max-w-[180px]">{holding.name}</td>
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{holding.quantity}</td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">{formatCurrency(holding.avgBuyPrice, settings)}</td>
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
        {loading ? (
          <span className="inline-block w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : holding.currentPrice != null ? (
          <span>{formatCurrency(holding.currentPrice, settings)}</span>
        ) : (
          <span className="text-gray-400">N/A</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{formatCurrency(holding.totalInvested, settings)}</td>
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 hidden lg:table-cell">
        {holding.currentValue != null ? formatCurrency(holding.currentValue, settings) : <span className="text-gray-400">N/A</span>}
      </td>
      <td className={`px-4 py-3 font-medium ${holding.unrealizedPL != null ? plColor : ''}`}>
        {holding.unrealizedPL != null ? (
          <div className="flex flex-col">
            <span>
              {holding.unrealizedPL >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(holding.unrealizedPL), settings)}
            </span>
            <span className="text-xs opacity-75">
              {holding.unrealizedPL >= 0 ? '+' : ''}{holding.unrealizedPLPercent?.toFixed(2)}%
            </span>
          </div>
        ) : <span className="text-gray-400">N/A</span>}
      </td>
      <td className={`px-4 py-3 hidden md:table-cell ${holding.dayChange != null ? dayColor : ''}`}>
        {holding.dayChangePercent != null ? (
          <span>{holding.dayChangePercent >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%</span>
        ) : <span className="text-gray-400">–</span>}
      </td>
    </tr>
  );
}

// ─── Analytics Tabs ─────────────────────────────────────

function DiversificationTab({ stats, settings }: {
  stats: ReturnType<typeof calculatePortfolioStats>;
  settings: Settings;
}) {
  const { diversification } = stats;
  const hhi = diversification.herfindahlIndex;
  const hhiLabel = hhi < 1500 ? 'Well Diversified' : hhi < 2500 ? 'Moderately Diversified' : 'Concentrated';
  const hhiColor = hhi < 1500 ? 'text-green-600 dark:text-green-400' : hhi < 2500 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* By Asset Class */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Asset Class</h4>
          {diversification.byAssetClass.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={diversification.byAssetClass} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {diversification.byAssetClass.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), settings)}
                      contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 w-full">
                {diversification.byAssetClass.map((item, i) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No data</p>}
        </div>

        {/* By Broker */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">By Broker</h4>
          {diversification.byBroker.length > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={diversification.byBroker} dataKey="value" nameKey="label" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {diversification.byBroker.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[(i + 5) % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), settings)}
                      contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1 w-full">
                {diversification.byBroker.map((item, i) => (
                  <div key={item.label} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[(i + 5) % CHART_COLORS.length] }} />
                      <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                    <span className="text-gray-500 dark:text-gray-400">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-gray-400">No data</p>}
        </div>
      </div>

      {/* Risk indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Concentration Risk</p>
          <p className={`text-2xl font-bold ${diversification.concentrationRisk > 30 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {diversification.concentrationRisk.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {diversification.concentrationRisk > 30
              ? `⚠️ Largest holding is ${diversification.concentrationRisk.toFixed(1)}% of portfolio`
              : '✅ No single holding dominates'}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">HHI Score</p>
          <p className={`text-2xl font-bold ${hhiColor}`}>{Math.round(hhi)}</p>
          <p className={`text-xs mt-1 ${hhiColor}`}>{hhiLabel}</p>
        </div>
      </div>
    </div>
  );
}

function PerformanceTab({ stats, holdings, settings, hasLivePrices }: {
  stats: ReturnType<typeof calculatePortfolioStats>;
  holdings: PortfolioHolding[];
  settings: Settings;
  hasLivePrices: boolean;
}) {
  if (!hasLivePrices) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
        <p>Live prices needed for performance data</p>
        <p className="text-xs mt-1">Refresh prices to see P&amp;L analytics</p>
      </div>
    );
  }

  const plData = holdings
    .filter(h => h.unrealizedPL != null)
    .map(h => ({
      symbol: h.symbol,
      pl: h.unrealizedPL ?? 0,
      plPercent: h.unrealizedPLPercent ?? 0,
    }))
    .sort((a, b) => b.pl - a.pl);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-green-500" /> Top Gainers
          </h4>
          <MiniTable holdings={stats.topGainers} settings={settings} />
        </div>
        {/* Top Losers */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <TrendingDown size={16} className="text-red-500" /> Top Losers
          </h4>
          <MiniTable holdings={stats.topLosers} settings={settings} />
        </div>
      </div>

      {/* P&L Bar Chart */}
      {plData.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">P&amp;L by Holding</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={plData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(1)}K`} />
                <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11 }} width={55} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), settings)}
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="pl" name="P&L" radius={[0, 4, 4, 0]}>
                  {plData.map((entry, i) => (
                    <Cell key={i} fill={entry.pl >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniTable({ holdings, settings }: { holdings: PortfolioHolding[]; settings: Settings }) {
  if (holdings.length === 0) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">No data</p>;
  }
  return (
    <div className="space-y-2">
      {holdings.map(h => (
        <div key={h.symbol} className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-800 dark:text-gray-200">{h.symbol}</span>
          <span className={`font-medium ${(h.unrealizedPLPercent ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {(h.unrealizedPLPercent ?? 0) >= 0 ? '+' : ''}{h.unrealizedPLPercent?.toFixed(2)}%
            <span className="ml-2 text-xs opacity-75">({formatCurrency(Math.abs(h.unrealizedPL ?? 0), settings)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function InsightsTab({ stats, holdings, tradingStats, settings }: {
  stats: ReturnType<typeof calculatePortfolioStats>;
  holdings: PortfolioHolding[];
  tradingStats: ReturnType<typeof calculateTradingStats>;
  settings: Settings;
}) {
  const assetClassCount = stats.diversification.byAssetClass.length;
  const avgHoldingCost = holdings.length > 0 ? stats.totalInvested / holdings.length : 0;
  const chargesPercent = stats.totalInvested > 0 ? (stats.totalCharges / stats.totalInvested) * 100 : 0;

  // Dominant asset class
  const topAsset = stats.diversification.byAssetClass[0];

  // Risk alerts
  const alerts: { type: 'warning' | 'success'; message: string }[] = [];
  if (stats.diversification.concentrationRisk > 30) {
    alerts.push({ type: 'warning', message: `${stats.diversification.concentrationRisk.toFixed(0)}% of portfolio in a single stock` });
  }
  if (assetClassCount <= 1 && holdings.length > 1) {
    alerts.push({ type: 'warning', message: 'No diversification across asset classes' });
  }
  if (assetClassCount > 2) {
    alerts.push({ type: 'success', message: `Well diversified across ${assetClassCount} asset classes` });
  }
  if (stats.diversification.concentrationRisk <= 30 && holdings.length > 3) {
    alerts.push({ type: 'success', message: 'No single holding dominates the portfolio' });
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InsightCard
          label="Primary Investment"
          value={topAsset?.label || 'N/A'}
          sub={topAsset ? `${topAsset.percent.toFixed(1)}% of portfolio` : ''}
          icon={<PieChart size={18} />}
        />
        <InsightCard
          label="Avg Holding Cost"
          value={formatCurrency(avgHoldingCost, settings)}
          sub={`Across ${holdings.length} stocks`}
          icon={<IndianRupee size={18} />}
        />
        <InsightCard
          label="Total Charges Paid"
          value={formatCurrency(stats.totalCharges, settings)}
          sub={`${chargesPercent.toFixed(2)}% of invested`}
          icon={<BarChart3 size={18} />}
        />
      </div>

      {/* Monthly Investment Trend */}
      {tradingStats.monthlyBreakdown.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Monthly Investment Trend</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...tradingStats.monthlyBreakdown].reverse().slice(-12)} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), settings)}
                  contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="buys" name="Buys" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sells" name="Sells" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Risk Alerts */}
      {alerts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Risk Alerts</h4>
          <div className="space-y-2">
            {alerts.map((alert, i) => (
              <div key={i} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                alert.type === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              }`}>
                {alert.type === 'warning' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InsightCard({ label, value, sub, icon }: {
  label: string; value: string; sub: string; icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
