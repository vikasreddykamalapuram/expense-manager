/**
 * Passive capability probe for voice input.
 *
 * Runs once per mount and never asks for the microphone, so it is safe to call
 * from always-mounted chrome like the FAB. Anything other than `ready` /
 * `needs-download` means the microphone is simply not rendered — we would
 * rather have no voice button than one that silently uses a cloud recogniser.
 */

import { useEffect, useState } from 'react';
import {
  DEFAULT_VOICE_LANGUAGE,
  probeVoiceLanguage,
  type VoiceAvailability,
} from '../services/speechEngine';

const LANG_KEY = 'moneyiq_voice_lang';

export function getVoiceLanguage(): string {
  try {
    return localStorage.getItem(LANG_KEY) || DEFAULT_VOICE_LANGUAGE;
  } catch {
    return DEFAULT_VOICE_LANGUAGE;
  }
}

export function setVoiceLanguage(lang: string): void {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* private mode — fall back to the default next time */
  }
}

export function useVoiceAvailability(lang?: string): VoiceAvailability | null {
  const [availability, setAvailability] = useState<VoiceAvailability | null>(null);
  const target = lang ?? DEFAULT_VOICE_LANGUAGE;

  useEffect(() => {
    let live = true;
    void probeVoiceLanguage(target).then((result) => {
      if (live) setAvailability(result);
    });
    return () => { live = false; };
  }, [target]);

  return availability;
}

/** True once we know an on-device engine exists (or can be downloaded). */
export function canOfferVoice(availability: VoiceAvailability | null): boolean {
  if (!availability) return false;
  return availability.status !== 'unsupported';
}
