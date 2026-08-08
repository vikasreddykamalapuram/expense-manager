import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Mail, Loader2 } from 'lucide-react';
import { isGoogleConfigured } from '../../../shared/config/auth';
import { scanGmail, GMAIL_READONLY_SCOPE } from '../gmailScan';

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
        setStatus(
          res.added > 0
            ? `Added ${res.added} transaction${res.added === 1 ? '' : 's'} to review.`
            : `Scanned ${res.scanned} email${res.scanned === 1 ? '' : 's'} — nothing new found.`
        );
        onScanned?.(res.added);
      } catch {
        setStatus('Could not scan Gmail. Please try again.');
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
