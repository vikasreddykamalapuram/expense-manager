import { v4 as uuidv4 } from 'uuid';
import type { ParsedShare } from '../../shared/services/shareParser';

export type DetectionSource = 'share' | 'notification' | 'gmail';

/** A parsed transaction candidate awaiting the user's review (privacy-first: nothing is saved until confirmed). */
export interface DetectedCandidate {
  id: string;
  source: DetectionSource;
  rawText: string;
  amount?: number;
  type?: 'income' | 'expense';
  merchant?: string;
  note?: string;
  account?: string; // last 4 digits
  date?: string;    // ISO YYYY-MM-DD
  detectedAt: string;
}

const QUEUE_KEY = 'moneyiq_detected_queue';
const CHANGED_EVENT = 'moneyiq:detected-changed';

/** Master opt-in flag key (read via prefs). Off by default — privacy first. */
export const AUTODETECT_ENABLED_KEY = 'autodetect_enabled';

function read(): DetectedCandidate[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as DetectedCandidate[]) : [];
  } catch {
    return [];
  }
}

function write(list: DetectedCandidate[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}

export function getDetectedQueue(): DetectedCandidate[] {
  return read().sort((a, b) => (a.detectedAt < b.detectedAt ? 1 : -1));
}

/** Add a parsed candidate to the review queue. De-dupes exact repeats within 1 minute. */
export function enqueueDetected(source: DetectionSource, parsed: ParsedShare, rawText: string): DetectedCandidate | null {
  if (!parsed.amount) return null; // nothing useful detected
  const list = read();
  const now = Date.now();
  const dup = list.find(
    (c) =>
      c.amount === parsed.amount &&
      c.rawText === rawText &&
      now - new Date(c.detectedAt).getTime() < 60_000
  );
  if (dup) return dup;

  const candidate: DetectedCandidate = {
    id: uuidv4(),
    source,
    rawText: rawText.slice(0, 300),
    amount: parsed.amount,
    type: parsed.type,
    merchant: parsed.merchant,
    note: parsed.note,
    account: parsed.account,
    date: parsed.date,
    detectedAt: new Date().toISOString(),
  };
  write([candidate, ...list]);
  return candidate;
}

export function dismissDetected(id: string): void {
  write(read().filter((c) => c.id !== id));
}

export function clearDetected(): void {
  write([]);
}

export function subscribeDetected(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener(CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
