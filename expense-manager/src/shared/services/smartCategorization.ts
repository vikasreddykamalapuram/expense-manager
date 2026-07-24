import { Transaction, Category } from '../types';

const STORAGE_KEY = 'expenseiq_cat_patterns';

interface PatternEntry {
  keyword: string;
  categoryId: string;
  count: number;
  lastUsed: string;
}

/**
 * Learn categorization patterns from user transactions.
 * Builds a notes→category mapping that improves over time.
 */
export class SmartCategorizer {
  private patterns: Map<string, PatternEntry> = new Map();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const entries: PatternEntry[] = JSON.parse(raw);
        for (const e of entries) {
          this.patterns.set(e.keyword, e);
        }
      }
    } catch { /* ignore */ }
  }

  private save() {
    try {
      const entries = [...this.patterns.values()];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch { /* ignore */ }
  }

  /**
   * Learn from a transaction — associate normalized notes with its category
   */
  learn(transaction: Transaction): void {
    if (!transaction.notes || transaction.type !== 'expense') return;
    const keywords = this.extractKeywords(transaction.notes);

    for (const keyword of keywords) {
      const existing = this.patterns.get(keyword);
      if (existing && existing.categoryId === transaction.categoryId) {
        existing.count++;
        existing.lastUsed = new Date().toISOString();
      } else if (!existing || existing.count < 3) {
        // New keyword or override low-confidence existing
        this.patterns.set(keyword, {
          keyword,
          categoryId: transaction.categoryId,
          count: existing ? 1 : 1,
          lastUsed: new Date().toISOString(),
        });
      }
    }
    this.save();
  }

  /**
   * Bulk learn from transaction history
   */
  learnFromHistory(transactions: Transaction[]): void {
    const expenses = transactions.filter(t => t.type === 'expense' && !t.isDeleted && t.notes);
    for (const t of expenses) {
      this.learn(t);
    }
  }

  /**
   * Suggest a category based on notes text
   */
  suggest(notes: string, categories: Category[]): CategorySuggestion | null {
    if (!notes || notes.length < 2) return null;
    const keywords = this.extractKeywords(notes);
    const scores = new Map<string, number>();

    for (const keyword of keywords) {
      const pattern = this.patterns.get(keyword);
      if (pattern) {
        const current = scores.get(pattern.categoryId) || 0;
        scores.set(pattern.categoryId, current + pattern.count);
      }
    }

    if (scores.size === 0) return null;

    // Find best match
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    const [bestCatId, bestScore] = sorted[0];
    const totalScore = sorted.reduce((s, [, v]) => s + v, 0);
    const confidence = Math.min(95, Math.round((bestScore / Math.max(totalScore, 1)) * 80 + Math.min(bestScore, 10) * 2));

    const category = categories.find(c => c.id === bestCatId);
    if (!category || confidence < 30) return null;

    return {
      categoryId: bestCatId,
      categoryName: category.name,
      confidence,
      source: 'learned',
    };
  }

  /**
   * Get all learned patterns (for display/management)
   */
  getPatterns(): PatternEntry[] {
    return [...this.patterns.values()].sort((a, b) => b.count - a.count);
  }

  /**
   * Clear a specific pattern
   */
  removePattern(keyword: string): void {
    this.patterns.delete(keyword);
    this.save();
  }

  /**
   * Clear all patterns
   */
  reset(): void {
    this.patterns.clear();
    localStorage.removeItem(STORAGE_KEY);
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 3)
      .slice(0, 5); // Max 5 keywords per transaction
  }
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number; // 0-100
  source: 'learned' | 'fuzzy';
}

/**
 * Fuzzy match merchant names to normalize variations
 * e.g., "SWIGGY ORDER", "Swiggy", "SWIGGY DELIVERY" → all match "swiggy"
 */
export function fuzzyMatchMerchant(notes: string, transactions: Transaction[]): string | null {
  if (!notes || notes.length < 3) return null;

  const normalized = notes.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.length < 3) return null;

  // Find transactions with similar notes
  const matches: Transaction[] = [];
  for (const t of transactions) {
    if (!t.notes || t.id === notes) continue;
    const tNorm = t.notes.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Check if one contains the other or Levenshtein-like similarity
    if (tNorm.includes(normalized) || normalized.includes(tNorm)) {
      matches.push(t);
    } else if (normalized.length >= 5 && tNorm.length >= 5) {
      // Check prefix match (first 5+ chars)
      const prefixLen = Math.min(normalized.length, tNorm.length, 8);
      if (normalized.slice(0, prefixLen) === tNorm.slice(0, prefixLen)) {
        matches.push(t);
      }
    }
  }

  if (matches.length === 0) return null;

  // Return the most common categoryId among matches
  const catCounts = new Map<string, number>();
  for (const m of matches) {
    catCounts.set(m.categoryId, (catCounts.get(m.categoryId) || 0) + 1);
  }
  const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return topCat ? topCat[0] : null;
}

// Singleton instance
export const smartCategorizer = new SmartCategorizer();
