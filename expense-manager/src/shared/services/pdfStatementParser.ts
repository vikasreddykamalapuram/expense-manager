// PDF Bank Statement Parser — extracts transactions from Indian bank PDF statements
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ParseResult, ParsedTransaction, BankFormat } from './statementParser';
import { suggestCategory } from './statementParser';

// Configure PDF.js worker using Vite's ?url import (bundled with the package)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Text Extraction ────────────────────────────────────

interface TextLine {
  y: number;
  text: string;
}

async function extractTextLines(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const allLines: TextLine[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group text items by Y-coordinate (same line = within ±2px)
    const lineMap = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as TextItem;
      if (!textItem.str.trim()) continue;

      const y = Math.round(textItem.transform[5]); // Y position
      const x = textItem.transform[4]; // X position

      // Find existing line within ±2px tolerance
      let lineY: number | null = null;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 2) {
          lineY = existingY;
          break;
        }
      }

      const targetY = lineY ?? y;
      if (!lineMap.has(targetY)) lineMap.set(targetY, []);
      lineMap.get(targetY)!.push({ x, str: textItem.str });
    }

    // Sort lines top-to-bottom (higher Y = higher on page in PDF coords)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
    for (const y of sortedYs) {
      const items = lineMap.get(y)!;
      // Sort items left-to-right within line
      items.sort((a, b) => a.x - b.x);
      const lineText = items.map((i) => i.str).join(' ').trim();
      if (lineText) allLines.push({ y, text: lineText });
    }
  }

  return allLines.map((l) => l.text);
}

// ─── Bank Detection ─────────────────────────────────────

const BANK_KEYWORDS: { bank: BankFormat; patterns: RegExp[] }[] = [
  { bank: 'icici', patterns: [/icici/i] },
  { bank: 'hdfc', patterns: [/hdfc/i] },
  { bank: 'sbi', patterns: [/state bank of india/i, /\bsbi\b/i] },
  { bank: 'axis', patterns: [/axis bank/i] },
];

function detectBankFromText(lines: string[]): BankFormat {
  // Check first 20 lines for bank name
  const headerText = lines.slice(0, 20).join(' ');
  for (const { bank, patterns } of BANK_KEYWORDS) {
    if (patterns.some((p) => p.test(headerText))) return bank;
  }
  return 'generic';
}

// ─── Account Number Extraction ──────────────────────────

function extractAccountNumber(lines: string[]): string | undefined {
  for (const line of lines.slice(0, 30)) {
    const match = line.match(/(?:account|a\/c|acct)[^\d]*(\d{4,})/i);
    if (match) return match[1].slice(-4); // last 4 digits only
  }
  return undefined;
}

// ─── Statement Period Detection ─────────────────────────

function extractStatementPeriod(lines: string[]): { start: string; end: string } | undefined {
  for (const line of lines.slice(0, 30)) {
    // "01/04/2024 to 30/04/2024" or "01-Apr-2024 to 30-Apr-2024"
    const rangeMatch = line.match(
      /(\d{1,2}[/\-.](?:\d{1,2}|[A-Za-z]{3,9})[/\-.](?:\d{4}|\d{2}))\s*(?:to|[-–])\s*(\d{1,2}[/\-.](?:\d{1,2}|[A-Za-z]{3,9})[/\-.](?:\d{4}|\d{2}))/i
    );
    if (rangeMatch) {
      const start = parseDateStr(rangeMatch[1]);
      const end = parseDateStr(rangeMatch[2]);
      if (start && end) return { start, end };
    }
  }
  return undefined;
}

// ─── Date Parsing ───────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function parseDateStr(dateStr: string): string | null {
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return formatDate(parseInt(y), parseInt(m), parseInt(d));
  }

  // DD/MM/YY
  const dmy2 = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (dmy2) {
    const [, d, m, y] = dmy2;
    return formatDate(parseInt(y) + 2000, parseInt(m), parseInt(d));
  }

  // DD Mon YYYY or DD-Mon-YYYY
  const dMonY = cleaned.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{4})/);
  if (dMonY) {
    const [, d, mon, y] = dMonY;
    const month = MONTHS[mon.toLowerCase()];
    if (month) return formatDate(parseInt(y), month, parseInt(d));
  }

  // YYYY-MM-DD
  const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return formatDate(parseInt(y), parseInt(m), parseInt(d));
  }

  return null;
}

function formatDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Amount Parsing ─────────────────────────────────────

function parseAmount(str: string): number | null {
  if (!str || !str.trim()) return null;

  let cleaned = str.trim()
    .replace(/[₹$€£¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '') // handles Indian format 1,50,000.00
    .replace(/\(([^)]+)\)/, '-$1') // (500) → -500
    .replace(/(Dr|Cr|DR|CR)\.?$/i, ''); // remove Dr/Cr suffixes

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

// ─── Date pattern at start of line ──────────────────────

const DATE_START_RE = /^(\d{1,2}[/\-.](?:\d{1,2}|[A-Za-z]{3,9})[/\-.](?:\d{4}|\d{2}))\b/;

function extractDateFromLine(line: string): { date: string; rest: string } | null {
  const match = line.match(DATE_START_RE);
  if (!match) return null;
  const dateStr = parseDateStr(match[1]);
  if (!dateStr) return null;
  return { date: dateStr, rest: line.slice(match[0].length).trim() };
}

// ─── Number extraction from end of line ─────────────────

function extractTrailingNumbers(text: string): { numbers: number[]; descPart: string } {
  // Match numbers at the end of the line (may have multiple columns)
  // Pattern: capture sequences of number-like tokens from the right
  const numbers: number[] = [];
  let remaining = text.trim();

  // Repeatedly extract the last number
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Match a number (with optional commas, decimal, negative) at end
    const numMatch = remaining.match(/\s+([\d,]+\.?\d*)\s*$/);
    if (!numMatch) break;
    const parsed = parseAmount(numMatch[1]);
    if (parsed === null) break;
    numbers.unshift(parsed);
    remaining = remaining.slice(0, remaining.length - numMatch[0].length).trim();
  }

  return { numbers, descPart: remaining };
}

// ─── Transaction line parsing ───────────────────────────

function parseTransactionLine(
  line: string,
  bank: BankFormat,
): { date: string; description: string; debit: number | null; credit: number | null; balance: number | null; reference?: string } | null {
  const dateResult = extractDateFromLine(line);
  if (!dateResult) return null;

  const { date, rest } = dateResult;
  if (!rest) return null;

  const { numbers, descPart } = extractTrailingNumbers(rest);
  if (numbers.length === 0) return null;

  let debit: number | null = null;
  let credit: number | null = null;
  let balance: number | null = null;
  let description = descPart;

  // Check if line contains Dr/Cr indicator
  const drCrIndicator = rest.match(/\b(Dr|Cr|DR|CR)\b/i);

  if (bank === 'hdfc' || bank === 'sbi' || bank === 'axis') {
    // Format: Date | Desc [| Ref] | Debit | Credit | Balance
    // Typically 3 numbers at the end: withdrawal, deposit, balance
    // But one of debit/credit is usually 0 or empty
    if (numbers.length >= 3) {
      balance = numbers[numbers.length - 1];
      credit = numbers[numbers.length - 2];
      debit = numbers[numbers.length - 3];
      // If debit and credit are both > 0, one might be a ref number — use balance difference heuristic
      if (debit > 0 && credit > 0) {
        // Keep as is — user will see both
      }
    } else if (numbers.length === 2) {
      // Could be amount + balance
      balance = numbers[1];
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = numbers[0];
      } else {
        debit = numbers[0];
      }
    } else if (numbers.length === 1) {
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = numbers[0];
      } else {
        debit = numbers[0];
      }
    }
  } else if (bank === 'icici') {
    // ICICI: Date | Description | Debit/Credit amount | Balance
    if (numbers.length >= 2) {
      balance = numbers[numbers.length - 1];
      const amt = numbers[numbers.length - 2];
      // Detect Dr/Cr from text
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = amt;
      } else {
        debit = amt;
      }
    } else if (numbers.length === 1) {
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = numbers[0];
      } else {
        debit = numbers[0];
      }
    }
  } else {
    // Generic: try to determine from number count
    if (numbers.length >= 3) {
      balance = numbers[numbers.length - 1];
      credit = numbers[numbers.length - 2];
      debit = numbers[numbers.length - 3];
    } else if (numbers.length === 2) {
      balance = numbers[1];
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = numbers[0];
      } else {
        debit = numbers[0];
      }
    } else if (numbers.length === 1) {
      if (drCrIndicator && drCrIndicator[1].toLowerCase() === 'cr') {
        credit = numbers[0];
      } else {
        debit = numbers[0];
      }
    }
  }

  // Clean description: remove Dr/Cr markers
  description = description.replace(/\b(Dr|Cr|DR|CR)\.?\b/gi, '').replace(/\s{2,}/g, ' ').trim();

  // Zero amounts are effectively null
  if (debit === 0) debit = null;
  if (credit === 0) credit = null;

  if (debit === null && credit === null) return null;

  return { date, description, debit, credit, balance };
}

// ─── Main PDF Parser ────────────────────────────────────

export async function parsePdfStatement(
  file: File,
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>,
  bankHint?: BankFormat,
): Promise<ParseResult> {
  const errors: string[] = [];

  let lines: string[];
  try {
    lines = await extractTextLines(file);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('password')) {
      return {
        transactions: [],
        errors: ['This PDF is password-protected. Please remove the password and try again.'],
      };
    }
    return { transactions: [], errors: [`Failed to read PDF: ${msg}`] };
  }

  if (lines.length === 0) {
    return {
      transactions: [],
      errors: ['This appears to be a scanned PDF. Please use a text-based PDF export from your bank\'s website.'],
    };
  }

  // Check if there's enough text (scanned PDFs may extract very little)
  const totalTextLength = lines.reduce((sum, l) => sum + l.length, 0);
  if (totalTextLength < 50) {
    return {
      transactions: [],
      errors: ['This appears to be a scanned PDF. Please use a text-based PDF export from your bank\'s website.'],
    };
  }

  const bank: BankFormat = bankHint ?? detectBankFromText(lines);
  const accountNumber = extractAccountNumber(lines);
  const statementPeriod = extractStatementPeriod(lines);

  const transactions: ParsedTransaction[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseTransactionLine(lines[i], bank);
    if (!parsed) continue;

    let amount: number;
    let txnType: 'income' | 'expense' | 'transfer';

    if (parsed.debit !== null && parsed.debit > 0) {
      amount = parsed.debit;
      txnType = 'expense';
    } else if (parsed.credit !== null && parsed.credit > 0) {
      amount = parsed.credit;
      txnType = 'income';
    } else {
      errors.push(`Line ${i + 1}: Could not determine amount`);
      continue;
    }

    const suggestion = suggestCategory(parsed.description, categories);
    if (suggestion.category === 'transfer') {
      txnType = 'transfer';
    }

    transactions.push({
      date: parsed.date,
      description: parsed.description,
      amount,
      type: txnType,
      category: suggestion.category,
      categoryId: suggestion.categoryId,
      reference: parsed.reference,
      balance: parsed.balance ?? undefined,
    });
  }

  // Derive period from transactions if not found in header
  let period = statementPeriod;
  if (!period && transactions.length > 0) {
    const dates = transactions.map((t) => t.date).sort();
    period = { start: dates[0], end: dates[dates.length - 1] };
  }

  const bankNames: Record<BankFormat, string | undefined> = {
    icici: 'ICICI Bank',
    hdfc: 'HDFC Bank',
    sbi: 'State Bank of India',
    axis: 'Axis Bank',
    generic: undefined,
  };

  return {
    transactions,
    bankName: bankNames[bank],
    accountNumber,
    statementPeriod: period,
    errors,
  };
}
