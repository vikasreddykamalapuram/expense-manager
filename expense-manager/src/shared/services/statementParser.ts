// Bank Statement CSV Parser — supports ICICI, HDFC, SBI, Axis, and generic formats

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  category?: string; // auto-suggested category name
  categoryId?: string; // matched category ID
  reference?: string;
  balance?: number; // running balance if available
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  bankName?: string;
  accountNumber?: string; // last 4 digits only
  statementPeriod?: { start: string; end: string };
  errors: string[];
}

type BankFormat = 'icici' | 'hdfc' | 'sbi' | 'axis' | 'generic';

interface ColumnMap {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance: number;
  reference: number;
}

// ─── Category keyword mapping ───────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'food-dining': ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'dining', 'dominos', 'pizza', 'mcdonalds', 'kfc', 'burger', 'biryani', 'starbucks'],
  'groceries': ['bigbasket', 'grofers', 'blinkit', 'dmart', 'more', 'reliance fresh', 'grocery', 'zepto', 'instamart'],
  'transportation': ['uber', 'ola', 'rapido', 'irctc', 'railways', 'metro', 'petrol', 'fuel', 'bp ', 'hp ', 'iocl', 'fastag', 'parking'],
  'shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal', 'croma', 'reliance digital'],
  'utilities': ['electricity', 'water', 'gas', 'broadband', 'internet', 'jio', 'airtel', 'vi ', 'bsnl', 'recharge', 'tata power', 'bescom'],
  'entertainment': ['netflix', 'hotstar', 'prime video', 'spotify', 'youtube', 'bookmyshow', 'pvr', 'inox', 'disney'],
  'healthcare': ['pharmacy', 'hospital', 'doctor', 'medical', 'apollo', 'practo', 'netmeds', '1mg', 'medplus', 'health'],
  'rent': ['rent', 'house rent', 'pg '],
  'emi': ['emi', 'loan', 'equated monthly'],
  'insurance': ['insurance', 'lic', 'policy', 'premium'],
  'investment': ['mutual fund', 'sip', 'stock', 'zerodha', 'groww', 'nps', 'ppf', 'fd ', 'fixed deposit', 'kuvera'],
  'salary': ['salary', 'neft-cr', 'credit-salary'],
  'transfer': ['neft', 'imps', 'upi', 'transfer', 'rtgs'],
};

// ─── Sanitization ───────────────────────────────────────

function sanitize(value: string): string {
  return value
    .replace(/[<>]/g, '') // strip HTML angle brackets
    .replace(/&/g, '&amp;')
    .trim();
}

// ─── CSV Parsing ────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  return lines
    .map((line) => parseCSVLine(line))
    .filter((cols) => cols.some((c) => c.length > 0));
}

// ─── Date Parsing ───────────────────────────────────────

function parseDate(dateStr: string): string | null {
  const cleaned = dateStr.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  // YYYY-MM-DD (ISO)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return formatDateParts(parseInt(y), parseInt(m), parseInt(d));
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const ddmmyyyy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const day = parseInt(d);
    const month = parseInt(m);
    const year = parseInt(y);
    // Heuristic: if first number > 12, it's definitely DD
    if (day > 12 || month <= 12) {
      return formatDateParts(year, month, day);
    }
    // Could be MM/DD/YYYY
    return formatDateParts(year, day, month);
  }

  // DD/MM/YY or DD-MM-YY
  const ddmmyy = cleaned.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2})$/);
  if (ddmmyy) {
    const [, d, m, y] = ddmmyy;
    const year = parseInt(y) + 2000;
    return formatDateParts(year, parseInt(m), parseInt(d));
  }

  // "DD Mon YYYY" or "DD-Mon-YYYY"
  const dMonY = cleaned.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})/);
  if (dMonY) {
    const [, d, mon, y] = dMonY;
    const month = monthNameToNumber(mon);
    if (month) return formatDateParts(parseInt(y), month, parseInt(d));
  }

  return null;
}

function formatDateParts(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function monthNameToNumber(name: string): number | null {
  const months: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
    oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  return months[name.toLowerCase()] || null;
}

// ─── Amount Parsing ─────────────────────────────────────

function parseAmount(amountStr: string): number | null {
  if (!amountStr || !amountStr.trim()) return null;
  // Remove currency symbols, spaces, and handle Indian comma format (1,50,000.00)
  const cleaned = amountStr.trim()
    .replace(/[₹$€£¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '') // remove all commas
    .replace(/\(([^)]+)\)/, '-$1'); // (500) → -500

  if (!cleaned || cleaned === '-' || cleaned === '.') return null;

  const num = parseFloat(cleaned);
  return isNaN(num) ? null : Math.round(num * 100) / 100; // 2 decimal places
}

// ─── Bank Format Detection ──────────────────────────────

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectBankFormat(headerRow: string[]): { format: BankFormat; columnMap: ColumnMap } {
  const headers = headerRow.map(normalizeHeader);
  const joined = headers.join('|');

  // ICICI: Date, Transaction Remarks, Withdrawal (Dr), Deposit (Cr), Balance
  if (joined.includes('transactionremarks') || (joined.includes('withdrawaldr') && joined.includes('depositcr'))) {
    return {
      format: 'icici',
      columnMap: {
        date: findCol(headers, ['date', 'transactiondate', 'txndate']),
        description: findCol(headers, ['transactionremarks', 'remarks', 'particulars']),
        debit: findCol(headers, ['withdrawaldr', 'withdrawal', 'debit', 'dr']),
        credit: findCol(headers, ['depositcr', 'deposit', 'credit', 'cr']),
        balance: findCol(headers, ['balance', 'closingbalance']),
        reference: findCol(headers, ['chequeno', 'refno', 'reference']),
      },
    };
  }

  // HDFC: Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, Closing Balance
  if (joined.includes('narration') || (joined.includes('debitamount') && joined.includes('creditamount'))) {
    return {
      format: 'hdfc',
      columnMap: {
        date: findCol(headers, ['date', 'transactiondate']),
        description: findCol(headers, ['narration', 'description', 'particulars']),
        debit: findCol(headers, ['debitamount', 'debit', 'dr']),
        credit: findCol(headers, ['creditamount', 'credit', 'cr']),
        balance: findCol(headers, ['closingbalance', 'balance']),
        reference: findCol(headers, ['chqrefnumber', 'chequeno', 'refno', 'referenceno']),
      },
    };
  }

  // SBI: Txn Date, Value Date, Description, Ref No./Cheque No., Debit, Credit, Balance
  if (joined.includes('txndate') || joined.includes('valudate') || (joined.includes('refno') && joined.includes('chequeno'))) {
    return {
      format: 'sbi',
      columnMap: {
        date: findCol(headers, ['txndate', 'transactiondate', 'date']),
        description: findCol(headers, ['description', 'particulars', 'narration']),
        debit: findCol(headers, ['debit', 'dr', 'withdrawal']),
        credit: findCol(headers, ['credit', 'cr', 'deposit']),
        balance: findCol(headers, ['balance', 'closingbalance']),
        reference: findCol(headers, ['refnochequeno', 'refno', 'chequeno', 'reference']),
      },
    };
  }

  // Axis: Tran Date, CHQNO, PARTICULARS, DR, CR, BAL, SOL
  if (joined.includes('particulars') && (joined.includes('trandate') || joined.includes('sol'))) {
    return {
      format: 'axis',
      columnMap: {
        date: findCol(headers, ['trandate', 'transactiondate', 'date']),
        description: findCol(headers, ['particulars', 'description', 'narration']),
        debit: findCol(headers, ['dr', 'debit', 'withdrawal']),
        credit: findCol(headers, ['cr', 'credit', 'deposit']),
        balance: findCol(headers, ['bal', 'balance']),
        reference: findCol(headers, ['chqno', 'chequeno', 'refno']),
      },
    };
  }

  // Generic fallback
  return {
    format: 'generic',
    columnMap: buildGenericColumnMap(headers),
  };
}

function findCol(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx >= 0) return idx;
    // Partial match
    const partialIdx = headers.findIndex((h) => h.includes(candidate));
    if (partialIdx >= 0) return partialIdx;
  }
  return -1;
}

function buildGenericColumnMap(headers: string[]): ColumnMap {
  return {
    date: findCol(headers, ['date', 'txndate', 'transactiondate', 'postingdate', 'bookingdate']),
    description: findCol(headers, ['description', 'narration', 'particulars', 'remarks', 'details', 'memo', 'payee']),
    debit: findCol(headers, ['debit', 'debitamount', 'dr', 'withdrawal', 'withdrawaldr', 'spent', 'expense']),
    credit: findCol(headers, ['credit', 'creditamount', 'cr', 'deposit', 'depositcr', 'received', 'income']),
    balance: findCol(headers, ['balance', 'closingbalance', 'bal', 'runningbalance']),
    reference: findCol(headers, ['reference', 'refno', 'chequeno', 'chqno', 'transactionid', 'txnid']),
  };
}

// ─── Format name helper ─────────────────────────────────

function bankFormatToName(format: BankFormat): string | undefined {
  const names: Record<BankFormat, string | undefined> = {
    icici: 'ICICI Bank',
    hdfc: 'HDFC Bank',
    sbi: 'State Bank of India',
    axis: 'Axis Bank',
    generic: undefined,
  };
  return names[format];
}

// ─── Account Number Extraction ──────────────────────────

function extractAccountNumber(rows: string[][]): string | undefined {
  for (const row of rows.slice(0, 10)) {
    const line = row.join(' ');
    const match = line.match(/(?:account|a\/c|acct)[^\d]*(\d{4,})/i);
    if (match) {
      const full = match[1];
      return full.slice(-4); // only last 4 digits
    }
  }
  return undefined;
}

// ─── Category Matching ──────────────────────────────────

export function suggestCategory(
  description: string,
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>,
): { category?: string; categoryId?: string } {
  const lower = description.toLowerCase();

  for (const [keyword, terms] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const term of terms) {
      if (lower.includes(term)) {
        // Try to match against existing user categories
        const matched = categories.find((c) => {
          const catLower = c.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          return catLower.includes(keyword) || keyword.includes(catLower);
        });

        if (matched) {
          return { category: matched.name, categoryId: matched.id };
        }
        // Return keyword as suggestion even without a matching category
        return { category: keyword };
      }
    }
  }

  return {};
}

// ─── Row Classification ─────────────────────────────────

function isDataRow(row: string[], columnMap: ColumnMap): boolean {
  if (row.every((c) => !c.trim())) return false; // empty row

  // Must have a parseable date
  const dateIdx = columnMap.date;
  if (dateIdx < 0 || dateIdx >= row.length) return false;
  if (!parseDate(row[dateIdx])) return false;

  // Must have at least one amount
  const debitVal = columnMap.debit >= 0 && columnMap.debit < row.length ? parseAmount(row[columnMap.debit]) : null;
  const creditVal = columnMap.credit >= 0 && columnMap.credit < row.length ? parseAmount(row[columnMap.credit]) : null;

  return debitVal !== null || creditVal !== null;
}

// ─── Main Parser ────────────────────────────────────────

export function parseBankStatement(
  csvContent: string,
  categories: Array<{ id: string; name: string; type: 'income' | 'expense' }>,
  forcedBank?: BankFormat,
): ParseResult {
  const errors: string[] = [];
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    return { transactions: [], errors: ['File is empty or has too few rows'] };
  }

  // Find the header row — first row with enough text columns
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const textCols = rows[i].filter((c) => c.trim() && isNaN(Number(c.replace(/[,]/g, '')))).length;
    if (textCols >= 3) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    return { transactions: [], errors: ['Could not detect header row in the CSV file'] };
  }

  const detected = detectBankFormat(rows[headerIdx]);
  const format: BankFormat = forcedBank || detected.format;
  const columnMap = forcedBank
    ? detectBankFormat(rows[headerIdx]).columnMap
    : detected.columnMap;

  if (columnMap.date < 0) {
    errors.push('Could not detect date column');
    return { transactions: [], errors };
  }
  if (columnMap.debit < 0 && columnMap.credit < 0) {
    errors.push('Could not detect debit/credit columns');
    return { transactions: [], errors };
  }

  const accountNumber = extractAccountNumber(rows.slice(0, headerIdx));
  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!isDataRow(row, columnMap)) continue;

    const dateStr = parseDate(row[columnMap.date]);
    if (!dateStr) {
      errors.push(`Row ${i + 1}: Invalid date "${sanitize(row[columnMap.date])}"`);
      continue;
    }

    const description = sanitize(
      columnMap.description >= 0 && columnMap.description < row.length
        ? row[columnMap.description]
        : ''
    );

    const debitAmt = columnMap.debit >= 0 && columnMap.debit < row.length
      ? parseAmount(row[columnMap.debit])
      : null;
    const creditAmt = columnMap.credit >= 0 && columnMap.credit < row.length
      ? parseAmount(row[columnMap.credit])
      : null;

    let amount: number;
    let txnType: 'income' | 'expense' | 'transfer';

    if (debitAmt && debitAmt > 0) {
      amount = debitAmt;
      txnType = 'expense';
    } else if (creditAmt && creditAmt > 0) {
      amount = creditAmt;
      txnType = 'income';
    } else if (debitAmt !== null && debitAmt < 0) {
      // Negative debit = credit
      amount = Math.abs(debitAmt);
      txnType = 'income';
    } else if (creditAmt !== null && creditAmt < 0) {
      amount = Math.abs(creditAmt);
      txnType = 'expense';
    } else {
      errors.push(`Row ${i + 1}: Could not determine amount`);
      continue;
    }

    const balance = columnMap.balance >= 0 && columnMap.balance < row.length
      ? parseAmount(row[columnMap.balance]) ?? undefined
      : undefined;

    const reference = columnMap.reference >= 0 && columnMap.reference < row.length
      ? sanitize(row[columnMap.reference]) || undefined
      : undefined;

    // Auto-categorize
    const suggestion = suggestCategory(description, categories);
    if (suggestion.category === 'transfer') {
      txnType = 'transfer';
    }

    transactions.push({
      date: dateStr,
      description,
      amount,
      type: txnType,
      category: suggestion.category,
      categoryId: suggestion.categoryId,
      reference,
      balance,
    });
  }

  // Statement period
  let statementPeriod: ParseResult['statementPeriod'];
  if (transactions.length > 0) {
    const dates = transactions.map((t) => t.date).sort();
    statementPeriod = { start: dates[0], end: dates[dates.length - 1] };
  }

  return {
    transactions,
    bankName: bankFormatToName(format),
    accountNumber,
    statementPeriod,
    errors,
  };
}

export type { BankFormat };
