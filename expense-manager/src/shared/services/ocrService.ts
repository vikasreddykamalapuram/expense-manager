// Receipt OCR. Tesseract.js is a ~2 MB WASM bundle plus a language model, so it
// is loaded on demand via dynamic import and never lands in the main chunk —
// the app must stay fast for the 99% of sessions that never scan a receipt.
//
// The engine and its English model are fetched from cdn.jsdelivr.net on first
// use (allow-listed in the CSP in index.html). The receipt image itself never
// leaves the device; recognition runs locally in a WASM worker.
//
// The parsing itself lives in receiptScan.ts, which is pure and unit-tested.
import type { ParsedReceipt } from './receiptScan';
import { scanReceiptText } from './receiptScan';

export type OcrStage = 'loading' | 'recognizing' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  /** 0–1. Only meaningful while recognizing. */
  progress: number;
}

export interface ReceiptScanResult {
  text: string;
  parsed: ParsedReceipt;
}

type TesseractWorker = {
  recognize: (image: unknown) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TesseractWorker> | null = null;

/**
 * Create (once) and reuse a Tesseract worker. Keeping it alive avoids paying
 * the multi-second model download again when the user scans a second receipt.
 */
async function getWorker(onProgress?: (p: OcrProgress) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    onProgress?.({ stage: 'loading', progress: 0 });
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) =>
        createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              onProgress?.({ stage: 'recognizing', progress: m.progress });
            }
          },
        }),
      )
      .then((w) => w as unknown as TesseractWorker)
      .catch((err) => {
        // Don't cache a failed load; the next attempt should retry cleanly
        // (the model is fetched over the network and that can simply fail).
        workerPromise = null;
        throw err;
      });
  }
  return workerPromise;
}

/**
 * Read a receipt image and return both the raw OCR text and the parsed
 * transaction candidate. The caller shows the result for confirmation —
 * nothing is saved here.
 *
 * @param image A File/Blob from the camera or file picker, or an image data URL.
 */
export async function scanReceiptImage(
  image: File | Blob | string,
  onProgress?: (p: OcrProgress) => void,
): Promise<ReceiptScanResult> {
  const worker = await getWorker(onProgress);
  onProgress?.({ stage: 'recognizing', progress: 0 });
  const { data } = await worker.recognize(image);
  onProgress?.({ stage: 'done', progress: 1 });
  const text = data?.text ?? '';
  return { text, parsed: scanReceiptText(text) };
}

/** Release the OCR worker and its memory. Safe to call when nothing is loaded. */
export async function releaseOcr(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Already gone or never finished loading — nothing to release.
  }
}
