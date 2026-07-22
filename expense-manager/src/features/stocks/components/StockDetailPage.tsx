import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, IndianRupee, RefreshCw,
  Clock, AlertTriangle, ArrowUpRight, ArrowDownRight, BarChart3,
  Target, Calendar, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useAppContext } from '../../../context/AppContext';
import { formatCurrency } from '../../../shared/utils/helpers';
import { calculateHoldings, enrichHoldingsWithPrices } from '../../../shared/services/stockService';
import { fetchStockPrice, getCachedPrice, type StockPrice } from '../../../shared/services/stockPriceService';
import type { StockTransaction, Settings } from '../../../shared/types';

export function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { state } = useAppContext();

  const [price, setPrice] = useState<StockPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);

  // All transactions for this symbol
  const transactions = useMemo(() =>
    state.stockTransactions
      .filter(t => t.symbol === symbol)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [state.stockTransactions, symbol]
  );

  // Current holding for this symbol
  const holding = useMemo(() => {
    const all = calculateHoldings(state.stockTransactions);
    const base = all.find(h => h.symbol === symbol);
    if (!base || !price) return base ?? null;
    const enriched = enrichHoldingsWithPrices([base], new Map([[symbol!, price]]));
    return enriched[0] ?? base;
  }, [state.stockTransactions, symbol, price]);

  // Load cached price on mount
  useEffect(() => {
    if (symbol) {
      const cached = getCachedPrice(symbol);
      if (cached) setPrice(cached);
    }
  }, [symbol]);

  const fetchPrice = useCallback(async () => {
    if (!symbol) return;
    setPriceLoading(true);
    setPriceError(false);
    try {
      const p = await fetchStockPrice(symbol);
      if (p) {
        setPrice(p);
      } else {
        setPriceError(true);
      }
    } catch {
      setPriceError(true);
    } finally {
      setPriceLoading(false);
    }
  }, [symbol]);

  // Auto-fetch on mount
  useEffect(() => {
    if (symbol) fetchPrice();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!symbol) {
    return <p className="text-gray-500 dark:text-gray-400 p-6">Invalid stock symbol</p>;
  }

  // Compute stats from transactions
  const txnStats = useMemo(() => {
    let totalBought = 0;
    let totalSold = 0;
    let totalDividends = 0;
    let totalCharges = 0;
    let buyCount = 0;
    let sellCount = 0;
    const firstDate = transactions.length > 0 ? transactions[transactions.length - 1].date : null;

    for (const t of transactions) {
      totalCharges += t.charges.total;
      if (t.type === 'buy' || t.type === 'ipo') {
        totalBought += t.totalValue;
        buyCount++;
      } else if (t.type === 'sell') {
        totalSold += t.totalValue;
        sellCount++;
      } else if (t.type === 'dividend') {
        totalDividends += t.totalValue;
      }
    }

    return { totalBought, totalSold, totalDividends, totalCharges, buyCount, sellCount, firstDate };
  }, [transactions]);

  // Monthly investment timeline for bar chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; bought: number; sold: number }>();
    for (const t of transactions) {
      const month = t.date.substring(0, 7);
      if (!map.has(month)) map.set(month, { month, bought: 0, sold: 0 });
      const entry = map.get(month)!;
      if (t.type === 'buy' || t.type === 'ipo') entry.bought += t.totalValue;
      else if (t.type === 'sell') entry.sold += t.totalValue;
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [transactions]);

  const stockName = holding?.name || transactions[0]?.name || symbol;

  const formatTs = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => navigate('/portfolio')}
          className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-fit"
        >
          <ArrowLeft size={16} />
          Back to Portfolio
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{symbol}</h1>
              {holding?.exchange && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                  {holding.exchange}
                </span>
              )}
              {holding?.assetClass && holding.assetClass !== 'equity' && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                  {holding.assetClass.replace('_', ' ').toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{stockName}</p>
          </div>

          {/* Current Price */}
          <div className="flex items-center gap-4">
            {price ? (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ₹{price.currentPrice.toFixed(2)}
                </p>
                <p className={`text-sm font-medium flex items-center gap-1 justify-end ${
                  price.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {price.change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {price.change >= 0 ? '+' : ''}{price.change.toFixed(2)} ({price.changePercent.toFixed(2)}%)
                </p>
              </div>
            ) : priceLoading ? (
              <div className="h-12 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : null}
            <button
              onClick={fetchPrice}
              disabled={priceLoading}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh price"
            >
              <RefreshCw size={16} className={priceLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Price freshness */}
      {price?.lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
          <Clock size={12} /> Price updated: {formatTs(price.lastUpdated)}
          {price.source === 'cache' && <span className="text-amber-500"> (cached)</span>}
        </p>
      )}
      {priceError && !price && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <AlertTriangle size={16} />
          Live price unavailable for {symbol}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard
          icon={<IndianRupee size={18} />}
          label="Total Invested"
          value={holding ? formatCurrency(holding.totalInvested, state.settings) : '—'}
          color="bg-blue-500"
        />
        <InfoCard
          icon={<BarChart3 size={18} />}
          label="Current Value"
          value={holding?.currentValue != null ? formatCurrency(holding.currentValue, state.settings) : 'N/A'}
          color="bg-emerald-500"
        />
        <InfoCard
          icon={holding?.unrealizedPL != null && holding.unrealizedPL >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          label="Unrealized P&L"
          value={holding?.unrealizedPL != null
            ? `${holding.unrealizedPL >= 0 ? '+' : ''}${formatCurrency(holding.unrealizedPL, state.settings)}`
            : 'N/A'}
          sub={holding?.unrealizedPLPercent != null ? `${holding.unrealizedPLPercent >= 0 ? '+' : ''}${holding.unrealizedPLPercent.toFixed(2)}%` : undefined}
          color={holding?.unrealizedPL != null && holding.unrealizedPL >= 0 ? 'bg-green-500' : 'bg-red-500'}
          valueColor={holding?.unrealizedPL != null
            ? (holding.unrealizedPL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
            : undefined}
        />
        <InfoCard
          icon={<Target size={18} />}
          label="Avg Buy Price"
          value={holding ? `₹${holding.avgBuyPrice.toFixed(2)}` : '—'}
          sub={holding ? `${holding.quantity} shares` : undefined}
          color="bg-purple-500"
        />
      </div>

      {/* Price Details (Day High/Low, Previous Close) */}
      {price && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Price Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <PriceDetail label="Previous Close" value={`₹${price.previousClose.toFixed(2)}`} />
            <PriceDetail label="Day High" value={`₹${price.dayHigh.toFixed(2)}`} />
            <PriceDetail label="Day Low" value={`₹${price.dayLow.toFixed(2)}`} />
            <PriceDetail
              label="Day Range"
              value={`₹${price.dayLow.toFixed(0)} – ₹${price.dayHigh.toFixed(0)}`}
            />
          </div>

          {/* Day range bar */}
          {price.dayHigh > price.dayLow && (
            <div className="mt-4">
              <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div
                  className="absolute h-2 bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full"
                  style={{ width: '100%' }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-gray-900 border-2 border-primary-500 rounded-full shadow"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((price.currentPrice - price.dayLow) / (price.dayHigh - price.dayLow)) * 100))}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>₹{price.dayLow.toFixed(2)}</span>
                <span>₹{price.dayHigh.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trading Stats */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Layers size={16} /> Trading Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatItem label="Total Bought" value={formatCurrency(txnStats.totalBought, state.settings)} />
          <StatItem label="Total Sold" value={formatCurrency(txnStats.totalSold, state.settings)} />
          <StatItem label="Dividends" value={formatCurrency(txnStats.totalDividends, state.settings)} />
          <StatItem label="Total Charges" value={formatCurrency(txnStats.totalCharges, state.settings)} />
          <StatItem label="Buy Trades" value={String(txnStats.buyCount)} />
          <StatItem label="Sell Trades" value={String(txnStats.sellCount)} />
        </div>
        {txnStats.firstDate && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 flex items-center gap-1">
            <Calendar size={12} />
            First trade: {new Date(txnStats.firstDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Monthly Investment Timeline */}
      {monthlyData.length > 1 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Investment Timeline</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), state.settings)}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, #fff)',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="bought" name="Bought" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sold" name="Sold" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Transaction History ({transactions.length})
          </h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 p-6 text-center">No transactions found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Qty</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Price</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right">Total</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase text-right hidden sm:table-cell">Charges</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.map(txn => (
                  <TxnRow key={txn.id} txn={txn} settings={state.settings} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charges Breakdown (if any) */}
      {txnStats.totalCharges > 0 && (
        <ChargesBreakdown transactions={transactions} settings={state.settings} />
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────

function InfoCard({ icon, label, value, sub, color, valueColor }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 text-white ${color}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-lg font-bold truncate ${valueColor || 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function PriceDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

const TRADE_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  buy: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'BUY' },
  sell: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'SELL' },
  dividend: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'DIV' },
  bonus: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'BONUS' },
  split: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'SPLIT' },
  ipo: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400', label: 'IPO' },
};

function TxnRow({ txn, settings }: { txn: StockTransaction; settings: Settings }) {
  const style = TRADE_TYPE_STYLES[txn.type] || TRADE_TYPE_STYLES.buy;

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
      <td className="px-4 py-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
        {new Date(txn.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">{txn.quantity}</td>
      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₹{txn.price.toFixed(2)}</td>
      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
        {formatCurrency(txn.totalValue, settings)}
      </td>
      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">
        {txn.charges.total > 0 ? formatCurrency(txn.charges.total, settings) : '—'}
      </td>
      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell truncate max-w-[200px]">
        {txn.notes || '—'}
      </td>
    </tr>
  );
}

function ChargesBreakdown({ transactions, settings }: { transactions: StockTransaction[]; settings: Settings }) {
  const totals = useMemo(() => {
    const result = { brokerage: 0, stt: 0, gst: 0, stampDuty: 0, exchangeCharges: 0, sebiCharges: 0, otherCharges: 0, total: 0 };
    for (const t of transactions) {
      result.brokerage += t.charges.brokerage;
      result.stt += t.charges.stt;
      result.gst += t.charges.gst;
      result.stampDuty += t.charges.stampDuty;
      result.exchangeCharges += t.charges.exchangeCharges;
      result.sebiCharges += t.charges.sebiCharges;
      result.otherCharges += t.charges.otherCharges;
      result.total += t.charges.total;
    }
    return result;
  }, [transactions]);

  const chargeItems = [
    { label: 'Brokerage', value: totals.brokerage },
    { label: 'STT', value: totals.stt },
    { label: 'GST', value: totals.gst },
    { label: 'Stamp Duty', value: totals.stampDuty },
    { label: 'Exchange Charges', value: totals.exchangeCharges },
    { label: 'SEBI Charges', value: totals.sebiCharges },
    { label: 'Other', value: totals.otherCharges },
  ].filter(c => c.value > 0);

  if (chargeItems.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Charges Breakdown</h3>
      <div className="space-y-2">
        {chargeItems.map(item => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {formatCurrency(item.value, settings)}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700 dark:text-gray-300">Total Charges</span>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(totals.total, settings)}
          </span>
        </div>
      </div>
    </div>
  );
}
