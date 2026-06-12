import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Loader2 } from 'lucide-react';
import { getChatMediaSignedUrl } from '@/hooks/useClientChat';
import { getAdminChatMediaSignedUrl } from '@/hooks/useAdminChat';
import { cn } from '@/lib/utils';

interface ChatImageProps {
  path: string;
  side: 'client' | 'admin';
  variant?: 'client-app' | 'admin-app';
  className?: string;
}

export function ChatImage({ path, variant = 'client-app', className }: ChatImageProps) {
  const { t } = useTranslation('support');
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetcher = variant === 'admin-app' ? getAdminChatMediaSignedUrl : getChatMediaSignedUrl;
    fetcher(path)
      .then((u) => {
        if (cancelled) return;
        if (u) {
          setUrl(u);
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
          'flex h-40 w-48 items-center justify-center rounded-xl bg-muted/40',
          className
        )}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'error' || !url) {
    return (
      <div
        className={cn(
          'flex h-40 w-48 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted/40 text-muted-foreground',
          className
        )}
      >
        <ImageOff className="h-5 w-5" />
        <span className="text-xs">{t('image.error')}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className={cn(
          'group relative overflow-hidden rounded-xl bg-muted/40',
          'transition-transform active:scale-[0.98]',
          className
        )}
        aria-label={t('image.tapToOpen')}
      >
        <img
          src={url}
          alt=""
          className="max-h-60 w-auto max-w-[260px] object-cover"
          loading="lazy"
        />
      </button>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreen(false)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={url}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
