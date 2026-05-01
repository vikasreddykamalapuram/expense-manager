/**
 * CSV Parser and data transformation utilities for importing
 * expense data from external apps (iPhone expense trackers, etc.)
 */

export interface ParsedCSV {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface ColumnMapping {
  date: string;
  amount: string;
  category: string;
  notes: string;
  type: string; // income/expense column (may be empty if using amount sign)
  account: string;
}

export interface ParsedTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  type: 'income' | 'expense';
  category: string; // raw category from CSV
  notes: string;
  account: string;
  rawRow: string[];
  rowIndex: number;
  warnings: string[];
}

export interface ImportResult {
  parsed: ParsedTransaction[];
  skipped: { rowIndex: number; reason: string; rawRow: string[] }[];
  dateFormat: string;
}

// --- CSV Parsing ---

export function parseCSV(text: string): ParsedCSV {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows: string[][] = [];

  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          currentField += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          currentRow.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
    }

    if (inQuotes) {
      // Field spans multiple lines
      currentField += '\n';
    } else {
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    }
  }

  // Handle trailing row
  if (currentRow.length > 0 || currentField.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [], rowCount: 0 };

  const headers = rows[0];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows, rowCount: dataRows.length };
}

// --- Date Parsing ---

type DateFormat =
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY-MM-DD'
  | 'DD-MM-YYYY'
  | 'MM-DD-YYYY'
  | 'DD/MM/YY'
  | 'MM/DD/YY'
  | 'YYYY/MM/DD'
  | 'DD MMM YYYY'
  | 'MMM DD, YYYY'
  | 'unknown';

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

export function detectDateFormat(samples: string[]): DateFormat {
  const validSamples = samples.filter((s) => s && s.trim().length > 0).slice(0, 20);
  if (validSamples.length === 0) return 'unknown';

  // Check for named month formats first
  if (validSamples.every((s) => /^\d{1,2}\s+[a-zA-Z]{3,}\s+\d{2,4}$/.test(s.trim()))) {
    return 'DD MMM YYYY';
  }
  if (validSamples.every((s) => /^[a-zA-Z]{3,}\s+\d{1,2},?\s+\d{2,4}$/.test(s.trim()))) {
    return 'MMM DD, YYYY';
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  if (validSamples.every((v) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v.trim()))) {
    return validSamples[0].trim().includes('/') ? 'YYYY/MM/DD' : 'YYYY-MM-DD';
  }

  // DD/MM/YYYY vs MM/DD/YYYY — check if any first part > 12 (must be DD)
  const slashDates = validSamples.filter((s) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s.trim()));
  if (slashDates.length === validSamples.length) {
    const firstParts = slashDates.map((s) => parseInt(s.split('/')[0]));
    const secondParts = slashDates.map((s) => parseInt(s.split('/')[1]));
    const yearParts = slashDates.map((s) => s.split('/')[2]);

    if (yearParts[0]?.length === 2) {
      if (firstParts.some((p) => p > 12)) return 'DD/MM/YY';
      if (secondParts.some((p) => p > 12)) return 'MM/DD/YY';
      return 'DD/MM/YY'; // default for Indian locale
    }
    if (firstParts.some((p) => p > 12)) return 'DD/MM/YYYY';
    if (secondParts.some((p) => p > 12)) return 'MM/DD/YYYY';
    return 'DD/MM/YYYY'; // default for Indian locale
  }

  // DD-MM-YYYY vs MM-DD-YYYY
  const dashDates = validSamples.filter((s) => /^\d{1,2}-\d{1,2}-\d{2,4}$/.test(s.trim()));
  if (dashDates.length === validSamples.length) {
    const firstParts = dashDates.map((s) => parseInt(s.split('-')[0]));
    const secondParts = dashDates.map((s) => parseInt(s.split('-')[1]));
    if (firstParts.some((p) => p > 12)) return 'DD-MM-YYYY';
    if (secondParts.some((p) => p > 12)) return 'MM-DD-YYYY';
    return 'DD-MM-YYYY';
  }

  return 'unknown';
}

export function parseDate(dateStr: string, format: DateFormat): string | null {
  const cleaned = dateStr.trim();
  if (!cleaned) return null;

  try {
    let day: number, month: number, year: number;

    switch (format) {
      case 'DD/MM/YYYY': {
        const [d, m, y] = cleaned.split('/').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'MM/DD/YYYY': {
        const [m, d, y] = cleaned.split('/').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'DD/MM/YY': {
        const [d, m, y] = cleaned.split('/').map(Number);
        day = d; month = m - 1; year = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
        break;
      }
      case 'MM/DD/YY': {
        const [m, d, y] = cleaned.split('/').map(Number);
        day = d; month = m - 1; year = y < 100 ? (y > 50 ? 1900 + y : 2000 + y) : y;
        break;
      }
      case 'YYYY-MM-DD': {
        const [y, m, d] = cleaned.split('-').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'DD-MM-YYYY': {
        const [d, m, y] = cleaned.split('-').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'MM-DD-YYYY': {
        const [m, d, y] = cleaned.split('-').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'YYYY/MM/DD': {
        const [y, m, d] = cleaned.split('/').map(Number);
        day = d; month = m - 1; year = y;
        break;
      }
      case 'DD MMM YYYY': {
        const parts = cleaned.split(/\s+/);
        day = parseInt(parts[0]);
        month = MONTH_MAP[parts[1].toLowerCase()] ?? -1;
        year = parseInt(parts[2]);
        break;
      }
      case 'MMM DD, YYYY': {
        const parts = cleaned.replace(',', '').split(/\s+/);
        month = MONTH_MAP[parts[0].toLowerCase()] ?? -1;
        day = parseInt(parts[1]);
        year = parseInt(parts[2]);
        break;
      }
      default: {
        // Try native Date parse as fallback
        const d = new Date(cleaned);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
      }
    }

    if (isNaN(day) || isNaN(month) || isNaN(year) || month < 0 || month > 11 || day < 1 || day > 31) {
      return null;
    }

    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
      return null; // invalid date (e.g., Feb 30)
    }

    const yStr = year.toString().padStart(4, '0');
    const mStr = (month + 1).toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  } catch {
    return null;
  }
}

// --- Amount Parsing ---

export function parseAmount(amountStr: string): number | null {
  if (!amountStr || !amountStr.trim()) return null;

  let cleaned = amountStr.trim();

  // Remove currency symbols
  cleaned = cleaned.replace(/^[₹$€£¥₩R\s]+/, '').replace(/[₹$€£¥₩R\s]+$/, '');

  // Handle parentheses notation for negatives: (1,234.56) → -1234.56
  const isParenthetical = /^\(.*\)$/.test(cleaned);
  if (isParenthetical) {
    cleaned = cleaned.replace(/[()]/g, '');
  }

  // Detect decimal separator: if both . and , exist, the last one is the decimal
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');

  if (lastDot > -1 && lastComma > -1) {
    if (lastDot > lastComma) {
      // 1,234.56 → comma is thousands
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // 1.234,56 → dot is thousands, comma is decimal (European)
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma > -1 && !cleaned.includes('.')) {
    // Only commas: could be "1,234" (thousands) or "1234,56" (decimal)
    const afterComma = cleaned.substring(lastComma + 1);
    if (afterComma.length === 2) {
      // Likely decimal separator
      cleaned = cleaned.replace(/,(?=\d{2}$)/, '.').replace(/,/g, '');
    } else {
      // Likely thousands separator
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  // Remove any remaining whitespace/non-numeric (except minus and dot)
  cleaned = cleaned.replace(/[^\d.\-]/g, '');

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  return isParenthetical ? -Math.abs(num) : num;
}

// --- Type Detection ---

export function detectTransactionType(
  amount: number,
  typeValue: string,
  categoryValue: string,
): 'income' | 'expense' {
  const typeLower = typeValue.toLowerCase().trim();

  // Explicit type column
  if (['income', 'credit', 'cr', 'credited', 'earning', 'inflow'].includes(typeLower)) return 'income';
  if (['expense', 'debit', 'dr', 'debited', 'spending', 'outflow'].includes(typeLower)) return 'expense';

  // Check category for income hints
  const catLower = categoryValue.toLowerCase();
  if (['salary', 'income', 'refund', 'cashback', 'interest', 'dividend', 'bonus', 'reimbursement'].some(
    (k) => catLower.includes(k)
  )) {
    return 'income';
  }

  // Use amount sign
  if (amount < 0) return 'expense';
  if (amount > 0 && typeLower === '') return 'expense'; // default

  return 'expense';
}

// --- Column Auto-Mapping ---

const COLUMN_PATTERNS: Record<keyof ColumnMapping, RegExp[]> = {
  date: [/^date$/i, /^txn\s*date$/i, /^transaction\s*date$/i, /^trans\.?\s*date$/i, /^payment\s*date$/i, /^created$/i],
  amount: [/^amount$/i, /^value$/i, /^total$/i, /^sum$/i, /^price$/i, /^cost$/i, /^amt$/i, /^money$/i],
  category: [/^category$/i, /^cat$/i, /^group$/i, /^tag$/i, /^label$/i, /^expense\s*type$/i, /^spending\s*category$/i],
  notes: [/^note$/i, /^notes$/i, /^description$/i, /^desc$/i, /^memo$/i, /^remark$/i, /^remarks$/i, /^detail$/i, /^details$/i, /^comment$/i, /^title$/i],
  type: [/^type$/i, /^transaction\s*type$/i, /^txn\s*type$/i, /^income\s*\/?\s*expense$/i, /^credit\s*\/?\s*debit$/i, /^cr\s*\/?\s*dr$/i, /^direction$/i],
  account: [/^account$/i, /^account\s*name$/i, /^wallet$/i, /^from$/i, /^bank$/i, /^payment\s*mode$/i, /^payment\s*method$/i],
};

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: '', amount: '', category: '', notes: '', type: '', account: '',
  };

  const used = new Set<string>();

  // Match each field to best header
  for (const field of ['date', 'amount', 'category', 'type', 'notes', 'account'] as (keyof ColumnMapping)[]) {
    for (const pattern of COLUMN_PATTERNS[field]) {
      const match = headers.find((h) => pattern.test(h.trim()) && !used.has(h));
      if (match) {
        mapping[field] = match;
        used.add(match);
        break;
      }
    }
  }

  return mapping;
}

// --- Category Matching ---

const CATEGORY_ALIASES: Record<string, string[]> = {
  'food-dining': ['food', 'dining', 'restaurant', 'eat', 'eating out', 'meal', 'meals', 'lunch', 'dinner', 'breakfast', 'cafe', 'canteen'],
  'groceries': ['grocery', 'groceries', 'supermarket', 'market', 'provisions', 'daily needs', 'kirana'],
  'transportation': ['transport', 'transportation', 'commute', 'cab', 'taxi', 'uber', 'ola', 'auto', 'metro', 'bus', 'train', 'fuel', 'petrol', 'diesel', 'gas'],
  'shopping': ['shopping', 'shop', 'purchase', 'amazon', 'flipkart', 'online shopping', 'clothing', 'clothes', 'apparel', 'fashion'],
  'entertainment': ['entertainment', 'movies', 'movie', 'cinema', 'games', 'gaming', 'netflix', 'streaming', 'fun', 'leisure', 'hobby'],
  'bills-utilities': ['bills', 'utilities', 'utility', 'electricity', 'electric', 'water', 'gas bill', 'internet', 'wifi', 'broadband', 'phone', 'mobile', 'recharge', 'dth'],
  'health': ['health', 'medical', 'medicine', 'doctor', 'hospital', 'pharmacy', 'clinic', 'healthcare', 'dental', 'eye'],
  'education': ['education', 'study', 'school', 'college', 'university', 'course', 'tuition', 'books', 'learning', 'training'],
  'travel': ['travel', 'trip', 'vacation', 'holiday', 'flight', 'hotel', 'booking', 'tourism', 'tour'],
  'household': ['household', 'home', 'house', 'rent', 'maintenance', 'repair', 'maid', 'housekeeper', 'furniture', 'appliance', 'home improvement'],
  'insurance': ['insurance', 'life insurance', 'health insurance', 'vehicle insurance', 'premium'],
  'personal-care': ['personal', 'personal care', 'salon', 'spa', 'haircut', 'grooming', 'beauty', 'cosmetics', 'gym', 'fitness'],
  'gifts-donations': ['gift', 'gifts', 'donation', 'donations', 'charity', 'tip', 'tips'],
  'subscriptions': ['subscription', 'subscriptions', 'membership', 'emi', 'installment'],
  'other-expense': ['other', 'miscellaneous', 'misc', 'general', 'uncategorized'],
  // Income categories
  'salary': ['salary', 'paycheck', 'wages', 'pay', 'income'],
  'freelance': ['freelance', 'consulting', 'contract', 'side hustle', 'gig'],
  'investments': ['investment', 'investments', 'dividend', 'interest', 'returns', 'capital gains', 'stocks', 'mutual fund'],
  'business': ['business', 'business income', 'revenue', 'sales', 'profit'],
  'rental-income': ['rental', 'rent income', 'property income', 'tenant'],
  'refund': ['refund', 'cashback', 'cash back', 'reimbursement', 'return'],
  'other-income': ['other income', 'bonus', 'award', 'gift received'],
};

export function matchCategory(rawCategory: string): string | null {
  const lower = rawCategory.toLowerCase().trim();
  if (!lower) return null;

  // Exact or substring match
  for (const [catId, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((alias) => lower === alias || lower.includes(alias) || alias.includes(lower))) {
      return catId;
    }
  }

  return null;
}

// --- Main Import Pipeline ---

export function processCSVImport(
  csv: ParsedCSV,
  mapping: ColumnMapping,
  dateFormat: DateFormat,
  defaultType: 'income' | 'expense',
): ImportResult {
  const parsed: ParsedTransaction[] = [];
  const skipped: ImportResult['skipped'] = [];

  const getIndex = (header: string) => csv.headers.indexOf(header);

  const dateIdx = getIndex(mapping.date);
  const amountIdx = getIndex(mapping.amount);
  const categoryIdx = getIndex(mapping.category);
  const notesIdx = getIndex(mapping.notes);
  const typeIdx = getIndex(mapping.type);
  const accountIdx = getIndex(mapping.account);

  if (dateIdx === -1 || amountIdx === -1) {
    return { parsed: [], skipped: [{ rowIndex: -1, reason: 'Date or Amount column not mapped', rawRow: [] }], dateFormat };
  }

  for (let i = 0; i < csv.rows.length; i++) {
    const row = csv.rows[i];
    const warnings: string[] = [];

    // Parse date
    const rawDate = row[dateIdx] || '';
    const date = parseDate(rawDate, dateFormat);
    if (!date) {
      skipped.push({ rowIndex: i + 1, reason: `Invalid date: "${rawDate}"`, rawRow: row });
      continue;
    }

    // Parse amount
    const rawAmount = row[amountIdx] || '';
    const amount = parseAmount(rawAmount);
    if (amount === null || amount === 0) {
      skipped.push({ rowIndex: i + 1, reason: `Invalid amount: "${rawAmount}"`, rawRow: row });
      continue;
    }

    // Get raw values
    const rawCategory = categoryIdx >= 0 ? (row[categoryIdx] || '') : '';
    const rawNotes = notesIdx >= 0 ? (row[notesIdx] || '') : '';
    const rawType = typeIdx >= 0 ? (row[typeIdx] || '') : '';
    const rawAccount = accountIdx >= 0 ? (row[accountIdx] || '') : '';

    // Detect type
    let type = detectTransactionType(Math.abs(amount), rawType, rawCategory);
    if (!rawType && amount > 0 && defaultType === 'expense') type = 'expense';

    // Category matching
    if (!rawCategory) warnings.push('No category — will use "Other"');

    parsed.push({
      date,
      amount: Math.abs(amount),
      type,
      category: rawCategory || 'Other',
      notes: rawNotes,
      account: rawAccount,
      rawRow: row,
      rowIndex: i + 1,
      warnings,
    });
  }

  return { parsed, skipped, dateFormat };
}
