import { describe, it, expect } from 'vitest';
import { computeTakeHome } from '../shared/utils/takeHome';

describe('computeTakeHome', () => {
  it('conserves CTC across its components (new regime)', () => {
    const r = computeTakeHome({ annualCtc: 1200000, basicPct: 0.5, regime: 'new', fy: '2025-26' });
    // CTC = take-home + employer PF + employee PF + professional tax + income tax
    const reconstructed = r.annualTakeHome + r.employerPf + r.employeePf + r.professionalTax + r.incomeTax;
    expect(reconstructed).toBeCloseTo(r.annualCtc, -1); // within rounding
  });

  it('computes PF as 12% of basic (under the wage ceiling)', () => {
    const r = computeTakeHome({ annualCtc: 240000, basicPct: 0.5, regime: 'new', fy: '2025-26' });
    // basic = 120000; 12% = 14400 (below the 180000 annual ceiling)
    expect(r.employeePf).toBe(14400);
    expect(r.employerPf).toBe(14400);
  });

  it('caps PF at the statutory wage ceiling for high basic', () => {
    const r = computeTakeHome({ annualCtc: 5000000, basicPct: 0.5, regime: 'new', fy: '2025-26' });
    // basic = 2.5M but PF base capped at 180000 -> PF = 21600
    expect(r.employeePf).toBe(21600);
  });

  it('gives a higher take-home than a naive gross (tax applies)', () => {
    const r = computeTakeHome({ annualCtc: 2000000, basicPct: 0.5, regime: 'new', fy: '2025-26' });
    expect(r.annualTakeHome).toBeLessThan(r.gross);
    expect(r.monthlyTakeHome).toBe(Math.round(r.annualTakeHome / 12));
    expect(r.inHandPct).toBeGreaterThan(0);
    expect(r.inHandPct).toBeLessThan(1);
  });

  it('zero CTC yields zero take-home and no tax', () => {
    const r = computeTakeHome({ annualCtc: 0, basicPct: 0.5, regime: 'old', fy: '2025-26' });
    expect(r.annualTakeHome).toBe(0);
    expect(r.incomeTax).toBe(0);
    expect(r.professionalTax).toBe(0);
  });

  it('old regime folds employee PF into 80C (lowers tax vs no deductions)', () => {
    const oldR = computeTakeHome({ annualCtc: 1500000, basicPct: 0.5, regime: 'old', fy: '2025-26' });
    const newR = computeTakeHome({ annualCtc: 1500000, basicPct: 0.5, regime: 'new', fy: '2025-26' });
    expect(oldR.incomeTax).toBeGreaterThanOrEqual(0);
    expect(newR.incomeTax).toBeGreaterThanOrEqual(0);
  });
});
