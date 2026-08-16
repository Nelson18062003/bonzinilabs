/**
 * The ONE upload affordance for dépôts & paiements — paste, drag, or click.
 *
 * Visual language is the mobile design kit (soft canvas, dashed neutral border,
 * no gradients, colour only where it means something). The zone tints violet
 * on drag-over and flashes green for ~700 ms when a paste lands, so a Ctrl+V
 * fired from the other side of the screen is unmistakably acknowledged.
 *
 * The paste listener is window-wide (see `usePasteFiles`), which is what makes
 * "screenshot ▸ Ctrl+V" work without aiming at anything. `enabled` therefore
 * has to be false whenever the zone is behind a closed drawer or on an inactive
 * wizard step — two live zones would attach the same screenshot twice.
 */

import { useRef, useState } from 'react';
import { Upload, ClipboardPaste, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { usePasteFiles } from '@/hooks/usePasteFiles';
import { ACCEPT_UPLOAD } from '@/lib/clipboardFiles';

interface Props {
  /** Receives validated files (type + size already checked). */
  onFiles: (files: File[]) => void;
  /** Bind the window paste listener. One live zone per screen. */
  enabled?: boolean;
  /** Single-slot zones (QR code) keep only the first file. */
  single?: boolean;
  /** `accept` for the hidden input. Defaults to JPG/PNG/WebP/PDF. */
  accept?: string;
  /** Headline inside the zone. */
  title?: string;
  /** Second line — defaults to the accepted-formats reminder. */
  hint?: string;
  /** Slimmer padding, for zones sitting under an existing preview. */
  compact?: boolean;
  /** Greys the zone out and ignores input (upload in flight). */
  busy?: boolean;
  className?: string;
}

export function PasteDropZone({
  onFiles,
  enabled = true,
  single = false,
  accept = ACCEPT_UPLOAD,
  title,
  hint,
  compact = false,
  busy = false,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Nested dragenter/dragleave pairs fire for every child element; counting
  // them is the only way to know when the pointer has really left the zone.
  const dragDepth = useRef(0);

  const { pasteFromClipboard, isReading, flash, canPasteButton, handleDrop, handleInputFiles } =
    usePasteFiles({ onFiles, enabled: enabled && !busy, single });

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        dragDepth.current = 0;
        setDragging(false);
        handleDrop(e);
      }}
      className={cn(
        'rounded-2xl border-2 border-dashed transition-colors',
        compact ? 'p-3.5' : 'p-5',
        dragging
          ? 'border-[#8B5CF6] bg-[#8B5CF6]/[0.06]'
          : flash
            ? 'border-[#10B981] bg-[#10B981]/[0.08]'
            : 'border-black/10 dark:border-white/10',
        busy && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={!single}
        className="hidden"
        onChange={(e) => {
          handleInputFiles(e.target.files);
          // Reset so re-picking the SAME file fires `change` again.
          e.target.value = '';
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        className="flex w-full flex-col items-center gap-1.5 text-center"
      >
        <Upload
          className={cn('h-5 w-5', flash ? 'text-[#10B981]' : dragging ? 'text-[#8B5CF6]' : TEXT.muted)}
        />
        <span className={cn('text-[12px] font-bold', TEXT.strong)}>
          {title ?? (single ? 'Collez, glissez ou cliquez' : 'Collez, glissez ou cliquez vos fichiers')}
        </span>
        <span className={cn('text-[11px]', TEXT.muted)}>
          {hint ?? 'Ctrl+V pour coller une capture · JPG, PNG, WebP ou PDF · 10 Mo max'}
        </span>
      </button>

      {canPasteButton && (
        <button
          type="button"
          onClick={pasteFromClipboard}
          disabled={isReading}
          className={cn(
            'mx-auto mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition active:scale-95 disabled:opacity-60',
            SURFACE.holder,
          )}
        >
          {isReading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardPaste className="h-3.5 w-3.5" />
          )}
          Coller depuis le presse-papiers
        </button>
      )}
    </div>
  );
}
