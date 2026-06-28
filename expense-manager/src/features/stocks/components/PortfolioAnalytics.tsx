import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Briefcase, BarChart3, PieChart as PieChartIcon,
  ArrowRight, RefreshCw, Clock, AlertTriangle,
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import { calculateHoldings, enrichHoldingsWithPrices } from '../../../shared/services/stockService';
import { fetchBatchPrices, getAllCachedPrices } from '../../../shared/services/stockPriceService';
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
  const [activeTab, setActiveTab] = useState<'pl' | 'diversification' | 'sectors'>('pl');

  // Calculate holdings with current prices
  const baseHoldings = useMemo(() => calculateHoldings(state.stockTransactions), [state.stockTransactions]);
  const holdings = useMemo(
    () => enrichHoldingsWithPrices(baseHoldings, priceMap),
    [baseHoldings, priceMap]
  );

  const { plMetrics, diversificationData, sectorBreakdown } = usePortfolioMetrics(holdings);

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
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'pl', label: 'P&L Summary', icon: <TrendingUp size={16} /> },
          { id: 'diversification', label: 'Diversification', icon: <PieChartIcon size={16} /> },
          { id: 'sectors', label: 'By Sector', icon: <BarChart3 size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'pl' | 'diversification' | 'sectors')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
              label="Holdings"
              value={`${plMetrics.profitableHoldings}/${holdings.length}`}
              icon={<BarChart3 size={20} className="text-white" />}
              color="bg-purple-500"
              subtext={`${plMetrics.losingHoldings} losing`}
            />
          </div>

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
                    <tr key={holding.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
