/**
 * Tests for the voice *plumbing* — the engine gate and the handoff mapping.
 * (Parsing itself is covered by voiceParser.test.ts.)
 *
 * The engine tests exist for one reason: to prove the app cannot fall back to a
 * cloud recogniser. That is a privacy claim MoneyIQ makes in its Play Data
 * Safety declaration, so it deserves a test rather than a comment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  probeVoiceLanguage,
  startVoiceSession,
  installVoiceLanguage,
  type SpeechRecognitionCtor,
} from '../shared/services/speechEngine';
import { buildVoiceDeepLink } from '../features/voice/voiceHandoff';
import type { ParsedVoiceTransaction } from '../shared/services/voiceParser';

// ─── Fake recogniser ────────────────────────────────────

interface FakeInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally?: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
}

let lastInstance: FakeInstance | null = null;

function makeCtor(opts: { available?: string; throwOnStart?: boolean } = {}): SpeechRecognitionCtor {
  class Fake implements FakeInstance {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    processLocally?: boolean;
    onstart: (() => void) | null = null;
    onaudiostart: (() => void) | null = null;
    onspeechend: (() => void) | null = null;
    onresult: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onend: (() => void) | null = null;

    constructor() {
      // Passing `this` as an argument rather than assigning it keeps
      // no-this-alias happy while still exposing the instance to the test.
      Fake.register(this);
    }

    static register(instance: FakeInstance) { lastInstance = instance; }

    start() { if (opts.throwOnStart) throw new Error('InvalidStateError'); }
    stop() {}
    abort() {}
  }

  const Ctor = Fake as unknown as SpeechRecognitionCtor;
  if (opts.available !== undefined) {
    (Ctor as { available?: unknown }).available = vi.fn(async () => opts.available);
    (Ctor as { install?: unknown }).install = vi.fn(async () => true);
  }
  return Ctor;
}

/** Build the shape `onresult` receives. */
function resultEvent(transcript: string, isFinal: boolean) {
  const result = { 0: { transcript, confidence: 0.9 }, isFinal, length: 1 };
  return { resultIndex: 0, results: { 0: result, length: 1 } };
}

beforeEach(() => {
  lastInstance = null;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// ─── The privacy gate ───────────────────────────────────

describe('probeVoiceLanguage — refuses anything that is not on-device', () => {
  it('reports no-api when the browser has no recogniser', async () => {
    const result = await probeVoiceLanguage('en-IN', null);
    expect(result).toEqual({ status: 'unsupported', reason: 'no-api' });
  });

  it('refuses a legacy recogniser that has no available() probe (cloud-only)', async () => {
    // This is the important one: webkitSpeechRecognition exists in plenty of
    // browsers, and using it would silently ship audio to a server.
    const result = await probeVoiceLanguage('en-IN', makeCtor());
    expect(result).toEqual({ status: 'unsupported', reason: 'no-local-api' });
  });

  it('refuses when no local model exists for the language', async () => {
    const result = await probeVoiceLanguage('hi-IN', makeCtor({ available: 'unavailable' }));
    expect(result).toEqual({ status: 'unsupported', reason: 'no-local-model' });
  });

  it('asks for processLocally when probing', async () => {
    const ctor = makeCtor({ available: 'available' });
    await probeVoiceLanguage('en-IN', ctor);
    expect(ctor.available).toHaveBeenCalledWith({ langs: ['en-IN'], processLocally: true });
  });

  it('maps downloadable and downloading to their own states', async () => {
    expect(await probeVoiceLanguage('en-IN', makeCtor({ available: 'downloadable' })))
      .toEqual({ status: 'needs-download' });
    expect(await probeVoiceLanguage('en-IN', makeCtor({ available: 'downloading' })))
      .toEqual({ status: 'downloading' });
  });

  it('treats a throwing probe as unsupported rather than assuming the best', async () => {
    const ctor = makeCtor({ available: 'available' });
    (ctor as { available: unknown }).available = vi.fn(async () => { throw new Error('boom'); });
    expect(await probeVoiceLanguage('en-IN', ctor)).toEqual({ status: 'unsupported', reason: 'no-local-model' });
  });

  it('does not attempt an install on a recogniser without install()', async () => {
    expect(await installVoiceLanguage('en-IN', makeCtor())).toBe(false);
  });
});

// ─── Sessions ───────────────────────────────────────────

describe('startVoiceSession', () => {
  it('sets processLocally on every session', () => {
    startVoiceSession('en-IN', { onResult: vi.fn(), onError: vi.fn() }, makeCtor({ available: 'available' }));
    expect(lastInstance?.processLocally).toBe(true);
    expect(lastInstance?.lang).toBe('en-IN');
  });

  it('returns the final transcript once', () => {
    const onResult = vi.fn();
    startVoiceSession('en-IN', { onResult, onError: vi.fn() }, makeCtor({ available: 'available' }));
    lastInstance?.onresult?.(resultEvent('spent 500 on groceries', true));
    lastInstance?.onend?.();
    expect(onResult).toHaveBeenCalledWith('spent 500 on groceries');
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it('streams interim text without treating it as the answer', () => {
    const onPartial = vi.fn();
    const onResult = vi.fn();
    startVoiceSession('en-IN', { onPartial, onResult, onError: vi.fn() }, makeCtor({ available: 'available' }));
    lastInstance?.onresult?.(resultEvent('spent 5', false));
    expect(onPartial).toHaveBeenCalledWith('spent 5');
    expect(onResult).not.toHaveBeenCalled();
  });

  it('reports an empty result as no-speech instead of parsing nothing', () => {
    const onError = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError }, makeCtor({ available: 'available' }));
    lastInstance?.onend?.();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-speech' }));
  });

  it('surfaces a network error as went-remote, because it should be impossible', () => {
    const onError = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError }, makeCtor({ available: 'available' }));
    lastInstance?.onerror?.({ error: 'network' });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'went-remote' }));
  });

  it('maps a blocked microphone to a permission message', () => {
    const onError = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError }, makeCtor({ available: 'available' }));
    lastInstance?.onerror?.({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'permission-denied' }));
  });

  it('discards the transcript when cancelled', () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    const session = startVoiceSession('en-IN', { onResult, onError }, makeCtor({ available: 'available' }));
    lastInstance?.onresult?.(resultEvent('spent 500', true));
    session.cancel();
    lastInstance?.onend?.();
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('gives up after a silence timeout rather than listening forever', () => {
    const onError = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError }, makeCtor({ available: 'available' }));
    vi.advanceTimersByTime(13_000);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-speech' }));
  });

  it('reports a start() that throws instead of appearing to listen', () => {
    const onError = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError }, makeCtor({ available: 'available', throwOnStart: true }));
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'start-failed' }));
  });

  it('fires onEnd exactly once per session', () => {
    const onEnd = vi.fn();
    startVoiceSession('en-IN', { onResult: vi.fn(), onError: vi.fn(), onEnd }, makeCtor({ available: 'available' }));
    lastInstance?.onresult?.(resultEvent('spent 500', true));
    lastInstance?.onend?.();
    lastInstance?.onend?.();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

// ─── Handoff ────────────────────────────────────────────

function parsed(over: Partial<ParsedVoiceTransaction> = {}): ParsedVoiceTransaction {
  return { transcript: 't', type: 'expense', ambiguities: [], ...over };
}

describe('buildVoiceDeepLink', () => {
  it('carries every resolved field to /add', () => {
    const link = buildVoiceDeepLink(parsed({
      amount: 450,
      notes: 'Big Bazaar',
      date: '2026-08-26',
      paymentMethod: 'upi',
      categoryId: 'food-groceries',
      accountId: 'acc-1',
    }));
    const params = new URLSearchParams(link.split('?')[1]);
    expect(link.startsWith('/add?')).toBe(true);
    expect(params.get('type')).toBe('expense');
    expect(params.get('amount')).toBe('450');
    expect(params.get('note')).toBe('Big Bazaar');
    expect(params.get('date')).toBe('2026-08-26');
    expect(params.get('method')).toBe('upi');
    expect(params.get('category')).toBe('food-groceries');
    expect(params.get('account')).toBe('acc-1');
  });

  it('omits fields that were not understood, so the form keeps its own defaults', () => {
    const params = new URLSearchParams(buildVoiceDeepLink(parsed()).split('?')[1]);
    expect(params.has('amount')).toBe(false);
    expect(params.has('category')).toBe(false);
    expect(params.has('date')).toBe(false);
    expect(params.get('type')).toBe('expense');
  });

  it('keeps both sides of a transfer', () => {
    const params = new URLSearchParams(
      buildVoiceDeepLink(parsed({ type: 'transfer', accountId: 'a', toAccountId: 'b' })).split('?')[1],
    );
    expect(params.get('account')).toBe('a');
    expect(params.get('toAccount')).toBe('b');
  });

  it('escapes notes so a spoken "&" cannot inject a parameter', () => {
    const link = buildVoiceDeepLink(parsed({ notes: 'chai & samosa', amount: 40 }));
    expect(link).not.toContain('chai & samosa');
    expect(new URLSearchParams(link.split('?')[1]).get('note')).toBe('chai & samosa');
  });
});
