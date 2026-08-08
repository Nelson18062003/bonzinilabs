/**
 * Screen-level layout pieces for the desktop console.
 *
 * The console has exactly two screen shapes:
 *
 *   1. `Workspace`  — a scrolling page (dashboards, forms, settings).
 *   2. `Workbench`  — a list that fills the viewport with an optional inspector
 *                     docked on the right. This is where operators live: the
 *                     list never unmounts when a record is opened, so they keep
 *                     their scroll position, their filters and their place in
 *                     the queue.
 *
 * Both share `ScreenHead` (title + actions) and `Toolbar` (filters), which is
 * what makes eleven different modules feel like one application.
 */
import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, LAYOUT } from './tokens';
import { IconButton } from './primitives';

/* ── Screen head ─────────────────────────────────────────────────────── */

export function ScreenHead({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className={cn(DT.display, DFG.strong)}>{title}</h2>
        {subtitle ? <p className={cn(DT.label, DFG.muted, 'mt-1')}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Filter strip. Left = the filters, right = view controls (density, export…). */
export function Toolbar({
  children,
  trailing,
  className,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
      {trailing ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
    </div>
  );
}

/** A labelled cluster of filters inside the toolbar. */
export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn(DT.micro, DFG.muted, 'mr-0.5')}>{label}</span>
      {children}
    </div>
  );
}

/* ── Workspace (scrolling page) ──────────────────────────────────────── */

export function Workspace({
  head,
  children,
  width = 'wide',
  className,
}: {
  head?: React.ReactNode;
  children: React.ReactNode;
  /** `wide` for dashboards, `narrow` for forms and settings. */
  width?: 'wide' | 'narrow';
  className?: string;
}) {
  return (
    <div className={cn('mx-auto', width === 'narrow' ? 'max-w-3xl' : 'max-w-[1560px]', className)}>
      {head ? <div className="mb-5">{head}</div> : null}
      {children}
    </div>
  );
}

/* ── Workbench (list + inspector) ────────────────────────────────────── */

/** Is the viewport wide enough to dock the inspector beside the list? */
function useDockedInspector() {
  const query = `(min-width: ${LAYOUT.inspectorDockAt}px)`;
  const [docked, setDocked] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setDocked(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return docked;
}

/**
 * Full-height list surface. `inspector` docks on the right and the list keeps
 * its own scroll — closing the inspector never re-renders or re-fetches it.
 *
 * The desktop shell mounts from 1024px but a docked 460px panel only fits from
 * 1280px. Rather than hiding the inspector in that band — which turned every
 * row click into a silent dead end — it becomes an overlay drawer there.
 */
export function Workbench({
  head,
  toolbar,
  metrics,
  children,
  inspector,
  onCloseInspector,
  className,
}: {
  head?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Optional KPI strip between the head and the toolbar. */
  metrics?: React.ReactNode;
  children: React.ReactNode;
  inspector?: React.ReactNode;
  /** Called when the operator dismisses the overlay inspector. */
  onCloseInspector?: () => void;
  className?: string;
}) {
  const docked = useDockedInspector();
  const overlay = !!inspector && !docked;

  /* Escape closes the overlay, like every other transient surface here. */
  React.useEffect(() => {
    if (!overlay || !onCloseInspector) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseInspector(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, onCloseInspector]);

  return (
    <div
      data-workbench
      style={{ height: `calc(100dvh - ${LAYOUT.topbar}px)` }}
      className={cn('relative flex min-h-0', className)}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {(head || metrics || toolbar) && (
          <div className={cn('shrink-0 space-y-3 border-b px-7 pb-3 pt-5', DS.line)}>
            {head}
            {metrics}
            {toolbar}
          </div>
        )}
        {/* The list owns its own scroll (see DataTable), so this stays clipped. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 py-4">{children}</div>
      </div>

      {inspector && docked ? (
        <aside
          aria-label="Détail de l'enregistrement"
          style={{ width: LAYOUT.inspector }}
          className={cn('shrink-0 overflow-y-auto border-l', DS.line, DS.panel)}
        >
          {inspector}
        </aside>
      ) : null}

      {overlay ? (
        <>
          <div className="absolute inset-0 z-20 bg-[#0B0A12]/40 dark:bg-black/60" onClick={onCloseInspector} aria-hidden />
          <aside
            aria-label="Détail de l'enregistrement"
            className={cn('absolute inset-y-0 right-0 z-30 w-[min(460px,92vw)] overflow-y-auto border-l', DS.line, DS.panel, DS.float)}
          >
            {onCloseInspector ? (
              <div className={cn('sticky top-0 z-10 flex justify-end border-b px-3 py-2', DS.line, DS.panel)}>
                <IconButton icon={X} label="Fermer le détail" onClick={onCloseInspector} size="sm" />
              </div>
            ) : null}
            {inspector}
          </aside>
        </>
      ) : null}
    </div>
  );
}
