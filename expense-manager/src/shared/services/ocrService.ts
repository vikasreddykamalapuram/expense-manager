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

// A phone camera photo is 12 MP or more. Handed to Tesseract as-is it decodes to
// a ~48 MB RGBA bitmap and Leptonica then allocates several working copies
// (grayscale, thresholded, binarised) inside the WASM heap — 150–250 MB in
// total. On a mid-range phone that either grinds for minutes or exhausts the
// renderer and kills the tab. Receipts OCR reliably at ~2000 px on the long
// edge, which cuts the bitmap ~6x. receiptService already downscales before
// *storing* an image; not doing it before the far more expensive OCR was an
// oversight.
const OCR_MAX_EDGE = 2000;
const OCR_JPEG_QUALITY = 0.92; // high: JPEG artefacts hurt character recognition

async function decodeBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    // Preferred: the decoded pixels can be released deterministically via
    // close() instead of waiting for the GC to notice a detached <img>.
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to decode image')); };
    img.src = url;
  });
}

/** Shrink an oversized photo so OCR runs in bounded memory. */
async function downscaleForOcr(image: File | Blob): Promise<File | Blob> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decodeBitmap(image);
  } catch {
    // Undecodable by the browser (HEIC on Android is the common case).
    // Tesseract could not have read it either, so fail with something the
    // user can act on rather than passing a dud through.
    throw new Error('This image format could not be read on this device. Try saving the photo as JPEG or PNG.');
  }

  const width = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const height = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(width, height));

  if (scale === 1) {
    if ('close' in source) source.close();
    return image;
  }

  try {
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return image;
    ctx.drawImage(source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', OCR_JPEG_QUALITY),
    );
    // Release the full-size canvas backing store straight away.
    canvas.width = 0;
    canvas.height = 0;
    return blob ?? image;
  } finally {
    if ('close' in source) source.close();
  }
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
  onProgress?.({ stage: 'loading', progress: 0 });
  // Downscale BEFORE the worker is even created: on a low-memory device the
  // decode and the WASM heap must not be alive at full size simultaneously.
  const prepared = typeof image === 'string' ? image : await downscaleForOcr(image);
  const worker = await getWorker(onProgress);
  onProgress?.({ stage: 'recognizing', progress: 0 });
  const { data } = await worker.recognize(prepared);
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
