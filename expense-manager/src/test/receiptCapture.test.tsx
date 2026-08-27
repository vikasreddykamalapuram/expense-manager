/**
 * The receipt control on a *new* transaction.
 *
 * Regression cover for a silent storage leak: the form used to render
 * `<ReceiptCapture transactionId="pending" onReceiptSaved={() => {}}>`, so
 * picking a photo compressed it, wrote it to IndexedDB under the literal id
 * "pending", then discarded the returned id. The UI reset to "Add Receipt" as
 * though nothing had happened, the transaction saved with no receiptId, and the
 * blob stayed in the database unreachable from any transaction — one orphan per
 * attempt.
 *
 * The invariant that matters is therefore negative: in defer mode nothing may
 * reach the database. The parent holds the File and saves it once the insert
 * has produced a real id.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReceiptCapture } from '../shared/components/ReceiptCapture';

// jsdom implements neither, and the preview is built on both.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const saveReceipt = vi.fn(async (_p: string, _t: string, _f: File) => 'receipt-1');
const validateFile = vi.fn((_f: File): string | null => null);

vi.mock('../shared/services/receiptService', () => ({
  receiptService: {
    saveReceipt: (p: string, t: string, f: File) => saveReceipt(p, t, f),
    validateFile: (f: File) => validateFile(f),
    getThumbnailUrl: async () => null,
    deleteReceipt: async () => undefined,
  },
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({ state: { activeProfileId: 'profile-1' } }),
}));

const file = () => new File(['x'], 'bill.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  saveReceipt.mockClear();
  validateFile.mockClear();
  validateFile.mockReturnValue(null);
});

/** Opens the picker and chooses a photo from the gallery input. */
async function pickPhoto(container: HTMLElement) {
  await userEvent.click(screen.getByRole('button', { name: /add receipt/i }));
  const inputs = container.querySelectorAll('input[type="file"]');
  // [0] is camera (capture="environment"), [1] is gallery.
  await userEvent.upload(inputs[1] as HTMLInputElement, file());
}

describe('ReceiptCapture — defer mode (new transaction)', () => {
  it('never writes to the database', async () => {
    const onFileSelected = vi.fn();
    const { container } = render(
      <ReceiptCapture deferSave onFileSelected={onFileSelected} />,
    );

    await pickPhoto(container);

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1));
    expect(saveReceipt).not.toHaveBeenCalled();
    expect(onFileSelected.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it('still rejects a file the service considers invalid', async () => {
    validateFile.mockReturnValue('File too large');
    const onFileSelected = vi.fn();
    const { container } = render(
      <ReceiptCapture deferSave onFileSelected={onFileSelected} />,
    );

    await pickPhoto(container);

    expect(await screen.findByText('File too large')).toBeInTheDocument();
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(saveReceipt).not.toHaveBeenCalled();
  });

  it('confirms the pending photo instead of resetting to "Add Receipt"', async () => {
    render(<ReceiptCapture deferSave pendingFile={file()} onFileSelected={vi.fn()} />);

    expect(await screen.findByText(/attaches when you save/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add receipt/i })).not.toBeInTheDocument();
  });

  it('clears the pending photo when removed', async () => {
    const onFileSelected = vi.fn();
    render(<ReceiptCapture deferSave pendingFile={file()} onFileSelected={onFileSelected} />);

    await userEvent.click(await screen.findByRole('button', { name: /remove/i }));

    expect(onFileSelected).toHaveBeenCalledWith(null);
    expect(saveReceipt).not.toHaveBeenCalled();
  });
});

describe('ReceiptCapture — immediate mode (editing)', () => {
  it('saves against the real transaction id', async () => {
    const onReceiptSaved = vi.fn();
    const { container } = render(
      <ReceiptCapture transactionId="tx-42" onReceiptSaved={onReceiptSaved} />,
    );

    await pickPhoto(container);

    await waitFor(() => expect(saveReceipt).toHaveBeenCalledTimes(1));
    expect(saveReceipt.mock.calls[0][1]).toBe('tx-42');
    await waitFor(() => expect(onReceiptSaved).toHaveBeenCalledWith('receipt-1'));
  });

  it('refuses to save when it has no transaction id to attach to', async () => {
    const { container } = render(<ReceiptCapture />);

    await pickPhoto(container);

    expect(await screen.findByText(/cannot attach a receipt yet/i)).toBeInTheDocument();
    expect(saveReceipt).not.toHaveBeenCalled();
  });
});
