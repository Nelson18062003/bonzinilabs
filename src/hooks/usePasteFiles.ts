/**
 * Screen-wide "just press Ctrl+V" support for the proof/QR upload zones.
 *
 * The listener is bound to `window`, not to a specific box, on purpose: an
 * admin who has just taken a screenshot should be able to hit Ctrl+V with the
 * cursor anywhere on the page and see the image land. Requiring them to first
 * click a target would reproduce the very friction this replaces.
 *
 * Because it is window-wide, `enabled` is the important prop — only ONE zone
 * per screen may listen at a time (the open drawer, the current wizard step),
 * otherwise a single paste would attach the same screenshot twice.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  filesFromDataTransfer,
  partitionUploadFiles,
  readClipboardFiles,
  rejectionMessage,
  canReadClipboard,
} from '@/lib/clipboardFiles';

interface Options {
  /** Called with the validated files (never empty). */
  onFiles: (files: File[]) => void;
  /**
   * Bind the window listener. Keep exactly one enabled zone per screen —
   * two listeners would attach the same paste twice.
   */
  enabled?: boolean;
  /** Take only the first file (QR code slots, single-proof drawers). */
  single?: boolean;
}

export function usePasteFiles({ onFiles, enabled = true, single = false }: Options) {
  const [isReading, setIsReading] = useState(false);
  // `flash` drives a brief highlight so a paste that lands from across the page
  // is visibly acknowledged — otherwise a successful paste looks like a no-op.
  const [flash, setFlash] = useState(false);

  // Keep the callback in a ref so the window listener is attached once and is
  // not torn down and re-bound on every parent render.
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;
  const singleRef = useRef(single);
  singleRef.current = single;

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerFlash = useCallback(() => {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 700);
  }, []);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  /** Validate, report what was dropped, and hand the rest to the caller. */
  const accept = useCallback(
    (incoming: File[]): boolean => {
      if (incoming.length === 0) return false;

      const { accepted, rejected } = partitionUploadFiles(incoming);
      const problem = rejectionMessage(rejected);
      if (problem) toast.error(problem);
      if (accepted.length === 0) return false;

      const files = singleRef.current ? accepted.slice(0, 1) : accepted;
      onFilesRef.current(files);
      triggerFlash();
      toast.success(
        files.length === 1 ? 'Image collée' : `${files.length} fichiers collés`,
      );
      return true;
    },
    [triggerFlash],
  );

  // ── Ctrl+V / right-click ▸ Coller, anywhere on the screen ────────────────
  useEffect(() => {
    if (!enabled) return;

    const handlePaste = (event: ClipboardEvent) => {
      const files = filesFromDataTransfer(event.clipboardData);
      // No files on the clipboard means this is an ordinary text paste — leave
      // it strictly alone so typing into the comment/amount fields still works.
      if (files.length === 0) return;

      event.preventDefault();
      accept(files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [enabled, accept]);

  /** Backs the "Coller" button — the only route on touch devices. */
  const pasteFromClipboard = useCallback(async () => {
    setIsReading(true);
    try {
      const result = await readClipboardFiles();
      if (result.ok) {
        accept(result.files);
        return;
      }
      if (result.reason === 'empty') {
        toast.error("Le presse-papiers ne contient pas d'image.");
      } else if (result.reason === 'unsupported') {
        toast.error('Ce navigateur ne permet pas la lecture du presse-papiers — utilisez Ctrl+V.');
      } else {
        toast.error('Accès au presse-papiers refusé — utilisez Ctrl+V ou choisissez un fichier.');
      }
    } finally {
      setIsReading(false);
    }
  }, [accept]);

  /** Drop handler for the visible zone — same validation as paste. */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      const files = filesFromDataTransfer(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      accept(files);
    },
    [accept],
  );

  /** Shared by the file `<input>`: same validation, same feedback path. */
  const handleInputFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const incoming = Array.from(list);
      const { accepted, rejected } = partitionUploadFiles(incoming);
      const problem = rejectionMessage(rejected);
      if (problem) toast.error(problem);
      if (accepted.length === 0) return;
      onFilesRef.current(singleRef.current ? accepted.slice(0, 1) : accepted);
    },
    [],
  );

  return {
    /** Read the clipboard on demand (button). */
    pasteFromClipboard,
    /** `true` while the async clipboard read is in flight. */
    isReading,
    /** `true` for ~700 ms after a successful paste — drives the zone highlight. */
    flash,
    /** Whether to render the "Coller" button at all. */
    canPasteButton: canReadClipboard(),
    handleDrop,
    handleInputFiles,
  };
}
