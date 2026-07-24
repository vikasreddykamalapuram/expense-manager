import { useMemo } from 'react';
import { PortfolioHolding, StockTransaction } from '../types';
import { calculateXIRR, buildPortfolioCashFlows } from '../utils/xirr';

export interface SectorAllocation {
  sector: string;
  topStocks: Array<{
    symbol: string;
    name: string;
    value: number;
    percent: number;
  }>;
  totalValue: number;
  percent: number;
  gainLoss: number;
  gainLossPercent: number;
}

export interface PLMetrics {
  totalInvested: number;
  totalCurrentValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  breakEvenPrice?: number;
  profitableHoldings: number;
  losingHoldings: number;
  xirr: number | null;
  realizedPL: number;
  unrealizedPL: number;
  dividendIncome: number;
  totalChargesPaid: number;
  topGainers: Array<{ symbol: string; name: string; pl: number; plPercent: number }>;
  topLosers: Array<{ symbol: string; name: string; pl: number; plPercent: number }>;
}

export interface PieChartData {
  name: string;
  value: number;
  symbol: string;
}

/**
 * Determine sector for a stock symbol (simplified mapping)
 * In production, fetch from NSE data
 */
function getSectorForStock(symbol: string, name: string): string {
  const nameUpper = name.toUpperCase();
  const symUpper = symbol.toUpperCase();

  // Banking & Finance
  if (/(BANK|FINANCIAL|ICICI|HDFC|AXIS|KOTAKBANK|INDUSIND|BAJAJFINSV|LT|SBI)/.test(symUpper)) {
    return 'Finance & Banking';
  }
  if (/(INSURANCE|SBICARD|BHARTI|VODAFONE)/.test(symUpper)) {
    return 'Finance & Insurance';
  }

  // IT & Technology
  if (/(INFY|TCS|WIPRO|HCLTECH|TECHM|LTTS|PERSISTENT|MPHASIS)/.test(symUpper)) {
    return 'Information Technology';
  }

  // FMCG & Consumer
  if (/(HINDUSTAN|MCDONALDS|BRITANNIA|NESTLEINDIA|COLPAL|ITC|UNILEVER|HINDUSTAN|PROCTER|PIRAMALGG)/.test(symUpper)) {
    return 'FMCG & Consumer';
  }

  // Energy & Oil & Gas
  if (/(RELIANCE|PETRONET|ONGC|NTPC|IBREALEST|POWERGRID|ADANIGAS|ADANIPOWER)/.test(symUpper)) {
    return 'Energy & Utilities';
  }

  // Auto & Components
  if (/(MARUTI|BAJAJAUOTO|TATAMOTOR|HERO|EICHER|ASHOK)/.test(symUpper)) {
    return 'Automobiles';
  }

  // Metals & Mining
  if (/(TATA|STEEL|HINDALCO|ALUMINIUM|JINDALSTEL|NATIONALAL)/.test(symUpper)) {
    return 'Metals & Mining';
  }

  // Infrastructure & Construction
  if (/(LARSENTOUB|GAIL|BHARARTI|INFRATEL|POLYCAB|SUMITOMO)/.test(symUpper)) {
    return 'Infrastructure';
  }

  // Pharma & Healthcare
  if (/(CIPLA|LUPIN|SUNPHARM|AUROPHARMA|DRREDDY|APOLLOHSP|DISHTV)/.test(symUpper)) {
    return 'Pharmaceuticals';
  }

  // Real Estate
  if (/(LODHA|PRESTIGE|OBEROI|INDIABULLS|RUNWAL|MAHADEV)/.test(symUpper)) {
    return 'Real Estate';
  }

  // Telecom
  if (/(AIRTEL|JIO|BSNL|VODAFONE)/.test(symUpper)) {
    return 'Telecom';
  }

  // Default to name prefix or 'Other'
  if (nameUpper.includes('LIMITED') || nameUpper.includes('LTD')) {
    return 'Diversified';
  }

  return 'Other';
}

export function usePortfolioMetrics(holdings: PortfolioHolding[], stockTransactions?: StockTransaction[]) {
  // P&L Metrics with XIRR, realized/unrealized split
  const plMetrics = useMemo<PLMetrics>(() => {
    if (holdings.length === 0) {
      return {
        totalInvested: 0,
        totalCurrentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercent: 0,
        profitableHoldings: 0,
        losingHoldings: 0,
        xirr: null,
        realizedPL: 0,
        unrealizedPL: 0,
        dividendIncome: 0,
        totalChargesPaid: 0,
        topGainers: [],
        topLosers: [],
      };
    }

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let profitableCount = 0;
    let losingCount = 0;
    let totalUnrealizedPL = 0;

    const holdingPL: Array<{ symbol: string; name: string; pl: number; plPercent: number }> = [];

    for (const holding of holdings) {
      totalInvested += holding.totalInvested;
      const current = holding.currentValue ?? holding.totalInvested;
      totalCurrentValue += current;

      const pl = holding.unrealizedPL ?? 0;
      totalUnrealizedPL += pl;

      if (pl > 0) profitableCount++;
      else if (pl < 0) losingCount++;

      holdingPL.push({
        symbol: holding.symbol,
        name: holding.name,
        pl,
        plPercent: holding.unrealizedPLPercent ?? 0,
      });
    }

    // Top gainers and losers
    const sorted = [...holdingPL].sort((a, b) => b.pl - a.pl);
    const topGainers = sorted.filter(h => h.pl > 0).slice(0, 5);
    const topLosers = sorted.filter(h => h.pl < 0).sort((a, b) => a.pl - b.pl).slice(0, 5);

    // Realized P&L from sell transactions
    let realizedPL = 0;
    let dividendIncome = 0;
    let totalChargesPaid = 0;

    if (stockTransactions) {
      for (const txn of stockTransactions) {
        totalChargesPaid += txn.charges?.total ?? 0;
        if (txn.type === 'dividend') {
          dividendIncome += txn.totalValue;
        }
        // Realized P&L approximation: sell proceeds - avg cost at time of sell
        // (simplified: actual realized P&L requires FIFO/LIFO tracking)
        if (txn.type === 'sell') {
          // Find current holding's avg buy price for approximate realized P&L
          const holding = holdings.find(h => h.symbol === txn.symbol);
          if (holding) {
            realizedPL += (txn.price - holding.avgBuyPrice) * txn.quantity;
          }
        }
      }
    }

    // XIRR calculation
    let xirr: number | null = null;
    if (stockTransactions && stockTransactions.length > 0 && totalCurrentValue > 0) {
      const cashFlows = buildPortfolioCashFlows(stockTransactions, totalCurrentValue);
      xirr = calculateXIRR(cashFlows);
    }

    const gainLoss = totalCurrentValue - totalInvested;
    const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalGainLoss: gainLoss,
      totalGainLossPercent: gainLossPercent,
      profitableHoldings: profitableCount,
      losingHoldings: losingCount,
      xirr,
      realizedPL,
      unrealizedPL: totalUnrealizedPL,
      dividendIncome,
      totalChargesPaid,
      topGainers,
      topLosers,
    };
  }, [holdings, stockTransactions]);

  // Diversification Pie Data
  const diversificationData = useMemo<PieChartData[]>(() => {
    if (holdings.length === 0) return [];

    return holdings
      .map(h => ({
        name: h.symbol,
        value: h.currentValue ?? h.totalInvested,
        symbol: h.symbol,
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  // Sector Breakdown
  const sectorBreakdown = useMemo<SectorAllocation[]>(() => {
    if (holdings.length === 0) return [];

    const sectorMap = new Map<string, typeof holdings>();

    // Group by sector
    for (const holding of holdings) {
      const sector = getSectorForStock(holding.symbol, holding.name);
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, []);
      }
      sectorMap.get(sector)!.push(holding);
    }

    // Calculate metrics per sector
    const sectorData: SectorAllocation[] = [];

    for (const [sector, sectorHoldings] of sectorMap) {
      const totalValue = sectorHoldings.reduce((sum, h) => sum + (h.currentValue ?? h.totalInvested), 0);
      const totalInvested = sectorHoldings.reduce((sum, h) => sum + h.totalInvested, 0);
      const gainLoss = totalValue - totalInvested;

      // Top 3 stocks in sector
      const topStocks = sectorHoldings
        .sort((a, b) => (b.currentValue ?? b.totalInvested) - (a.currentValue ?? a.totalInvested))
        .slice(0, 3)
        .map(h => ({
          symbol: h.symbol,
          name: h.name,
          value: h.currentValue ?? h.totalInvested,
          percent: ((h.currentValue ?? h.totalInvested) / totalValue) * 100,
        }));

      sectorData.push({
        sector,
        topStocks,
        totalValue,
        percent: 0, // Will be calculated below
        gainLoss,
        gainLossPercent: totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0,
      });
    }

    // Calculate percentages
    const totalPortfolioValue = plMetrics.totalCurrentValue;
    for (const sector of sectorData) {
      sector.percent = totalPortfolioValue > 0 ? (sector.totalValue / totalPortfolioValue) * 100 : 0;
    }

    // Sort by value descending
    sectorData.sort((a, b) => b.totalValue - a.totalValue);

    return sectorData;
  }, [holdings, plMetrics.totalCurrentValue]);

  // Concentration risk: stocks with > 20% portfolio weight
  const concentrationRisk = useMemo(() => {
    if (diversificationData.length === 0) return [];
    const total = diversificationData.reduce((s, d) => s + d.value, 0);
    return diversificationData
      .map(d => ({ symbol: d.symbol, percent: total > 0 ? (d.value / total) * 100 : 0 }))
      .filter(d => d.percent > 20);
  }, [diversificationData]);

  return {
    plMetrics,
    diversificationData,
    sectorBreakdown,
    concentrationRisk,
  };
}
