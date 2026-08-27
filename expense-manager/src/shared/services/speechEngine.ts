/**
 * On-device speech recognition.
 *
 * MoneyIQ's Play Data Safety declaration states that financial parsing happens
 * on the device and that nothing raw is uploaded. Speech is the easiest place
 * to break that promise by accident, because the Web Speech API uses a *cloud*
 * recogniser by default and does so silently — the app would look identical
 * while the declaration quietly became false.
 *
 * So this module refuses to produce an engine unless the platform can guarantee
 * local processing:
 *
 *   1. `SpeechRecognition.available({ processLocally: true })` must report that
 *      a local model exists for the requested language.
 *   2. `recognition.processLocally = true` is set on every session. Per spec
 *      this is a requirement rather than a hint: "If set to `true`, speech
 *      recognition done via the SpeechRecognition object must be done locally."
 *      A platform that cannot honour it errors instead of falling back.
 *
 * If either check fails we report `unsupported` and the UI never renders a
 * microphone at all. Typing stays the complete, unrestricted path — voice is
 * only ever an accelerator.
 */

/** Values returned by the static `SpeechRecognition.available()` probe. */
type AvailabilityStatus = 'unavailable' | 'downloadable' | 'downloading' | 'available';

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Experimental; present only on engines that support local recognition. */
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechend: (() => void) | null;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
  available?(opts: { langs: string[]; processLocally?: boolean }): Promise<AvailabilityStatus>;
  install?(opts: { langs: string[]; processLocally?: boolean }): Promise<boolean>;
}

/** Why voice is not on offer. Each maps to a distinct, honest user message. */
export type VoiceUnsupportedReason =
  | 'insecure-context'
  | 'no-api'
  | 'no-local-api'
  | 'no-local-model';

export type VoiceAvailability =
  | { status: 'ready' }
  | { status: 'needs-download' }
  | { status: 'downloading' }
  | { status: 'unsupported'; reason: VoiceUnsupportedReason };

export type VoiceErrorCode =
  | 'permission-denied'
  | 'no-speech'
  | 'no-microphone'
  | 'language-unavailable'
  | 'went-remote'
  | 'aborted'
  | 'start-failed'
  | 'unknown';

export interface VoiceError {
  code: VoiceErrorCode;
  /** Ready to show to a user. */
  message: string;
  /** Raw platform code, for diagnostics. */
  detail?: string;
}

export interface VoiceLanguage {
  code: string;
  label: string;
  /** Shown while listening, in the language itself. */
  hint: string;
}

/**
 * `en-IN` is the default because Indian-English recognisers handle code-mixed
 * speech ("500 rupees kirane pe") far better than `hi-IN` does, and they emit
 * numerals rather than number words — which removes a whole class of parsing
 * risk. `hi-IN` is offered for users who speak pure Hindi.
 */
export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { code: 'en-IN', label: 'English (India)', hint: 'e.g. "spent 450 on groceries with UPI"' },
  { code: 'hi-IN', label: 'हिन्दी (Hindi)', hint: 'जैसे "किराने पर 450 रुपये UPI से"' },
];

export const DEFAULT_VOICE_LANGUAGE = 'en-IN';

/** Nothing was heard for this long → give up rather than listen indefinitely. */
const SILENCE_TIMEOUT_MS = 12_000;

export function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Can we recognise `lang` entirely on this device?
 *
 * Never requests microphone permission — this is a passive capability check, so
 * it is safe to run on mount to decide whether to render the mic at all.
 */
export async function probeVoiceLanguage(
  lang: string,
  ctor: SpeechRecognitionCtor | null = getRecognitionCtor(),
): Promise<VoiceAvailability> {
  // Web Speech requires a secure context. Bail out early with a precise reason
  // rather than letting `start()` throw something opaque later.
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return { status: 'unsupported', reason: 'insecure-context' };
  }
  if (!ctor) return { status: 'unsupported', reason: 'no-api' };

  // A recogniser without the static `available()` probe predates on-device
  // support, which means it can only be a cloud recogniser. We do not use it.
  if (typeof ctor.available !== 'function') {
    return { status: 'unsupported', reason: 'no-local-api' };
  }

  try {
    const status = await ctor.available({ langs: [lang], processLocally: true });
    switch (status) {
      case 'available':
        return { status: 'ready' };
      case 'downloadable':
        return { status: 'needs-download' };
      case 'downloading':
        return { status: 'downloading' };
      default:
        return { status: 'unsupported', reason: 'no-local-model' };
    }
  } catch {
    // A probe that throws tells us nothing reassuring, so treat it as a no.
    return { status: 'unsupported', reason: 'no-local-model' };
  }
}

/**
 * Ask the platform to download the local model for `lang`.
 * Resolves false if the download could not be started or was declined.
 */
export async function installVoiceLanguage(
  lang: string,
  ctor: SpeechRecognitionCtor | null = getRecognitionCtor(),
): Promise<boolean> {
  if (!ctor || typeof ctor.install !== 'function') return false;
  try {
    return await ctor.install({ langs: [lang], processLocally: true });
  } catch {
    return false;
  }
}

function describeError(raw: string, message?: string): VoiceError {
  switch (raw) {
    case 'not-allowed':
    case 'service-not-allowed':
      return {
        code: 'permission-denied',
        detail: raw,
        message:
          'Microphone access was blocked. Allow it in your browser or system settings, or type the transaction instead.',
      };
    case 'no-speech':
      return { code: 'no-speech', detail: raw, message: 'I did not hear anything. Tap the mic and try again.' };
    case 'audio-capture':
      return { code: 'no-microphone', detail: raw, message: 'No microphone was found on this device.' };
    case 'language-not-supported':
      return {
        code: 'language-unavailable',
        detail: raw,
        message: 'This language is not available for on-device recognition here. Try English (India).',
      };
    case 'network':
      // On a processLocally session this should be impossible. If it happens,
      // the engine reached for a server — say so plainly instead of retrying.
      return {
        code: 'went-remote',
        detail: raw,
        message: 'Recognition tried to use a network service, so it was stopped. Voice input needs an on-device engine.',
      };
    case 'aborted':
      return { code: 'aborted', detail: raw, message: 'Listening was cancelled.' };
    default:
      return { code: 'unknown', detail: raw, message: message || 'Speech recognition failed. Please type instead.' };
  }
}

export interface VoiceSessionHandlers {
  /** Live, not-yet-final text. Display only — never parse this. */
  onPartial?: (text: string) => void;
  /** The settled transcript. Fires once, then the session is finished. */
  onResult: (text: string) => void;
  onError: (err: VoiceError) => void;
  /** Always fires last, for either outcome. */
  onEnd?: () => void;
}

export interface VoiceSession {
  /** Stop listening and keep whatever was recognised. */
  stop(): void;
  /** Stop listening and discard the result. */
  cancel(): void;
}

/**
 * Listen for a single utterance and hand back the transcript.
 *
 * Callers must have seen `probeVoiceLanguage() === 'ready'` first; this still
 * re-asserts `processLocally` so a session can never be created that is allowed
 * to fall back to a server.
 */
export function startVoiceSession(
  lang: string,
  handlers: VoiceSessionHandlers,
  ctor: SpeechRecognitionCtor | null = getRecognitionCtor(),
): VoiceSession {
  let finished = false;
  let cancelled = false;
  let finalText = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };

  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    clearTimer();
    fn();
    handlers.onEnd?.();
  };

  if (!ctor) {
    // Defer so callers always get the handle back before any callback fires.
    const t = setTimeout(() => {
      finish(() => handlers.onError({ code: 'unknown', message: 'Speech recognition is not available here.' }));
    }, 0);
    return { stop: () => clearTimeout(t), cancel: () => clearTimeout(t) };
  }

  const recognition = new ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  // The privacy invariant, restated per session.
  recognition.processLocally = true;

  const armTimer = () => {
    clearTimer();
    timer = setTimeout(() => {
      try { recognition.abort(); } catch { /* already stopped */ }
      finish(() =>
        handlers.onError({ code: 'no-speech', message: 'I did not hear anything. Tap the mic and try again.' }),
      );
    }, SILENCE_TIMEOUT_MS);
  };

  recognition.onstart = armTimer;
  recognition.onaudiostart = armTimer;

  recognition.onresult = (ev) => {
    let interim = '';
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const result = ev.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += text;
      else interim += text;
    }
    // Any audio at all means the user is talking — restart the silence guard.
    armTimer();
    if (interim && !finished) handlers.onPartial?.((finalText + interim).trim());
  };

  recognition.onerror = (ev) => {
    if (cancelled) return;
    finish(() => handlers.onError(describeError(ev.error, ev.message)));
  };

  recognition.onend = () => {
    if (cancelled) {
      finish(() => { /* discarded on purpose */ });
      return;
    }
    const text = finalText.trim();
    if (!text) {
      finish(() =>
        handlers.onError({ code: 'no-speech', message: 'I did not catch that. Tap the mic and try again.' }),
      );
      return;
    }
    finish(() => handlers.onResult(text));
  };

  try {
    recognition.start();
    armTimer();
  } catch (err) {
    finish(() =>
      handlers.onError({
        code: 'start-failed',
        detail: err instanceof Error ? err.message : String(err),
        message: 'Could not start listening. Close any other app using the microphone and try again.',
      }),
    );
  }

  return {
    stop: () => { try { recognition.stop(); } catch { /* already stopped */ } },
    cancel: () => {
      cancelled = true;
      try { recognition.abort(); } catch { /* already stopped */ }
    },
  };
}
