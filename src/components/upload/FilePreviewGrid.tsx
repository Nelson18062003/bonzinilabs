/**
 * Thumbnails for files staged but not yet uploaded — the shared preview strip
 * for every proof/QR zone in dépôts & paiements.
 *
 * Blob-URL lifecycle lives in `useFilePreviews`; this file stays components-only
 * so Fast Refresh keeps working.
 */

import { FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { useFilePreviews } from '@/hooks/useFilePreviews';
import { formatFileSize } from '@/lib/clipboardFiles';

interface Props {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
}

export function FilePreviewGrid({ files, onRemove, className }: Props) {
  const previews = useFilePreviews(files);

  if (files.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {files.map((file, i) => (
        <div
          key={`${file.name}-${file.lastModified}-${i}`}
          className={cn(
            'relative flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-xl ring-1 ring-black/[0.06] dark:ring-white/[0.06]',
            SURFACE.canvas,
          )}
          title={`${file.name} · ${formatFileSize(file.size)}`}
        >
          {previews[i] ? (
            <img src={previews[i]!} alt={file.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-0.5 px-1">
              <FileText className={cn('h-4 w-4', TEXT.muted)} />
              <span className={cn('max-w-[52px] truncate text-[8px]', TEXT.muted)}>{file.name}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Retirer ${file.name}`}
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60"
          >
            <X className="h-2.5 w-2.5 text-white" />
          </button>
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-px text-center text-[8px] font-semibold text-white">
            {formatFileSize(file.size)}
          </span>
        </div>
      ))}
    </div>
  );
}
