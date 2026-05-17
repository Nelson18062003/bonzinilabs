import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, X, Send, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import {
  detectVoiceMimeType,
  isVoiceRecordingSupported,
  requestMicrophoneStream,
  formatDuration,
  type VoiceMimeChoice,
} from '@/lib/voice-recording';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Limites enregistrement
const MAX_DURATION_SECONDS = 60;
const SLIDE_CANCEL_THRESHOLD_PX = 100;
const PEAKS_COUNT = 32; // nombre de barres stockées en BDD pour playback

export interface VoiceBlobPayload {
  blob: Blob;
  mimeType: string;
  extension: string;
  durationSeconds: number;
  peaks: number[]; // normalisés 0-1, longueur PEAKS_COUNT
}

interface VoiceRecorderProps {
  onSend: (payload: VoiceBlobPayload) => Promise<void> | void;
  disabled?: boolean;
  className?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'recording'; startedAt: number; cancelHinted: boolean }
  | { kind: 'sending' }
  | { kind: 'unsupported' }
  | { kind: 'denied' };

export function VoiceRecorder({ onSend, disabled = false, className }: VoiceRecorderProps) {
  const { t } = useTranslation('support');
  const [state, setState] = useState<State>(
    isVoiceRecordingSupported() ? { kind: 'idle' } : { kind: 'unsupported' }
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveLevel, setLiveLevel] = useState(0); // 0-1, niveau micro courant

  // Refs des objets stateful non-react
  const mimeRef = useRef<VoiceMimeChoice | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const collectedPeaksRef = useRef<number[]>([]); // peaks accumulés pour BDD
  const animRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  // Nettoyage centralisé
  const cleanup = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (elapsedTimerRef.current != null) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
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
    setLiveLevel(0);
    setElapsedSeconds(0);
    touchStartXRef.current = null;
    cancelledRef.current = false;
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  // Démarre l'enregistrement
  const startRecording = useCallback(async () => {
    if (state.kind !== 'idle' && state.kind !== 'denied') return;
    setState({ kind: 'requesting' });

    try {
      const mime = detectVoiceMimeType();
      mimeRef.current = mime;
      const stream = await requestMicrophoneStream();
      streamRef.current = stream;

      // Web Audio pour waveform live + collecte peaks
      type WindowAC = Window & { webkitAudioContext?: typeof AudioContext };
      const AC = window.AudioContext || (window as WindowAC).webkitAudioContext;
      const audioCtx: AudioContext = new AC();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
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

      recorder.onstop = async () => {
        // Si annulé, on ne fait rien (cleanup déjà parti)
        if (cancelledRef.current) {
          cleanup();
          setState({ kind: 'idle' });
          return;
        }

        const durationSec = (Date.now() - (state.kind === 'recording' ? state.startedAt : Date.now())) / 1000;
        const blob = new Blob(chunksRef.current, {
          type: mimeRef.current?.mimeType || 'audio/webm',
        });

        // Génère peaks finaux : on rééchantillonne collectedPeaks à PEAKS_COUNT
        const peaks = resampleToFixedLength(
          collectedPeaksRef.current,
          PEAKS_COUNT
        );

        // Cleanup et envoi
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

      recorder.start(250); // chunk toutes les 250ms

      // Boucle d'analyse waveform
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastPeakSample = 0;
      const PEAK_SAMPLE_INTERVAL_MS = 100;
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        // Niveau RMS approximé
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length) / 255; // 0-1
        setLiveLevel(rms);

        const now = Date.now();
        if (now - lastPeakSample >= PEAK_SAMPLE_INTERVAL_MS) {
          collectedPeaksRef.current.push(rms);
          lastPeakSample = now;
        }

        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);

      // Timer durée (auto-stop géré via ref pour éviter dépendance circulaire)
      const startedAt = Date.now();
      elapsedTimerRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(sec);
        if (sec >= MAX_DURATION_SECONDS) {
          toast.info(t('voice.maxDurationReached'));
          cancelledRef.current = false;
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            try {
              recorderRef.current.stop();
            } catch {
              // ignore
            }
          }
        }
      }, 200);

      setState({ kind: 'recording', startedAt, cancelHinted: false });
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

  // Stoppe l'enregistrement (cancel=true → annulation, pas d'envoi)
  const stopRecording = useCallback((cancel: boolean) => {
    cancelledRef.current = cancel;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    } else {
      // Si recorder n'est pas en marche, on cleanup manuellement
      cleanup();
      setState({ kind: 'idle' });
    }
  }, [cleanup]);

  // Touch handlers (mobile press-and-hold)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    if (state.kind !== 'idle' && state.kind !== 'denied') return;
    touchStartXRef.current = e.touches[0].clientX;
    void startRecording();
  }, [disabled, state.kind, startRecording]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (state.kind !== 'recording') return;
    if (touchStartXRef.current == null) return;
    const dx = touchStartXRef.current - e.touches[0].clientX;
    const willCancel = dx > SLIDE_CANCEL_THRESHOLD_PX;
    if (willCancel !== state.cancelHinted) {
      setState({ ...state, cancelHinted: willCancel });
    }
  }, [state]);

  const onTouchEnd = useCallback(() => {
    if (state.kind !== 'recording') {
      touchStartXRef.current = null;
      return;
    }
    const shouldCancel = state.cancelHinted;
    touchStartXRef.current = null;
    stopRecording(shouldCancel);
  }, [state, stopRecording]);

  // Click desktop : toggle
  const onClick = useCallback(() => {
    if (disabled) return;
    if (state.kind === 'idle' || state.kind === 'denied') {
      void startRecording();
    } else if (state.kind === 'recording') {
      stopRecording(false);
    }
  }, [disabled, state.kind, startRecording, stopRecording]);

  // États affichage
  if (state.kind === 'unsupported') {
    // Pas de bouton — le parent affiche autre chose (texte / photo seulement)
    return null;
  }

  if (state.kind === 'denied') {
    return (
      <button
        type="button"
        onClick={() => toast.error(t('voice.errors.permissionDenied'))}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          'bg-destructive/10 text-destructive',
          className
        )}
        aria-label={t('voice.permissionHelp')}
      >
        <AlertCircle className="h-5 w-5" />
      </button>
    );
  }

  // Pendant enregistrement : on remplace le mini-bouton par une grosse barre flottante
  if (state.kind === 'recording') {
    return (
      <RecordingOverlay
        elapsedSeconds={elapsedSeconds}
        liveLevel={liveLevel}
        cancelHinted={state.cancelHinted}
        onCancel={() => stopRecording(true)}
        onSend={() => stopRecording(false)}
      />
    );
  }

  // État sending
  if (state.kind === 'sending') {
    return (
      <button
        type="button"
        disabled
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          'bg-bonzini-violet text-white',
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </button>
    );
  }

  // Idle ou requesting → bouton micro
  return (
    <button
      type="button"
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => stopRecording(true)}
      disabled={disabled || state.kind === 'requesting'}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        'bg-bonzini-orange/15 text-bonzini-orange',
        'transition-colors hover:bg-bonzini-orange/25 active:scale-95',
        'disabled:opacity-50',
        className
      )}
      aria-label={t('voice.startRecording')}
    >
      {state.kind === 'requesting' ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </button>
  );
}

// ── Overlay pendant l'enregistrement ─────────────────────────

interface OverlayProps {
  elapsedSeconds: number;
  liveLevel: number;
  cancelHinted: boolean;
  onCancel: () => void;
  onSend: () => void;
}

function RecordingOverlay({
  elapsedSeconds,
  liveLevel,
  cancelHinted,
  onCancel,
  onSend,
}: OverlayProps) {
  const { t } = useTranslation('support');
  return (
    <div
      className={cn(
        'flex h-10 flex-1 items-center gap-2 rounded-full px-3',
        cancelHinted
          ? 'bg-destructive/15 text-destructive'
          : 'bg-bonzini-orange/15 text-bonzini-orange'
      )}
    >
      <button
        type="button"
        onClick={onCancel}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-background/60"
        aria-label={t('voice.cancel')}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-1.5">
        <span
          className="block h-2 w-2 rounded-full bg-current"
          style={{
            opacity: 0.5 + liveLevel * 0.5,
            transform: `scale(${1 + liveLevel * 0.5})`,
            transition: 'transform 80ms ease-out',
          }}
        />
        <span className="text-sm font-mono tabular-nums">
          {formatDuration(elapsedSeconds)}
        </span>
      </div>

      <span className="flex-1 truncate text-center text-xs opacity-80">
        {cancelHinted ? t('voice.releaseToCancel') : t('voice.slideToCancel')}
      </span>

      <button
        type="button"
        onClick={onSend}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-current text-background"
        aria-label={t('input.send')}
      >
        <Send className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Rééchantillonne un tableau de peaks vers une longueur fixe.
 * Utilise une moyenne glissante simple. Sortie normalisée 0-1.
 */
function resampleToFixedLength(input: number[], targetLength: number): number[] {
  if (input.length === 0) return new Array(targetLength).fill(0.05);
  if (input.length === targetLength) return normalizePeaks(input);

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
  return normalizePeaks(out);
}

function normalizePeaks(arr: number[]): number[] {
  const max = Math.max(0.01, ...arr);
  return arr.map((v) => Math.max(0.05, Math.min(1, v / max)));
}
