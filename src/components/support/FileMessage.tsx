import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/voice-recording';
import { getChatMediaSignedUrl } from '@/hooks/useClientChat';
import { getAdminChatMediaSignedUrl } from '@/hooks/useAdminChat';

interface FileMessageProps {
  path: string;
  filename: string | null;
  sizeBytes: number | null;
  perspective: 'self' | 'other';
  variant?: 'client-app' | 'admin-app';
  className?: string;
}

export function FileMessage({
  path,
  filename,
  sizeBytes,
  perspective,
  variant = 'client-app',
  className,
}: FileMessageProps) {
  const { t } = useTranslation('support');
  const [downloading, setDownloading] = useState(false);

  const displayName = filename || path.split('/').pop() || 'document';
  const isSelf = perspective === 'self';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const fetcher = variant === 'admin-app' ? getAdminChatMediaSignedUrl : getChatMediaSignedUrl;
      const url = await fetcher(path);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = displayName;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-w-[220px] items-center gap-2.5 rounded-xl px-2.5 py-2',
        isSelf ? 'bg-black/[0.04] dark:bg-white/5' : 'bg-muted/60',
        className
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          isSelf ? 'bg-black/[0.06] dark:bg-white/10' : 'bg-background'
        )}
      >
        <FileText className="h-4 w-4 text-foreground/70" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{displayName}</p>
        {sizeBytes != null && (
          <p className="text-[11px] text-muted-foreground">{formatFileSize(sizeBytes)}</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          isSelf ? 'bg-black/[0.06] dark:bg-white/10' : 'bg-background',
          'text-foreground/70 transition active:scale-92'
        )}
        aria-label={t('file.download')}
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
