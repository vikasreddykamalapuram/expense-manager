import { describe, it, expect, beforeEach, vi } from 'vitest';
import { claimReloadAttempt } from '../shared/utils/lazyWithRetry';

const KEY = 'moneyiq_chunk_reload';

describe('lazyWithRetry — chunk-recovery reload bound', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('allows a recovery reload on a fresh failure', () => {
    expect(claimReloadAttempt(1_000)).toBe(true);
  });

  it('bounds consecutive reloads so a broken chunk cannot loop the tab', () => {
    expect(claimReloadAttempt(1_000)).toBe(true);
    expect(claimReloadAttempt(2_000)).toBe(true);
    // Third attempt inside the window must be refused — this is what stops the
    // renderer being reload-thrashed to death.
    expect(claimReloadAttempt(3_000)).toBe(false);
    expect(claimReloadAttempt(4_000)).toBe(false);
  });

  it('is NOT reset by an unrelated successful chunk load', () => {
    // The previous implementation cleared the guard on every successful
    // import, so one working chunk re-armed the reload for a broken one.
    // Nothing outside this module may reset the counter.
    expect(claimReloadAttempt(1_000)).toBe(true);
    expect(claimReloadAttempt(1_500)).toBe(true);
    expect(claimReloadAttempt(2_000)).toBe(false);
  });

  it('recovers after the window passes, so a later deploy can self-heal', () => {
    expect(claimReloadAttempt(1_000)).toBe(true);
    expect(claimReloadAttempt(2_000)).toBe(true);
    expect(claimReloadAttempt(3_000)).toBe(false);

    // A genuinely new incident, minutes later.
    expect(claimReloadAttempt(3_000 + 61_000)).toBe(true);
  });

  it('treats corrupt stored state as a fresh incident', () => {
    window.sessionStorage.setItem(KEY, 'not json');
    expect(claimReloadAttempt(1_000)).toBe(true);

    window.sessionStorage.setItem(KEY, JSON.stringify({ nope: true }));
    expect(claimReloadAttempt(2_000)).toBe(true);
  });

  it('refuses to reload when sessionStorage cannot record the attempt', () => {
    // Storage is a Proxy in jsdom, so assigning `sessionStorage.setItem`
    // would write a *key* rather than replace the method. Patch the prototype.
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    try {
      // Without a counter we cannot prove we are not looping, so refuse.
      expect(claimReloadAttempt(1_000)).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
