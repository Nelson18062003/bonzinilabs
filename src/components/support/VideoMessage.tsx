import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2, VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/voice-recording';
import { getChatMediaSignedUrl } from '@/hooks/useClientChat';
import { getAdminChatMediaSignedUrl } from '@/hooks/useAdminChat';

interface VideoMessageProps {
  path: string;
  durationSeconds: number | null;
  variant?: 'client-app' | 'admin-app';
  className?: string;
}

export function VideoMessage({
  path,
  durationSeconds,
  variant = 'client-app',
  className,
}: VideoMessageProps) {
  const { t } = useTranslation('support');
  const [url, setUrl] = useState<string | null>(null);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetcher = variant === 'admin-app' ? getAdminChatMediaSignedUrl : getChatMediaSignedUrl;
    // path = "conv_id/video/uuid.mp4"; poster = "conv_id/video/uuid.poster.jpg"
    const posterPath = path.replace(/\.[^.]+$/, '.poster.jpg');

    Promise.all([fetcher(path), fetcher(posterPath)])
      .then(([u, p]) => {
        if (cancelled) return;
        if (u) {
          setUrl(u);
          setPosterUrl(p);
          setStatus('ready');
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [path, variant]);

  if (status === 'loading') {
    return (
      <div
        className={cn(
          'flex h-40 w-60 items-center justify-center rounded-xl bg-black/20',
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
    );
  }

  if (status === 'error' || !url) {
    return (
      <div
        className={cn(
          'flex h-40 w-60 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted/40 text-muted-foreground',
          className
        )}
      >
        <VideoOff className="h-5 w-5" />
        <span className="text-xs">{t('video.error')}</span>
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-black', className)}
      style={{ maxWidth: 280 }}
    >
      <video
        src={url}
        poster={posterUrl ?? undefined}
        controls={playing}
        playsInline
        preload="metadata"
        className="block max-h-[360px] w-full"
        onPlay={() => setPlaying(true)}
      />
      {!playing && (
        <button
          type="button"
          onClick={(e) => {
            const video = e.currentTarget.parentElement?.querySelector('video');
            if (video) {
              setPlaying(true);
              void video.play();
            }
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
          aria-label="Play"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
            <Play className="h-6 w-6 translate-x-px" />
          </div>
          {durationSeconds != null && durationSeconds > 0 && (
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">
              {formatDuration(durationSeconds)}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
