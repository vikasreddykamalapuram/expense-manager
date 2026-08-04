import { describe, it, expect } from 'vitest';
import { scanPayslipLines } from '../shared/services/payslipScan';

describe('scanPayslipLines', () => {
  it('parses a single-column payslip', () => {
    const { components, net } = scanPayslipLines([
      'Employee: Jane Doe',
      'Basic 25,000.00',
      'HRA 12,500.00',
      'Special Allowance 8,000',
      'Provident Fund 1,800',
      'Professional Tax 200',
      'TDS 3,500',
      'Net Pay 40,000.00',
    ]);
    const byLabel = Object.fromEntries(components.map((c) => [c.label, c]));
    expect(byLabel['Basic'].amount).toBe(25000);
    expect(byLabel['Basic'].kind).toBe('earning');
    expect(byLabel['HRA'].amount).toBe(12500);
    expect(byLabel['Provident Fund (PF)'].amount).toBe(1800);
    expect(byLabel['Provident Fund (PF)'].kind).toBe('deduction');
    expect(byLabel['Professional Tax'].amount).toBe(200);
    expect(byLabel['TDS (Income Tax)'].amount).toBe(3500);
    expect(net).toBe(40000);
  });

  it('handles a two-column (earnings | deductions) payslip row', () => {
    // "Basic 25000    Provident Fund 1800" on one line
    const { components } = scanPayslipLines([
      'Basic 25000 Provident Fund 1800',
      'HRA 12500 Professional Tax 200',
    ]);
    const byLabel = Object.fromEntries(components.map((c) => [c.label, c]));
    expect(byLabel['Basic'].amount).toBe(25000);
    expect(byLabel['Provident Fund (PF)'].amount).toBe(1800);
    expect(byLabel['HRA'].amount).toBe(12500);
    expect(byLabel['Professional Tax'].amount).toBe(200);
  });

  it('does not duplicate a component seen twice', () => {
    const { components } = scanPayslipLines(['Basic 25000', 'Basic 25000']);
    expect(components.filter((c) => c.label === 'Basic')).toHaveLength(1);
  });

  it('returns empty for lines with no recognizable components', () => {
    const { components, gross, net } = scanPayslipLines(['Hello world', 'Page 1 of 2']);
    expect(components).toHaveLength(0);
    expect(gross).toBeUndefined();
    expect(net).toBeUndefined();
  });
});
