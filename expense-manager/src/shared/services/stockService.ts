import { StockTransaction, PortfolioHolding, AssetClass } from '../types';
import { StockPrice } from './stockPriceService';

interface BuyLot {
  quantity: number;
  price: number;
  charges: number;
}

/**
 * Calculate current portfolio holdings from transaction history using FIFO method.
 * For each symbol, tracks buy lots and reduces them on sells.
 */
export function calculateHoldings(transactions: StockTransaction[]): PortfolioHolding[] {
  // Sort by date ascending for FIFO
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  // Group by symbol
  const symbolMap = new Map<string, {
    name: string;
    exchange: StockTransaction['exchange'];
    assetClass: AssetClass;
    broker: string;
    buyLots: BuyLot[];
    totalCharges: number;
  }>();

  for (const txn of sorted) {
    if (!symbolMap.has(txn.symbol)) {
      symbolMap.set(txn.symbol, {
        name: txn.name,
        exchange: txn.exchange,
        assetClass: txn.assetClass,
        broker: txn.broker,
        buyLots: [],
        totalCharges: 0,
      });
    }
    const entry = symbolMap.get(txn.symbol)!;
    entry.totalCharges += txn.charges.total;

    if (txn.type === 'buy' || txn.type === 'ipo') {
      entry.buyLots.push({
        quantity: txn.quantity,
        price: txn.price,
        charges: txn.charges.total,
      });
    } else if (txn.type === 'sell') {
      let remaining = txn.quantity;
      // FIFO: consume oldest lots first
      while (remaining > 0 && entry.buyLots.length > 0) {
        const lot = entry.buyLots[0];
        if (lot.quantity <= remaining) {
          remaining -= lot.quantity;
          entry.buyLots.shift();
        } else {
          lot.quantity -= remaining;
          remaining = 0;
        }
      }
    } else if (txn.type === 'bonus' || txn.type === 'split') {
      // Bonus/split adds shares at zero cost
      entry.buyLots.push({
        quantity: txn.quantity,
        price: 0,
        charges: 0,
      });
    }
    // dividends don't affect quantity
  }

  const holdings: PortfolioHolding[] = [];
  for (const [symbol, entry] of symbolMap) {
    const totalQty = entry.buyLots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (totalQty <= 0) continue;

    const totalInvested = entry.buyLots.reduce((sum, lot) => sum + lot.quantity * lot.price, 0);
    const avgBuyPrice = totalInvested / totalQty;

    holdings.push({
      symbol,
      name: entry.name,
      exchange: entry.exchange,
      assetClass: entry.assetClass,
      quantity: totalQty,
      avgBuyPrice: Math.round(avgBuyPrice * 100) / 100,
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalCharges: Math.round(entry.totalCharges * 100) / 100,
      broker: entry.broker,
    });
  }

  return holdings.sort((a, b) => b.totalInvested - a.totalInvested);
}

export interface PortfolioStats {
  totalInvested: number;
  totalCurrentValue: number;
  totalUnrealizedPL: number;
  totalUnrealizedPLPercent: number;
  totalDayChange: number;
  totalCharges: number;
  holdingCount: number;
  topHoldings: PortfolioHolding[];
  topGainers: PortfolioHolding[];
  topLosers: PortfolioHolding[];
  diversification: {
    byAssetClass: { label: string; value: number; percent: number }[];
    byBroker: { label: string; value: number; percent: number }[];
    concentrationRisk: number;
    herfindahlIndex: number;
  };
}

export function calculatePortfolioStats(holdings: PortfolioHolding[]): PortfolioStats {
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  const totalCharges = holdings.reduce((sum, h) => sum + h.totalCharges, 0);
  const topHoldings = [...holdings].sort((a, b) => b.totalInvested - a.totalInvested).slice(0, 5);

  const hasLivePrices = holdings.some(h => h.currentValue != null);
  const totalCurrentValue = hasLivePrices
    ? holdings.reduce((sum, h) => sum + (h.currentValue ?? h.totalInvested), 0)
    : 0;
  const totalUnrealizedPL = hasLivePrices ? totalCurrentValue - totalInvested : 0;
  const totalUnrealizedPLPercent = hasLivePrices && totalInvested > 0
    ? (totalUnrealizedPL / totalInvested) * 100
    : 0;
  const totalDayChange = hasLivePrices
    ? holdings.reduce((sum, h) => sum + (h.dayChange ?? 0) * (h.quantity ?? 0), 0)
    : 0;

  // Holdings with P&L for sorting
  const holdingsWithPL = holdings.filter(h => h.unrealizedPLPercent != null);
  const topGainers = [...holdingsWithPL]
    .sort((a, b) => (b.unrealizedPLPercent ?? 0) - (a.unrealizedPLPercent ?? 0))
    .slice(0, 5);
  const topLosers = [...holdingsWithPL]
    .sort((a, b) => (a.unrealizedPLPercent ?? 0) - (b.unrealizedPLPercent ?? 0))
    .slice(0, 5);

  // Diversification: use currentValue if available, else totalInvested
  const valueKey = hasLivePrices ? 'currentValue' : 'totalInvested';
  const totalValue = holdings.reduce((s, h) => s + (h[valueKey] ?? h.totalInvested), 0);

  // By asset class
  const acMap = new Map<string, number>();
  for (const h of holdings) {
    const label = h.assetClass.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    acMap.set(label, (acMap.get(label) || 0) + (h[valueKey] ?? h.totalInvested));
  }
  const byAssetClass = [...acMap.entries()]
    .map(([label, value]) => ({ label, value: r2(value), percent: totalValue > 0 ? r2((value / totalValue) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  // By broker
  const brokerMap = new Map<string, number>();
  for (const h of holdings) {
    brokerMap.set(h.broker, (brokerMap.get(h.broker) || 0) + (h[valueKey] ?? h.totalInvested));
  }
  const byBroker = [...brokerMap.entries()]
    .map(([label, value]) => ({ label, value: r2(value), percent: totalValue > 0 ? r2((value / totalValue) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);

  // Concentration risk: largest single holding as % of portfolio
  const maxHoldingValue = holdings.reduce((max, h) => Math.max(max, h[valueKey] ?? h.totalInvested), 0);
  const concentrationRisk = totalValue > 0 ? r2((maxHoldingValue / totalValue) * 100) : 0;

  // Herfindahl-Hirschman Index (sum of squared market shares, 0-10000)
  const herfindahlIndex = totalValue > 0
    ? r2(holdings.reduce((sum, h) => {
        const share = ((h[valueKey] ?? h.totalInvested) / totalValue) * 100;
        return sum + share * share;
      }, 0))
    : 0;

  return {
    totalInvested: r2(totalInvested),
    totalCurrentValue: r2(totalCurrentValue),
    totalUnrealizedPL: r2(totalUnrealizedPL),
    totalUnrealizedPLPercent: r2(totalUnrealizedPLPercent),
    totalDayChange: r2(totalDayChange),
    totalCharges: r2(totalCharges),
    holdingCount: holdings.length,
    topHoldings,
    topGainers,
    topLosers,
    diversification: {
      byAssetClass,
      byBroker,
      concentrationRisk,
      herfindahlIndex,
    },
  };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Enrich holdings with live price data */
export function enrichHoldingsWithPrices(
  holdings: PortfolioHolding[],
  prices: Map<string, StockPrice>
): PortfolioHolding[] {
  return holdings.map(h => {
    const price = prices.get(h.symbol);
    if (!price) return h;

    const currentValue = h.quantity * price.currentPrice;
    const unrealizedPL = currentValue - h.totalInvested;
    const unrealizedPLPercent = h.totalInvested > 0
      ? (unrealizedPL / h.totalInvested) * 100
      : 0;

    return {
      ...h,
      currentPrice: price.currentPrice,
      currentValue: r2(currentValue),
      unrealizedPL: r2(unrealizedPL),
      unrealizedPLPercent: r2(unrealizedPLPercent),
      dayChange: price.change,
      dayChangePercent: price.changePercent,
      priceLastUpdated: price.lastUpdated,
    };
  });
}

export interface MonthlyBreakdown {
  month: string;
  buys: number;
  sells: number;
  dividends: number;
}

export interface TradingStats {
  totalBuys: number;
  totalSells: number;
  totalDividends: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export function calculateTradingStats(transactions: StockTransaction[]): TradingStats {
  let totalBuys = 0;
  let totalSells = 0;
  let totalDividends = 0;

  const monthMap = new Map<string, MonthlyBreakdown>();

  for (const txn of transactions) {
    const month = txn.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, buys: 0, sells: 0, dividends: 0 });
    }
    const mb = monthMap.get(month)!;

    if (txn.type === 'buy' || txn.type === 'ipo') {
      totalBuys += txn.totalValue;
      mb.buys += txn.totalValue;
    } else if (txn.type === 'sell') {
      totalSells += txn.totalValue;
      mb.sells += txn.totalValue;
    } else if (txn.type === 'dividend') {
      totalDividends += txn.totalValue;
      mb.dividends += txn.totalValue;
    }
  }

  const monthlyBreakdown = [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month));

  return {
    totalBuys: Math.round(totalBuys * 100) / 100,
    totalSells: Math.round(totalSells * 100) / 100,
    totalDividends: Math.round(totalDividends * 100) / 100,
    monthlyBreakdown,
  };
}
