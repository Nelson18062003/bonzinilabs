import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/voice-recording';
import { getChatMediaSignedUrl } from '@/hooks/useClientChat';
import { getAdminChatMediaSignedUrl } from '@/hooks/useAdminChat';

interface VoiceMessageProps {
  path: string;
  peaks: number[] | null;
  durationSeconds: number | null;
  perspective: 'self' | 'other';
  variant?: 'client-app' | 'admin-app';
  className?: string;
}

// Singleton pour pause automatique de l'audio précédent
let currentAudio: HTMLAudioElement | null = null;

export function VoiceMessage({
  path,
  peaks,
  durationSeconds,
  perspective,
  variant = 'client-app',
  className,
}: VoiceMessageProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const displayPeaks = peaks && peaks.length > 0 ? peaks : defaultPeaks();
  const total = durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0;

  const fetchUrl = useCallback(async () => {
    if (url) return url;
    setLoading(true);
    const fetcher = variant === 'admin-app' ? getAdminChatMediaSignedUrl : getChatMediaSignedUrl;
    const u = await fetcher(path);
    setLoading(false);
    if (u) setUrl(u);
    return u;
  }, [path, url, variant]);

  const togglePlay = useCallback(async () => {
    let audio = audioRef.current;

    if (!audio) {
      const u = await fetchUrl();
      if (!u) return;
      audio = new Audio(u);
      audioRef.current = audio;
      audio.preload = 'metadata';
      audio.addEventListener('timeupdate', () => {
        if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      });
      audio.addEventListener('ended', () => {
        setPlaying(false);
        setCurrentTime(0);
      });
      audio.addEventListener('pause', () => setPlaying(false));
      audio.addEventListener('play', () => setPlaying(true));
    }

    if (audio.paused) {
      if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
      }
      currentAudio = audio;
      try {
        await audio.play();
      } catch (err) {
        console.error('Voice playback error', err);
      }
    } else {
      audio.pause();
    }
  }, [fetchUrl]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (currentAudio === audioRef.current) currentAudio = null;
        audioRef.current = null;
      }
    };
  }, []);

  const onWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !total) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * total;
      setCurrentTime(audio.currentTime);
    },
    [total]
  );

  // Couleurs solides quel que soit le côté — la bulle parent est claire dans
  // les 2 cas (tint léger pour self, blanc pour other).
  // Largeurs strictes : la bulle entière mesure max 200px (pour rester DANS la
  // limite max-w-[80%] même sur petits écrans Android 320px), avec waveform qui
  // shrink-fit ce qui reste après play button + timer.
  return (
    <div
      className={cn(
        'flex w-fit items-center gap-2 py-0.5 text-foreground',
        className
      )}
      style={{ width: '200px', maxWidth: '100%' }}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          'bg-bonzini-violet text-white transition active:scale-95',
          'shadow-[0_2px_6px_hsl(258_95%_60%/_0.3)]'
        )}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-px" />
        )}
      </button>

      <div
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={onWaveformClick}
      >
        {displayPeaks.map((p, i) => {
          const passed = i / displayPeaks.length <= progress;
          return (
            <span
              key={i}
              className={cn(
                'block w-[2px] rounded-full transition-colors',
                passed ? 'bg-bonzini-violet' : 'bg-foreground/25'
              )}
              style={{
                height: `${Math.max(3, p * 20)}px`,
                flex: '1 1 auto',
              }}
            />
          );
        })}
      </div>

      <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground tracking-tight">
        {formatDuration(playing ? currentTime : total)}
      </span>
    </div>
  );
}

function defaultPeaks(): number[] {
  return [
    0.2, 0.4, 0.6, 0.3, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.3, 0.6, 0.4, 0.7, 0.5,
    0.3, 0.8, 0.6, 0.4, 0.5, 0.7, 0.4, 0.3, 0.6, 0.5, 0.4, 0.7, 0.5, 0.3, 0.4,
    0.6, 0.3,
  ];
}
