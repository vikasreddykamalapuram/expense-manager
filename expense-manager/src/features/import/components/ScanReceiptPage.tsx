import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Image as ImageIcon,
  Loader2,
  ScanLine,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import type { PaymentMethod } from '../../../shared/types';
import type { ParsedReceipt } from '../../../shared/services/receiptScan';
import { scanReceiptImage, releaseOcr, type OcrProgress } from '../../../shared/services/ocrService';
import { receiptService } from '../../../shared/services/receiptService';
import { stashScannedReceipt } from '../receiptHandoff';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  upi: 'UPI',
  cash: 'Cash',
  card: 'Card',
  net_banking: 'Net banking',
  cheque: 'Cheque',
  auto_debit: 'Auto debit',
  other: 'Other',
};

const CONFIDENCE_COPY: Record<ParsedReceipt['confidence'], { label: string; hint: string; tone: string }> = {
  high: {
    label: 'Good read',
    hint: 'Found a labelled total on the receipt.',
    tone: 'bg-success-100 text-success-700',
  },
  medium: {
    label: 'Check the total',
    hint: 'No total was labelled, so the largest amount was used. Please confirm it.',
    tone: 'bg-amber-100 text-amber-700',
  },
  low: {
    label: 'Could not read an amount',
    hint: 'Try a sharper, straighter photo with the whole bill in frame.',
    tone: 'bg-danger-100 text-danger-700',
  },
};

export function ScanReceiptPage() {
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [parsed, setParsed] = useState<ParsedReceipt | null>(null);
  const [rawText, setRawText] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The OCR worker holds a WASM heap; free it when the user leaves the screen.
  useEffect(() => () => { void releaseOcr(); }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const reset = () => {
    setFile(null);
    setParsed(null);
    setRawText('');
    setError(null);
    setProgress(null);
    setShowRaw(false);
  };

  const handleFile = async (picked: File) => {
    const invalid = receiptService.validateFile(picked);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setParsed(null);
    setFile(picked);
    setProgress({ stage: 'loading', progress: 0 });
    try {
      const result = await scanReceiptImage(picked, setProgress);
      setRawText(result.text);
      setParsed(result.parsed);
    } catch {
      setError('Could not read this image. Check your connection — the text recogniser downloads once on first use.');
    } finally {
      setProgress(null);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) void handleFile(picked);
    e.target.value = '';
  };

  /** Hand the parsed fields and the image to the Add Transaction form. */
  const useDetails = () => {
    if (!parsed) return;
    stashScannedReceipt(file);
    const params = new URLSearchParams({ type: 'expense' });
    if (parsed.amount) params.set('amount', String(parsed.amount));
    if (parsed.merchant) params.set('note', parsed.merchant);
    if (parsed.date) params.set('date', parsed.date);
    if (parsed.paymentMethod) params.set('method', parsed.paymentMethod);
    navigate(`/add?${params.toString()}`);
  };

  const busy = progress !== null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <ScanLine size={22} className="text-primary-600" /> Scan a receipt
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Photograph a bill and MoneyIQ will fill in the transaction for you.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/10 p-3 text-xs text-gray-600 dark:text-gray-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" />
        <span>
          <strong>Private by design.</strong> Your receipt is read on this device and the image is never
          uploaded. Only the text-recognition model itself is downloaded, once. Nothing is saved until you
          confirm the details.
        </span>
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} />
      <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={onInputChange} />

      {!file && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-600 px-4 py-8 text-sm font-medium text-primary-600 dark:text-primary-400 transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
          >
            <Camera size={22} /> Take photo
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-8 text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:border-primary-400 hover:text-primary-600"
          >
            <ImageIcon size={22} /> Choose image
          </button>
        </div>
      )}

      {previewUrl && (
        <div className="flex gap-4">
          <img src={previewUrl} alt="Receipt preview" className="h-32 w-24 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 object-cover" />
          <div className="min-w-0 flex-1 space-y-2">
            {busy ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Loader2 size={16} className="animate-spin text-primary-500" />
                {progress?.stage === 'loading' ? 'Preparing the text recogniser…' : `Reading receipt… ${Math.round((progress?.progress ?? 0) * 100)}%`}
              </div>
            ) : (
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline">
                <RotateCcw size={14} /> Scan a different receipt
              </button>
            )}
            {progress?.stage === 'loading' && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                First scan downloads the recogniser (~5 MB). Later scans are instant.
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-danger-50 dark:bg-danger-900/20 p-3 text-sm text-danger-700 dark:text-danger-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {parsed && !busy && (
        <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">What we found</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONFIDENCE_COPY[parsed.confidence].tone}`}>
              {CONFIDENCE_COPY[parsed.confidence].label}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{CONFIDENCE_COPY[parsed.confidence].hint}</p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Field label="Amount" value={parsed.amount !== undefined ? `₹${parsed.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined} emphasis />
            <Field label="Merchant" value={parsed.merchant} />
            <Field label="Date" value={parsed.date} />
            <Field label="Payment mode" value={parsed.paymentMethod ? PAYMENT_LABELS[parsed.paymentMethod] : undefined} />
            <Field label="Card / account" value={parsed.account ? `•••• ${parsed.account}` : undefined} />
            <Field label="Tax" value={parsed.tax !== undefined ? `₹${parsed.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : undefined} />
          </dl>

          {parsed.lineItems.length > 0 && (
            <details className="rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3">
              <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">
                {parsed.lineItems.length} item{parsed.lineItems.length === 1 ? '' : 's'} detected
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                {parsed.lineItems.map((item, i) => (
                  <li key={`${item.description}-${i}`} className="flex justify-between gap-3">
                    <span className="truncate">{item.description}</span>
                    <span className="shrink-0 tabular-nums">₹{item.amount.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={useDetails}
              disabled={parsed.amount === undefined}
              className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              Continue to add <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/add?type=expense')}
              className="text-sm font-medium text-gray-500 hover:underline dark:text-gray-400"
            >
              Enter manually instead
            </button>
          </div>

          {rawText && (
            <div>
              <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-xs font-medium text-primary-600 hover:underline">
                {showRaw ? 'Hide' : 'Show'} recognised text
              </button>
              {showRaw && (
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 dark:bg-gray-900/40 p-3 text-[11px] text-gray-600 dark:text-gray-300">
                  {rawText}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, emphasis }: { label: string; value?: string; emphasis?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</dt>
      <dd
        className={`truncate ${
          value
            ? emphasis
              ? 'text-lg font-semibold text-gray-900 dark:text-gray-100'
              : 'font-medium text-gray-700 dark:text-gray-200'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {value ?? 'Not found'}
      </dd>
    </div>
  );
}
