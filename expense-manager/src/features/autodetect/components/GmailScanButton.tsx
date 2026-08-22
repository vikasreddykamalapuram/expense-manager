import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Mail, Loader2 } from 'lucide-react';
import { isGoogleConfigured } from '../../../shared/config/auth';
import { scanGmail, GMAIL_READONLY_SCOPE, type GmailScanResult } from '../gmailScan';

/**
 * Say precisely what happened. "Nothing found" is useless feedback when the
 * real reason could be no matching mail, all mail already scanned, or mail that
 * matched but had no readable amount.
 */
function describeScan(res: GmailScanResult): string {
  if (res.added > 0) {
    return `Added ${res.added} transaction${res.added === 1 ? '' : 's'} to review.`;
  }
  if (res.scanned === 0) {
    return 'No transaction emails found in the last 30 days.';
  }
  if (res.alreadySeen === res.scanned) {
    return `All ${res.scanned} matching emails were scanned already — nothing new.`;
  }
  if (res.withAmount === 0) {
    return `Checked ${res.scanned - res.alreadySeen} email${res.scanned - res.alreadySeen === 1 ? '' : 's'}, but none had a readable amount.`;
  }
  return `Found ${res.withAmount} amount${res.withAmount === 1 ? '' : 's'}, all already in your review queue.`;
}

interface GmailScanButtonProps {
  className?: string;
  onScanned?: (added: number) => void;
}

/**
 * On-demand Gmail scan. Requests the read-only Gmail scope *incrementally*
 * (only when the user taps it — never at login), fetches recent transaction
 * emails, and adds detected candidates to the review queue.
 */
export function GmailScanButton({ className, onScanned }: GmailScanButtonProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const login = useGoogleLogin({
    scope: GMAIL_READONLY_SCOPE,
    onSuccess: async (token) => {
      try {
        const res = await scanGmail(token.access_token);
        setStatus(describeScan(res));
        onScanned?.(res.added);
      } catch (err) {
        // Distinguish "Google said no" from "the request never left the app",
        // because the fixes are completely different.
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('403')) {
          setStatus('Gmail access was refused. Re-grant permission and try again.');
        } else if (msg.includes('401')) {
          setStatus('Gmail sign-in expired. Tap to scan again.');
        } else if (msg.startsWith('Gmail API')) {
          setStatus(`Gmail returned an error (${msg.replace('Gmail API ', '')}). Try again shortly.`);
        } else {
          setStatus('Could not reach Gmail. Check your connection and try again.');
        }
      } finally {
        setBusy(false);
      }
    },
    onError: () => {
      setBusy(false);
      setStatus('Gmail access was not granted.');
    },
  });

  if (!isGoogleConfigured()) return null;

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setStatus(null);
          login();
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
        {busy ? 'Scanning Gmail…' : 'Scan Gmail'}
      </button>
      {status && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{status}</p>}
    </div>
  );
}
