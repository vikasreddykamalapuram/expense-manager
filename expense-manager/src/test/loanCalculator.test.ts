import { describe, it, expect } from 'vitest';
import {
  computeEmi,
  outstandingAfter,
  monthsElapsed,
  loanStatus,
} from '../shared/utils/loanCalculator';

describe('loanCalculator', () => {
  describe('computeEmi', () => {
    it('matches the standard reducing-balance EMI formula', () => {
      // 10,00,000 @ 8.5% p.a. for 120 months -> ~12,398.57
      const emi = computeEmi({ principal: 1000000, annualRatePct: 8.5, tenureMonths: 120 });
      expect(emi).toBeCloseTo(12398.57, 1);
    });

    it('handles a 0% loan as simple division', () => {
      const emi = computeEmi({ principal: 120000, annualRatePct: 0, tenureMonths: 12 });
      expect(emi).toBe(10000);
    });

    it('returns 0 for invalid inputs', () => {
      expect(computeEmi({ principal: 0, annualRatePct: 10, tenureMonths: 12 })).toBe(0);
      expect(computeEmi({ principal: 1000, annualRatePct: 10, tenureMonths: 0 })).toBe(0);
    });
  });

  describe('outstandingAfter', () => {
    const loan = { principal: 1000000, annualRatePct: 8.5, tenureMonths: 120 };

    it('is the full principal before any payment', () => {
      expect(outstandingAfter(loan, 0)).toBe(1000000);
    });

    it('is zero after the final EMI', () => {
      expect(outstandingAfter(loan, 120)).toBe(0);
      expect(outstandingAfter(loan, 200)).toBe(0);
    });

    it('decreases monotonically as EMIs are paid', () => {
      const b12 = outstandingAfter(loan, 12);
      const b24 = outstandingAfter(loan, 24);
      expect(b12).toBeLessThan(1000000);
      expect(b24).toBeLessThan(b12);
    });

    it('reduces principal linearly for a 0% loan', () => {
      const zero = { principal: 120000, annualRatePct: 0, tenureMonths: 12 };
      expect(outstandingAfter(zero, 3)).toBeCloseTo(90000, 2);
    });
  });

  describe('monthsElapsed', () => {
    it('counts whole months and ignores partial ones', () => {
      expect(monthsElapsed('2025-01-15', '2025-04-15')).toBe(3);
      expect(monthsElapsed('2025-01-15', '2025-04-10')).toBe(2); // day-of-month not yet reached
    });

    it('is 0 when the start date is in the future', () => {
      expect(monthsElapsed('2030-01-01', '2025-01-01')).toBe(0);
    });
  });

  describe('loanStatus', () => {
    const loan = { principal: 1000000, annualRatePct: 8.5, tenureMonths: 120 };

    it('derives outstanding/repaid from EMIs paid, conserving principal', () => {
      const s = loanStatus(loan, { emisPaidOverride: 24 });
      expect(s.emisPaid).toBe(24);
      expect(s.outstandingPrincipal + s.principalRepaid).toBeCloseTo(loan.principal, 2);
      expect(s.principalRepaid).toBeGreaterThan(0);
      expect(s.repaidFraction).toBeGreaterThan(0);
      expect(s.repaidFraction).toBeLessThan(1);
    });

    it('reports a fully repaid loan at end of tenure', () => {
      const s = loanStatus(loan, { emisPaidOverride: 120 });
      expect(s.outstandingPrincipal).toBe(0);
      expect(s.principalRepaid).toBeCloseTo(loan.principal, 2);
      expect(s.repaidFraction).toBe(1);
    });

    it('total interest equals total payable minus principal', () => {
      const s = loanStatus(loan, { emisPaidOverride: 0 });
      expect(s.totalPayable).toBeCloseTo(s.emi * loan.tenureMonths, 2);
      expect(s.totalInterest).toBeCloseTo(s.totalPayable - loan.principal, 2);
    });

    it('uses start date when no override is given', () => {
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
      const s = loanStatus(loan, { startDate: start });
      expect(s.emisPaid).toBe(6);
    });
  });
});
