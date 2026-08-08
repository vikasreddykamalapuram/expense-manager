import { computeRegimeTax, TaxDeductions, EMPTY_DEDUCTIONS } from './taxEngine';
import { TAX_CONFIGS, DEFAULT_FY } from '../constants/taxConfig';

export interface TakeHomeInputs {
  /** Annual cost-to-company. */
  annualCtc: number;
  /** Basic salary as a fraction of CTC (typically 0.40–0.50). */
  basicPct: number;
  regime: 'old' | 'new';
  fy: string;
  /** Extra deductions declared for the old regime (80C etc.). Employee PF is added automatically. */
  deductions?: TaxDeductions;
}

export interface TakeHomeResult {
  annualCtc: number;
  basic: number;
  employerPf: number;   // part of CTC, not paid in-hand
  gross: number;        // CTC - employer PF
  employeePf: number;   // deducted from salary, goes to your EPF
  professionalTax: number;
  incomeTax: number;    // per the chosen regime
  annualTakeHome: number;
  monthlyTakeHome: number;
  inHandPct: number;    // annualTakeHome / annualCtc
}

const PF_RATE = 0.12;                 // 12% of basic
const PF_WAGE_CEILING = 15000 * 12;   // EPF statutory wage ceiling (annual basic)
const PROFESSIONAL_TAX = 2400;        // typical annual professional tax (state-dependent)

/**
 * Estimate annual/monthly take-home from CTC.
 *
 * Model: basic = basicPct × CTC; employer & employee PF = 12% of basic (capped at
 * the ₹15k/month wage ceiling); gross = CTC − employer PF; income tax via the
 * chosen regime (employee PF counts toward 80C in the old regime); minus
 * professional tax. It's an estimate for planning, not a payslip.
 */
export function computeTakeHome(inputs: TakeHomeInputs): TakeHomeResult {
  const ctc = Math.max(0, inputs.annualCtc);
  const basicPct = Math.min(Math.max(inputs.basicPct || 0.5, 0.1), 1);
  const basic = ctc * basicPct;

  const pfBase = Math.min(basic, PF_WAGE_CEILING);
  const employerPf = pfBase * PF_RATE;
  const employeePf = pfBase * PF_RATE;

  const gross = Math.max(0, ctc - employerPf);
  const professionalTax = ctc > 0 ? PROFESSIONAL_TAX : 0;

  const fyConfig = TAX_CONFIGS[inputs.fy] ?? TAX_CONFIGS[DEFAULT_FY];
  // In the old regime, employee PF is an 80C deduction; fold it in.
  const deductions: TaxDeductions =
    inputs.regime === 'old'
      ? {
          ...EMPTY_DEDUCTIONS,
          ...(inputs.deductions ?? {}),
          section80C: (inputs.deductions?.section80C ?? 0) + employeePf,
        }
      : EMPTY_DEDUCTIONS;

  const incomeTax = computeRegimeTax(inputs.regime, gross, deductions, fyConfig).totalTax;

  const annualTakeHome = Math.max(0, gross - employeePf - professionalTax - incomeTax);

  return {
    annualCtc: ctc,
    basic,
    employerPf: Math.round(employerPf),
    gross: Math.round(gross),
    employeePf: Math.round(employeePf),
    professionalTax,
    incomeTax: Math.round(incomeTax),
    annualTakeHome: Math.round(annualTakeHome),
    monthlyTakeHome: Math.round(annualTakeHome / 12),
    inHandPct: ctc > 0 ? annualTakeHome / ctc : 0,
  };
}
