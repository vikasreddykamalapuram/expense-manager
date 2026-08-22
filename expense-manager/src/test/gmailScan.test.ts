import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { scanGmail, resetGmailSeen } from '../features/autodetect/gmailScan';
import { getDetectedQueue, clearDetected } from '../features/autodetect/detection';

/**
 * The Gmail scan previously fetched the Subject header and then parsed only the
 * snippet — throwing away the one field that most reliably carries the amount.
 * It also had no memory, so a second scan re-queued everything.
 */

interface FakeMail {
  id: string;
  subject: string;
  snippet: string;
  from: string;
}

function mockGmail(mails: FakeMail[]) {
  return vi.fn(async (url: string) => {
    if (url.includes('/messages?')) {
      return {
        ok: true,
        json: async () => ({ messages: mails.map((m) => ({ id: m.id, threadId: m.id })) }),
      } as unknown as Response;
    }
    const id = url.match(/messages\/([^?]+)/)?.[1];
    const mail = mails.find((m) => m.id === id);
    if (!mail) return { ok: false, status: 404 } as unknown as Response;
    return {
      ok: true,
      json: async () => ({
        id: mail.id,
        snippet: mail.snippet,
        payload: {
          headers: [
            { name: 'Subject', value: mail.subject },
            { name: 'From', value: mail.from },
          ],
        },
      }),
    } as unknown as Response;
  });
}

const AMOUNT_IN_SUBJECT: FakeMail = {
  id: 'm1',
  subject: 'Debit alert: Rs.1,250.00 spent on your HDFC Bank Card',
  snippet: 'Dear Customer, thank you for banking with us. View this email in your browser.',
  from: 'HDFC Bank Alerts <alerts@hdfcbank.net>',
};

const NO_AMOUNT: FakeMail = {
  id: 'm2',
  subject: 'Your monthly statement is ready',
  snippet: 'Log in to view your account statement.',
  from: 'ICICI Bank <statements@icicibank.com>',
};

describe('scanGmail', () => {
  beforeEach(() => {
    localStorage.clear();
    clearDetected();
    resetGmailSeen();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the amount from the subject when the snippet has none', async () => {
    vi.stubGlobal('fetch', mockGmail([AMOUNT_IN_SUBJECT]));

    const res = await scanGmail('token');

    expect(res.added).toBe(1);
    expect(res.withAmount).toBe(1);
    const [candidate] = getDetectedQueue();
    expect(candidate.amount).toBe(1250);
    expect(candidate.source).toBe('gmail');
  });

  it('falls back to the sender name when no merchant is parseable', async () => {
    vi.stubGlobal('fetch', mockGmail([AMOUNT_IN_SUBJECT]));

    await scanGmail('token');

    expect(getDetectedQueue()[0].merchant).toBe('HDFC Bank Alerts');
  });

  it('does not re-queue the same email on a second scan', async () => {
    vi.stubGlobal('fetch', mockGmail([AMOUNT_IN_SUBJECT]));

    const first = await scanGmail('token');
    const second = await scanGmail('token');

    expect(first.added).toBe(1);
    expect(second.added).toBe(0);
    expect(second.alreadySeen).toBe(1);
    expect(getDetectedQueue()).toHaveLength(1);
  });

  it('reports emails that matched but carried no amount', async () => {
    vi.stubGlobal('fetch', mockGmail([NO_AMOUNT]));

    const res = await scanGmail('token');

    expect(res.scanned).toBe(1);
    expect(res.withAmount).toBe(0);
    expect(res.added).toBe(0);
    expect(getDetectedQueue()).toHaveLength(0);
  });

  it('surfaces an API failure instead of reporting an empty scan', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403 }) as unknown as Response),
    );

    await expect(scanGmail('token')).rejects.toThrow('Gmail API 403');
  });

  it('targets the gmail.googleapis.com host', async () => {
    const fetchMock = mockGmail([AMOUNT_IN_SUBJECT]);
    vi.stubGlobal('fetch', fetchMock);

    await scanGmail('token');

    expect(fetchMock.mock.calls[0][0]).toContain('https://gmail.googleapis.com');
  });
});
