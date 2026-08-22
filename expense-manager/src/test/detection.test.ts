import { describe, it, expect, beforeEach } from 'vitest';
import {
  enqueueDetected,
  getDetectedQueue,
  dismissDetected,
  clearDetected,
} from '../features/autodetect/detection';
import { parseSharedText } from '../shared/services/shareParser';

const BANK_SMS =
  'HDFC Bank: Rs.1,250.00 debited from a/c XX4521 on 12-05-26 to SWIGGY. UPI Ref 123456789.';

describe('detected transaction queue', () => {
  beforeEach(() => {
    clearDetected();
  });

  it('rejects text with no parseable amount', () => {
    const parsed = parseSharedText('Your OTP is 4821. Do not share it with anyone.');
    expect(enqueueDetected('notification', parsed, 'otp')).toBeNull();
    expect(getDetectedQueue()).toHaveLength(0);
  });

  it('enqueues a bank alert with the parsed details', () => {
    const parsed = parseSharedText(BANK_SMS);
    const candidate = enqueueDetected('notification', parsed, BANK_SMS);

    expect(candidate).not.toBeNull();
    expect(candidate?.amount).toBe(1250);
    expect(candidate?.type).toBe('expense');
    expect(candidate?.source).toBe('notification');
    expect(getDetectedQueue()).toHaveLength(1);
  });

  // nativeShell relies on this: a de-duped repeat returns a *truthy* existing
  // candidate, so callers must compare queue length rather than trusting the
  // return value before navigating the user to the review screen.
  it('returns the existing candidate for a repeat without growing the queue', () => {
    const parsed = parseSharedText(BANK_SMS);
    const first = enqueueDetected('notification', parsed, BANK_SMS);
    const second = enqueueDetected('notification', parsed, BANK_SMS);

    expect(second).not.toBeNull();
    expect(second?.id).toBe(first?.id);
    expect(getDetectedQueue()).toHaveLength(1);
  });

  it('treats a different amount as a separate candidate', () => {
    enqueueDetected('notification', parseSharedText(BANK_SMS), BANK_SMS);
    const other = 'HDFC Bank: Rs.480.00 debited from a/c XX4521 to UBER.';
    enqueueDetected('notification', parseSharedText(other), other);

    expect(getDetectedQueue()).toHaveLength(2);
  });

  it('dismisses a single candidate without touching the rest', () => {
    const a = enqueueDetected('notification', parseSharedText(BANK_SMS), BANK_SMS);
    const other = 'ICICI Bank: Rs.99.00 debited from a/c XX1122 to NETFLIX.';
    enqueueDetected('notification', parseSharedText(other), other);

    dismissDetected(a!.id);
    const queue = getDetectedQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].amount).toBe(99);
  });
});
