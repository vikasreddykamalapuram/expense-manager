import { StockTransaction, PortfolioHolding, AssetClass } from '../types';

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
  totalCharges: number;
  holdingCount: number;
  topHoldings: PortfolioHolding[];
}

export function calculatePortfolioStats(holdings: PortfolioHolding[]): PortfolioStats {
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalInvested, 0);
  const totalCharges = holdings.reduce((sum, h) => sum + h.totalCharges, 0);
  const topHoldings = [...holdings].sort((a, b) => b.totalInvested - a.totalInvested).slice(0, 5);

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    holdingCount: holdings.length,
    topHoldings,
  };
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
