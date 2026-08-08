/**
 * Loan amortization helpers.
 *
 * "Compute, don't ask" — instead of making the user type outstanding/repaid/principal,
 * we derive the full picture from a few inputs (original principal, annual interest rate,
 * tenure in months, and start date) using a standard reducing-balance EMI schedule.
 */

export interface LoanInputs {
  /** Original sanctioned principal. */
  principal: number;
  /** Annual interest rate in percent (e.g. 8.5 for 8.5% p.a.). */
  annualRatePct: number;
  /** Total tenure in months. */
  tenureMonths: number;
}

export interface LoanStatus {
  /** Equated Monthly Instalment. */
  emi: number;
  /** Whole EMIs already paid as of the reference date (clamped to [0, tenure]). */
  emisPaid: number;
  /** Total number of EMIs over the full tenure. */
  totalEmis: number;
  /** Outstanding principal still owed as of the reference date. */
  outstandingPrincipal: number;
  /** Principal repaid so far (original principal - outstanding). */
  principalRepaid: number;
  /** Interest paid so far. */
  interestPaid: number;
  /** Total amount payable over the full tenure (emi * tenure). */
  totalPayable: number;
  /** Total interest over the full tenure. */
  totalInterest: number;
  /** Reference-date value of (principalRepaid / principal), 0..1. */
  repaidFraction: number;
}

/** Monthly interest rate as a fraction (e.g. 8.4% p.a. -> 0.007). */
function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 12 / 100;
}

/**
 * Equated Monthly Instalment for a reducing-balance loan.
 * Falls back to simple division when the rate is 0.
 */
export function computeEmi({ principal, annualRatePct, tenureMonths }: LoanInputs): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = monthlyRate(annualRatePct);
  if (r === 0) return principal / tenureMonths;
  const pow = Math.pow(1 + r, tenureMonths);
  return (principal * r * pow) / (pow - 1);
}

/**
 * Outstanding principal after `paidCount` EMIs on a reducing-balance loan.
 * Uses the closed-form balance formula: B_k = P(1+r)^k - EMI * ((1+r)^k - 1) / r.
 */
export function outstandingAfter(inputs: LoanInputs, paidCount: number): number {
  const { principal, annualRatePct, tenureMonths } = inputs;
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const paid = clamp(Math.floor(paidCount), 0, tenureMonths);
  if (paid <= 0) return principal;
  if (paid >= tenureMonths) return 0;
  const r = monthlyRate(annualRatePct);
  const emi = computeEmi(inputs);
  if (r === 0) return Math.max(0, principal - emi * paid);
  const pow = Math.pow(1 + r, paid);
  const balance = principal * pow - emi * ((pow - 1) / r);
  return Math.max(0, balance);
}

/**
 * Whole months elapsed between `start` and `asOf` (0 if start is in the future).
 * A loan's first EMI is due one month after disbursal, so elapsed months == EMIs paid.
 */
export function monthsElapsed(start: Date | string, asOf: Date | string = new Date()): number {
  const s = typeof start === 'string' ? new Date(start) : start;
  const a = typeof asOf === 'string' ? new Date(asOf) : asOf;
  if (isNaN(s.getTime()) || isNaN(a.getTime()) || a <= s) return 0;
  let months = (a.getFullYear() - s.getFullYear()) * 12 + (a.getMonth() - s.getMonth());
  if (a.getDate() < s.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Full derived status of a loan as of a reference date.
 * If `emisPaidOverride` is provided it takes precedence over date-based elapsed months.
 */
export function loanStatus(
  inputs: LoanInputs,
  opts: { startDate?: Date | string; asOf?: Date | string; emisPaidOverride?: number } = {}
): LoanStatus {
  const { principal, tenureMonths } = inputs;
  const emi = computeEmi(inputs);
  const totalEmis = Math.max(0, Math.floor(tenureMonths));
  const totalPayable = emi * totalEmis;
  const totalInterest = Math.max(0, totalPayable - principal);

  const rawPaid =
    opts.emisPaidOverride != null
      ? opts.emisPaidOverride
      : opts.startDate != null
        ? monthsElapsed(opts.startDate, opts.asOf)
        : 0;
  const emisPaid = clamp(Math.floor(rawPaid), 0, totalEmis);

  const outstandingPrincipal = outstandingAfter(inputs, emisPaid);
  const principalRepaid = Math.max(0, principal - outstandingPrincipal);
  const interestPaid = Math.max(0, emi * emisPaid - principalRepaid);
  const repaidFraction = principal > 0 ? clamp(principalRepaid / principal, 0, 1) : 0;

  return {
    emi,
    emisPaid,
    totalEmis,
    outstandingPrincipal,
    principalRepaid,
    interestPaid,
    totalPayable,
    totalInterest,
    repaidFraction,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
