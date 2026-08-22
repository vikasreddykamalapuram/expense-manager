import { parseSharedText } from '../../shared/services/shareParser';
import { enqueueDetected } from './detection';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailScanResult {
  /** Emails matching the query. */
  scanned: number;
  /** Of those, ones already processed by an earlier scan. */
  alreadySeen: number;
  /** Of the new ones, how many contained a parseable amount. */
  withAmount: number;
  /** How many actually reached the review queue. */
  added: number;
}

/**
 * Gmail query targeting recent bank/payment emails. Kept narrow (last 30 days,
 * transaction keywords, excludes promotions) so we fetch as little as possible.
 */
const GMAIL_QUERY =
  'newer_than:30d (debited OR credited OR spent OR "transaction" OR txn OR payment OR "debit alert" OR "credit alert") -category:promotions -category:social';

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: { headers?: GmailHeader[] };
}

/**
 * Message IDs already turned into candidates. Without this, a second scan
 * re-adds every email again — the queue's own de-dupe only covers a 60s window,
 * which is meant for repeated notifications, not a manual re-scan an hour later.
 */
const SEEN_KEY = 'moneyiq_gmail_seen_ids';
const SEEN_LIMIT = 500;

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    // Keep the newest IDs; the query only looks back 30 days anyway.
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT)));
  } catch {
    /* storage full or unavailable — de-dupe is best-effort */
  }
}

/** Forget which emails have been scanned, so the next scan re-reads everything. */
export function resetGmailSeen(): void {
  try {
    localStorage.removeItem(SEEN_KEY);
  } catch {
    /* ignore */
  }
}

function header(msg: GmailMessage, name: string): string | undefined {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

/** "HDFC Bank Alerts <alerts@hdfcbank.net>" -> "HDFC Bank Alerts" */
function senderName(from: string | undefined): string | undefined {
  if (!from) return undefined;
  const named = from.match(/^\s*"?([^"<]+?)"?\s*</);
  if (named?.[1]?.trim()) return named[1].trim();
  const addr = from.match(/([^@<\s]+)@/);
  return addr?.[1];
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Scan the signed-in user's Gmail for recent transaction emails and add any
 * detected candidates to the on-device review queue. Read-only: uses only the
 * subject line and message snippet (never stores or forwards the email body).
 * Nothing is saved as a transaction until the user confirms it in the queue.
 */
export async function scanGmail(accessToken: string, maxResults = 25): Promise<GmailScanResult> {
  const q = encodeURIComponent(GMAIL_QUERY);
  const list = await gmailFetch<GmailListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${q}`,
    accessToken
  );
  const ids = (list.messages || []).map((m) => m.id);
  const seen = readSeen();
  const fresh = ids.filter((id) => !seen.has(id));
  let added = 0;
  let withAmount = 0;

  for (const id of fresh) {
    try {
      const msg = await gmailFetch<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        accessToken
      );

      // The amount frequently lives in the subject ("Debit alert: Rs.1,250.00
      // spent at ..."), so parse subject + snippet together. The snippet alone
      // is truncated and often starts with a greeting or a logo alt-text.
      const subject = header(msg, 'Subject') ?? '';
      const snippet = msg.snippet?.trim() ?? '';
      const text = [subject, snippet].filter(Boolean).join(' — ');
      if (!text) continue;

      seen.add(id);

      const parsed = parseSharedText(text);
      if (!parsed.amount) continue;
      withAmount++;

      // Bank emails rarely name the merchant in a parseable way; the sender is
      // a far better label than nothing ("HDFC Bank Alerts").
      if (!parsed.merchant) parsed.merchant = senderName(header(msg, 'From'));

      if (enqueueDetected('gmail', parsed, text)) added++;
    } catch {
      // Skip an individual message that fails to fetch/parse.
    }
  }

  writeSeen(seen);
  return { scanned: ids.length, alreadySeen: ids.length - fresh.length, withAmount, added };
}
