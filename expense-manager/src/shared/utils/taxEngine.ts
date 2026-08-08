import { FyTaxConfig, RegimeConfig, TaxSlab, TAX_CONFIGS, DEFAULT_FY } from '../constants/taxConfig';

/** Chapter VI-A deduction inputs (annual, INR). Only used by the old regime. */
export interface TaxDeductions {
  section80C: number;       // PF, ELSS, LIC, PPF, principal repayment… capped at 1.5L
  section80D: number;       // health insurance premium
  section80CCD1B: number;   // additional NPS, capped at 50k
  hraExemption: number;     // computed HRA exemption
  homeLoanInterest: number; // self-occupied, capped at 2L
  otherDeductions: number;  // 80E, 80G, etc. (user-computed)
}

export const EMPTY_DEDUCTIONS: TaxDeductions = {
  section80C: 0,
  section80D: 0,
  section80CCD1B: 0,
  hraExemption: 0,
  homeLoanInterest: 0,
  otherDeductions: 0,
};

export interface SlabTax {
  from: number;
  to: number | null;
  rate: number;
  taxable: number;
  tax: number;
}

export interface RegimeResult {
  regime: 'old' | 'new';
  grossIncome: number;
  standardDeduction: number;
  appliedDeductions: number;   // chapter VI-A actually applied (0 for new regime)
  taxableIncome: number;
  slabBreakdown: SlabTax[];
  taxBeforeRebate: number;
  rebate: number;
  surcharge: number;
  cess: number;
  totalTax: number;            // final payable (after rebate + surcharge + cess)
  effectiveRate: number;       // totalTax / grossIncome
}

export interface RegimeComparison {
  old: RegimeResult;
  new: RegimeResult;
  recommended: 'old' | 'new';
  savings: number;             // how much the recommended regime saves vs the other
}

function round(n: number): number {
  return Math.round(n);
}

/** Progressive slab tax with a per-slab breakdown. */
function computeSlabTax(taxable: number, slabs: TaxSlab[]): { total: number; breakdown: SlabTax[] } {
  const breakdown: SlabTax[] = [];
  let lower = 0;
  let total = 0;
  for (const slab of slabs) {
    const upper = slab.upTo ?? Infinity;
    if (taxable <= lower) break;
    const amountInSlab = Math.min(taxable, upper) - lower;
    if (amountInSlab > 0) {
      const tax = amountInSlab * slab.rate;
      total += tax;
      breakdown.push({
        from: lower,
        to: slab.upTo,
        rate: slab.rate,
        taxable: amountInSlab,
        tax,
      });
    }
    lower = upper;
  }
  return { total, breakdown };
}

/** Highest matching surcharge band, applied to base tax. */
function computeSurcharge(taxableIncome: number, baseTax: number, cfg: RegimeConfig): number {
  let rate = 0;
  for (const band of cfg.surcharge) {
    if (taxableIncome > band.over) rate = band.rate;
  }
  return baseTax * rate;
}

/**
 * Compute tax for one regime.
 * The old regime subtracts standard + capped chapter VI-A deductions; the new
 * regime allows only the standard deduction.
 */
export function computeRegimeTax(
  regime: 'old' | 'new',
  grossIncome: number,
  deductions: TaxDeductions,
  fyConfig: FyTaxConfig
): RegimeResult {
  const cfg = regime === 'old' ? fyConfig.old : fyConfig.new;
  const gross = Math.max(0, grossIncome);

  let appliedDeductions = 0;
  if (cfg.allowsDeductions) {
    const c80c = Math.min(deductions.section80C, fyConfig.caps.section80C);
    const cNps = Math.min(deductions.section80CCD1B, fyConfig.caps.section80CCD1B);
    const cHome = Math.min(deductions.homeLoanInterest, fyConfig.caps.homeLoanInterest);
    appliedDeductions =
      c80c + cNps + cHome +
      Math.max(0, deductions.section80D) +
      Math.max(0, deductions.hraExemption) +
      Math.max(0, deductions.otherDeductions);
  }

  const taxableIncome = Math.max(0, gross - cfg.standardDeduction - appliedDeductions);
  const { total: baseTax, breakdown } = computeSlabTax(taxableIncome, cfg.slabs);

  // Section 87A rebate: wipes tax up to the threshold, capped.
  let rebate = 0;
  if (taxableIncome <= cfg.rebate.maxTaxableIncome) {
    rebate = Math.min(baseTax, cfg.rebate.maxRebate);
  }
  let taxAfterRebate = baseTax - rebate;

  // Marginal relief just above the rebate threshold: tax can't exceed the
  // income earned over the threshold (prevents a cliff at the 87A boundary).
  if (rebate === 0 && taxableIncome > cfg.rebate.maxTaxableIncome) {
    const excessOverThreshold = taxableIncome - cfg.rebate.maxTaxableIncome;
    if (taxAfterRebate > excessOverThreshold) {
      taxAfterRebate = excessOverThreshold;
    }
  }

  const surcharge = computeSurcharge(taxableIncome, taxAfterRebate, cfg);
  const cess = (taxAfterRebate + surcharge) * cfg.cessRate;
  const totalTax = round(taxAfterRebate + surcharge + cess);

  return {
    regime,
    grossIncome: gross,
    standardDeduction: cfg.standardDeduction,
    appliedDeductions,
    taxableIncome,
    slabBreakdown: breakdown,
    taxBeforeRebate: round(baseTax),
    rebate: round(rebate),
    surcharge: round(surcharge),
    cess: round(cess),
    totalTax,
    effectiveRate: gross > 0 ? totalTax / gross : 0,
  };
}

/** Compute both regimes and recommend the cheaper one. */
export function compareRegimes(
  grossIncome: number,
  deductions: TaxDeductions,
  fy: string = DEFAULT_FY
): RegimeComparison {
  const fyConfig = TAX_CONFIGS[fy] ?? TAX_CONFIGS[DEFAULT_FY];
  const oldRes = computeRegimeTax('old', grossIncome, deductions, fyConfig);
  const newRes = computeRegimeTax('new', grossIncome, deductions, fyConfig);
  const recommended = newRes.totalTax <= oldRes.totalTax ? 'new' : 'old';
  const savings = Math.abs(oldRes.totalTax - newRes.totalTax);
  return { old: oldRes, new: newRes, recommended, savings };
}
