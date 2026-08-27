/**
 * Voice entry for a transaction: speak → review → prefill the Add form.
 *
 * Deliberately modelled on ScanReceiptPage: capture, show exactly what was
 * understood, and hand off to `/add` rather than writing anything itself. The
 * user always sees and confirms the transaction in the normal form, so a
 * mis-heard word can never silently become a saved record.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  Square,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  Download,
  Info,
} from 'lucide-react';
import { useAppContext } from '../../../context/AppContext';
import { Button } from '../../../shared/components/ui/Button';
import { haptic } from '../../../shared/services/haptics';
import { parseVoiceTransaction, type ParsedVoiceTransaction } from '../../../shared/services/voiceParser';
import { suggestCategories } from '../../../shared/services/autoCategorize';
import {
  VOICE_LANGUAGES,
  installVoiceLanguage,
  probeVoiceLanguage,
  startVoiceSession,
  type VoiceAvailability,
  type VoiceError,
  type VoiceSession,
} from '../../../shared/services/speechEngine';
import { getVoiceLanguage, setVoiceLanguage } from '../../../shared/hooks/useVoiceAvailability';
import { buildVoiceDeepLink } from '../voiceHandoff';
import { VoiceReview } from './VoiceReview';

const UNSUPPORTED_COPY: Record<string, string> = {
  'insecure-context': 'Voice input needs a secure (https) connection.',
  'no-api': 'This browser does not support speech recognition.',
  'no-local-api':
    'This browser can only recognise speech by sending the audio to a server. MoneyIQ keeps your finances on your device, so voice input is switched off here. Chrome 139+ on Android and desktop supports on-device recognition.',
  'no-local-model':
    'No on-device speech model is available for this language on this device. Try English (India), or type the transaction instead.',
};

type Phase = 'idle' | 'listening' | 'parsing' | 'review';

export function VoiceAddPage() {
  const navigate = useNavigate();
  const { state } = useAppContext();

  const [lang, setLang] = useState(getVoiceLanguage);
  const [availability, setAvailability] = useState<VoiceAvailability | null>(null);
  const [installing, setInstalling] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const [parsed, setParsed] = useState<ParsedVoiceTransaction | null>(null);

  const sessionRef = useRef<VoiceSession | null>(null);

  const categories = state.categories;
  const accounts = state.accounts;

  const refreshAvailability = useCallback((target: string) => {
    setAvailability(null);
    void probeVoiceLanguage(target).then(setAvailability);
  }, []);

  useEffect(() => {
    refreshAvailability(lang);
  }, [lang, refreshAvailability]);

  // Never leave the microphone open behind us.
  useEffect(() => () => sessionRef.current?.cancel(), []);

  const chooseLanguage = (next: string) => {
    sessionRef.current?.cancel();
    sessionRef.current = null;
    setPhase('idle');
    setPartial('');
    setError(null);
    setParsed(null);
    setLang(next);
    setVoiceLanguage(next);
  };

  const handleTranscript = useCallback(
    (text: string) => {
      setPhase('parsing');
      const result = parseVoiceTransaction(text, { categories, accounts });

      // The parser only understands language. Category *learning* lives in
      // autoCategorize, which knows this user's own history — so fall back to
      // it whenever the words alone did not name a category.
      if (!result.categoryId && result.type !== 'transfer' && result.notes) {
        const suggestions = suggestCategories(
          result.notes,
          result.amount ?? 0,
          result.type,
          result.date ?? new Date().toISOString().slice(0, 10),
          state.transactions,
          categories,
        );
        if (suggestions.length > 0 && suggestions[0].confidence > 60) {
          result.categoryId = suggestions[0].categoryId;
        }
      }

      setParsed(result);
      setPhase('review');
      haptic.success();
    },
    [categories, accounts, state.transactions],
  );

  const listen = () => {
    setError(null);
    setParsed(null);
    setPartial('');
    setPhase('listening');
    haptic.medium();

    sessionRef.current = startVoiceSession(lang, {
      onPartial: setPartial,
      onResult: handleTranscript,
      onError: (err) => {
        sessionRef.current = null;
        setPhase('idle');
        setPartial('');
        // Cancelling is a deliberate act, not a failure worth shouting about.
        if (err.code !== 'aborted') {
          setError(err);
          haptic.error();
        }
      },
      onEnd: () => { sessionRef.current = null; },
    });
  };

  const stopListening = () => {
    haptic.light();
    sessionRef.current?.stop();
  };

  const download = async () => {
    setInstalling(true);
    const ok = await installVoiceLanguage(lang);
    setInstalling(false);
    if (ok) refreshAvailability(lang);
    else {
      setError({
        code: 'language-unavailable',
        message: 'The language pack could not be downloaded. Check your connection and try again.',
      });
    }
  };

  const useDetails = () => {
    if (!parsed) return;
    navigate(buildVoiceDeepLink(parsed));
  };

  const reset = () => {
    setParsed(null);
    setPartial('');
    setError(null);
    setPhase('idle');
  };

  const activeLanguage = useMemo(
    () => VOICE_LANGUAGES.find((l) => l.code === lang) ?? VOICE_LANGUAGES[0],
    [lang],
  );

  const unsupported = availability?.status === 'unsupported';
  const needsDownload = availability?.status === 'needs-download';
  const downloading = availability?.status === 'downloading';
  const ready = availability?.status === 'ready';

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Mic size={22} className="text-primary-600" /> Speak a transaction
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Say what you spent and MoneyIQ will fill in the form for you.
        </p>
      </div>

      {/* Prominent disclosure. Google Play requires this to appear *before* the
          runtime microphone prompt, and it is the honest thing to show anyway. */}
      <div className="flex items-start gap-2 rounded-lg bg-primary-50/60 dark:bg-primary-900/10 p-3 text-xs text-gray-600 dark:text-gray-300">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-600" />
        <span>
          Your voice is recognised <strong>entirely on this device</strong>. No audio and no transcript is
          uploaded or stored — the words are turned into text, read once to fill the form, and discarded.
          The microphone is only on while you are holding the button.
        </span>
      </div>

      {/* Language */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm dark:bg-gray-800">
        {VOICE_LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => chooseLanguage(l.code)}
            className={
              'flex-1 rounded-md py-1.5 font-medium transition-colors ' +
              (lang === l.code
                ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-700 dark:text-primary-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')
            }
          >
            {l.label}
          </button>
        ))}
      </div>

      {availability === null && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Checking this device…
        </div>
      )}

      {unsupported && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
          <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {UNSUPPORTED_COPY[availability.reason] ?? 'On-device voice input is not available here.'}
            </span>
          </div>
          <Button variant="secondary" onClick={() => navigate('/add')} icon={<ArrowRight size={16} />}>
            Type it instead
          </Button>
        </div>
      )}

      {(needsDownload || downloading) && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <Info size={16} className="mt-0.5 shrink-0 text-primary-600" />
            <span>
              {activeLanguage.label} needs a one-off language pack so recognition can run offline. It
              downloads once and then works without a connection.
            </span>
          </div>
          <Button
            onClick={download}
            disabled={installing || downloading}
            icon={installing || downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          >
            {installing || downloading ? 'Downloading…' : 'Download language pack'}
          </Button>
        </div>
      )}

      {ready && phase !== 'review' && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={phase === 'listening' ? stopListening : listen}
            disabled={phase === 'parsing'}
            aria-label={phase === 'listening' ? 'Stop listening' : 'Start listening'}
            className={
              'relative flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 disabled:opacity-60 ' +
              (phase === 'listening'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-primary-600 hover:bg-primary-700')
            }
          >
            {phase === 'listening' && (
              <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-30" />
            )}
            {phase === 'parsing' ? (
              <Loader2 size={34} className="animate-spin" />
            ) : phase === 'listening' ? (
              <Square size={30} />
            ) : (
              <Mic size={34} />
            )}
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-300" aria-live="polite">
            {phase === 'listening'
              ? partial || 'Listening…'
              : phase === 'parsing'
                ? 'Working out the details…'
                : activeLanguage.hint}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {phase === 'review' && parsed && (
        <VoiceReview
          parsed={parsed}
          categories={categories}
          accounts={accounts}
          onConfirm={useDetails}
          onRetry={() => { reset(); listen(); }}
        />
      )}

      {phase === 'review' && (
        <button
          type="button"
          onClick={reset}
          className="mx-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <RotateCcw size={13} /> Start over
        </button>
      )}
    </div>
  );
}
