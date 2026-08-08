import { parseSharedText } from '../../shared/services/shareParser';
import { enqueueDetected } from './detection';

export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export interface GmailScanResult {
  scanned: number;
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

interface GmailMessage {
  id: string;
  snippet?: string;
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * Scan the signed-in user's Gmail for recent transaction emails and add any
 * detected candidates to the on-device review queue. Read-only: uses only the
 * message snippet (never stores or forwards the email body). Nothing is saved
 * as a transaction until the user confirms it in the queue.
 */
export async function scanGmail(accessToken: string, maxResults = 25): Promise<GmailScanResult> {
  const q = encodeURIComponent(GMAIL_QUERY);
  const list = await gmailFetch<GmailListResponse>(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${q}`,
    accessToken
  );
  const ids = (list.messages || []).map((m) => m.id);
  let added = 0;

  for (const id of ids) {
    try {
      const msg = await gmailFetch<GmailMessage>(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
        accessToken
      );
      const text = msg.snippet?.trim();
      if (!text) continue;
      const parsed = parseSharedText(text);
      if (parsed.amount && enqueueDetected('gmail', parsed, text)) added++;
    } catch {
      // Skip an individual message that fails to fetch/parse.
    }
  }

  return { scanned: ids.length, added };
}
