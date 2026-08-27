/**
 * Shared vocabulary for voice errors.
 *
 * Both engines funnel into this: the web Speech API engine (speechEngine.ts)
 * and the native Android on-device engine (nativeSpeech.ts). The native plugin
 * deliberately reports Web Speech error *strings* rather than Android's integer
 * codes so that there is exactly one place that decides what a user is told.
 *
 * Lives in its own module so neither engine has to import the other.
 */

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

export function describeVoiceError(raw: string, message?: string): VoiceError {
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
      // On an on-device session this should be impossible. If it happens, the
      // engine reached for a server — say so plainly instead of retrying.
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
