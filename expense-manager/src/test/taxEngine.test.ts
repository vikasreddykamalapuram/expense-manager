import { describe, it, expect } from 'vitest';
import { computeRegimeTax, compareRegimes, EMPTY_DEDUCTIONS, TaxDeductions } from '../shared/utils/taxEngine';
import { TAX_CONFIGS } from '../shared/constants/taxConfig';

const FY = TAX_CONFIGS['2025-26'];
const ded = (o: Partial<TaxDeductions>): TaxDeductions => ({ ...EMPTY_DEDUCTIONS, ...o });

describe('taxEngine — FY 2025-26', () => {
  describe('new regime', () => {
    it('is zero up to the 12L rebate threshold (after 75k standard deduction)', () => {
      // 12.75L gross -> 12L taxable -> full 87A rebate -> zero tax
      const r = computeRegimeTax('new', 1275000, EMPTY_DEDUCTIONS, FY);
      expect(r.taxableIncome).toBe(1200000);
      expect(r.totalTax).toBe(0);
    });

    it('ignores chapter VI-A deductions (only standard deduction applies)', () => {
      const withDed = computeRegimeTax('new', 2000000, ded({ section80C: 150000, section80D: 25000 }), FY);
      const noDed = computeRegimeTax('new', 2000000, EMPTY_DEDUCTIONS, FY);
      expect(withDed.appliedDeductions).toBe(0);
      expect(withDed.totalTax).toBe(noDed.totalTax);
    });

    it('computes slab tax for 20L gross correctly', () => {
      // taxable = 20L - 75k = 19.25L
      // 0-4:0 | 4-8:5%=20000 | 8-12:10%=40000 | 12-16:15%=60000 | 16-19.25:20%=65000
      // base = 185000; +4% cess = 192400
      const r = computeRegimeTax('new', 2000000, EMPTY_DEDUCTIONS, FY);
      expect(r.taxableIncome).toBe(1925000);
      expect(r.taxBeforeRebate).toBe(185000);
      expect(r.rebate).toBe(0);
      expect(r.cess).toBe(7400);
      expect(r.totalTax).toBe(192400);
    });
  });

  describe('old regime', () => {
    it('applies 87A rebate up to 5L taxable', () => {
      // gross 5.5L - 50k std = 5L taxable -> rebate wipes tax
      const r = computeRegimeTax('old', 550000, EMPTY_DEDUCTIONS, FY);
      expect(r.taxableIncome).toBe(500000);
      expect(r.totalTax).toBe(0);
    });

    it('caps 80C at 1.5L and applies deductions', () => {
      const r = computeRegimeTax('old', 1500000, ded({ section80C: 200000 }), FY);
      // 80C capped at 150000
      expect(r.appliedDeductions).toBe(150000);
      // taxable = 15L - 50k std - 1.5L = 13L
      expect(r.taxableIncome).toBe(1300000);
    });

    it('computes 13L taxable tax with cess', () => {
      // taxable 13L: 0-2.5:0 | 2.5-5:5%=12500 | 5-10:20%=100000 | 10-13:30%=90000 = 202500
      // +4% cess = 210600
      const r = computeRegimeTax('old', 1500000, ded({ section80C: 200000 }), FY);
      expect(r.taxBeforeRebate).toBe(202500);
      expect(r.totalTax).toBe(210600);
    });
  });

  describe('compareRegimes', () => {
    it('recommends new regime for a no-deduction earner', () => {
      const c = compareRegimes(2000000, EMPTY_DEDUCTIONS, '2025-26');
      expect(c.recommended).toBe('new');
      expect(c.savings).toBe(Math.abs(c.old.totalTax - c.new.totalTax));
      expect(c.savings).toBeGreaterThan(0);
    });

    it('can favour the old regime when deductions are large', () => {
      const heavy = ded({ section80C: 150000, section80CCD1B: 50000, section80D: 50000, homeLoanInterest: 200000, hraExemption: 300000 });
      const c = compareRegimes(1500000, heavy, '2025-26');
      expect(c.old.totalTax).toBeLessThan(c.new.totalTax);
      expect(c.recommended).toBe('old');
    });

    it('falls back to the default FY for an unknown key', () => {
      const c = compareRegimes(2000000, EMPTY_DEDUCTIONS, 'not-a-year');
      expect(c.new.totalTax).toBe(192400);
    });
  });

  describe('marginal relief above rebate threshold', () => {
    it('caps tax to income over the threshold near 12L (new regime)', () => {
      // 12.75L + 10k gross = taxable 12.10L, just over 12L threshold.
      const r = computeRegimeTax('new', 1285000, EMPTY_DEDUCTIONS, FY);
      // Without relief tax would jump; relief caps pre-cess tax to ~10k excess.
      expect(r.totalTax).toBeLessThanOrEqual(Math.round(10000 * 1.04) + 1);
    });
  });
});
