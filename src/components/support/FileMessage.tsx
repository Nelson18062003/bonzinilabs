import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FileSpreadsheet, FileType, Download, Loader2 } from 'lucide-react';
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
  const ext = displayName.split('.').pop()?.toLowerCase() ?? '';

  const Icon = pickIcon(ext);
  const iconColor = perspective === 'self' ? 'text-white' : pickIconColor(ext);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const fetcher = variant === 'admin-app' ? getAdminChatMediaSignedUrl : getChatMediaSignedUrl;
      const url = await fetcher(path);
      if (!url) return;
      // Trigger download via lien temporaire
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

  const isSelf = perspective === 'self';

  return (
    <div
      className={cn(
        'flex min-w-[220px] items-center gap-3 rounded-xl px-3 py-2.5',
        isSelf ? 'bg-white/15' : 'bg-background/60',
        className
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
          isSelf ? 'bg-white/20' : 'bg-muted'
        )}
      >
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{displayName}</p>
        {sizeBytes != null && (
          <p className="text-xs opacity-70">{formatFileSize(sizeBytes)}</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isSelf ? 'bg-white/20 hover:bg-white/30' : 'bg-bonzini-violet/15 text-bonzini-violet hover:bg-bonzini-violet/25'
        )}
        aria-label={t('file.download')}
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function pickIcon(ext: string) {
  if (['pdf'].includes(ext)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['doc', 'docx', 'odt'].includes(ext)) return FileType;
  return FileText;
}

function pickIconColor(ext: string): string {
  if (['pdf'].includes(ext)) return 'text-red-500';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'text-emerald-600';
  if (['doc', 'docx'].includes(ext)) return 'text-blue-500';
  return 'text-muted-foreground';
}
