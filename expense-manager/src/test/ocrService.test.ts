import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanReceiptImage, releaseOcr } from '../shared/services/ocrService';

// Tesseract is a multi-megabyte WASM download; the worker is faked so these
// tests assert what we hand it, not what it can read.
const recognize = vi.fn(async (image: unknown) => {
  void image;
  return { data: { text: 'TOTAL 250.00' } };
});
const terminate = vi.fn(async () => undefined);

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({ recognize, terminate })),
}));

let drawImage: ReturnType<typeof vi.fn>;
let toBlobResult: Blob | null;
let closed: number;

function stubBitmap(width: number, height: number) {
  (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = vi.fn(
    async () => ({ width, height, close: () => { closed += 1; } }),
  );
}

beforeEach(async () => {
  await releaseOcr();
  recognize.mockClear();
  closed = 0;
  drawImage = vi.fn();
  toBlobResult = new Blob(['downscaled'], { type: 'image/jpeg' });

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => ({ drawImage })) as unknown as HTMLCanvasElement['getContext'],
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
    ((cb: BlobCallback) => cb(toBlobResult)) as HTMLCanvasElement['toBlob'],
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as unknown as Record<string, unknown>).createImageBitmap;
});

const file = (name = 'receipt.jpg') =>
  new File([new Uint8Array(64)], name, { type: 'image/jpeg' });

describe('scanReceiptImage — memory safety', () => {
  it('downscales a 12 MP camera photo to the OCR bound before recognising', async () => {
    stubBitmap(4000, 3000);
    const original = file();

    await scanReceiptImage(original);

    // Long edge clamped to 2000, aspect ratio preserved.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
    // The full-size original must never reach the WASM heap.
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(recognize.mock.calls[0][0]).not.toBe(original);
    expect(recognize.mock.calls[0][0]).toBe(toBlobResult);
  });

  it('scales by the longest edge on a portrait photo', async () => {
    stubBitmap(3000, 4000);
    await scanReceiptImage(file());
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1500, 2000);
  });

  it('passes an already-small image through untouched', async () => {
    stubBitmap(800, 600);
    const original = file();

    await scanReceiptImage(original);

    expect(drawImage).not.toHaveBeenCalled();
    expect(recognize.mock.calls[0][0]).toBe(original);
  });

  it('releases the decoded bitmap in both the resized and pass-through paths', async () => {
    stubBitmap(4000, 3000);
    await scanReceiptImage(file());
    expect(closed).toBe(1);

    await releaseOcr();
    recognize.mockClear();
    stubBitmap(800, 600);
    await scanReceiptImage(file());
    expect(closed).toBe(2);
  });

  it('reports an actionable error for an image the browser cannot decode', async () => {
    (globalThis as unknown as { createImageBitmap: unknown }).createImageBitmap = vi.fn(
      async () => { throw new Error('unsupported'); },
    );

    await expect(scanReceiptImage(file('bill.heic'))).rejects.toThrow(/could not be read/i);
    // Nothing should have been sent to the recogniser.
    expect(recognize).not.toHaveBeenCalled();
  });

  it('falls back to the original image if the canvas cannot produce a blob', async () => {
    stubBitmap(4000, 3000);
    toBlobResult = null;
    const original = file();

    await scanReceiptImage(original);

    expect(recognize.mock.calls[0][0]).toBe(original);
  });

  it('still parses the recognised text', async () => {
    stubBitmap(800, 600);
    const result = await scanReceiptImage(file());
    expect(result.text).toBe('TOTAL 250.00');
    expect(result.parsed).toBeDefined();
  });
});
