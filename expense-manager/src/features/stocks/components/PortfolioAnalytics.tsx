import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Briefcase, BarChart3, PieChart as PieChartIcon,
  ArrowRight, RefreshCw, Clock, AlertTriangle, Scale, Coins, Activity,
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import { calculateHoldings, enrichHoldingsWithPrices } from '../../../shared/services/stockService';
import { fetchBatchPrices, getAllCachedPrices, fetchIndexPrices, type IndexPrice } from '../../../shared/services/stockPriceService';
import { usePortfolioMetrics } from '../../../shared/hooks/usePortfolioMetrics';
import { EmptyState } from '../../../shared/components/ui/EmptyState';

const SECTOR_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#3b82f6',
];

interface StatCardProps {
  label: string;
  value: string | React.ReactNode;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ label, value, subtext, icon, color, trend }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2`}>
          <span className={`p-2 rounded-lg ${color}`}>
            {icon}
          </span>
          {label}
        </span>
        {trend === 'up' && <TrendingUp size={16} className="text-green-500" />}
        {trend === 'down' && <TrendingDown size={16} className="text-red-500" />}
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {subtext && <p className="text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
    </div>
  );
}

export function PortfolioAnalytics() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [priceMap, setPriceMap] = useState<Map<string, import('../../../shared/services/stockPriceService').StockPrice>>(new Map());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pl' | 'diversification' | 'sectors' | 'dividends' | 'performance' | 'benchmark'>('pl');
  const [indexPrices, setIndexPrices] = useState<IndexPrice[]>([]);

  // Calculate holdings with current prices
  const baseHoldings = useMemo(() => calculateHoldings(state.stockTransactions), [state.stockTransactions]);
  const holdings = useMemo(
    () => enrichHoldingsWithPrices(baseHoldings, priceMap),
    [baseHoldings, priceMap]
  );

  const { plMetrics, diversificationData, sectorBreakdown, concentrationRisk } = usePortfolioMetrics(holdings, state.stockTransactions);

  // Load cached prices on mount
  useEffect(() => {
    if (baseHoldings.length > 0) {
      const cached = getAllCachedPrices();
      if (cached.size > 0) {
        setPriceMap(cached);
        const timestamps = [...cached.values()].map((p: import('../../../shared/services/stockPriceService').StockPrice) => p.lastUpdated).filter(Boolean);
        if (timestamps.length > 0) setLastUpdated(timestamps[0]);
      }
    }
  }, [baseHoldings]);

  const fetchPrices = useCallback(async () => {
    if (baseHoldings.length === 0) return;
    setPricesLoading(true);
    setPriceError(false);
    try {
      const [prices, indices] = await Promise.all([
        fetchBatchPrices(baseHoldings),
        fetchIndexPrices(),
      ]);
      if (prices.size > 0) {
        setPriceMap(prices);
        setLastUpdated(new Date().toISOString());
      } else {
        setPriceError(true);
      }
      if (indices.length > 0) setIndexPrices(indices);
    } catch {
      setPriceError(true);
    } finally {
      setPricesLoading(false);
    }
  }, [baseHoldings]);

  // Auto-fetch prices on mount
  useEffect(() => {
    if (baseHoldings.length > 0) {
      fetchPrices();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio Analytics</h1>
        </div>
        <EmptyState
          icon={<BarChart3 size={32} />}
          title="No Portfolio Data"
          description="Start by importing your trade data or create a portfolio entry"
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

  const hasLivePrices = holdings.some(h => h.currentPrice != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Portfolio Analytics</h1>
        <button
          onClick={fetchPrices}
          disabled={pricesLoading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={pricesLoading ? 'animate-spin' : ''} />
          {pricesLoading ? 'Fetching...' : 'Refresh Prices'}
        </button>
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

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-hide">
        {[
          { id: 'pl', label: 'P&L Summary', icon: <TrendingUp size={16} /> },
          { id: 'diversification', label: 'Allocation', icon: <PieChartIcon size={16} /> },
          { id: 'sectors', label: 'Sectors', icon: <BarChart3 size={16} /> },
          { id: 'dividends', label: 'Dividends', icon: <Coins size={16} /> },
          { id: 'performance', label: 'Performance', icon: <Activity size={16} /> },
          { id: 'benchmark', label: 'Benchmark', icon: <Scale size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* P&L Summary Tab */}
      {activeTab === 'pl' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Invested"
              value={formatCurrency(plMetrics.totalInvested, state.settings)}
              icon={<Briefcase size={20} className="text-white" />}
              color="bg-blue-500"
            />
            <StatCard
              label="Current Value"
              value={formatCurrency(plMetrics.totalCurrentValue, state.settings)}
              icon={<TrendingUp size={20} className="text-white" />}
              color="bg-green-500"
              trend={plMetrics.totalGainLoss >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="Total Gain/Loss"
              value={formatCurrency(plMetrics.totalGainLoss, state.settings)}
              icon={plMetrics.totalGainLoss >= 0 ? <TrendingUp size={20} className="text-white" /> : <TrendingDown size={20} className="text-white" />}
              color={plMetrics.totalGainLoss >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}
              subtext={`${plMetrics.totalGainLossPercent.toFixed(2)}%`}
              trend={plMetrics.totalGainLoss >= 0 ? 'up' : 'down'}
            />
            <StatCard
              label="XIRR (Annual Return)"
              value={plMetrics.xirr != null ? `${(plMetrics.xirr * 100).toFixed(1)}%` : '—'}
              icon={<BarChart3 size={20} className="text-white" />}
              color="bg-purple-500"
              subtext={plMetrics.xirr != null ? 'True annualized return' : 'Need more data'}
              trend={plMetrics.xirr != null && plMetrics.xirr > 0 ? 'up' : plMetrics.xirr != null && plMetrics.xirr < 0 ? 'down' : 'neutral'}
            />
          </div>

          {/* Realized vs Unrealized P&L */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Unrealized P&L</p>
              <p className={`text-xl font-bold mt-1 ${plMetrics.unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {plMetrics.unrealizedPL >= 0 ? '+' : ''}{formatCurrency(plMetrics.unrealizedPL, state.settings)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Open positions</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Realized P&L</p>
              <p className={`text-xl font-bold mt-1 ${plMetrics.realizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {plMetrics.realizedPL >= 0 ? '+' : ''}{formatCurrency(plMetrics.realizedPL, state.settings)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Closed trades</p>
            </div>
            <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Dividend Income</p>
              <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(plMetrics.dividendIncome, state.settings)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Total dividends received</p>
            </div>
          </div>

          {/* Top Gainers & Losers */}
          {(plMetrics.topGainers.length > 0 || plMetrics.topLosers.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {plMetrics.topGainers.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <TrendingUp size={16} className="text-green-500" /> Top Gainers
                  </h4>
                  <div className="space-y-3">
                    {plMetrics.topGainers.map(stock => (
                      <div key={stock.symbol} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stock.symbol}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[120px]">{stock.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                            +{formatCurrency(stock.pl, state.settings)}
                          </p>
                          <p className="text-xs text-green-500">+{stock.plPercent.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {plMetrics.topLosers.length > 0 && (
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <TrendingDown size={16} className="text-red-500" /> Top Losers
                  </h4>
                  <div className="space-y-3">
                    {plMetrics.topLosers.map(stock => (
                      <div key={stock.symbol} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stock.symbol}</p>
                          <p className="text-xs text-gray-500 truncate max-w-[120px]">{stock.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(stock.pl, state.settings)}
                          </p>
                          <p className="text-xs text-red-500">{stock.plPercent.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Holdings Table */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Stock</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Avg Buy</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Current</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {holdings.map(holding => (
                    <tr key={holding.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{holding.symbol}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{holding.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-300">{holding.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-300">₹{holding.avgBuyPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-300">
                        {holding.currentPrice != null ? `₹${holding.currentPrice.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        (holding.unrealizedPL ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      }`}>
                        {holding.unrealizedPL != null
                          ? `${holding.unrealizedPL >= 0 ? '+' : ''}${formatCurrency(holding.unrealizedPL, state.settings)}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Diversification Tab */}
      {activeTab === 'diversification' && (
        <div className="space-y-4">
          {/* Concentration Risk Alert */}
          {concentrationRisk.length > 0 && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Concentration Risk</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {concentrationRisk.map(r => `${r.symbol} (${r.percent.toFixed(1)}%)`).join(', ')}
                  {' '}— Single stock exceeds 20% of portfolio. Consider diversifying.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Allocation by Stock</h3>
            {diversificationData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <RePieChart>
                  <Pie
                    data={diversificationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {diversificationData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number, state.settings)}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No data available</p>
            )}
          </div>
        </div>
      )}

      {/* Sectors Tab */}
      {activeTab === 'sectors' && (
        <div className="space-y-6">
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sector Allocation</h3>
            <div className="space-y-4">
              {sectorBreakdown.map((sector, idx) => (
                <div key={sector.sector} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length] }} />
                      <span className="font-medium text-gray-900 dark:text-white">{sector.sector}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{sector.percent.toFixed(1)}%</span>
                      <span className={`font-semibold ${sector.gainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {sector.gainLoss >= 0 ? '+' : ''}{formatCurrency(sector.gainLoss, state.settings)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${sector.percent}%`,
                        backgroundColor: SECTOR_COLORS[idx % SECTOR_COLORS.length],
                      }}
                    />
                  </div>

                  {/* Top 3 stocks in sector */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {sector.topStocks.map(stock => (
                      <div key={stock.symbol} className="flex justify-between pl-5">
                        <span>{stock.symbol}</span>
                        <span>{stock.percent.toFixed(1)}% • {formatCurrency(stock.value, state.settings)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Tab */}
      {activeTab === 'benchmark' && (
        <BenchmarkTab
          indexPrices={indexPrices}
          plMetrics={plMetrics}
          holdings={holdings}
          settings={state.settings}
          hasLivePrices={holdings.some(h => h.currentPrice != null)}
        />
      )}

      {/* Dividends Tab */}
      {activeTab === 'dividends' && (
        <DividendsTab
          stockTransactions={state.stockTransactions}
          holdings={holdings}
          settings={state.settings}
        />
      )}

      {/* Performance Tab — Holdings Heatmap & Day Change */}
      {activeTab === 'performance' && (
        <PerformanceTab
          holdings={holdings}
          plMetrics={plMetrics}
          settings={state.settings}
        />
      )}

      {/* Action button to portfolio */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/portfolio')}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          <Briefcase size={16} />
          View Full Portfolio
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Benchmark Comparison Tab ───────────────────────────

import type { Settings, PortfolioHolding, StockTransaction } from '../../../shared/types';
import type { PLMetrics } from '../../../shared/hooks/usePortfolioMetrics';

function BenchmarkTab({ indexPrices, plMetrics, holdings, settings, hasLivePrices }: {
  indexPrices: IndexPrice[];
  plMetrics: PLMetrics;
  holdings: PortfolioHolding[];
  settings: Settings;
  hasLivePrices: boolean;
}) {
  // Portfolio day change %
  const portfolioDayChange = useMemo(() => {
    if (!hasLivePrices) return 0;
    let totalDayChange = 0;
    let totalPrevValue = 0;
    for (const h of holdings) {
      if (h.currentPrice != null && h.dayChange != null) {
        totalDayChange += h.dayChange * h.quantity;
        totalPrevValue += (h.currentPrice - h.dayChange) * h.quantity;
      }
    }
    return totalPrevValue > 0 ? (totalDayChange / totalPrevValue) * 100 : 0;
  }, [holdings, hasLivePrices]);

  // Comparison bar chart data
  const comparisonData = useMemo(() => {
    const data: { name: string; dayChange: number; fill: string }[] = [
      {
        name: 'Your Portfolio',
        dayChange: Math.round(portfolioDayChange * 100) / 100,
        fill: portfolioDayChange >= 0 ? '#10b981' : '#ef4444',
      },
    ];
    for (const idx of indexPrices) {
      data.push({
        name: idx.name,
        dayChange: idx.changePercent,
        fill: idx.changePercent >= 0 ? '#6366f1' : '#f97316',
      });
    }
    return data;
  }, [portfolioDayChange, indexPrices]);

  const portfolioReturnPercent = plMetrics.totalGainLossPercent;

  if (indexPrices.length === 0 && !hasLivePrices) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <Scale size={40} className="mx-auto mb-3 opacity-50" />
        <p>Benchmark data unavailable</p>
        <p className="text-xs mt-1">Refresh prices to load Nifty 50 &amp; Sensex data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Day Performance Comparison */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today&apos;s Performance</h3>

        {/* Visual comparison cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
         <ComparisonCard
           label="Your Portfolio"
           change={portfolioDayChange}
           sublabel={hasLivePrices ? `Value: ${formatCurrency(plMetrics.totalCurrentValue, settings)}` : 'Prices not loaded'}
           highlight
         />
         {indexPrices.map(idx => (
           <ComparisonCard
             key={idx.symbol}
             label={idx.name}
             change={idx.changePercent}
             sublabel={`${idx.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
           />
         ))}
        </div>

        {/* Bar chart */}
        {comparisonData.length > 1 && (
         <div className="h-56">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={comparisonData} layout="vertical" margin={{ left: 100, right: 30 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
               <XAxis
                 type="number"
                 tick={{ fontSize: 11 }}
                 tickFormatter={v => `${v}%`}
                 domain={['auto', 'auto']}
               />
               <YAxis
                 type="category"
                 dataKey="name"
                 tick={{ fontSize: 12 }}
                 width={95}
               />
               <Tooltip
                 formatter={(value) => `${Number(value).toFixed(2)}%`}
                 contentStyle={{
                   backgroundColor: 'var(--tooltip-bg, #fff)',
                   border: '1px solid #e5e7eb',
                   borderRadius: '8px',
                   fontSize: '12px',
                 }}
               />
               <Bar dataKey="dayChange" name="Day Change %" radius={[0, 4, 4, 0]}>
                 {comparisonData.map((entry, i) => (
                   <Cell key={i} fill={entry.fill} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
         </div>
        )}
      </div>

      {/* Overall Return Comparison */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Overall Portfolio Returns</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
         <div className="space-y-3">
           <div className="flex items-center justify-between">
             <span className="text-sm text-gray-600 dark:text-gray-400">Total Invested</span>
             <span className="font-semibold text-gray-900 dark:text-gray-100">
               {formatCurrency(plMetrics.totalInvested, settings)}
             </span>
           </div>
           <div className="flex items-center justify-between">
             <span className="text-sm text-gray-600 dark:text-gray-400">Current Value</span>
             <span className="font-semibold text-gray-900 dark:text-gray-100">
               {hasLivePrices ? formatCurrency(plMetrics.totalCurrentValue, settings) : 'N/A'}
             </span>
           </div>
           <div className="border-t border-gray-200 dark:border-gray-700 pt-3 flex items-center justify-between">
             <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Return</span>
             <span className={`text-lg font-bold ${
               portfolioReturnPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
             }`}>
               {hasLivePrices
                 ? `${portfolioReturnPercent >= 0 ? '+' : ''}${portfolioReturnPercent.toFixed(2)}%`
                 : 'N/A'}
             </span>
           </div>
         </div>

         {/* Benchmark levels */}
         <div className="space-y-3">
           <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Index Levels</h4>
           {indexPrices.length > 0 ? indexPrices.map(idx => (
             <div key={idx.symbol} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
               <div className="flex items-center justify-between">
                 <span className="font-medium text-gray-900 dark:text-gray-100">{idx.name}</span>
                 <span className="font-bold text-gray-900 dark:text-gray-100">
                   {idx.currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                 </span>
               </div>
               <div className="flex items-center justify-between mt-1">
                 <span className="text-xs text-gray-500 dark:text-gray-400">
                   Prev: {idx.previousClose.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                 </span>
                 <span className={`text-xs font-medium ${
                   idx.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                 }`}>
                   {idx.change >= 0 ? '+' : ''}{idx.change.toFixed(2)} ({idx.changePercent.toFixed(2)}%)
                 </span>
               </div>
               {/* Day range bar */}
               {idx.dayHigh > idx.dayLow && (
                 <div className="mt-2">
                   <div className="relative h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                     <div className="absolute h-1.5 bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full w-full" />
                     <div
                       className="absolute top-1/2 w-2 h-2 bg-white dark:bg-gray-900 border-2 border-primary-500 rounded-full"
                       style={{
                         left: `${Math.max(0, Math.min(100, ((idx.currentPrice - idx.dayLow) / (idx.dayHigh - idx.dayLow)) * 100))}%`,
                         transform: 'translate(-50%, -50%)',
                       }}
                     />
                   </div>
                   <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                     <span>{idx.dayLow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                     <span>{idx.dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                   </div>
                 </div>
               )}
             </div>
           )) : (
             <p className="text-sm text-gray-400 dark:text-gray-500">
               Index data will appear after prices.json includes ^NSEI and ^BSESN.
               Push the updated stock-symbols.json and wait for the next GitHub Action run.
             </p>
           )}
         </div>
        </div>
      </div>

      {/* Beat/Trail indicator */}
      {hasLivePrices && indexPrices.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
         <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Today&apos;s Verdict</h3>
         <div className="space-y-3">
           {indexPrices.map(idx => {
             const diff = portfolioDayChange - idx.changePercent;
             const beating = diff > 0;
             const tied = Math.abs(diff) < 0.01;
             return (
               <div key={idx.symbol} className={`flex items-center justify-between rounded-xl p-4 ${
                 tied
                   ? 'bg-gray-50 dark:bg-gray-700/30'
                   : beating
                   ? 'bg-green-50 dark:bg-green-900/20'
                   : 'bg-red-50 dark:bg-red-900/20'
               }`}>
                 <div className="flex items-center gap-3">
                   {tied ? (
                     <Scale size={20} className="text-gray-500" />
                   ) : beating ? (
                     <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
                   ) : (
                     <TrendingDown size={20} className="text-red-600 dark:text-red-400" />
                   )}
                   <div>
                     <p className={`font-medium ${
                       tied ? 'text-gray-700 dark:text-gray-300'
                         : beating ? 'text-green-700 dark:text-green-400'
                         : 'text-red-700 dark:text-red-400'
                     }`}>
                       {tied ? 'Matching' : beating ? 'Beating' : 'Trailing'} {idx.name}
                     </p>
                     <p className="text-xs text-gray-500 dark:text-gray-400">
                       Portfolio {portfolioDayChange >= 0 ? '+' : ''}{portfolioDayChange.toFixed(2)}%
                       vs {idx.name} {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
                     </p>
                   </div>
                 </div>
                 <span className={`text-lg font-bold ${
                   tied ? 'text-gray-600 dark:text-gray-400'
                     : beating ? 'text-green-600 dark:text-green-400'
                     : 'text-red-600 dark:text-red-400'
                 }`}>
                   {diff >= 0 ? '+' : ''}{diff.toFixed(2)}%
                 </span>
               </div>
             );
           })}
         </div>
        </div>
      )}
    </div>
  );
}

function ComparisonCard({ label, change, sublabel, highlight }: {
  label: string; change: number; sublabel: string; highlight?: boolean;
}) {
  const isPositive = change >= 0;
  return (
    <div className={`rounded-xl border p-4 ${
      highlight
        ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
    }`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${
        isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}>
        {isPositive ? '+' : ''}{change.toFixed(2)}%
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sublabel}</p>
    </div>
  );
}

// ─── Dividends Tab ──────────────────────────────────────

function DividendsTab({ stockTransactions, holdings, settings }: {
  stockTransactions: StockTransaction[];
  holdings: PortfolioHolding[];
  settings: Settings;
}) {
  const dividendTxns = useMemo(
    () => stockTransactions
      .filter(t => t.type === 'dividend' && !t.isDeleted)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [stockTransactions]
  );

  const totalDividends = useMemo(
    () => dividendTxns.reduce((sum, t) => sum + t.totalValue, 0),
    [dividendTxns]
  );

  // Dividends by stock
  const byStock = useMemo(() => {
    const map = new Map<string, { symbol: string; name: string; total: number; count: number }>();
    for (const t of dividendTxns) {
      const existing = map.get(t.symbol) || { symbol: t.symbol, name: t.name, total: 0, count: 0 };
      existing.total += t.totalValue;
      existing.count++;
      map.set(t.symbol, existing);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [dividendTxns]);

  // Dividend yield per stock (annual dividend / current value)
  const yieldData = useMemo(() => {
    return byStock.map(s => {
      const holding = holdings.find(h => h.symbol === s.symbol);
      const currentValue = holding?.currentValue ?? holding?.totalInvested ?? 0;
      const yieldPercent = currentValue > 0 ? (s.total / currentValue) * 100 : 0;
      return { ...s, yieldPercent, currentValue };
    });
  }, [byStock, holdings]);

  // Annual chart data
  const annualData = useMemo(() => {
    const yearMap = new Map<string, number>();
    for (const t of dividendTxns) {
      const year = t.date.substring(0, 4);
      yearMap.set(year, (yearMap.get(year) || 0) + t.totalValue);
    }
    return [...yearMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, amount]) => ({ year, amount }));
  }, [dividendTxns]);

  if (dividendTxns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <Coins size={40} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">No dividend records</p>
        <p className="text-xs mt-1">Dividends from your holdings will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5">
          <p className="text-sm text-emerald-700 dark:text-emerald-400">Total Dividend Income</p>
          <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">
            {formatCurrency(totalDividends, settings)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Dividend Stocks</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{byStock.length}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Payouts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{dividendTxns.length}</p>
        </div>
      </div>

      {/* Annual Dividend Chart */}
      {annualData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Annual Dividend Income</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip
                formatter={(value) => formatCurrency(value as number, settings)}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} name="Dividends" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Dividend Yield by Stock */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dividend Yield by Stock</h3>
        <div className="space-y-3">
          {yieldData.map(stock => (
            <div key={stock.symbol} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{stock.symbol}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{stock.count} payout{stock.count > 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(stock.total, settings)}
                </p>
                <p className="text-xs text-gray-500">Yield: {stock.yieldPercent.toFixed(2)}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dividend History */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dividend History</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {dividendTxns.map(txn => (
            <div key={txn.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{txn.symbol}</p>
                <p className="text-xs text-gray-500">{new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(txn.totalValue, settings)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Performance Tab ────────────────────────────────────

function PerformanceTab({ holdings, plMetrics, settings }: {
  holdings: PortfolioHolding[];
  plMetrics: PLMetrics;
  settings: Settings;
}) {
  const hasLivePrices = holdings.some(h => h.currentPrice != null);

  // Portfolio day change
  const dayChange = useMemo(() => {
    let totalChange = 0;
    let totalPrevValue = 0;
    for (const h of holdings) {
      if (h.currentPrice != null && h.dayChange != null) {
        totalChange += h.dayChange * h.quantity;
        totalPrevValue += (h.currentPrice - h.dayChange) * h.quantity;
      }
    }
    return {
      amount: totalChange,
      percent: totalPrevValue > 0 ? (totalChange / totalPrevValue) * 100 : 0,
    };
  }, [holdings]);

  // Sort holdings for heatmap by P&L%
  const heatmapData = useMemo(() => {
    return holdings
      .filter(h => h.currentPrice != null)
      .map(h => ({
        symbol: h.symbol,
        name: h.name,
        plPercent: h.unrealizedPLPercent ?? 0,
        pl: h.unrealizedPL ?? 0,
        currentValue: h.currentValue ?? h.totalInvested,
        dayChangePercent: h.dayChangePercent ?? 0,
      }))
      .sort((a, b) => b.plPercent - a.plPercent);
  }, [holdings]);

  // P&L bar chart data
  const plBarData = useMemo(() => {
    return holdings
      .filter(h => h.unrealizedPL != null)
      .map(h => ({
        symbol: h.symbol,
        pl: h.unrealizedPL!,
        fill: (h.unrealizedPL ?? 0) >= 0 ? '#10b981' : '#ef4444',
      }))
      .sort((a, b) => b.pl - a.pl);
  }, [holdings]);

  if (!hasLivePrices) {
    return (
      <div className="text-center py-12 text-gray-400 dark:text-gray-500">
        <Activity size={40} className="mx-auto mb-3 opacity-50" />
        <p className="font-medium">Price data unavailable</p>
        <p className="text-xs mt-1">Refresh prices to see performance metrics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Day Change & Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`rounded-2xl p-5 border ${
          dayChange.amount >= 0
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <p className="text-sm text-gray-600 dark:text-gray-400">Today's Change</p>
          <p className={`text-2xl font-bold mt-1 ${
            dayChange.amount >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {dayChange.amount >= 0 ? '+' : ''}{formatCurrency(dayChange.amount, settings)}
          </p>
          <p className={`text-sm font-medium ${
            dayChange.percent >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
          }`}>
            {dayChange.percent >= 0 ? '↑' : '↓'} {Math.abs(dayChange.percent).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Portfolio Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {formatCurrency(plMetrics.totalCurrentValue, settings)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Winning Stocks</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{plMetrics.profitableHoldings}</p>
          <p className="text-xs text-gray-400">of {holdings.length} holdings</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Losing Stocks</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{plMetrics.losingHoldings}</p>
          <p className="text-xs text-gray-400">of {holdings.length} holdings</p>
        </div>
      </div>

      {/* Holdings Heatmap */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Holdings Heatmap</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {heatmapData.map(stock => {
            const intensity = Math.min(Math.abs(stock.plPercent) / 50, 1);
            const isPositive = stock.plPercent >= 0;
            return (
              <div
                key={stock.symbol}
                className="rounded-xl p-4 text-center transition-transform hover:scale-105"
                style={{
                  backgroundColor: isPositive
                    ? `rgba(16, 185, 129, ${0.1 + intensity * 0.4})`
                    : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`,
                }}
              >
                <p className="font-bold text-sm text-gray-900 dark:text-white">{stock.symbol}</p>
                <p className={`text-lg font-bold mt-1 ${
                  isPositive ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {isPositive ? '+' : ''}{stock.plPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {formatCurrency(stock.pl, settings)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* P&L Bar Chart */}
      {plBarData.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">P&L by Stock</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={plBarData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis type="category" dataKey="symbol" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} />
              <Tooltip
                formatter={(value) => formatCurrency(value as number, settings)}
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                labelStyle={{ color: '#fff' }}
              />
              <Bar dataKey="pl" name="P&L" radius={[0, 6, 6, 0]}>
                {plBarData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
