import { ReactNode } from 'react';
import { SURFACE } from '@/mobile/designKit';
import { cn } from '@/lib/utils';
import { LAYOUT, useTier } from '@/desktop/kit';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopTopbar } from './DesktopTopbar';

/**
 * Workbench shell: navigation rail, sticky topbar, and a content region sized
 * to the tier rather than to one hard-coded number.
 *
 * The previous version capped every screen at 1400px. With the 256px rail that
 * left roughly 900px unused on a 2560px monitor — while the fiche paiement
 * inside it scrolled in a 460px column. Now:
 *
 *   compact  (1024–1439)  1280px cap — laptops; a wider measure just wraps badly
 *   standard (1440–1919)  1720px cap
 *   wide     (1920+)      no cap — the workbench uses the monitor
 *
 * `wide` is uncapped on purpose. A queue is a table: more width means more
 * columns and fewer truncated client names, which is the opposite of prose,
 * where an unbounded measure hurts. Screens that ARE prose (settings, a single
 * form) opt into a narrower measure themselves via `narrow`.
 */
export function DesktopAppShell({
  children,
  narrow = false,
}: {
  children: ReactNode;
  /** Constrain to a readable measure — for form and settings screens. */
  narrow?: boolean;
}) {
  const { tier } = useTier();
  const cap = LAYOUT.contentMax[tier];

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <DesktopSidebar />
      <div style={{ paddingLeft: LAYOUT.railWidth }}>
        <DesktopTopbar />
        <main
          className="mx-auto px-8 py-7"
          style={{ maxWidth: narrow ? 760 : (cap ?? undefined) }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
