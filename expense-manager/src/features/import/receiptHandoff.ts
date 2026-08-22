/**
 * One-shot handoff of a scanned receipt image from the scan screen to the Add
 * Transaction form.
 *
 * A File cannot survive a URL and is far too large for router state or session
 * storage, so it is parked in module scope for the single navigation hop that
 * follows a scan. Taking it clears it, so a later visit to /add never silently
 * attaches a stale image.
 */
let pending: File | null = null;

export function stashScannedReceipt(file: File | null): void {
  pending = file;
}

/** Retrieve and clear the pending scanned receipt. */
export function takeScannedReceipt(): File | null {
  const file = pending;
  pending = null;
  return file;
}

export function clearScannedReceipt(): void {
  pending = null;
}
