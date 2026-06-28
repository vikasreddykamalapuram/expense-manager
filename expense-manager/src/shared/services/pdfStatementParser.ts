// PDF Bank Statement Parser — extracts transactions from Indian bank PDF statements
// Uses X-coordinate column mapping for reliable column detection across bank formats
import * as pdfjsLib from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { ParseResult, ParsedTransaction, BankFormat } from './statementParser';
import { suggestCategory } from './statementParser';

// Configure PDF.js worker using Vite's ?url import (bundled with the package)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ─── Types ──────────────────────────────────────────────

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

interface PageData {
  items: TextBlock[];
  width: number;
  height: number;
}

interface TextRow {
  y: number;
  items: TextBlock[]; // sorted left-to-right by x
}

type ColumnType = 'date' | 'description' | 'debit' | 'credit' | 'balance' | 'reference';

interface ColumnRange {
  xMin: number;
  xMax: number;
}

interface ColumnLayout {
  date: ColumnRange;
  description: ColumnRange;
  debit: ColumnRange | null;
  credit: ColumnRange | null;
  balance: ColumnRange | null;
  reference: ColumnRange | null;
}

// ─── Text Extraction ────────────────────────────────────

async function extractPageData(file: File, password?: string): Promise<PageData[]> {
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer, ...(password ? { password } : {}) });
  const pdf = await loadingTask.promise;
  const pages: PageData[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextBlock[] = [];

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const textItem = item as TextItem;
      if (!textItem.str.trim()) continue;

      items.push({
        text: textItem.str,
        x: textItem.transform[4],
        y: textItem.transform[5],
        width: textItem.width,
        fontSize: textItem.transform[0],
      });
    }

    pages.push({ items, width: viewport.width, height: viewport.height });
  }

  return pages;
}

// ─── Row Grouping ───────────────────────────────────────

const Y_TOLERANCE = 3;

function groupIntoRows(items: TextBlock[]): TextRow[] {
  const rowMap = new Map<number, TextBlock[]>();

  for (const item of items) {
    const y = Math.round(item.y);
    let matchedY: number | null = null;
    for (const existingY of rowMap.keys()) {
      if (Math.abs(existingY - y) <= Y_TOLERANCE) {
        matchedY = existingY;
        break;
      }
    }
    const targetY = matchedY ?? y;
    if (!rowMap.has(targetY)) rowMap.set(targetY, []);
    rowMap.get(targetY)!.push(item);
  }

  // Sort rows top-to-bottom (higher Y = higher on page in PDF coords)
  const sortedYs = [...rowMap.keys()].sort((a, b) => b - a);
  return sortedYs.map((y) => ({
    y,
    items: rowMap.get(y)!.sort((a, b) => a.x - b.x),
  }));
}

function rowToText(row: TextRow): string {
  return row.items.map((i) => i.text).join(' ').trim();
}

// ─── Header Detection ───────────────────────────────────

const HEADER_KEYWORDS: Record<ColumnType, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'trans date', 'value date', 'posting date'],
  description: ['description', 'narration', 'particulars', 'remarks', 'transaction remarks', 'details', 'transaction details'],
  debit: ['debit', 'withdrawal', 'dr', 'debit amount', 'withdrawal (dr)', 'withdrawal(dr)', 'withdrawals', 'debit(dr)'],
  credit: ['credit', 'deposit', 'cr', 'credit amount', 'deposit (cr)', 'deposit(cr)', 'deposits', 'credit(cr)'],
  balance: ['balance', 'closing balance', 'running balance', 'bal'],
  reference: ['ref', 'reference', 'cheque', 'chq', 'ref no', 'cheque no', 'ref no./cheque no.'],
};

/** Check whether a single text block (or a few merged blocks) matches a header keyword. */
function matchHeaderColumn(text: string): ColumnType | null {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  for (const [col, keywords] of Object.entries(HEADER_KEYWORDS) as [ColumnType, string[]][]) {
    for (const kw of keywords) {
      if (lower === kw || lower.replace(/\s+/g, ' ') === kw) return col;
    }
  }
  // Partial / substring match for composite header cells
  for (const [col, keywords] of Object.entries(HEADER_KEYWORDS) as [ColumnType, string[]][]) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return col;
    }
  }
  return null;
}

/**
 * Try to detect the header row within a set of rows. Some banks split headers
 * across two consecutive rows (e.g., "Withdrawal" on one line, "(Dr)" on the next).
 * We merge up to two rows when checking.
 */
function detectHeaderRow(
  rows: TextRow[],
  pageWidth: number,
): { layout: ColumnLayout; headerEndIndex: number } | null {
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    // Try single row first, then merged with the next row
    const candidates = [rows[i].items];
    if (i + 1 < rows.length) {
      candidates.push([...rows[i].items, ...rows[i + 1].items].sort((a, b) => a.x - b.x));
    }

    for (let ci = 0; ci < candidates.length; ci++) {
      const items = candidates[ci];
      const layout = tryBuildLayout(items, pageWidth);
      if (layout) {
        return { layout, headerEndIndex: i + 1 + ci };
      }
    }
  }
  return null;
}

function tryBuildLayout(items: TextBlock[], pageWidth: number): ColumnLayout | null {
  // Merge adjacent items that might form a multi-word header (e.g. "Txn" + "Date")
  const merged = mergeAdjacentItems(items);

  const detected: { col: ColumnType; x: number; xEnd: number }[] = [];

  for (const item of merged) {
    const col = matchHeaderColumn(item.text);
    if (col) {
      // Avoid duplicate column types — keep the first occurrence
      if (!detected.some((d) => d.col === col)) {
        detected.push({ col, x: item.x, xEnd: item.x + item.width });
      }
    }
  }

  // Need at least date + description + one amount column
  const hasDate = detected.some((d) => d.col === 'date');
  const hasDesc = detected.some((d) => d.col === 'description');
  const hasAmount = detected.some((d) => d.col === 'debit' || d.col === 'credit' || d.col === 'balance');

  if (!hasDate || !hasDesc || !hasAmount) return null;

  // Sort by x position to compute boundaries
  detected.sort((a, b) => a.x - b.x);

  const buildRange = (col: ColumnType): ColumnRange | null => {
    const idx = detected.findIndex((d) => d.col === col);
    if (idx === -1) return null;
    const entry = detected[idx];
    const xMin = idx === 0
      ? 0
      : (detected[idx - 1].xEnd + entry.x) / 2;
    const xMax = idx === detected.length - 1
      ? pageWidth
      : (entry.xEnd + detected[idx + 1].x) / 2;
    return { xMin, xMax };
  };

  const dateRange = buildRange('date');
  const descRange = buildRange('description');
  if (!dateRange || !descRange) return null;

  return {
    date: dateRange,
    description: descRange,
    debit: buildRange('debit'),
    credit: buildRange('credit'),
    balance: buildRange('balance'),
    reference: buildRange('reference'),
  };
}

/** Merge adjacent text blocks that are close together (gap < 10px) into single items. */
function mergeAdjacentItems(items: TextBlock[]): TextBlock[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const result: TextBlock[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const cur = sorted[i];
    const gap = cur.x - (prev.x + prev.width);
    if (gap < 10 && gap >= -2) {
      // Merge
      prev.text = prev.text + ' ' + cur.text;
      prev.width = (cur.x + cur.width) - prev.x;
    } else {
      result.push({ ...cur });
    }
  }
  return result;
}

// ─── Column Assignment ──────────────────────────────────

interface AssignedRow {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  reference: string;
}

function assignItemsToColumns(row: TextRow, layout: ColumnLayout): AssignedRow {
  const result: AssignedRow = { date: '', description: '', debit: '', credit: '', balance: '', reference: '' };
  const buckets: Record<keyof AssignedRow, string[]> = {
    date: [], description: [], debit: [], credit: [], balance: [], reference: [],
  };

  for (const item of row.items) {
    const mid = item.x + item.width / 2;
    const col = findColumn(mid, layout);
    buckets[col].push(item.text);
  }

  for (const key of Object.keys(buckets) as (keyof AssignedRow)[]) {
    result[key] = buckets[key].join(' ').trim();
  }
  return result;
}

function findColumn(xMid: number, layout: ColumnLayout): keyof AssignedRow {
  // Check specific columns first (narrower ranges), fall back to description
  const checks: { key: keyof AssignedRow; range: ColumnRange | null }[] = [
    { key: 'date', range: layout.date },
    { key: 'debit', range: layout.debit },
    { key: 'credit', range: layout.credit },
    { key: 'balance', range: layout.balance },
    { key: 'reference', range: layout.reference },
    { key: 'description', range: layout.description },
  ];

  let bestCol: keyof AssignedRow = 'description';
  let bestDist = Infinity;

  for (const { key, range } of checks) {
    if (!range) continue;
    if (xMid >= range.xMin && xMid <= range.xMax) {
      // Item is within this column's range — pick the closest center
      const center = (range.xMin + range.xMax) / 2;
      const dist = Math.abs(xMid - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestCol = key;
      }
    }
  }

  return bestCol;
}

// ─── Bank Detection ─────────────────────────────────────

const BANK_KEYWORDS: { bank: BankFormat; patterns: RegExp[] }[] = [
  { bank: 'icici', patterns: [/icici/i] },
  { bank: 'hdfc', patterns: [/hdfc/i] },
  { bank: 'sbi', patterns: [/state bank of india/i, /\bsbi\b/i] },
  { bank: 'axis', patterns: [/axis bank/i] },
];

function detectBankFromText(lines: string[]): BankFormat {
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
    if (match) return match[1].slice(-4);
  }
  return undefined;
}

// ─── Statement Period Detection ─────────────────────────

function extractStatementPeriod(lines: string[]): { start: string; end: string } | undefined {
  for (const line of lines.slice(0, 30)) {
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
  const dMonY = cleaned.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})/);
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

  const cleaned = str.trim()
    .replace(/[₹$€£¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/\(([^)]+)\)/, '-$1')
    .replace(/(Dr|Cr|DR|CR)\.?$/i, '');

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

// ─── Skip Patterns ──────────────────────────────────────

const SKIP_PATTERNS = [
  /opening balance/i, /closing balance/i, /b\/f/i, /c\/f/i,
  /brought forward/i, /carried forward/i, /\btotal\b/i, /page\s*\d+/i,
  /statement\s+(of|summary|generated)/i, /generated\s+on/i, /disclaimer/i,
  /^$/, /^\s+$/,
];

function shouldSkipRow(text: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(text));
}

// ─── Dr/Cr Indicator Handling ───────────────────────────

function extractDrCr(text: string): 'dr' | 'cr' | null {
  const match = text.match(/\b(Dr|Cr|DR|CR)\b/i);
  if (!match) return null;
  return match[1].toLowerCase() === 'cr' ? 'cr' : 'dr';
}

// ─── Transaction Extraction from Column-Mapped Rows ─────

interface RawTransaction {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  reference?: string;
}

function parseTransactionFromRow(
  assigned: AssignedRow,
  layout: ColumnLayout,
): RawTransaction | null {
  // Parse date
  const dateStr = parseDateStr(assigned.date);
  if (!dateStr) return null;

  const description = assigned.description
    .replace(/\b(Dr|Cr|DR|CR)\.?\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let debit = parseAmount(assigned.debit);
  let credit = parseAmount(assigned.credit);
  const balance = parseAmount(assigned.balance);
  const reference = assigned.reference || undefined;

  // Handle single amount column with Dr/Cr indicator
  // If layout has no separate debit/credit columns, or only one of them
  if (!layout.debit && !layout.credit) {
    // No amount columns detected — shouldn't happen with a valid layout
    return null;
  }

  if (layout.debit && !layout.credit) {
    // Single "Debit" column — check for Dr/Cr indicator in description or amount text
    const drCr = extractDrCr(assigned.debit) ?? extractDrCr(assigned.description);
    const amt = debit;
    debit = null;
    credit = null;
    if (drCr === 'cr' && amt !== null) {
      credit = Math.abs(amt);
    } else if (amt !== null) {
      debit = Math.abs(amt);
    }
  } else if (!layout.debit && layout.credit) {
    // Single "Credit" column — check for Dr/Cr indicator
    const drCr = extractDrCr(assigned.credit) ?? extractDrCr(assigned.description);
    const amt = credit;
    debit = null;
    credit = null;
    if (drCr === 'dr' && amt !== null) {
      debit = Math.abs(amt);
    } else if (amt !== null) {
      credit = Math.abs(amt);
    }
  }

  // Handle negative amounts: negative debit = credit and vice versa
  if (debit !== null && debit < 0) {
    credit = Math.abs(debit);
    debit = null;
  }
  if (credit !== null && credit < 0) {
    debit = Math.abs(credit);
    credit = null;
  }

  // Zero amounts are effectively null
  if (debit === 0) debit = null;
  if (credit === 0) credit = null;

  if (debit === null && credit === null) return null;

  return { date: dateStr, description, debit, credit, balance, reference };
}

// ─── Main PDF Parser ────────────────────────────────────

export async function parsePdfStatement(
  file: File,
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>,
  bankHint?: BankFormat,
  password?: string,
): Promise<ParseResult> {
  const errors: string[] = [];

  let pages: PageData[];
  try {
    pages = await extractPageData(file, password);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes('password')) {
      return {
        transactions: [],
        errors: [password ? 'Incorrect password. Please try again.' : 'PASSWORD_REQUIRED'],
      };
    }
    return { transactions: [], errors: [`Failed to read PDF: ${msg}`] };
  }

  // Flatten all items for text-line checks (bank detection, account, period)
  const allItems = pages.flatMap((p) => p.items);
  if (allItems.length === 0) {
    return {
      transactions: [],
      errors: ['This appears to be a scanned PDF. Please use a text-based PDF export from your bank\'s website.'],
    };
  }

  const totalTextLength = allItems.reduce((sum, item) => sum + item.text.length, 0);
  if (totalTextLength < 50) {
    return {
      transactions: [],
      errors: ['This appears to be a scanned PDF. Please use a text-based PDF export from your bank\'s website.'],
    };
  }

  // Build flat text lines for bank detection, account number, period extraction
  const flatRows = groupIntoRows(allItems);
  const flatLines = flatRows.map(rowToText);

  const bank: BankFormat = bankHint ?? detectBankFromText(flatLines);
  const accountNumber = extractAccountNumber(flatLines);
  const statementPeriod = extractStatementPeriod(flatLines);

  // Process each page: detect header, then extract transactions
  const transactions: ParsedTransaction[] = [];
  let activeLayout: ColumnLayout | null = null;
  let lastTransaction: RawTransaction | null = null;

  for (const page of pages) {
    const rows = groupIntoRows(page.items);

    // Try to detect a header on this page (re-detect per page for repeated headers)
    const headerResult = detectHeaderRow(rows, page.width);
    let startIdx = 0;

    if (headerResult) {
      activeLayout = headerResult.layout;
      startIdx = headerResult.headerEndIndex;
    }

    if (!activeLayout) continue;

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      const lineText = rowToText(row);

      if (shouldSkipRow(lineText)) continue;

      const assigned = assignItemsToColumns(row, activeLayout);

      // Check if this is a continuation line (no date, no amounts — just description)
      const hasDate = !!parseDateStr(assigned.date);
      const hasDebit = parseAmount(assigned.debit) !== null;
      const hasCredit = parseAmount(assigned.credit) !== null;
      const hasDescription = !!assigned.description.trim();

      if (!hasDate && !hasDebit && !hasCredit && hasDescription && lastTransaction) {
        // Append to previous transaction's description
        lastTransaction.description = (lastTransaction.description + ' ' + assigned.description.trim())
          .replace(/\s{2,}/g, ' ')
          .trim();
        // Update the last pushed transaction
        const lastPushed = transactions[transactions.length - 1];
        if (lastPushed) {
          lastPushed.description = lastTransaction.description;
          // Re-run category suggestion with updated description
          const suggestion = suggestCategory(lastTransaction.description, categories);
          lastPushed.category = suggestion.category;
          lastPushed.categoryId = suggestion.categoryId;
          if (suggestion.category === 'transfer') {
            lastPushed.type = 'transfer';
          }
        }
        continue;
      }

      const parsed = parseTransactionFromRow(assigned, activeLayout);
      if (!parsed) continue;

      if (!parsed.description && lastTransaction) {
        // Empty description — unusual, skip
        continue;
      }

      lastTransaction = parsed;

      let amount: number;
      let txnType: 'income' | 'expense' | 'transfer';

      if (parsed.debit !== null && parsed.debit > 0) {
        amount = parsed.debit;
        txnType = 'expense';
      } else if (parsed.credit !== null && parsed.credit > 0) {
        amount = parsed.credit;
        txnType = 'income';
      } else {
        errors.push(`Row at Y=${row.y}: Could not determine amount`);
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
