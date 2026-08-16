/**
 * The record panel, beside the queue — replacement for `MasterDetailLayout`.
 *
 * The old layout pinned the detail to `w-[min(460px,40vw)]` and dropped the
 * MOBILE detail screen into it. That is where the cramped fiche paiement comes
 * from: 460px is a phone, so amount, beneficiary, proofs and actions stack into
 * one scrolling column on a monitor with room for all of them at once.
 *
 * Three things change here:
 *   • width comes from the tier (480 / 560 / 680) and is drag-resizable,
 *   • the operator's chosen width persists, because they will set it once,
 *   • below `wide` the panel overlays instead of squeezing the queue under its
 *     legible minimum — a 620px queue with a 560px panel is two bad columns
 *     rather than one good one.
 *
 * It is a layout shell only. What goes inside is each module's own desktop
 * detail component; nothing here knows about payments or deposits.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { LAYOUT, inspectorFits } from './tokens';
import { useTier } from './useTier';
import { useShortcuts } from './shortcuts';

const STORAGE_KEY = 'bonzini-inspector-width';
const MIN_WIDTH = 420;
const MAX_WIDTH = 900;

interface Props {
  /** The queue. Always rendered. */
  children: React.ReactNode;
  /** The record. `null` closes the panel and gives the queue full width. */
  detail?: React.ReactNode | null;
  onClose?: () => void;
  title?: React.ReactNode;
}

export function Inspector({ children, detail, onClose, title }: Props) {
  const { tier, viewportWidth } = useTier();
  const [stored, setStored] = useState<number | null>(() => {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  });

  const width = clamp(stored ?? LAYOUT.inspectorWidth[tier], MIN_WIDTH, MAX_WIDTH);
  const railWidth = tier === 'compact' ? LAYOUT.railWidthCollapsed : LAYOUT.railWidth;
  const docked = inspectorFits(viewportWidth, tier, railWidth);

  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      dragging.current = true;
      startX.current = event.clientX;
      startWidth.current = width;
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!dragging.current) return;
    // Panel is on the right, so dragging LEFT grows it.
    setStored(clamp(startWidth.current - (event.clientX - startX.current), MIN_WIDTH, MAX_WIDTH));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Persist only when the drag ends, not on every pointermove.
  useEffect(() => {
    if (stored == null) return;
    const id = setTimeout(() => window.localStorage.setItem(STORAGE_KEY, String(stored)), 250);
    return () => clearTimeout(id);
  }, [stored]);

  useShortcuts(
    [{ key: 'Escape', description: 'Fermer la fiche', handler: () => onClose?.() }],
    !!detail && !!onClose,
  );

  if (!detail) return <>{children}</>;

  const panel = (
    <div className={cn('flex h-full min-h-0 flex-col', SURFACE.card)}>
      {(title || onClose) && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
          <div className={cn('min-w-0 truncate text-[13px] font-bold', TEXT.strong)}>{title}</div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer la fiche"
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:bg-black/[0.05] dark:hover:bg-white/[0.06]',
                TEXT.muted,
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">{detail}</div>
    </div>
  );

  // ── Overlay mode: not enough room to dock without crushing the queue ──────
  if (!docked) {
    return (
      <>
        {children}
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={cn(
            'fixed bottom-0 right-0 z-50 shadow-[0_8px_40px_-8px_rgba(46,32,92,0.35)]',
            SURFACE.card,
          )}
          style={{ width, top: LAYOUT.topbarHeight }}
          aria-label="Fiche"
        >
          <Grip onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          {panel}
        </aside>
      </>
    );
  }

  // ── Docked mode ───────────────────────────────────────────────────────────
  return (
    <div className="flex gap-5">
      <div className="min-w-0 flex-1">{children}</div>
      <aside
        className="relative shrink-0"
        style={{ width }}
        aria-label="Fiche"
      >
        <div
          className={cn(
            'sticky overflow-hidden rounded-[20px]',
            'shadow-[0_8px_30px_-12px_rgba(46,32,92,0.20)] ring-1 ring-black/[0.05]',
            'dark:shadow-none dark:ring-white/[0.06]',
          )}
          style={{
            top: LAYOUT.topbarHeight + 16,
            height: `calc(100vh - ${LAYOUT.topbarHeight + 40}px)`,
          }}
        >
          <Grip onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} />
          {panel}
        </div>
      </aside>
    </div>
  );
}

/** The drag handle on the panel's left edge. */
function Grip({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionner la fiche"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-col-resize transition-colors hover:bg-[#6B5BD2]/30"
    />
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
