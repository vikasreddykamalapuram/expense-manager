import { describe, it, expect } from 'vitest';
import {
  parseSpokenNumber,
  evaluateNumberWords,
  normalizeDigits,
} from '../shared/services/hindiNumbers';
import { parseVoiceTransaction } from '../shared/services/voiceParser';
import { buildVoiceDeepLink } from '../features/voice/voiceHandoff';
import { Account, Category } from '../shared/types';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SUBCATEGORIES,
  INCOME_CATEGORIES,
} from '../shared/constants/categories';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const categories: Category[] = [
  ...EXPENSE_CATEGORIES,
  ...EXPENSE_SUBCATEGORIES,
  ...INCOME_CATEGORIES,
];

const account = (over: Partial<Account> & { id: string; name: string }): Account => ({
  type: 'bank',
  kind: 'asset',
  openingBalance: 0,
  color: '#000',
  icon: 'Wallet',
  isActive: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...over,
});

const accounts: Account[] = [
  account({ id: 'acc-hdfc', name: 'HDFC Savings', institution: 'HDFC Bank' }),
  account({ id: 'acc-icici-cc', name: 'ICICI Credit Card', type: 'credit_card', kind: 'liability' }),
  account({ id: 'acc-cash', name: 'Wallet Cash', type: 'cash' }),
];

// Fixed reference date so relative expressions are deterministic.
// 2026-08-26 is a Wednesday.
const TODAY = new Date(2026, 7, 26);

const parse = (text: string) =>
  parseVoiceTransaction(text, { categories, accounts, today: TODAY });

// ─── Number parsing ──────────────────────────────────────────────────────────

describe('hindiNumbers', () => {
  it('converts Devanagari digits to ASCII', () => {
    expect(normalizeDigits('४५०')).toBe('450');
    expect(normalizeDigits('₹१,२५०')).toBe('₹1,250');
  });

  it('parses plain numerals', () => {
    expect(parseSpokenNumber('450')).toBe(450);
    expect(parseSpokenNumber('1,250')).toBe(1250);
    expect(parseSpokenNumber('99.50')).toBe(99.5);
  });

  it('parses romanized Hindi units and tens', () => {
    expect(parseSpokenNumber('paanch')).toBe(5);
    expect(parseSpokenNumber('pachaas')).toBe(50);
    expect(parseSpokenNumber('bees')).toBe(20);
  });

  it('parses Devanagari number words', () => {
    expect(parseSpokenNumber('पाँच सौ')).toBe(500);
    expect(parseSpokenNumber('दो हज़ार')).toBe(2000);
  });

  it('applies scale words', () => {
    expect(parseSpokenNumber('paanch sau')).toBe(500);
    expect(parseSpokenNumber('do hazaar')).toBe(2000);
    expect(parseSpokenNumber('teen lakh')).toBe(300000);
    expect(parseSpokenNumber('5 k')).toBe(5000);
  });

  it('combines scales additively', () => {
    // "two lakh five thousand" = 205000
    expect(evaluateNumberWords(['do', 'lakh', 'paanch', 'hazaar'])).toBe(205000);
    // "three hundred fifty"
    expect(evaluateNumberWords(['teen', 'sau', 'pachaas'])).toBe(350);
  });

  it('treats a bare multiplier as one of it', () => {
    expect(parseSpokenNumber('sau')).toBe(100);
    expect(parseSpokenNumber('hazaar')).toBe(1000);
  });

  it('handles Hindi fractional quantifiers', () => {
    expect(parseSpokenNumber('dedh sau')).toBe(150);   // 1.5 x 100
    expect(parseSpokenNumber('dhai hazaar')).toBe(2500); // 2.5 x 1000
    expect(parseSpokenNumber('sawa lakh')).toBe(125000); // 1.25 x 100000
  });

  it('handles the "saade" prefix modifier', () => {
    expect(parseSpokenNumber('saade teen sau')).toBe(350); // (3 + 0.5) x 100
    expect(parseSpokenNumber('saade char hazaar')).toBe(4500);
  });

  it('ignores "aur" between number words', () => {
    expect(parseSpokenNumber('teen sau aur pachaas')).toBe(350);
  });

  it('returns null when there is no number', () => {
    expect(parseSpokenNumber('groceries at DMart')).toBeNull();
    expect(evaluateNumberWords(['hello', 'world'])).toBeNull();
  });

  it('reports the span the number occupied', () => {
    // Lets the caller strip the amount out of the note.
    const found = parseSpokenNumber('spent 450 today');
    expect(found).toBe(450);
  });
});

// ─── English utterances ──────────────────────────────────────────────────────

describe('parseVoiceTransaction — English', () => {
  it('returns an empty expense shell for blank input', () => {
    const r = parseVoiceTransaction('', { categories, accounts });
    expect(r.transcript).toBe('');
    expect(r.type).toBe('expense');
    expect(r.amount).toBeUndefined();
  });

  it('parses a full expense sentence', () => {
    const r = parse('spent 450 on groceries at DMart yesterday using UPI');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(450);
    expect(r.categoryId).toBe('groceries');
    expect(r.paymentMethod).toBe('upi');
    expect(r.date).toBe('2026-08-25');
    expect(r.merchant).toBe('DMart');
  });

  it('detects income', () => {
    const r = parse('received 50000 salary today');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(50000);
    expect(r.categoryId).toBe('salary');
    expect(r.date).toBe('2026-08-26');
  });

  it('detects a transfer', () => {
    const r = parse('transferred 10000 to HDFC Savings');
    expect(r.type).toBe('transfer');
    expect(r.amount).toBe(10000);
    // Transfers have no category — the form picks the transfer pseudo-category.
    expect(r.categoryId).toBeUndefined();
  });

  it('handles the rupee symbol and comma grouping', () => {
    const r = parse('paid ₹1,250 for internet bill');
    expect(r.amount).toBe(1250);
    // The subcategory is preferred over its parent when it matches more
    // specifically ("internet" beats "bills").
    expect(r.categoryId).toBe('bills-internet');
  });

  it('prefers the currency-anchored number over other figures', () => {
    const r = parse('bought 2 coffees for rs 300');
    expect(r.amount).toBe(300);
  });

  it('falls back to the largest number when no currency token is present', () => {
    const r = parse('bought 2 coffees for 300');
    expect(r.amount).toBe(300);
  });

  it('never mistakes a clock time for an amount', () => {
    const r = parse('paid 250 for lunch at 2 pm');
    expect(r.amount).toBe(250);
  });

  it('never mistakes a relative-date number for an amount', () => {
    const r = parse('spent 800 on fuel 3 days ago');
    expect(r.amount).toBe(800);
    expect(r.date).toBe('2026-08-23');
  });

  it('defaults the date to today when none is spoken', () => {
    const r = parse('paid 200 for chai');
    expect(r.date).toBe('2026-08-26');
  });

  it('resolves a weekday to the most recent past occurrence', () => {
    // TODAY is Wednesday; "on Monday" → two days back.
    const r = parse('spent 600 on shopping on Monday');
    expect(r.date).toBe('2026-08-24');
  });

  it('resolves an explicit day and month', () => {
    const r = parse('paid 1500 for insurance on 10th July');
    expect(r.date).toBe('2026-07-10');
  });

  it('rolls an explicit future date back to last year', () => {
    // December is after August, so it must mean last December.
    const r = parse('paid 900 on 5th December');
    expect(r.date).toBe('2025-12-05');
  });

  it('flags a missing amount rather than guessing', () => {
    const r = parse('bought some groceries at DMart');
    expect(r.amount).toBeUndefined();
    expect(r.ambiguities.join(' ')).toMatch(/amount/i);
  });
});

// ─── Payment methods ─────────────────────────────────────────────────────────

describe('parseVoiceTransaction — payment methods', () => {
  const cases: [string, string][] = [
    ['paid 100 by gpay', 'upi'],
    ['paid 100 via phonepe', 'upi'],
    ['paid 100 through paytm', 'upi'],
    ['paid 100 in cash', 'cash'],
    ['paid 100 with credit card', 'card'],
    ['paid 100 by debit card', 'card'],
    ['paid 100 via net banking', 'net_banking'],
    ['paid 100 by NEFT', 'net_banking'],
    ['paid 100 by cheque', 'cheque'],
    ['paid 100 by auto debit', 'auto_debit'],
  ];

  it.each(cases)('maps %s → %s', (utterance, method) => {
    expect(parse(utterance).paymentMethod).toBe(method);
  });

  it('prefers the specific phrase over the token it contains', () => {
    // "net banking" contains "bank"; "credit card" contains "card".
    expect(parse('paid 500 using net banking').paymentMethod).toBe('net_banking');
    expect(parse('paid 500 using credit card').paymentMethod).toBe('card');
  });
});

// ─── Accounts ────────────────────────────────────────────────────────────────

describe('parseVoiceTransaction — accounts', () => {
  it('matches an account by name', () => {
    expect(parse('paid 500 from HDFC Savings').accountId).toBe('acc-hdfc');
  });

  it('matches an account by institution', () => {
    expect(parse('paid 500 from HDFC Bank').accountId).toBe('acc-hdfc');
  });

  it('prefers the longer, more specific account name', () => {
    expect(parse('paid 500 on ICICI Credit Card').accountId).toBe('acc-icici-cc');
  });

  it('infers the cash account when the user says cash', () => {
    expect(parse('paid 200 cash for chai').accountId).toBe('acc-cash');
  });

  it('leaves the account unset when nothing matches', () => {
    expect(parse('paid 200 for chai').accountId).toBeUndefined();
  });
});

// ─── Accounts: several cards ─────────────────────────────────────────────────

/**
 * The realistic wallet. Reported from a device: "used ICICI Emerald credit
 * card" resolved to whichever credit card happened to be first in the list,
 * because whole-name matching failed and the fallback picked one anyway.
 */
const multiCard: Account[] = [
  account({ id: 'cc-hdfc', name: 'HDFC Regalia Credit Card', type: 'credit_card', kind: 'liability', institution: 'HDFC Bank' }),
  account({ id: 'cc-icici', name: 'ICICI Emerald Credit Card', type: 'credit_card', kind: 'liability', institution: 'ICICI Bank' }),
  account({ id: 'cc-axis', name: 'Axis Magnus Credit Card', type: 'credit_card', kind: 'liability', institution: 'Axis Bank' }),
  account({ id: 'acc-icici-sb', name: 'ICICI Savings', type: 'bank', institution: 'ICICI Bank' }),
];

const parseCards = (text: string) =>
  parseVoiceTransaction(text, { categories, accounts: multiCard, today: TODAY });

describe('parseVoiceTransaction — picking between several cards', () => {
  it('picks the card the user actually named', () => {
    expect(parseCards('spent 2000 using ICICI Emerald credit card').accountId).toBe('cc-icici');
  });

  it('matches on the distinctive word alone, without the full account name', () => {
    expect(parseCards('spent 2000 on Emerald').accountId).toBe('cc-icici');
  });

  it('survives the recogniser mangling a proper noun by one letter', () => {
    expect(parseCards('spent 2000 using emrald credit card').accountId).toBe('cc-icici');
  });

  it('prefers the card over the savings account of the same bank', () => {
    expect(parseCards('spent 2000 on ICICI credit card').accountId).toBe('cc-icici');
  });

  it('still picks the savings account when no card is implied', () => {
    expect(parseCards('paid 500 from ICICI Savings').accountId).toBe('acc-icici-sb');
  });

  it('refuses to guess which card when only "credit card" was said', () => {
    const r = parseCards('spent 2000 on credit card');
    expect(r.accountId).toBeUndefined();
    expect(r.ambiguities.join(' ')).toContain('3');
  });

  it('flags the tie instead of choosing when two accounts match equally', () => {
    const twins: Account[] = [
      account({ id: 'a', name: 'Emerald One', type: 'credit_card', kind: 'liability' }),
      account({ id: 'b', name: 'Emerald Two', type: 'credit_card', kind: 'liability' }),
    ];
    const r = parseVoiceTransaction('spent 100 on Emerald', {
      categories,
      accounts: twins,
      today: TODAY,
    });
    expect(r.accountId).toBeUndefined();
    expect(r.ambiguities.join(' ')).toContain('Emerald One');
  });

  it('does not match an unrelated short word by fuzzy distance', () => {
    expect(parseCards('spent 2000 on Axis Magnum credit card').accountId).toBe('cc-axis');
    expect(parseCards('spent 300 on tea').accountId).toBeUndefined();
  });
});

// ─── Hindi and Hinglish ──────────────────────────────────────────────────────

describe('parseVoiceTransaction — Hindi / Hinglish', () => {
  it('parses a romanized Hinglish expense', () => {
    const r = parse('paanch sau rupaye sabzi pe cash se kharch kiye');
    expect(r.type).toBe('expense');
    expect(r.amount).toBe(500);
    expect(r.categoryId).toBe('groceries');
    expect(r.paymentMethod).toBe('cash');
  });

  it('parses a Devanagari expense', () => {
    const r = parse('कल पेट्रोल पर 2000 रुपये कार्ड से');
    expect(r.amount).toBe(2000);
    expect(r.categoryId).toBe('transportation');
    expect(r.paymentMethod).toBe('card');
    expect(r.date).toBe('2026-08-25');
  });

  it('detects Hindi income verbs', () => {
    const r = parse('tankhwah mili 60000');
    expect(r.type).toBe('income');
    expect(r.amount).toBe(60000);
  });

  it('maps Hindi category words', () => {
    expect(parse('300 dawai ke liye kharch').categoryId).toBe('health');
    expect(parse('kiraya 15000 diya').categoryId).toBe('household');
    expect(parse('bijli ka bill 1200').categoryId).toBe('bills-utilities');
    expect(parse('500 khana kharch').categoryId).toBe('food-dining');
  });

  it('handles Devanagari digits inside an utterance', () => {
    expect(parse('४५० खाना').amount).toBe(450);
  });

  it('resolves "kal" to yesterday and flags the ambiguity', () => {
    const r = parse('kal 500 kharch kiye');
    expect(r.date).toBe('2026-08-25');
    expect(r.ambiguities.join(' ')).toMatch(/kal/i);
  });

  it('does not flag unambiguous English "yesterday"', () => {
    const r = parse('spent 500 yesterday');
    expect(r.date).toBe('2026-08-25');
    expect(r.ambiguities).toHaveLength(0);
  });

  it('resolves "parso" two days back and flags it', () => {
    const r = parse('parso 700 kharch');
    expect(r.date).toBe('2026-08-24');
    expect(r.ambiguities.join(' ')).toMatch(/parso/i);
  });

  it('resolves "din pehle"', () => {
    expect(parse('4 din pehle 900 kharch').date).toBe('2026-08-22');
  });

  it('parses "aaj" as today', () => {
    expect(parse('aaj 250 chai pe kharch').date).toBe('2026-08-26');
  });
});

// ─── Notes ───────────────────────────────────────────────────────────────────

describe('parseVoiceTransaction — notes', () => {
  it('uses the merchant as the note when one is found', () => {
    expect(parse('spent 450 at DMart yesterday').notes).toBe('DMart');
  });

  it('strips the amount, date and payment phrase from the note', () => {
    const note = parse('spent 450 on groceries yesterday using UPI')!.notes!;
    expect(note.toLowerCase()).toContain('groceries');
    expect(note).not.toContain('450');
    expect(note.toLowerCase()).not.toContain('yesterday');
    expect(note.toLowerCase()).not.toContain('upi');
  });

  it('falls back to the transcript when nothing meaningful remains', () => {
    const r = parse('500');
    expect(r.notes).toBe('500');
  });

  it('always preserves the raw transcript', () => {
    const utterance = 'spent 450 on groceries at DMart yesterday using UPI';
    expect(parse(utterance).transcript).toBe(utterance);
  });
});

// ─── Safety: a custom category set must never yield a dangling id ────────────

describe('parseVoiceTransaction — custom category sets', () => {
  it('does not return a built-in id that the user does not have', () => {
    const minimal: Category[] = [
      { id: 'my-food', name: 'Eating Out', type: 'expense', icon: 'X', color: '#000', isCustom: true },
    ];
    const r = parseVoiceTransaction('500 sabzi pe kharch', {
      categories: minimal,
      accounts,
      today: TODAY,
    });
    // "groceries" is not in this user's list, so no category is claimed.
    expect(r.categoryId).toBeUndefined();
  });

  it('matches a user-defined category by name', () => {
    const custom: Category[] = [
      { id: 'my-pets', name: 'Pet Care', type: 'expense', icon: 'X', color: '#000', isCustom: true },
    ];
    const r = parseVoiceTransaction('spent 700 on Pet Care', {
      categories: custom,
      accounts,
      today: TODAY,
    });
    expect(r.categoryId).toBe('my-pets');
  });

  it('ignores deleted categories and inactive accounts', () => {
    const deleted: Category[] = [
      { id: 'gone', name: 'Groceries', type: 'expense', icon: 'X', color: '#000', isCustom: false, isDeleted: true },
    ];
    const inactive: Account[] = [account({ id: 'old', name: 'Old Bank', isActive: false })];
    const r = parseVoiceTransaction('spent 100 on Groceries from Old Bank', {
      categories: deleted,
      accounts: inactive,
      today: TODAY,
    });
    expect(r.categoryId).toBeUndefined();
    expect(r.accountId).toBeUndefined();
  });
});


// ─── Offering to create what was heard ───────────────────────────────────────

describe('parseVoiceTransaction — unmatched names', () => {
  it('offers the account name it heard when nothing matches', () => {
    const r = parse('paid 500 using Zenith Platinum');
    expect(r.accountId).toBeUndefined();
    expect(r.suggestedAccountName).toBe('Zenith Platinum');
    expect(r.ambiguities.join(' ')).toContain('Zenith Platinum');
  });

  it('stops the captured name at a word that cannot be part of one', () => {
    expect(parse('paid 500 using Zenith Platinum yesterday').suggestedAccountName)
      .toBe('Zenith Platinum');
  });

  it('reads the Hindi word order, where the marker comes last', () => {
    expect(parse('Zenith Platinum se 500 kharch kiye').suggestedAccountName)
      .toBe('Zenith Platinum');
  });

  it('stays quiet when the account was actually matched', () => {
    const r = parse('paid 500 from HDFC Savings');
    expect(r.accountId).toBe('acc-hdfc');
    expect(r.suggestedAccountName).toBeUndefined();
  });

  it('never offers to create an account from a generic word', () => {
    expect(parse('paid 500 using the card').suggestedAccountName).toBeUndefined();
  });

  it('offers a category name when nothing matches', () => {
    const r = parse('spent 700 on cricket coaching');
    expect(r.categoryId).toBeUndefined();
    expect(r.suggestedCategoryName).toBe('Cricket Coaching');
  });

  it('stays quiet when the category was actually matched', () => {
    const r = parse('spent 450 on groceries');
    expect(r.categoryId).toBeTruthy();
    expect(r.suggestedCategoryName).toBeUndefined();
  });

  it('never offers to create a category from a vague word', () => {
    expect(parse('spent 300 on something').suggestedCategoryName).toBeUndefined();
  });

  it('carries the suggestions into the add-transaction link', () => {
    const link = buildVoiceDeepLink(parse('paid 500 using Zenith Platinum'));
    expect(link).toContain('newAccount=Zenith+Platinum');
    expect(buildVoiceDeepLink(parse('paid 500 from HDFC Savings'))).not.toContain('newAccount');
  });
});
