/**
 * XIRR (Extended Internal Rate of Return) calculation
 * Uses Newton-Raphson method to find the rate that makes NPV = 0
 */

interface CashFlow {
  date: Date;
  amount: number; // negative = outflow (investment), positive = inflow (return)
}

/**
 * Calculate XIRR for a series of cash flows
 * @returns annualized return rate as decimal (0.12 = 12%) or null if doesn't converge
 */
export function calculateXIRR(cashFlows: CashFlow[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;

  // Ensure at least one positive and one negative cash flow
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sortedFlows[0].date;

  function yearFrac(d: Date): number {
    return (d.getTime() - firstDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  }

  function npv(rate: number): number {
    return sortedFlows.reduce((sum, cf) => {
      const t = yearFrac(cf.date);
      return sum + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  }

  function npvDerivative(rate: number): number {
    return sortedFlows.reduce((sum, cf) => {
      const t = yearFrac(cf.date);
      return sum - t * cf.amount / Math.pow(1 + rate, t + 1);
    }, 0);
  }

  // Newton-Raphson iteration
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    const f = npv(rate);
    const fPrime = npvDerivative(rate);

    if (Math.abs(fPrime) < 1e-10) break;

    const newRate = rate - f / fPrime;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;

    // Guard against divergence
    if (rate < -0.99 || rate > 100) break;
  }

  // Try bisection if Newton-Raphson fails
  return bisectionXIRR(sortedFlows, yearFrac);
}

function bisectionXIRR(
  flows: CashFlow[],
  yearFrac: (d: Date) => number,
): number | null {
  let low = -0.99;
  let high = 10;
  const tolerance = 1e-6;
  const maxIter = 200;

  function npv(rate: number): number {
    return flows.reduce((sum, cf) => {
      const t = yearFrac(cf.date);
      return sum + cf.amount / Math.pow(1 + rate, t);
    }, 0);
  }

  let fLow = npv(low);
  let fHigh = npv(high);

  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const fMid = npv(mid);

    if (Math.abs(fMid) < tolerance || (high - low) / 2 < tolerance) {
      return mid;
    }

    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return null;
}

/**
 * Build XIRR cash flows from stock transactions and current portfolio value
 */
export function buildPortfolioCashFlows(
  transactions: Array<{ date: string; type: string; totalValue: number; quantity: number }>,
  currentValue: number,
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const txn of transactions) {
    const date = new Date(txn.date);
    if (isNaN(date.getTime())) continue;

    if (txn.type === 'buy' || txn.type === 'ipo') {
      // Money going out
      flows.push({ date, amount: -txn.totalValue });
    } else if (txn.type === 'sell') {
      // Money coming in
      flows.push({ date, amount: txn.totalValue });
    } else if (txn.type === 'dividend') {
      // Money coming in
      flows.push({ date, amount: txn.totalValue });
    }
  }

  // Add current portfolio value as final inflow (as of today)
  if (currentValue > 0) {
    flows.push({ date: new Date(), amount: currentValue });
  }

  return flows;
}
