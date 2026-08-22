// Pure receipt/bill text scanner — no OCR engine dependency, so it is
// unit-testable and safe to import anywhere. ocrService.ts loads the heavy
// Tesseract worker and delegates the parsing to scanReceiptText() here.
//
// The job is deliberately narrow: turn the messy text of a shop receipt into a
// best-guess transaction. Everything is optional and the user confirms or edits
// every field before anything is saved.
import type { PaymentMethod } from '../types';

export interface ReceiptLineItem {
  description: string;
  amount: number;
}

export interface ParsedReceipt {
  /** Grand total actually paid. */
  amount?: number;
  /** Shop/vendor name, taken from the receipt header. */
  merchant?: string;
  /** ISO YYYY-MM-DD. */
  date?: string;
  paymentMethod?: PaymentMethod;
  /** Last 4 digits of the card/account, when the receipt prints them. */
  account?: string;
  /** Tax charged (GST/VAT), when itemised. */
  tax?: number;
  lineItems: ReceiptLineItem[];
  /**
   * How much to trust this. `high` = an explicit grand-total label was found;
   * `medium` = we fell back to the largest amount; `low` = no amount at all.
   */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Labels that mark the amount the customer actually paid, most specific first.
 * Order matters: a receipt often prints both "Total" and "Grand Total", and the
 * latter is the one that includes tax.
 */
const TOTAL_LABELS: RegExp[] = [
  /\b(?:grand\s*total|net\s*(?:payable|amount|total)|amount\s*(?:due|payable)|total\s*payable)\b/i,
  /\b(?:total\s*amount|bill\s*(?:total|amount)|invoice\s*total)\b/i,
  /\btotal\b/i,
];

/** Lines that carry an amount but are NOT what the customer paid. */
const NON_TOTAL_LABELS =
  /\b(?:sub\s*total|subtotal|taxable|discount|savings?|round\s*off|change|cash\s*tendered|tendered|balance|cgst|sgst|igst|gst|vat|service\s*charge|tip|mrp|qty)\b/i;

const TAX_LABELS = /\b(?:total\s*(?:gst|tax)|gst|cgst|sgst|igst|vat|tax)\b/i;

/** Payment mode detection, most specific first so "credit card" beats "card". */
const PAYMENT_PATTERNS: Array<[RegExp, PaymentMethod]> = [
  [/\b(?:upi|gpay|g\s?pay|google\s*pay|phonepe|phone\s*pe|paytm|bhim|vpa|@(?:ok|ybl|paytm|upi))\b/i, 'upi'],
  [/\b(?:net\s*banking|netbanking|internet\s*banking|imps|neft|rtgs|bank\s*transfer)\b/i, 'net_banking'],
  [/\b(?:credit\s*card|debit\s*card|card\s*(?:no|number|ending|payment)|visa|master\s*card|mastercard|rupay|amex|swipe|pos\b|emv|chip\s*&?\s*pin|contactless)\b/i, 'card'],
  [/\bcheque|check\s*no\b/i, 'cheque'],
  [/\b(?:auto\s*(?:debit|pay)|standing\s*instruction|mandate|e-?nach|nach)\b/i, 'auto_debit'],
  [/\bcash\b/i, 'cash'],
];

/** Card/account last 4: "XXXX1234", "ending 1234", "Card No: ****1234". */
const ACCOUNT_PATTERNS: RegExp[] = [
  /(?:card|a\/c|acct|account)\s*(?:no\.?|number|ending)?\s*[:#]?\s*[xX*\u2022]{2,}\s*([0-9]{4})\b/,
  /\bending\s*(?:in\s*)?([0-9]{4})\b/i,
  /[xX*\u2022]{4,}\s*([0-9]{4})\b/,
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Noise that shows up above the shop name and must not be mistaken for it. */
const HEADER_NOISE =
  /^(?:tax\s*invoice|invoice|receipt|bill|cash\s*memo|retail\s*invoice|gstin|gst\s*no|cin|fssai|phone|tel|ph\b|mob|email|www\.|http|order\s*id|token)/i;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fullYear(y: string): number {
  const n = parseInt(y, 10);
  return n < 100 ? 2000 + n : n;
}

/**
 * Parse a money token. OCR frequently reads `.` as `,` and vice versa, so treat
 * a trailing group of exactly two digits as the decimal part regardless of which
 * separator precedes it.
 */
export function parseMoney(token: string): number | null {
  const cleaned = token.replace(/[₹$€£\s]|(?:INR|Rs\.?)/gi, '').replace(/[oO]/g, '0');
  const m = cleaned.match(/^-?[\d.,]+$/);
  if (!m) return null;
  const digitsOnly = cleaned.replace(/[.,]/g, '');
  if (!digitsOnly || !/^\d+$/.test(digitsOnly.replace(/^-/, ''))) return null;

  const decimal = cleaned.match(/[.,](\d{2})$/);
  const value = decimal
    ? parseFloat(`${digitsOnly.slice(0, -2)}.${decimal[1]}`)
    : parseFloat(digitsOnly);
  return isNaN(value) ? null : Math.round(value * 100) / 100;
}

/** Every money-looking amount in a line, left to right. */
function amountsIn(line: string): number[] {
  const tokens = line.match(/(?:₹|Rs\.?|INR)?\s?\d[\d,.]*\d|\d/gi) || [];
  const out: number[] = [];
  for (const t of tokens) {
    const n = parseMoney(t);
    if (n !== null && n > 0) out.push(n);
  }
  return out;
}

/** The rightmost amount on a line — receipts right-align the value column. */
function lastAmountIn(line: string): number | null {
  const all = amountsIn(line);
  return all.length ? all[all.length - 1] : null;
}

function extractDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const mon = text.match(/\b(\d{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ](\d{2,4})\b/);
  if (mon) {
    const m = MONTHS[mon[2].toLowerCase()];
    if (m) return `${fullYear(mon[3])}-${pad(m)}-${pad(parseInt(mon[1], 10))}`;
  }

  // Day-first (Indian convention) unless the first field cannot be a day.
  const dmy = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (dmy) {
    let d = parseInt(dmy[1], 10);
    let m = parseInt(dmy[2], 10);
    if (d > 12 && m <= 12) {
      // unambiguous day-first
    } else if (m > 12 && d <= 12) {
      [d, m] = [m, d];
    }
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${fullYear(dmy[3])}-${pad(m)}-${pad(d)}`;
    }
  }
  return undefined;
}

/**
 * The shop name is almost always the first substantial line of the receipt,
 * above the address and the invoice metadata.
 */
function extractMerchant(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 6)) {
    const t = line.trim();
    if (t.length < 3 || t.length > 40) continue;
    if (HEADER_NOISE.test(t)) continue;
    if (!/[A-Za-z]{3}/.test(t)) continue;
    // Skip lines that are mostly digits (phone numbers, GSTINs, addresses).
    const digits = (t.match(/\d/g) || []).length;
    if (digits > t.length / 3) continue;
    return t.replace(/\s+/g, ' ').replace(/[*|_]+/g, '').trim();
  }
  return undefined;
}

function extractPaymentMethod(text: string): PaymentMethod | undefined {
  for (const [rx, method] of PAYMENT_PATTERNS) {
    if (rx.test(text)) return method;
  }
  return undefined;
}

function extractAccount(text: string): string | undefined {
  for (const rx of ACCOUNT_PATTERNS) {
    const m = text.match(rx);
    if (m) return m[1];
  }
  return undefined;
}

/**
 * Find the grand total. Walks the total labels from most to least specific and
 * takes the last matching line, because receipts print the payable amount at
 * the bottom and OCR sometimes repeats headers.
 */
function extractTotal(lines: string[]): { amount?: number; confident: boolean } {
  for (const label of TOTAL_LABELS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!label.test(line)) continue;
      if (NON_TOTAL_LABELS.test(line)) continue;

      const onSameLine = lastAmountIn(line.replace(label, ' '));
      if (onSameLine !== null) return { amount: onSameLine, confident: true };

      // Some layouts put the label and the value on consecutive lines.
      const next = lines[i + 1];
      if (next && !TOTAL_LABELS.some((l) => l.test(next))) {
        const below = lastAmountIn(next);
        if (below !== null) return { amount: below, confident: true };
      }
    }
  }

  // No labelled total — fall back to the largest amount on the receipt, which
  // on a well-formed bill is the total. Flagged as lower confidence.
  const all = lines.flatMap((l) => (NON_TOTAL_LABELS.test(l) ? [] : amountsIn(l)));
  if (!all.length) return { confident: false };
  return { amount: Math.max(...all), confident: false };
}

function extractTax(lines: string[]): number | undefined {
  let total = 0;
  let found = false;
  for (const line of lines) {
    if (!TAX_LABELS.test(line)) continue;
    if (/\b(?:gstin|gst\s*no|tax\s*invoice)\b/i.test(line)) continue;
    const amt = lastAmountIn(line.replace(TAX_LABELS, ' '));
    if (amt !== null) {
      total += amt;
      found = true;
    }
  }
  return found ? Math.round(total * 100) / 100 : undefined;
}

function extractLineItems(lines: string[], total?: number): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  for (const line of lines) {
    if (NON_TOTAL_LABELS.test(line) || TOTAL_LABELS.some((l) => l.test(line))) continue;
    const amt = lastAmountIn(line);
    if (amt === null || amt <= 0) continue;
    if (total !== undefined && amt >= total) continue;

    const description = line
      .replace(/(?:₹|Rs\.?|INR)?\s?\d[\d,.]*\d\s*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (description.length < 2 || !/[A-Za-z]{2}/.test(description)) continue;
    items.push({ description: description.slice(0, 60), amount: amt });
  }
  return items.slice(0, 25);
}

/**
 * Turn OCR'd receipt text into a transaction candidate. Pure and synchronous —
 * all the heavy lifting (image → text) happens in ocrService.ts.
 */
export function scanReceiptText(raw: string | undefined | null): ParsedReceipt {
  const empty: ParsedReceipt = { lineItems: [], confidence: 'low' };
  if (!raw) return empty;

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!lines.length) return empty;

  const text = lines.join('\n');
  const { amount, confident } = extractTotal(lines);

  return {
    amount,
    merchant: extractMerchant(lines),
    date: extractDate(text),
    paymentMethod: extractPaymentMethod(text),
    account: extractAccount(text),
    tax: extractTax(lines),
    lineItems: extractLineItems(lines, amount),
    confidence: amount === undefined ? 'low' : confident ? 'high' : 'medium',
  };
}
