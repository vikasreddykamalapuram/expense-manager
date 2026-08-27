/**
 * Turns a spoken sentence into a best-guess transaction.
 *
 * Handles English, Hindi and code-mixed "Hinglish" utterances such as:
 *   "spent 450 on groceries at DMart yesterday using UPI"
 *   "paanch sau rupaye sabzi pe cash se kharch kiye"
 *   "कल पेट्रोल पर 2000 रुपये कार्ड से"
 *
 * Every field is optional — the caller shows a review screen and the user
 * confirms or edits before anything is saved. This module is pure: no I/O, no
 * timers, no globals, and `today` is injectable so tests are deterministic.
 *
 * Language handling lives here; *learning* from the user's own history stays in
 * `autoCategorize.suggestCategories`, which the review screen calls with the
 * note we produce. We deliberately do not duplicate that keyword table.
 */

import { Account, Category, PaymentMethod } from '../types';
import { extractNumber, normalizeDigits } from './hindiNumbers';

export interface ParsedVoiceTransaction {
  /** Raw recogniser output, kept verbatim for the review screen. */
  transcript: string;
  type: 'income' | 'expense' | 'transfer';
  amount?: number;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  paymentMethod?: PaymentMethod;
  /** ISO YYYY-MM-DD. Always shown to the user so a wrong guess is visible. */
  date?: string;
  notes?: string;
  merchant?: string;
  /**
   * Human-readable warnings for fields the user should double-check, e.g.
   * "kal" meaning either yesterday or tomorrow.
   */
  ambiguities: string[];
}

export interface VoiceParserContext {
  categories: Category[];
  accounts: Account[];
  /** Reference date for relative expressions. Defaults to the current day. */
  today?: Date;
}

interface Span {
  start: number;
  end: number;
}

const MAX_NOTE_LENGTH = 200;

// ─── Unicode-aware word boundaries ───────────────────────────────────────────

/**
 * JavaScript's `\b` is defined over `[A-Za-z0-9_]` only, so it never matches at
 * the edge of a Devanagari word: in "कल पेट्रोल", both the space and `प` are
 * "non-word" characters, so `\bपेट्रोल\b` silently fails. Every keyword pattern
 * here therefore uses an explicit Unicode boundary instead.
 *
 * Marks (`\p{M}`) count as part of a word — Devanagari vowel signs, the nukta
 * and the virama are Marks, not Letters.
 */
const WORD_CHARS = '\\p{L}\\p{N}\\p{M}';

/**
 * Note the deliberate absence of lookbehind. Vite's default build target
 * includes Safari 14, which throws a SyntaxError on `(?<=...)` while *parsing*
 * the module — that would break the whole bundle, not just voice input. So the
 * preceding character is consumed instead and the real match kept in group 1.
 */
function wordish(source: string, flags = 'iu'): RegExp {
  return new RegExp(`(?:^|[^${WORD_CHARS}])(${source})(?![${WORD_CHARS}])`, flags);
}

interface WordishMatch {
  /** Span of the keyword itself, excluding the consumed leading character. */
  span: Span;
  /** Capture groups declared inside `source`. */
  groups: (string | undefined)[];
  text: string;
}

function matchWordish(text: string, source: string): WordishMatch | null {
  const m = text.match(wordish(source));
  if (!m || m.index === undefined) return null;
  // The lookahead consumes nothing, so the core always ends where m[0] ends.
  const end = m.index + m[0].length;
  return { span: { start: end - m[1].length, end }, groups: m.slice(2), text: m[1] };
}

function testWordish(text: string, source: string): boolean {
  return wordish(source).test(text);
}

// ─── Intent ──────────────────────────────────────────────────────────────────

const TRANSFER_KEYWORDS =
  'transfer(?:red|ring)?|moved?\\s+(?:money|funds)|ट्रांसफर|transfer\\s*kiya|bheja|भेजा';
const INCOME_KEYWORDS =
  'received|got|earned|credited|salary|refund(?:ed)?|income|bonus|cashback|deposit(?:ed)?|mila|mili|मिला|मिली|मिले|aaya|आया|tankhwah|तनख्वाह|kamai|कमाई|jama|जमा';
const EXPENSE_KEYWORDS =
  'spent|spend|paid|pay|bought|buy|purchased?|gave|debited|withdrew|kharch|खर्च|kharcha|diya|दिया|diye|दिये|khareeda|खरीदा|liya|लिया|bhara|भरा';

function detectType(text: string): 'income' | 'expense' | 'transfer' {
  if (testWordish(text, TRANSFER_KEYWORDS)) return 'transfer';
  const income = testWordish(text, INCOME_KEYWORDS);
  const expense = testWordish(text, EXPENSE_KEYWORDS);
  // An explicit income signal only wins when no spending verb is present, so
  // "paid the salary" stays an expense.
  if (income && !expense) return 'income';
  if (expense) return 'expense';
  if (income) return 'income';
  return 'expense'; // most voice entries are expenses
}

// ─── Payment method ──────────────────────────────────────────────────────────

/**
 * Ordered most-specific first: "net banking" and "credit card" must be tested
 * before the bare "bank"/"card" tokens they contain.
 */
const PAYMENT_PATTERNS: { method: PaymentMethod; source: string }[] = [
  {
    method: 'auto_debit',
    source: 'auto[\\s-]?debit|auto[\\s-]?pay|autopay|standing\\s+instruction|e[\\s-]?mandate|mandate|ecs|nach',
  },
  {
    method: 'net_banking',
    source: 'net[\\s-]?banking|netbanking|internet\\s+banking|imps|neft|rtgs|bank\\s+transfer|online\\s+transfer|नेट\\s*बैंकिंग',
  },
  {
    method: 'upi',
    source: 'upi|g[\\s-]?pay|google\\s*pay|phone[\\s-]?pe|phonepe|paytm|bhim|amazon\\s*pay|qr\\s*(?:code|scan)?|scan(?:ned)?\\s+(?:and|&)\\s+pay|यूपीआई|फोनपे|पेटीएम',
  },
  { method: 'cheque', source: 'cheque|chèque|check\\s+number|चेक' },
  { method: 'card', source: 'credit\\s*card|debit\\s*card|card|swiped?|कार्ड' },
  { method: 'cash', source: 'cash|nagad|नगद|नकद|नकदी' },
];

function detectPaymentMethod(text: string): { method?: PaymentMethod; span?: Span } {
  for (const { method, source } of PAYMENT_PATTERNS) {
    const m = matchWordish(text, source);
    if (m) return { method, span: m.span };
  }
  return {};
}

// ─── Date ────────────────────────────────────────────────────────────────────

const WEEKDAYS = [
  'sunday', 'monday', 'tuesday', 'wednesday',
  'thursday', 'friday', 'saturday',
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shiftDays(base: Date, delta: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}

interface DateResult {
  date: string;
  span: Span;
  ambiguity?: string;
}

/**
 * Resolves a relative or explicit date expression.
 *
 * Note on "kal" (कल) and "parso" (परसों): each means *both* the day before and
 * the day after today. Voice entries record something that already happened, so
 * we resolve backwards and flag the ambiguity — the review screen always shows
 * the resolved date, making a wrong guess visible and one tap to fix.
 */
function detectDate(text: string, today: Date): DateResult | null {
  const at = (delta: number, m: WordishMatch, ambiguity?: string): DateResult => ({
    date: toIso(shiftDays(today, delta)),
    span: m.span,
    ambiguity,
  });

  let m: WordishMatch | null;

  if ((m = matchWordish(text, "today|aaj|आज|just\\s+now|abhi|अभी|this\\s+(?:morning|afternoon|evening)"))) {
    return at(0, m);
  }

  if ((m = matchWordish(text, 'day\\s+before\\s+yesterday|parso|parson|परसों|परसो'))) {
    const ambiguous = !/^day/i.test(m.text);
    return at(-2, m, ambiguous
      ? '"parso" can mean two days back or two days ahead — resolved to the past.'
      : undefined);
  }

  if ((m = matchWordish(text, 'yesterday|bita\\s+kal|beeta\\s+kal|kal|कल'))) {
    const word = m.text.toLowerCase();
    const ambiguous = word === 'kal' || word === 'कल';
    return at(-1, m, ambiguous
      ? '"kal" can mean yesterday or tomorrow — resolved to yesterday.'
      : undefined);
  }

  if ((m = matchWordish(text, '(\\d{1,2})\\s*(?:days?|din|दिन)\\s*(?:ago|pehle|pahle|पहले|back|before)'))) {
    return at(-parseInt(m.groups[0]!, 10), m);
  }

  if ((m = matchWordish(text, 'last\\s+week|pichle\\s+hafte|पिछले\\s+हफ्ते'))) {
    return at(-7, m);
  }

  // Weekday name, optionally prefixed with "last" — resolve to the most recent
  // past occurrence. Today counts as 7 days back, not 0, since "on Monday"
  // spoken on a Monday almost always means the previous one.
  if ((m = matchWordish(text, `(?:last\\s+|on\\s+)?(${WEEKDAYS.join('|')})`))) {
    const target = WEEKDAYS.indexOf(m.groups[0]!.toLowerCase());
    const diff = (today.getDay() - target + 7) % 7 || 7;
    return at(-diff, m);
  }

  // "25th July" / "July 25"
  const monthNames = Object.keys(MONTHS).join('|');
  if ((m = matchWordish(text, `(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})`))) {
    return explicitDate(parseInt(m.groups[0]!, 10), MONTHS[m.groups[1]!.toLowerCase()], m.span, today);
  }
  if ((m = matchWordish(text, `(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?`))) {
    return explicitDate(parseInt(m.groups[1]!, 10), MONTHS[m.groups[0]!.toLowerCase()], m.span, today);
  }

  return null;
}

function explicitDate(day: number, month: number, span: Span, today: Date): DateResult | null {
  if (day < 1 || day > 31) return null;
  let d = new Date(today.getFullYear(), month, day);
  // A future date almost certainly refers to last year.
  if (d > today) d = new Date(today.getFullYear() - 1, month, day);
  return { date: toIso(d), span };
}

// ─── Amount ──────────────────────────────────────────────────────────────────

const CURRENCY_TOKEN = '₹|rs\\.?|inr|rupees?|rupaye|rupaya|rupay|रुपये|रुपए|रुपया|रू';

/** Time expressions masked before amount detection so "5 pm" is never money. */
const TIME_SOURCES = [
  "\\d{1,2}\\s*[:.]\\s*\\d{2}\\s*(?:am|pm)?",
  "\\d{1,2}\\s*(?:am|pm|baje|बजे|o'?clock)",
];

function maskSpan(text: string, span: Span): string {
  return text.slice(0, span.start) + ' '.repeat(span.end - span.start) + text.slice(span.end);
}

/** Blanks every occurrence of each keyword source, preserving string offsets. */
function maskWordish(text: string, sources: string[]): string {
  let out = text;
  for (const source of sources) {
    out = out.replace(wordish(source, 'giu'), (match) => ' '.repeat(match.length));
  }
  return out;
}

/**
 * Picks the monetary value out of the utterance.
 *
 * Order matters: a number adjacent to a currency token is unambiguous, so it
 * wins outright. Otherwise we collect every remaining number and take the
 * largest, because in a spending sentence the money is nearly always the
 * biggest figure ("2 coffees for 300").
 */
function detectAmount(text: string): { amount?: number; span?: Span } {
  // Currency token before the number: "₹500", "rs 1,250", "rupaye paanch sau".
  const before = text.match(wordish(CURRENCY_TOKEN));
  if (before && before.index !== undefined) {
    const tokenEnd = before.index + before[0].length;
    const found = extractNumber(text.slice(tokenEnd));
    // Only trust it when the number follows closely, not clauses later.
    if (found && found.startIndex < 4 && found.value > 0) {
      return {
        amount: found.value,
        span: { start: tokenEnd - before[1].length, end: tokenEnd + found.endIndex },
      };
    }
  }

  // Currency token after the number: "500 rupees", "paanch sau rupaye".
  const after = text.match(
    new RegExp(`([${WORD_CHARS}][${WORD_CHARS} .,]*?)\\s*(?:${CURRENCY_TOKEN})(?![${WORD_CHARS}])`, 'iu'),
  );
  if (after && after.index !== undefined) {
    const found = extractNumber(after[1]);
    if (found && found.value > 0) {
      return {
        amount: found.value,
        span: {
          start: after.index + found.startIndex,
          end: after.index + after[0].length,
        },
      };
    }
  }

  // No currency anchor — collect all numbers and take the largest.
  let best: { value: number; span: Span } | null = null;
  let cursor = 0;
  let guard = 0;
  while (cursor < text.length && guard++ < 20) {
    const found = extractNumber(text.slice(cursor));
    if (!found) break;
    const span = { start: cursor + found.startIndex, end: cursor + found.endIndex };
    if (found.value > 0 && (!best || found.value > best.value)) {
      best = { value: found.value, span };
    }
    cursor = span.end;
  }

  return best ? { amount: best.value, span: best.span } : {};
}

// ─── Category ────────────────────────────────────────────────────────────────

/**
 * Hindi / Hinglish words mapped to built-in category ids. English merchant
 * keywords are intentionally absent — `autoCategorize` already covers those and
 * learns from the user's own history.
 *
 * A mapping only takes effect when the target category actually exists in the
 * user's list, so a customised category set can never produce a dangling id.
 */
const LANGUAGE_CATEGORY_HINTS: { source: string; categoryId: string }[] = [
  { source: 'sabzi|सब्ज़ी|सब्जी|kirana|किराना|ration|राशन|grocery|groceries|dukaan|सामान', categoryId: 'groceries' },
  { source: 'khana|khaana|खाना|nashta|नाश्ता|chai|चाय|coffee|restaurant|hotel|होटल|dhaba|ढाबा|swiggy|zomato|lunch|dinner|breakfast', categoryId: 'food-dining' },
  { source: 'petrol|पेट्रोल|diesel|डीज़ल|fuel|auto|ऑटो|rickshaw|रिक्शा|ola|uber|cab|taxi|metro|मेट्रो|bus|बस|train|ट्रेन|parking|पार्किंग|toll', categoryId: 'transportation' },
  { source: 'bijli|बिजली|electricity|paani|पानी|water\\s+bill|gas|गैस|recharge|रिचार्ज|internet|इंटरनेट|wifi|broadband|mobile\\s+bill|bill', categoryId: 'bills-utilities' },
  { source: 'dawai|दवाई|davai|medicine|दवा|doctor|डॉक्टर|hospital|अस्पताल|clinic|chemist|pharmacy|ilaj|इलाज', categoryId: 'health' },
  { source: 'kiraya|किराया|rent|makan\\s*malik|maid|मेड|bai|बाई', categoryId: 'household' },
  { source: 'kapde|कपड़े|kapda|clothes|clothing|shopping|शॉपिंग|amazon|flipkart|myntra|joote|जूते', categoryId: 'shopping' },
  { source: 'movie|मूवी|cinema|सिनेमा|film|फिल्म|netflix|prime\\s+video|hotstar|concert|game', categoryId: 'entertainment' },
  { source: 'school|स्कूल|fees|फीस|tuition|ट्यूशन|college|कॉलेज|padhai|पढ़ाई|course|book|किताब', categoryId: 'education' },
  { source: 'salon|सैलून|haircut|gym|जिम|parlour|parlor', categoryId: 'personal-care' },
  { source: 'insurance|बीमा|bima|premium|policy', categoryId: 'insurance' },
  { source: 'gift|गिफ्ट|donation|दान|daan|chanda|चंदा', categoryId: 'gifts-donations' },
  { source: 'salary|सैलरी|tankhwah|तनख्वाह|tankhah|payroll', categoryId: 'salary' },
  { source: 'interest|ब्याज|byaj', categoryId: 'interest' },
  { source: 'refund|रिफंड|wapas\\s+mile', categoryId: 'refunds' },
];

function detectCategory(
  text: string,
  categories: Category[],
  type: 'income' | 'expense' | 'transfer',
): string | undefined {
  if (type === 'transfer') return undefined;
  const pool = categories.filter((c) => c.type === type && !c.isDeleted);
  const lower = text.toLowerCase();

  // Exact name match wins — prefer the most specific (longest) name so a
  // subcategory beats its parent.
  const byName = pool
    .filter((c) => lower.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (byName) return byName.id;

  // Partial word match, e.g. "food" → "Food & Dining". Score by the length of
  // the matched word so the result does not depend on array order: "internet
  // bill" resolves to Internet/Broadband rather than whichever came first.
  let best: { id: string; score: number } | null = null;
  for (const cat of pool) {
    for (const w of cat.name.toLowerCase().split(/[\s&/]+/)) {
      if (w.length > 3 && lower.includes(w) && (!best || w.length > best.score)) {
        best = { id: cat.id, score: w.length };
      }
    }
  }
  if (best) return best.id;

  // Language hints, only when the target category is present.
  for (const hint of LANGUAGE_CATEGORY_HINTS) {
    if (testWordish(text, hint.source) && pool.some((c) => c.id === hint.categoryId)) {
      return hint.categoryId;
    }
  }

  return undefined;
}

// ─── Account ─────────────────────────────────────────────────────────────────

function detectAccount(
  text: string,
  accounts: Account[],
  method?: PaymentMethod,
): string | undefined {
  const pool = accounts.filter((a) => a.isActive && !a.isDeleted);
  const lower = text.toLowerCase();

  // Longest name first so "ICICI Credit Card" beats "ICICI".
  const byName = pool
    .filter((a) => lower.includes(a.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (byName) return byName.id;

  const byInstitution = pool.find(
    (a) => a.institution && lower.includes(a.institution.toLowerCase()),
  );
  if (byInstitution) return byInstitution.id;

  if (testWordish(text, 'credit\\s*card')) {
    const cc = pool.find((a) => a.type === 'credit_card');
    if (cc) return cc.id;
  }

  // "paid cash" implies the cash account even when it isn't named.
  if (method === 'cash') {
    const cash = pool.find((a) => a.type === 'cash');
    if (cash) return cash.id;
  }

  return undefined;
}

// ─── Merchant & note ─────────────────────────────────────────────────────────

/**
 * Conservative merchant extraction — we would rather return nothing than a
 * wrong name, since the note is what the user sees in their ledger.
 */
const MERCHANT_PATTERNS: RegExp[] = [
  /\b(?:at|from)\s+([A-Za-z][A-Za-z0-9&'.\s]{1,30}?)(?=\s+(?:on|for|using|with|by|yesterday|today)\b|[,.]|$)/i,
  /\b([A-Z][A-Za-z0-9&'.]{2,20})\s+(?:se|pe|par|mein)\b/,
];

function detectMerchant(text: string): string | undefined {
  for (const rx of MERCHANT_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      const name = m[1].trim().replace(/\s+/g, ' ');
      if (name.length >= 2) return name;
    }
  }
  return undefined;
}

const NOTE_NOISE =
  "i|we|spent|spend|paid|pay|bought|buy|purchased?|gave|received|got|transferred?|using|used|with|by|via|on|for|to|from|the|an?|of|some|maine|मैंने|kiya|किया|kiye|किये|kar|diya|दिया|hai|है|ne|ने|se|से|pe|पे|par|पर|ko|को|ke|के|liye|लिये|लिए|ka|का|rupees?|rupaye|rupaya|rs|inr|रुपये|रुपए";

/**
 * Builds the ledger note: the merchant when we found one, otherwise whatever
 * meaningful words remain once the amount, date and payment phrases are
 * removed. Falls back to the raw transcript so a note is never empty.
 */
function buildNote(transcript: string, merchant: string | undefined, spans: Span[]): string {
  if (merchant) return merchant.slice(0, MAX_NOTE_LENGTH);

  let residual = transcript;
  // Mask from the end so earlier indices stay valid.
  for (const span of [...spans].sort((a, b) => b.start - a.start)) {
    residual = maskSpan(residual, span);
  }

  const cleaned = maskWordish(residual, [NOTE_NOISE])
    .replace(/[^\p{L}\p{N}\p{M}\s&'.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const note = cleaned.length >= 3 ? cleaned : transcript.trim();
  return note.slice(0, MAX_NOTE_LENGTH);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export function parseVoiceTransaction(
  utterance: string | undefined | null,
  ctx: VoiceParserContext,
): ParsedVoiceTransaction {
  const transcript = (utterance ?? '').trim();
  if (!transcript) {
    return { transcript: '', type: 'expense', ambiguities: [] };
  }

  const today = ctx.today ?? new Date();
  const text = normalizeDigits(transcript);
  const ambiguities: string[] = [];
  const consumed: Span[] = [];

  const type = detectType(text);

  const dateResult = detectDate(text, today);
  if (dateResult) {
    consumed.push(dateResult.span);
    if (dateResult.ambiguity) ambiguities.push(dateResult.ambiguity);
  }

  const payment = detectPaymentMethod(text);
  if (payment.span) consumed.push(payment.span);

  // Mask the date, payment phrase and any clock times before looking for money,
  // so "3 din pehle" and "5 pm" can never be mistaken for an amount.
  let amountSearchText = maskWordish(text, TIME_SOURCES);
  for (const span of [...consumed].sort((a, b) => b.start - a.start)) {
    amountSearchText = maskSpan(amountSearchText, span);
  }

  const { amount, span: amountSpan } = detectAmount(amountSearchText);
  if (amountSpan) consumed.push(amountSpan);
  if (amount === undefined) {
    ambiguities.push('No amount detected — please enter it manually.');
  }

  const categoryId = detectCategory(text, ctx.categories, type);
  const accountId = detectAccount(text, ctx.accounts, payment.method);
  const merchant = detectMerchant(transcript);

  return {
    transcript,
    type,
    amount,
    categoryId,
    accountId,
    paymentMethod: payment.method,
    date: dateResult ? dateResult.date : toIso(today),
    notes: buildNote(transcript, merchant, consumed),
    merchant,
    ambiguities,
  };
}
