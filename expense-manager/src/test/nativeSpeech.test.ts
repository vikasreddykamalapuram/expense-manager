import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The native engine exists to keep a promise: MoneyIQ's Play Data Safety
 * declaration says speech is processed on the device. These tests pin the
 * behaviour that protects that promise — above all, that anything we cannot
 * *prove* is local is reported as unsupported rather than quietly allowed.
 */

type Listener = (data: { text?: string; code?: string; message?: string }) => void;

const h = vi.hoisted(() => {
  const listeners = new Map<string, Listener[]>();
  const plugin = {
    isAvailable: vi.fn(async (_o: { lang: string }) => ({ status: 'ready' } as { status: string; reason?: string })),
    install: vi.fn(async (_o: { lang: string }) => ({ started: true })),
    start: vi.fn(async (_o: { lang: string }) => ({ started: true })),
    stop: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    addListener: vi.fn(async (event: string, fn: Listener) => {
      const arr = listeners.get(event) ?? [];
      arr.push(fn);
      listeners.set(event, arr);
      return { remove: async () => { listeners.set(event, (listeners.get(event) ?? []).filter((f) => f !== fn)); } };
    }),
  };
  return {
    plugin,
    listeners,
    emit(event: string, data: Record<string, unknown> = {}) {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(data);
    },
    reset() {
      listeners.clear();
      Object.values(plugin).forEach((f) => f.mockClear?.());
      plugin.isAvailable.mockResolvedValue({ status: 'ready' });
      plugin.start.mockResolvedValue({ started: true });
    },
    native: { value: true },
  };
});

vi.mock('@capacitor/core', () => ({ registerPlugin: () => h.plugin }));
vi.mock('../shared/services/platform', () => ({
  isNativePlatform: () => h.native.value,
  isAndroid: () => h.native.value,
  getPlatform: () => (h.native.value ? 'android' : 'web'),
}));

import {
  shouldUseNativeSpeech,
  probeNativeVoice,
  installNativeVoice,
  startNativeVoiceSession,
} from '../shared/services/nativeSpeech';

/** Let the session's async listener registration settle before emitting. */
async function settled() {
  await vi.waitFor(() => expect(h.plugin.start).toHaveBeenCalled());
}

beforeEach(() => { h.reset(); h.native.value = true; });
afterEach(() => { vi.useRealTimers(); });

describe('engine selection', () => {
  it('uses the native engine in the Android shell', () => {
    expect(shouldUseNativeSpeech()).toBe(true);
  });

  it('leaves the web build on the web engine', () => {
    h.native.value = false;
    expect(shouldUseNativeSpeech()).toBe(false);
  });
});

describe('probeNativeVoice', () => {
  it('reports ready when a local model is installed', async () => {
    h.plugin.isAvailable.mockResolvedValue({ status: 'ready' });
    expect(await probeNativeVoice('en-IN')).toEqual({ status: 'ready' });
  });

  it('distinguishes a downloadable model from a missing engine', async () => {
    h.plugin.isAvailable.mockResolvedValue({ status: 'needs-download' });
    expect(await probeNativeVoice('hi-IN')).toEqual({ status: 'needs-download' });
  });

  it('preserves the no-local-api reason so the UI can explain itself', async () => {
    h.plugin.isAvailable.mockResolvedValue({ status: 'unsupported', reason: 'no-local-api' });
    expect(await probeNativeVoice('en-IN')).toEqual({ status: 'unsupported', reason: 'no-local-api' });
  });

  // The compliance-critical case: a probe we cannot trust must never be
  // treated as permission to listen.
  it('fails closed when the plugin is missing or throws', async () => {
    h.plugin.isAvailable.mockRejectedValue(new Error('plugin not implemented'));
    expect(await probeNativeVoice('en-IN')).toEqual({ status: 'unsupported', reason: 'no-local-api' });
  });
});

describe('installNativeVoice', () => {
  it('reports whether the download actually started', async () => {
    h.plugin.install.mockResolvedValue({ started: true });
    expect(await installNativeVoice('hi-IN')).toBe(true);
  });

  it('resolves false instead of throwing when unavailable', async () => {
    h.plugin.install.mockRejectedValue(new Error('nope'));
    expect(await installNativeVoice('hi-IN')).toBe(false);
  });
});

describe('startNativeVoiceSession', () => {
  it('streams partials and resolves the final transcript', async () => {
    const onPartial = vi.fn();
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    startNativeVoiceSession('en-IN', { onPartial, onResult, onError, onEnd });
    await settled();

    h.emit('voiceStart');
    h.emit('voicePartial', { text: 'spent 450' });
    h.emit('voiceResult', { text: 'spent 450 on groceries' });
    h.emit('voiceEnd');

    expect(onPartial).toHaveBeenCalledWith('spent 450');
    expect(onResult).toHaveBeenCalledWith('spent 450 on groceries');
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('maps a native error onto the shared user-facing message', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();

    startNativeVoiceSession('en-IN', { onResult, onError });
    await settled();

    h.emit('voiceError', { code: 'not-allowed' });
    h.emit('voiceEnd');

    expect(onResult).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].code).toBe('permission-denied');
  });

  /**
   * `network` should be unreachable on an on-device recogniser. If it ever
   * arrives it means audio left the device, so it must surface loudly rather
   * than be retried or ignored.
   */
  it('surfaces a network error as went-remote', async () => {
    const onError = vi.fn();
    startNativeVoiceSession('en-IN', { onResult: vi.fn(), onError });
    await settled();

    h.emit('voiceError', { code: 'network' });
    h.emit('voiceEnd');

    expect(onError.mock.calls[0][0].code).toBe('went-remote');
  });

  it('reports no-speech when the transcript is empty', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    startNativeVoiceSession('en-IN', { onResult, onError });
    await settled();

    h.emit('voiceResult', { text: '   ' });
    h.emit('voiceEnd');

    expect(onResult).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0].code).toBe('no-speech');
  });

  it('discards the transcript when the session is cancelled', async () => {
    const onResult = vi.fn();
    const onError = vi.fn();
    const onEnd = vi.fn();

    const session = startNativeVoiceSession('en-IN', { onResult, onError, onEnd });
    await settled();

    session.cancel();
    h.emit('voiceResult', { text: 'should be thrown away' });
    h.emit('voiceEnd');

    expect(h.plugin.cancel).toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('only ever finishes once', async () => {
    const onResult = vi.fn();
    const onEnd = vi.fn();
    startNativeVoiceSession('en-IN', { onResult, onError: vi.fn(), onEnd });
    await settled();

    h.emit('voiceResult', { text: 'first' });
    h.emit('voiceEnd');
    h.emit('voiceEnd');
    h.emit('voiceEnd');

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stop() keeps the transcript rather than discarding it', async () => {
    const onResult = vi.fn();
    const session = startNativeVoiceSession('en-IN', { onResult, onError: vi.fn() });
    await settled();

    session.stop();
    h.emit('voiceResult', { text: 'kept' });
    h.emit('voiceEnd');

    expect(h.plugin.stop).toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith('kept');
  });
});
