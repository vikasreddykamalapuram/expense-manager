/**
 * Config-driven Indian income-tax parameters, keyed by financial year.
 *
 * Kept as data (not code) so rates can be updated each Budget without touching
 * the tax engine. All amounts are annual, in INR. These are simplified models
 * for planning — MoneyIQ shows an estimate, not tax advice.
 */

export interface TaxSlab {
  /** Upper bound of this slab (inclusive). `null` = no upper bound. */
  upTo: number | null;
  /** Marginal rate as a fraction (0.05 = 5%). */
  rate: number;
}

export interface SurchargeBand {
  /** Applies when taxable income exceeds this threshold. */
  over: number;
  rate: number;
}

export interface RegimeConfig {
  slabs: TaxSlab[];
  /** Standard deduction for salaried individuals. */
  standardDeduction: number;
  /** Section 87A rebate: full rebate when taxable income ≤ maxTaxableIncome, capped at maxRebate. */
  rebate: { maxTaxableIncome: number; maxRebate: number };
  /** Health & education cess (fraction of tax + surcharge). */
  cessRate: number;
  /** Surcharge bands (highest matching applies), before cess. */
  surcharge: SurchargeBand[];
  /**
   * Whether chapter VI-A deductions (80C/80D/HRA/home-loan/80CCD1B) reduce taxable income.
   * true for the old regime; false for the new regime (only standard deduction applies).
   */
  allowsDeductions: boolean;
}

export interface FyTaxConfig {
  fy: string;        // e.g. '2025-26'
  label: string;     // e.g. 'FY 2025-26 (AY 2026-27)'
  /** Deduction caps used by the old regime. */
  caps: {
    section80C: number;
    section80CCD1B: number; // NPS additional
    homeLoanInterest: number; // self-occupied
  };
  old: RegimeConfig;
  new: RegimeConfig;
}

const OLD_REGIME_SLABS: TaxSlab[] = [
  { upTo: 250000, rate: 0 },
  { upTo: 500000, rate: 0.05 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

const OLD_REGIME: RegimeConfig = {
  slabs: OLD_REGIME_SLABS,
  standardDeduction: 50000,
  rebate: { maxTaxableIncome: 500000, maxRebate: 12500 },
  cessRate: 0.04,
  surcharge: [
    { over: 5000000, rate: 0.1 },
    { over: 10000000, rate: 0.15 },
    { over: 20000000, rate: 0.25 },
    { over: 50000000, rate: 0.37 },
  ],
  allowsDeductions: true,
};

// New regime slabs introduced in Budget 2025 (FY 2025-26).
const NEW_REGIME_2025_26_SLABS: TaxSlab[] = [
  { upTo: 400000, rate: 0 },
  { upTo: 800000, rate: 0.05 },
  { upTo: 1200000, rate: 0.1 },
  { upTo: 1600000, rate: 0.15 },
  { upTo: 2000000, rate: 0.2 },
  { upTo: 2400000, rate: 0.25 },
  { upTo: null, rate: 0.3 },
];

const NEW_REGIME_2025_26: RegimeConfig = {
  slabs: NEW_REGIME_2025_26_SLABS,
  standardDeduction: 75000,
  rebate: { maxTaxableIncome: 1200000, maxRebate: 60000 },
  cessRate: 0.04,
  surcharge: [
    { over: 5000000, rate: 0.1 },
    { over: 10000000, rate: 0.15 },
    { over: 20000000, rate: 0.25 }, // new regime caps surcharge at 25%
  ],
  allowsDeductions: false,
};

// New regime slabs for FY 2024-25 (pre Budget 2025).
const NEW_REGIME_2024_25: RegimeConfig = {
  slabs: [
    { upTo: 300000, rate: 0 },
    { upTo: 700000, rate: 0.05 },
    { upTo: 1000000, rate: 0.1 },
    { upTo: 1200000, rate: 0.15 },
    { upTo: 1500000, rate: 0.2 },
    { upTo: null, rate: 0.3 },
  ],
  standardDeduction: 75000,
  rebate: { maxTaxableIncome: 700000, maxRebate: 25000 },
  cessRate: 0.04,
  surcharge: [
    { over: 5000000, rate: 0.1 },
    { over: 10000000, rate: 0.15 },
    { over: 20000000, rate: 0.25 },
  ],
  allowsDeductions: false,
};

const CAPS = { section80C: 150000, section80CCD1B: 50000, homeLoanInterest: 200000 };

export const TAX_CONFIGS: Record<string, FyTaxConfig> = {
  '2024-25': {
    fy: '2024-25',
    label: 'FY 2024-25 (AY 2025-26)',
    caps: CAPS,
    old: OLD_REGIME,
    new: NEW_REGIME_2024_25,
  },
  '2025-26': {
    fy: '2025-26',
    label: 'FY 2025-26 (AY 2026-27)',
    caps: CAPS,
    old: OLD_REGIME,
    new: NEW_REGIME_2025_26,
  },
  // Rates carried forward from FY 2025-26 pending the next Budget — update when notified.
  '2026-27': {
    fy: '2026-27',
    label: 'FY 2026-27 (AY 2027-28)',
    caps: CAPS,
    old: OLD_REGIME,
    new: NEW_REGIME_2025_26,
  },
};

export const DEFAULT_FY = '2025-26';

export const FY_OPTIONS = Object.values(TAX_CONFIGS).map((c) => ({ value: c.fy, label: c.label }));
