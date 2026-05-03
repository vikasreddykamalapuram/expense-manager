import type { Transaction, Category } from '../types';

// ─── Types ──────────────────────────────────────────────

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number; // 0-100
  reason: string;
}

export interface CategorizationPattern {
  keyword: string;
  categoryId: string;
  frequency: number;
  lastSeen: string;
}

// ─── Default merchant keyword map ───────────────────────

const DEFAULT_MERCHANT_KEYWORDS: Record<string, string[]> = {
  'food': ['swiggy', 'zomato', 'restaurant', 'cafe', 'hotel', 'bakery', 'mess', 'canteen', 'dhaba', 'biryani', 'pizza', 'burger', 'dominos', 'kfc', 'mcdonalds'],
  'shopping': ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'mall', 'store', 'shop', 'snapdeal', 'nykaa'],
  'transport': ['uber', 'ola', 'rapido', 'petrol', 'diesel', 'fuel', 'parking', 'toll', 'metro', 'bus', 'cab', 'auto', 'railway', 'irctc'],
  'groceries': ['bigbasket', 'blinkit', 'zepto', 'jiomart', 'dmart', 'reliance fresh', 'grocery', 'kirana', 'vegetables', 'fruits', 'supermarket'],
  'utility': ['electricity', 'water', 'gas', 'broadband', 'jio', 'airtel', 'vi', 'bsnl', 'recharge', 'wifi', 'internet', 'mobile bill'],
  'entertainment': ['netflix', 'hotstar', 'prime', 'spotify', 'bookmyshow', 'movie', 'theatre', 'cinema', 'gaming', 'youtube premium'],
  'medical': ['hospital', 'pharmacy', 'apollo', 'medplus', '1mg', 'netmeds', 'doctor', 'clinic', 'medicine', 'health', 'dental', 'lab test'],
  'education': ['school', 'college', 'tuition', 'coaching', 'books', 'udemy', 'coursera', 'exam', 'fee'],
  'subscription': ['subscription', 'membership', 'premium', 'renewal'],
  'insurance': ['insurance', 'lic', 'hdfc life', 'sbi life', 'policy', 'premium'],
  'rent': ['rent', 'landlord', 'house rent', 'pg', 'hostel'],
  'salary': ['salary', 'payroll', 'wages', 'stipend'],
  'investment': ['mutual fund', 'sip', 'stock', 'share', 'dividend', 'fd', 'fixed deposit'],
};

// ─── Helpers ────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function extractTokens(text: string): string[] {
  return normalizeText(text).split(' ').filter(Boolean);
}

function getDayOfMonth(dateStr: string): number {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? 0 : d.getDate();
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}


// ─── Build patterns from transaction history ────────────

interface NotesPattern {
  normalized: string;
  categoryId: string;
  count: number;
}

interface AmountProfile {
  categoryId: string;
  min: number;
  max: number;
  median: number;
  days: number[]; // common days of month
}

interface MerchantPattern {
  keyword: string;
  categoryId: string;
  count: number;
}

function buildNotesMap(transactions: Transaction[]): Map<string, NotesPattern> {
  const map = new Map<string, NotesPattern>();
  for (const txn of transactions) {
    if (!txn.notes || !txn.categoryId || txn.categoryId === 'transfer') continue;
    const normalized = normalizeText(txn.notes);
    if (!normalized) continue;

    const existing = map.get(normalized);
    if (existing) {
      // Pick the most frequently used category for this notes pattern
      if (existing.categoryId === txn.categoryId) {
        existing.count++;
      } else {
        // Track the dominant category
        existing.count--;
        if (existing.count <= 0) {
          existing.categoryId = txn.categoryId;
          existing.count = 1;
        }
      }
    } else {
      map.set(normalized, { normalized, categoryId: txn.categoryId, count: 1 });
    }
  }
  return map;
}

function buildAmountProfiles(transactions: Transaction[]): AmountProfile[] {
  const catAmounts = new Map<string, { amounts: number[]; days: number[] }>();
  for (const txn of transactions) {
    if (!txn.categoryId || txn.categoryId === 'transfer') continue;
    let entry = catAmounts.get(txn.categoryId);
    if (!entry) {
      entry = { amounts: [], days: [] };
      catAmounts.set(txn.categoryId, entry);
    }
    entry.amounts.push(txn.amount);
    entry.days.push(getDayOfMonth(txn.date));
  }

  const profiles: AmountProfile[] = [];
  for (const [categoryId, data] of catAmounts) {
    if (data.amounts.length < 2) continue; // need at least 2 transactions
    profiles.push({
      categoryId,
      min: Math.min(...data.amounts),
      max: Math.max(...data.amounts),
      median: median(data.amounts),
      days: data.days,
    });
  }
  return profiles;
}

function buildMerchantPatterns(
  transactions: Transaction[],
  categories: Category[],
): MerchantPattern[] {
  // First, build from user's transaction history (these override defaults)
  const userPatterns = new Map<string, MerchantPattern>();
  for (const txn of transactions) {
    if (!txn.notes || !txn.categoryId || txn.categoryId === 'transfer') continue;
    const tokens = extractTokens(txn.notes);
    for (const token of tokens) {
      if (token.length < 3) continue; // skip tiny tokens
      const key = `${token}__${txn.categoryId}`;
      const existing = userPatterns.get(key);
      if (existing) {
        existing.count++;
      } else {
        userPatterns.set(key, { keyword: token, categoryId: txn.categoryId, count: 1 });
      }
    }
  }

  // Convert to array, only keep patterns that appeared at least twice
  const patterns: MerchantPattern[] = [];
  for (const p of userPatterns.values()) {
    if (p.count >= 2) {
      patterns.push(p);
    }
  }

  // Add default merchant keywords, but only if no user pattern exists for that keyword
  const userKeywords = new Set(patterns.map((p) => p.keyword));
  for (const [categoryName, keywords] of Object.entries(DEFAULT_MERCHANT_KEYWORDS)) {
    // Find matching category by name (case-insensitive partial match)
    const matchingCat = categories.find((c) => {
      const catNameLower = c.name.toLowerCase();
      const searchName = categoryName.toLowerCase();
      return catNameLower.includes(searchName) || searchName.includes(catNameLower);
    });
    if (!matchingCat) continue;

    for (const kw of keywords) {
      if (!userKeywords.has(kw)) {
        patterns.push({ keyword: kw, categoryId: matchingCat.id, count: 0 });
      }
    }
  }

  return patterns;
}

function buildDayPatterns(transactions: Transaction[]): Map<number, Map<string, number>> {
  // day → categoryId → count
  const dayMap = new Map<number, Map<string, number>>();
  for (const txn of transactions) {
    if (!txn.categoryId || txn.categoryId === 'transfer') continue;
    const day = getDayOfMonth(txn.date);
    if (day === 0) continue;
    let catMap = dayMap.get(day);
    if (!catMap) {
      catMap = new Map();
      dayMap.set(day, catMap);
    }
    catMap.set(txn.categoryId, (catMap.get(txn.categoryId) || 0) + 1);
  }
  return dayMap;
}

// ─── Main suggestion function ───────────────────────────

export function suggestCategories(
  notes: string,
  amount: number,
  type: 'income' | 'expense',
  date: string,
  existingTransactions: Transaction[],
  categories: Category[],
): CategorySuggestion[] {
  const relevantTransactions = existingTransactions.filter(
    (t) => t.type === type && t.categoryId && t.categoryId !== 'transfer',
  );

  if (relevantTransactions.length === 0) {
    // No history — try default merchant keywords only
    return suggestFromDefaults(notes, type, categories);
  }

  const filteredCategories = categories.filter((c) => c.type === type);
  const suggestions = new Map<string, CategorySuggestion>();

  const addSuggestion = (categoryId: string, confidence: number, reason: string) => {
    // Verify the category exists and matches type
    const cat = filteredCategories.find((c) => c.id === categoryId);
    if (!cat) return;

    const existing = suggestions.get(categoryId);
    if (!existing || existing.confidence < confidence) {
      suggestions.set(categoryId, {
        categoryId,
        categoryName: cat.name,
        confidence: Math.min(confidence, 100),
        reason,
      });
    }
  };

  // 1. Notes-based matching (highest priority)
  if (notes.trim()) {
    const normalizedNotes = normalizeText(notes);
    const notesMap = buildNotesMap(relevantTransactions);

    // Exact match
    const exactMatch = notesMap.get(normalizedNotes);
    if (exactMatch) {
      addSuggestion(
        exactMatch.categoryId,
        90,
        `Matches previous: "${notes.trim()}"`,
      );
    }

    // Partial keyword match
    const inputTokens = extractTokens(notes);
    for (const [, pattern] of notesMap) {
      if (pattern.normalized === normalizedNotes) continue; // skip exact (already handled)
      const patternTokens = pattern.normalized.split(' ');
      const matchingTokens = inputTokens.filter((t) => patternTokens.includes(t));
      if (matchingTokens.length > 0 && matchingTokens.length >= Math.min(2, inputTokens.length)) {
        const matchRatio = matchingTokens.length / Math.max(inputTokens.length, patternTokens.length);
        const confidence = Math.round(50 + matchRatio * 20 + Math.min(pattern.count, 5) * 2);
        addSuggestion(
          pattern.categoryId,
          Math.min(confidence, 80),
          `Similar to: "${pattern.normalized}"`,
        );
      }
    }
  }

  // 2. Merchant/payee pattern matching
  if (notes.trim()) {
    const merchantPatterns = buildMerchantPatterns(relevantTransactions, filteredCategories);
    const normalizedInput = normalizeText(notes);
    const inputTokens = extractTokens(notes);

    for (const pattern of merchantPatterns) {
      const isMatch =
        inputTokens.includes(pattern.keyword) ||
        normalizedInput.includes(pattern.keyword);

      if (isMatch) {
        const isUserPattern = pattern.count >= 2;
        const confidence = isUserPattern
          ? Math.min(60 + pattern.count * 5, 85)
          : 55;
        addSuggestion(
          pattern.categoryId,
          confidence,
          `Merchant match: "${pattern.keyword}"`,
        );
      }
    }
  }

  // 3. Amount-range matching
  if (amount > 0) {
    const amountProfiles = buildAmountProfiles(relevantTransactions);
    const day = getDayOfMonth(date);

    for (const profile of amountProfiles) {
      const range = profile.max - profile.min;
      const tolerance = Math.max(range * 0.2, profile.median * 0.1);
      const inRange = amount >= profile.min - tolerance && amount <= profile.max + tolerance;

      if (inRange) {
        let confidence = 30;
        // Boost if amount is close to median
        const medianDiff = Math.abs(amount - profile.median);
        if (medianDiff < profile.median * 0.05) confidence += 15;

        // Boost if day matches
        if (day > 0 && profile.days.includes(day)) {
          const dayFreq = profile.days.filter((d) => d === day).length / profile.days.length;
          if (dayFreq > 0.3) confidence += 20;
        }

        if (confidence > 50) {
          addSuggestion(
            profile.categoryId,
            confidence,
            `Amount ₹${amount.toLocaleString()} fits pattern`,
          );
        }
      }
    }
  }

  // 4. Day-of-month pattern matching
  if (date) {
    const day = getDayOfMonth(date);
    if (day > 0) {
      const dayPatterns = buildDayPatterns(relevantTransactions);
      const dayCategories = dayPatterns.get(day);
      if (dayCategories) {
        for (const [categoryId, count] of dayCategories) {
          if (count >= 3) {
            // Only suggest if there's a clear pattern (3+ occurrences on this day)
            const totalForDay = [...dayCategories.values()].reduce((a, b) => a + b, 0);
            const ratio = count / totalForDay;
            if (ratio > 0.5) {
              addSuggestion(
                categoryId,
                Math.min(40 + ratio * 20, 55),
                `Often on day ${day} of month`,
              );
            }
          }
        }
      }
    }
  }

  // Return top 3 suggestions with confidence > 50%
  return [...suggestions.values()]
    .filter((s) => s.confidence > 50)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// Fallback: suggest from default merchant keywords only (no transaction history)
function suggestFromDefaults(
  notes: string,
  type: 'income' | 'expense',
  categories: Category[],
): CategorySuggestion[] {
  if (!notes.trim()) return [];

  const filteredCategories = categories.filter((c) => c.type === type);
  const normalizedInput = normalizeText(notes);
  const inputTokens = extractTokens(notes);
  const suggestions: CategorySuggestion[] = [];

  for (const [categoryName, keywords] of Object.entries(DEFAULT_MERCHANT_KEYWORDS)) {
    const matchingCat = filteredCategories.find((c) => {
      const catNameLower = c.name.toLowerCase();
      const searchName = categoryName.toLowerCase();
      return catNameLower.includes(searchName) || searchName.includes(catNameLower);
    });
    if (!matchingCat) continue;

    for (const kw of keywords) {
      if (inputTokens.includes(kw) || normalizedInput.includes(kw)) {
        suggestions.push({
          categoryId: matchingCat.id,
          categoryName: matchingCat.name,
          confidence: 55,
          reason: `Merchant match: "${kw}"`,
        });
        break; // one match per category is enough
      }
    }
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// ─── Batch suggestion for imports ───────────────────────

export function suggestCategoryForImport(
  description: string,
  amount: number,
  type: 'income' | 'expense',
  date: string,
  existingTransactions: Transaction[],
  categories: Category[],
): CategorySuggestion | null {
  const suggestions = suggestCategories(
    description, amount, type, date,
    existingTransactions, categories,
  );
  return suggestions.length > 0 ? suggestions[0] : null;
}
