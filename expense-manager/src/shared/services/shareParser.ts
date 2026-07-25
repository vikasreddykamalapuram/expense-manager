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
  date?: string;
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
