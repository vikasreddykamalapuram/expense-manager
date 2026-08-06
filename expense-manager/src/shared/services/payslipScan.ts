// Pure payslip line-scanner — no pdf.js dependency, so it is unit-testable and
// safe to import in any environment. payslipParser.ts (which loads the PDF)
// delegates to scanPayslipLines() here.
import { v4 as uuidv4 } from 'uuid';
import type { SalaryComponent } from '../types';

// label pattern → canonical component label
const EARNING_LABELS: Array<[RegExp, string]> = [
  [/gross (?:earnings|salary|pay)/i, '__GROSS__'],
  [/\bbasic\b/i, 'Basic'],
  [/house rent|\bh\.?\s?r\.?\s?a\b/i, 'HRA'],
  [/special allow/i, 'Special Allowance'],
  [/conveyance/i, 'Conveyance'],
  [/leave travel|\bl\.?\s?t\.?\s?a\b/i, 'LTA'],
  [/medical allow/i, 'Medical Allowance'],
  [/dearness allow|\bd\.?\s?a\b/i, 'Dearness Allowance'],
  [/bonus|incentive/i, 'Bonus'],
];
const DEDUCTION_LABELS: Array<[RegExp, string]> = [
  [/provident fund|\bepf\b|\bp\.?\s?f\b/i, 'Provident Fund (PF)'],
  [/professional tax|\bp\.?\s?tax\b|\bp\.?\s?t\b/i, 'Professional Tax'],
  [/\btds\b|income tax|tax deducted/i, 'TDS (Income Tax)'],
  [/\besi\b|employee state/i, 'ESI'],
  [/loan|advance recovery/i, 'Loan / Advance'],
];
const NET_LABEL = /net (?:pay|salary|amount|payable)|take[-\s]?home/i;

function parseAmt(s: string): number | null {
  const c = s.replace(/[₹\s,]/g, '');
  const n = parseFloat(c);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** First numeric amount appearing after `from` in the line (handles two-column payslips). */
export function amountAfter(line: string, from: number): number | null {
  const m = line.slice(from).match(/-?\s*₹?\s*\d[\d,]*\.?\d{0,2}/);
  return m ? parseAmt(m[0]) : null;
}

/** Map payslip text lines to salary components. Pure & unit-testable. */
export function scanPayslipLines(lines: string[]): { components: SalaryComponent[]; gross?: number; net?: number } {
  const components: SalaryComponent[] = [];
  const seen = new Set<string>();
  let gross: number | undefined;
  let net: number | undefined;

  const scan = (labels: Array<[RegExp, string]>, kind: SalaryComponent['kind']) => {
    for (const line of lines) {
      for (const [re, label] of labels) {
        const m = re.exec(line);
        if (!m) continue;
        const amt = amountAfter(line, m.index + m[0].length);
        if (amt == null || amt <= 0) continue;
        if (label === '__GROSS__') { gross = amt; continue; }
        if (!seen.has(label)) { components.push({ id: uuidv4(), label, amount: amt, kind }); seen.add(label); }
      }
    }
  };
  scan(EARNING_LABELS, 'earning');
  scan(DEDUCTION_LABELS, 'deduction');

  for (const line of lines) {
    const m = NET_LABEL.exec(line);
    if (m) { const a = amountAfter(line, m.index + m[0].length); if (a) net = a; }
  }
  return { components, gross, net };
}
