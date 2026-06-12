import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Viewport-locked app-shell. Implements the "fixed frame" contract documented
 * in docs/audit-fondation-mobile-assistant.md (R1→R3):
 *
 *   • R1 — the document never scrolls: while a shell is mounted, the page is
 *     locked (`html.viewport-locked`, see index.css). Only the middle zone
 *     scrolls.
 *   • R2 — the shell is anchored to the VISIBLE viewport via the --vvh / --vvt
 *     CSS vars (set once by useVisibleViewportSync), so it follows the
 *     on-screen keyboard on iOS and Android.
 *   • R3 — three invariant zones: fixed header / scrollable middle / fixed
 *     footer (composer).
 *
 * `position: fixed` makes the shell escape any `min-h-screen` parent, which is
 * what fixes the nesting bug without touching the router.
 *
 * Use for chat (Assistant, Support) and any "owns the screen" surface. Other
 * screens stay document-scroll (`min-h-[100dvh]`).
 */
export interface ViewportShellProps {
  /** Fixed top zone (header). Does not scroll. */
  header?: React.ReactNode;
  /** Fixed bottom zone (composer / action bar). Does not scroll. */
  footer?: React.ReactNode;
  /** Scrollable middle zone. */
  children: React.ReactNode;
  /** Extra classes on the outer fixed shell. */
  className?: string;
  /** Extra classes on the scrollable middle zone. */
  scrollClassName?: string;
  /** Ref to the scrollable middle zone (e.g. to keep it pinned to the bottom). */
  scrollRef?: React.Ref<HTMLDivElement>;
}

// Ref-counted so nested/overlapping shells never unlock the document early.
let lockCount = 0;
function lockDocument() {
  if (typeof document === 'undefined') return;
  lockCount += 1;
  document.documentElement.classList.add('viewport-locked');
}
function unlockDocument() {
  if (typeof document === 'undefined') return;
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.documentElement.classList.remove('viewport-locked');
}

export const ViewportShell = React.forwardRef<HTMLDivElement, ViewportShellProps>(
  function ViewportShell(
    { header, footer, children, className, scrollClassName, scrollRef },
    ref,
  ) {
    React.useEffect(() => {
      lockDocument();
      return unlockDocument;
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          'fixed left-0 right-0 z-30 flex flex-col overflow-hidden bg-background',
          className,
        )}
        style={{
          top: 'var(--vvt, 0px)',
          height: 'var(--vvh, 100dvh)',
        }}
      >
        {header != null && <div className="shrink-0">{header}</div>}
        <div
          ref={scrollRef}
          className={cn('flex-1 overflow-y-auto overscroll-contain', scrollClassName)}
        >
          {children}
        </div>
        {footer != null && <div className="shrink-0">{footer}</div>}
      </div>
    );
  },
);
