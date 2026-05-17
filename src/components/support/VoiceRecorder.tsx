/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Send, Trash2, Lock, AlertCircle, ChevronLeft, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  detectVoiceMimeType,
  isVoiceRecordingSupported,
  requestMicrophoneStream,
  formatDuration,
  type VoiceMimeChoice,
} from '@/lib/voice-recording';
import { cn } from '@/lib/utils';

const MAX_DURATION_SECONDS = 60;
const SLIDE_CANCEL_PX = 80;
const SLIDE_LOCK_PX = 60;
const PEAKS_COUNT = 32;

export interface VoiceBlobPayload {
  blob: Blob;
  mimeType: string;
  extension: string;
  durationSeconds: number;
  peaks: number[];
}

interface VoiceRecorderProps {
  onSend: (payload: VoiceBlobPayload) => Promise<void> | void;
  disabled?: boolean;
  /**
   * Si défini, ce callback est appelé avec true quand l'enregistrement
   * commence et false quand il se termine. Le parent peut l'utiliser
   * pour masquer le textarea pendant l'enregistrement (UX WhatsApp).
   */
  onRecordingChange?: (recording: boolean) => void;
  /**
   * Si défini, ce render prop reçoit l'état de l'enregistrement
   * et doit retourner l'UI inline à afficher À LA PLACE du textarea
   * pendant qu'on enregistre. Si non défini, l'UI inline n'est pas
   * rendue par le recorder (le parent gère).
   */
  renderInline?: (state: InlineRecorderState) => React.ReactNode;
  className?: string;
}

export interface InlineRecorderState {
  elapsedSeconds: number;
  isCancelArmed: boolean;
  isLocked: boolean;
  onCancel: () => void;
  onLockedSend: () => void;
}

type State =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'recording'; startedAt: number; locked: boolean }
  | { kind: 'sending' }
  | { kind: 'unsupported' }
  | { kind: 'denied' };

export function VoiceRecorder({
  onSend,
  disabled = false,
  onRecordingChange,
  renderInline,
  className,
}: VoiceRecorderProps) {
  const { t } = useTranslation('support');
  const [state, setState] = useState<State>(
    isVoiceRecordingSupported() ? { kind: 'idle' } : { kind: 'unsupported' }
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cancelArmed, setCancelArmed] = useState(false);

  const mimeRef = useRef<VoiceMimeChoice | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const collectedPeaksRef = useRef<number[]>([]);
  const animRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const cancelledRef = useRef(false);

  // Sync parent
  useEffect(() => {
    onRecordingChange?.(state.kind === 'recording');
  }, [state.kind]);

  const cleanup = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* */ }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    chunksRef.current = [];
    collectedPeaksRef.current = [];
    setElapsedSeconds(0);
    setCancelArmed(false);
    touchStartRef.current = null;
    cancelledRef.current = false;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startRecording = useCallback(async () => {
    if (state.kind !== 'idle' && state.kind !== 'denied') return;
    setState({ kind: 'requesting' });

    try {
      const mime = detectVoiceMimeType();
      mimeRef.current = mime;
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;

      type WindowAC = Window & { webkitAudioContext?: typeof AudioContext };
      const AC = window.AudioContext || (window as WindowAC).webkitAudioContext;
      const audioCtx: AudioContext = new AC();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const options: MediaRecorderOptions = mime?.mimeType
        ? { mimeType: mime.mimeType, audioBitsPerSecond: 32000 }
        : { audioBitsPerSecond: 32000 };
      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      chunksRef.current = [];
      collectedPeaksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      const startedAt = Date.now();

      recorder.onstop = async () => {
        if (cancelledRef.current) {
          cleanup();
          setState({ kind: 'idle' });
          return;
        }

        const durationSec = (Date.now() - startedAt) / 1000;
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current?.mimeType || 'audio/webm',
        });
        const peaks = resamplePeaks(collectedPeaksRef.current, PEAKS_COUNT);
        const mimeUsed = mimeRef.current?.mimeType || 'audio/webm';
        const ext = mimeRef.current?.extension || 'webm';

        cleanup();
        setState({ kind: 'sending' });

        try {
          await onSend({
            blob,
            mimeType: mimeUsed,
            extension: ext,
            durationSeconds: Math.max(1, Math.round(durationSec)),
            peaks,
          });
        } finally {
          setState({ kind: 'idle' });
        }
      };

      recorder.start(250);

      // Boucle Web Audio pour collecter les peaks
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastPeak = 0;
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length) / 255;
        const now = Date.now();
        if (now - lastPeak >= 100) {
          collectedPeaksRef.current.push(rms);
          lastPeak = now;
        }
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);

      timerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(sec);
        if (sec >= MAX_DURATION_SECONDS) {
          toast.info(t('voice.maxDurationReached'));
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            cancelledRef.current = false;
            try { recorderRef.current.stop(); } catch { /* */ }
          }
        }
      }, 200);

      setState({ kind: 'recording', startedAt, locked: false });
    } catch (err) {
      const error = err as DOMException & { name?: string };
      console.error('Voice start error', error);
      if (error?.name === 'NotAllowedError') {
        setState({ kind: 'denied' });
      } else if (error?.name === 'NotFoundError') {
        toast.error(t('voice.errors.noMicrophone'));
        setState({ kind: 'idle' });
      } else if (error?.name === 'NotReadableError') {
        toast.error(t('voice.errors.microphoneBusy'));
        setState({ kind: 'idle' });
      } else {
        toast.error(t('voice.errors.unknownStart'));
        setState({ kind: 'idle' });
      }
      cleanup();
    }
  }, [state, cleanup, onSend, t]);

  const stopRecording = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* */ }
    } else {
      cleanup();
      setState({ kind: 'idle' });
    }
  }, [cleanup]);

  // Touch handlers — press long + slide pour annuler/verrouiller
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    if (state.kind !== 'idle' && state.kind !== 'denied') return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    void startRecording();
  }, [disabled, state.kind, startRecording]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (state.kind !== 'recording' || state.locked) return;
    if (!touchStartRef.current) return;
    const dx = touchStartRef.current.x - e.touches[0].clientX;
    const dy = touchStartRef.current.y - e.touches[0].clientY;

    // Slide vers le haut → verrouille
    if (dy > SLIDE_LOCK_PX && dx < 30) {
      setState((s) => (s.kind === 'recording' ? { ...s, locked: true } : s));
      touchStartRef.current = null;
      return;
    }

    // Slide vers la gauche → annule
    const willCancel = dx > SLIDE_CANCEL_PX;
    if (willCancel !== cancelArmed) setCancelArmed(willCancel);
  }, [state, cancelArmed]);

  const onTouchEnd = useCallback(() => {
    if (state.kind !== 'recording') {
      touchStartRef.current = null;
      return;
    }
    if (state.locked) {
      // En mode verrouillé, on n'arrête pas en relâchant — l'utilisateur
      // doit cliquer sur le bouton stop/envoyer.
      touchStartRef.current = null;
      return;
    }
    const shouldCancel = cancelArmed;
    touchStartRef.current = null;
    setCancelArmed(false);
    stopRecording(shouldCancel);
  }, [state, cancelArmed, stopRecording]);

  // Click desktop : toggle
  const onClick = useCallback(() => {
    if (disabled) return;
    if (state.kind === 'idle' || state.kind === 'denied') {
      void startRecording();
    } else if (state.kind === 'recording') {
      stopRecording(false);
    }
  }, [disabled, state, startRecording, stopRecording]);

  // Render bouton micro/envoi
  if (state.kind === 'unsupported') return null;

  if (state.kind === 'denied') {
    return (
      <button
        type="button"
        onClick={() => toast.error(t('voice.errors.permissionDenied'))}
        className={cn(
          'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full',
          'bg-destructive/10 text-destructive',
          className
        )}
        aria-label={t('voice.permissionHelp')}
      >
        <AlertCircle className="h-5 w-5" />
      </button>
    );
  }

  if (state.kind === 'sending') {
    return (
      <div
        className={cn(
          'flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full',
          'bg-bonzini-violet text-white',
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // Rendu de l'UI inline pendant l'enregistrement (via render prop parent)
  const inlineState: InlineRecorderState | null = state.kind === 'recording' ? {
    elapsedSeconds,
    isCancelArmed: cancelArmed,
    isLocked: state.locked,
    onCancel: () => stopRecording(true),
    onLockedSend: () => stopRecording(false),
  } : null;

  return (
    <>
      {inlineState && renderInline?.(inlineState)}
      <motion.button
        type="button"
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => stopRecording(true)}
        disabled={disabled || state.kind === 'requesting'}
        whileTap={{ scale: 0.92 }}
        animate={state.kind === 'recording' ? {
          backgroundColor: cancelArmed ? 'hsl(0 84% 60%)' : 'hsl(258 95% 60%)',
        } : {}}
        className={cn(
          'relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full',
          'bg-bonzini-violet text-white shadow-[0_6px_18px_hsl(258_95%_60%/_0.22)]',
          'disabled:opacity-50',
          state.kind === 'recording' && 'shadow-[0_6px_18px_hsl(0_84%_60%/_0.22)]',
          className
        )}
        aria-label={t('voice.startRecording')}
      >
        {state.kind === 'requesting' ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
        {state.kind === 'recording' && !state.locked && (
          <motion.span
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full bg-current"
          />
        )}
      </motion.button>
    </>
  );
}

/**
 * UI INLINE qui REMPLACE le textarea dans la barre d'input pendant l'enregistrement.
 * Style WhatsApp : rec-dot + timer + hint slide-to-cancel + hint lock vertical.
 * À utiliser comme `renderInline` du VoiceRecorder.
 */
export function VoiceRecorderInline({ state }: { state: InlineRecorderState }) {
  const { t } = useTranslation('support');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'flex flex-1 items-center gap-2 rounded-full px-3 py-2 min-h-[38px]',
        state.isCancelArmed
          ? 'bg-destructive/10'
          : 'bg-muted'
      )}
    >
      {state.isLocked ? (
        <button
          type="button"
          onClick={state.onCancel}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
          aria-label={t('voice.cancel')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-destructive"
        />
      )}
      <span className="shrink-0 min-w-[38px] text-sm font-medium tabular-nums text-foreground">
        {formatDuration(state.elapsedSeconds)}
      </span>
      <span
        className={cn(
          'flex flex-1 items-center gap-1 truncate text-sm',
          state.isCancelArmed ? 'text-destructive font-semibold' : 'text-muted-foreground'
        )}
      >
        {state.isLocked ? (
          <>
            <Lock className="h-3 w-3" />
            <span className="truncate">{t('voice.lockedHint')}</span>
          </>
        ) : state.isCancelArmed ? (
          <span className="truncate">{t('voice.releaseToCancel')}</span>
        ) : (
          <>
            <ChevronLeft className="h-3 w-3" />
            <span className="truncate">{t('voice.slideToCancel')}</span>
          </>
        )}
      </span>
      {!state.isLocked && (
        <div className="hidden flex-col items-center gap-0.5 text-[10px] text-muted-foreground sm:flex">
          <Lock className="h-3 w-3" />
        </div>
      )}
      {state.isLocked && (
        <button
          type="button"
          onClick={state.onLockedSend}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bonzini-violet text-white"
          aria-label={t('input.send')}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      )}
    </motion.div>
  );
}

function resamplePeaks(input: number[], targetLength: number): number[] {
  if (input.length === 0) return new Array(targetLength).fill(0.05);
  if (input.length === targetLength) return normalize(input);

  const out: number[] = new Array(targetLength).fill(0);
  const ratio = input.length / targetLength;
  for (let i = 0; i < targetLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio) + 1);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return normalize(out);
}

function normalize(arr: number[]): number[] {
  const max = Math.max(0.01, ...arr);
  return arr.map((v) => Math.max(0.05, Math.min(1, v / max)));
}

export { AnimatePresence };
