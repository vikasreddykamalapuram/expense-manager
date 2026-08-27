/**
 * On-device speech recognition inside the Android shell.
 *
 * The Web Speech API cannot be used here. Chromium binds the
 * `SpeechRecognition.available()` / `.install()` probes — the only way to prove
 * a request is served locally — in ChromeContentBrowserClient, which
 * android_webview does not compile. WebView nonetheless still ships
 * AwSpeechRecognitionManagerDelegate, so the legacy **cloud** recogniser is live
 * and would happily answer. It would look like it worked while uploading audio.
 *
 * So in the native shell we bypass the web API entirely and talk to
 * SpeechBridgePlugin, which uses `createOnDeviceSpeechRecognizer` — an engine
 * that cannot reach the network at all.
 *
 * Type-only imports from ./speechEngine keep this module free of any runtime
 * dependency on it, so the delegation in speechEngine.ts is not a cycle.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativePlatform, isAndroid } from './platform';
import { describeVoiceError, type VoiceError } from './voiceErrors';
import type { VoiceAvailability, VoiceSession, VoiceSessionHandlers } from './speechEngine';

interface NativeAvailability {
  status: 'ready' | 'needs-download' | 'downloading' | 'unsupported';
  reason?: string;
}

interface SpeechBridgeApi {
  isAvailable(options: { lang: string }): Promise<NativeAvailability>;
  install(options: { lang: string }): Promise<{ started: boolean }>;
  start(options: { lang: string }): Promise<{ started: boolean }>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  addListener(
    event: 'voiceStart' | 'voicePartial' | 'voiceResult' | 'voiceError' | 'voiceEnd',
    fn: (data: { text?: string; code?: string; message?: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const SpeechBridge = registerPlugin<SpeechBridgeApi>('SpeechBridge', {
  // The web build never calls these (shouldUseNativeSpeech() is false there),
  // but a stub keeps registerPlugin from throwing if one slips through.
  web: {
    isAvailable: async () => ({ status: 'unsupported', reason: 'no-local-api' }),
    install: async () => ({ started: false }),
    start: async () => ({ started: false }),
    stop: async () => {},
    cancel: async () => {},
    addListener: async () => ({ remove: async () => {} }) as PluginListenerHandle,
  },
});

/**
 * Only Android has an on-device engine we can prove. iOS `SFSpeechRecognizer`
 * has `requiresOnDeviceRecognition`, but that path is not built yet, so we fall
 * through to the web engine rather than pretend.
 */
export function shouldUseNativeSpeech(): boolean {
  return isNativePlatform() && isAndroid();
}

/** Safety net in case the plugin never reports an end event. */
const NATIVE_SESSION_TIMEOUT_MS = 20_000;

export async function probeNativeVoice(lang: string): Promise<VoiceAvailability> {
  try {
    const res = await SpeechBridge.isAvailable({ lang });
    switch (res.status) {
      case 'ready':
        return { status: 'ready' };
      case 'needs-download':
        return { status: 'needs-download' };
      case 'downloading':
        return { status: 'downloading' };
      default:
        return {
          status: 'unsupported',
          reason: res.reason === 'no-local-api' ? 'no-local-api' : 'no-local-model',
        };
    }
  } catch {
    // A missing plugin or a throwing probe tells us nothing reassuring.
    return { status: 'unsupported', reason: 'no-local-api' };
  }
}

export async function installNativeVoice(lang: string): Promise<boolean> {
  try {
    const { started } = await SpeechBridge.install({ lang });
    return started;
  } catch {
    return false;
  }
}

export function startNativeVoiceSession(lang: string, handlers: VoiceSessionHandlers): VoiceSession {
  let finished = false;
  let cancelled = false;
  let finalText = '';
  let pendingError: VoiceError | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const handles: PluginListenerHandle[] = [];

  const clearTimer = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  const removeListeners = () => {
    for (const h of handles) { void h.remove().catch(() => { /* already gone */ }); }
    handles.length = 0;
  };

  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    clearTimer();
    removeListeners();
    fn();
    handlers.onEnd?.();
  };

  const armTimer = () => {
    clearTimer();
    timer = setTimeout(() => {
      void SpeechBridge.cancel().catch(() => { /* ignore */ });
      finish(() =>
        handlers.onError({ code: 'no-speech', message: 'I did not hear anything. Tap the mic and try again.' }),
      );
    }, NATIVE_SESSION_TIMEOUT_MS);
  };

  void (async () => {
    try {
      // Listeners must be attached before start() so no early event is missed.
      handles.push(
        await SpeechBridge.addListener('voiceStart', () => armTimer()),
        await SpeechBridge.addListener('voicePartial', ({ text }) => {
          if (finished || !text) return;
          armTimer();
          handlers.onPartial?.(text);
        }),
        await SpeechBridge.addListener('voiceResult', ({ text }) => {
          finalText = text ?? '';
        }),
        await SpeechBridge.addListener('voiceError', ({ code, message }) => {
          if (cancelled) return;
          pendingError = describeVoiceError(code ?? 'unknown', message);
        }),
        // The plugin always emits voiceEnd last, for either outcome, so the
        // decision of what the user sees happens in exactly one place.
        await SpeechBridge.addListener('voiceEnd', () => {
          if (cancelled) { finish(() => { /* discarded on purpose */ }); return; }
          const text = finalText.trim();
          if (text) { finish(() => handlers.onResult(text)); return; }
          const err = pendingError ?? {
            code: 'no-speech' as const,
            message: 'I did not catch that. Tap the mic and try again.',
          };
          finish(() => handlers.onError(err));
        }),
      );

      if (finished) { removeListeners(); return; }

      armTimer();
      const { started } = await SpeechBridge.start({ lang });
      if (!started && !finished) {
        // The plugin emits voiceError/voiceEnd itself in most failure modes;
        // this covers the rest so a session can never hang silently.
        setTimeout(() => {
          if (finished) return;
          finish(() =>
            handlers.onError(
              pendingError ?? {
                code: 'start-failed',
                message: 'Could not start listening. Close any other app using the microphone and try again.',
              },
            ),
          );
        }, 250);
      }
    } catch (err) {
      finish(() =>
        handlers.onError({
          code: 'start-failed',
          detail: err instanceof Error ? err.message : String(err),
          message: 'Voice input is unavailable in this build.',
        }),
      );
    }
  })();

  return {
    stop: () => { void SpeechBridge.stop().catch(() => { /* already stopped */ }); },
    cancel: () => {
      cancelled = true;
      void SpeechBridge.cancel().catch(() => { /* already stopped */ });
      finish(() => { /* discarded on purpose */ });
    },
  };
}
