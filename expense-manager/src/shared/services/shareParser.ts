/**
 * Parses shared text (bank SMS, receipt OCR, email confirmation, etc.) to
 * extract a best-guess transaction. Everything is optional — the form gets
 * whatever we can find and the user confirms/edits before saving.
 */

export interface ParsedShare {
  amount?: number;
  merchant?: string;
  note?: string;
  type?: 'income' | 'expense';
  date?: string;    // ISO YYYY-MM-DD when a date is detected
  account?: string; // last 4 digits of the account/card, when detected
}

/** Bank SMS patterns — Indian banks use "debited/credited by INR 500.00" style. */
const AMOUNT_PATTERNS: RegExp[] = [
  // "INR 1,234.50" — comma-grouped Indian format (require the comma so we don't
  // greedily match a 3-digit prefix of a longer plain number like 50000).
  /(?:INR|Rs\.?|₹)\s?([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?)/i,
  // "INR 50000" / "Rs 500.00" — plain number after currency token.
  /(?:INR|Rs\.?|₹)\s?([0-9]+(?:\.[0-9]{1,2})?)(?!\d)/i,
  // "Amount: 500" / "Total: 1234.50"
  /(?:amount|total|paid|charged)[:\s]+([0-9]+(?:\.[0-9]{1,2})?)/i,
];

const DEBIT_KEYWORDS = /(debited|spent|paid|purchase|withdrawn|charged|txn|transaction|deducted)/i;
const CREDIT_KEYWORDS = /(credited|received|refund|deposited|salary|cashback)/i;

// "at MERCHANT" / "to MERCHANT" / "@ MERCHANT"
const MERCHANT_PATTERNS: RegExp[] = [
  /(?:at|@)\s+([A-Za-z][A-Za-z0-9&'\s]{2,30}?)(?:\s+on|\s+for|\.|,|$)/i,
  /(?:to|from)\s+([A-Za-z][A-Za-z0-9&'\s]{2,30}?)(?:\s+on|\s+for|\.|,|$)/i,
];

function normalize(numStr: string): number {
  return parseFloat(numStr.replace(/,/g, ''));
}

// "A/c XX1234", "Card ending 1234", "a/c no. XXXX1234" — capture trailing 4 digits.
const ACCOUNT_PATTERNS: RegExp[] = [
  /(?:a\/c|acct|account|card)\s*(?:no\.?|ending|xx+|\*+|x+)?\s*[:#]?\s*[xX*]*([0-9]{4})\b/i,
  /\bending\s+([0-9]{4})\b/i,
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// "25-Jul-26", "25 Jul 2026", "25/07/2026", "2026-07-25"
const DATE_PATTERNS: RegExp[] = [
  /\b([0-9]{1,2})[-/ ]([A-Za-z]{3})[A-Za-z]*[-/ ]([0-9]{2,4})\b/,   // 25-Jul-26
  /\b([0-9]{1,2})[-/]([0-9]{1,2})[-/]([0-9]{2,4})\b/,               // 25/07/2026
  /\b([0-9]{4})-([0-9]{2})-([0-9]{2})\b/,                            // 2026-07-25 (ISO)
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fullYear(y: string): number {
  const n = parseInt(y, 10);
  return n < 100 ? 2000 + n : n;
}

/** Best-effort date extraction → ISO YYYY-MM-DD, or undefined. */
function extractDate(text: string): string | undefined {
  // ISO first (unambiguous)
  const iso = text.match(DATE_PATTERNS[2]);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd-MMM-yy
  const mon = text.match(DATE_PATTERNS[0]);
  if (mon) {
    const m = MONTHS[mon[2].toLowerCase()];
    if (m) return `${fullYear(mon[3])}-${pad(m)}-${pad(parseInt(mon[1], 10))}`;
  }
  // dd/mm/yyyy (assume day-first, Indian convention)
  const dmy = text.match(DATE_PATTERNS[1]);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${fullYear(dmy[3])}-${pad(m)}-${pad(d)}`;
    }
  }
  return undefined;
}

export function parseSharedText(raw: string | undefined | null): ParsedShare {
  if (!raw) return {};
  const text = raw.trim();
  if (!text) return {};

  const result: ParsedShare = { note: text.slice(0, 200) };

  for (const rx of AMOUNT_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      const n = normalize(m[1]);
      if (!isNaN(n) && n > 0) {
        result.amount = n;
        break;
      }
    }
  }

  if (CREDIT_KEYWORDS.test(text)) result.type = 'income';
  else if (DEBIT_KEYWORDS.test(text)) result.type = 'expense';

  for (const rx of MERCHANT_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      result.merchant = m[1].trim().replace(/\s+/g, ' ');
      break;
    }
  }

  for (const rx of ACCOUNT_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      result.account = m[1];
      break;
    }
  }

  const date = extractDate(text);
  if (date) result.date = date;

  // If merchant found, use it as the primary note (user can edit).
  if (result.merchant) result.note = result.merchant;

  return result;
}

/** Build the deep-link URL that navigates to /add with prefill query params. */
export function buildAddDeepLink(parsed: ParsedShare, basePath = '/'): string {
  const params = new URLSearchParams();
  if (parsed.amount) params.set('amount', String(parsed.amount));
  if (parsed.note) params.set('note', parsed.note);
  if (parsed.type) params.set('type', parsed.type);
  const qs = params.toString();
  const base = basePath.replace(/\/$/, '');
  return `${base}/add${qs ? '?' + qs : ''}`;
}
