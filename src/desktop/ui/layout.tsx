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
import { DS, DT, DFG } from './tokens';
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
      <span className={cn(DT.micro, DFG.faint, 'mr-0.5')}>{label}</span>
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

/**
 * Full-height list surface. `inspector` docks on the right and the list keeps
 * its own scroll — closing the inspector never re-renders or re-fetches it.
 */
export function Workbench({
  head,
  toolbar,
  metrics,
  children,
  inspector,
  className,
}: {
  head?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Optional KPI strip between the head and the toolbar. */
  metrics?: React.ReactNode;
  children: React.ReactNode;
  inspector?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-workbench className={cn('flex h-[calc(100vh-52px)] min-h-0', className)}>
      <div className="flex min-w-0 flex-1 flex-col">
        {(head || metrics || toolbar) && (
          <div className={cn('shrink-0 space-y-3 border-b px-7 pb-3 pt-5', DS.line)}>
            {head}
            {metrics}
            {toolbar}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-4">{children}</div>
      </div>
      {inspector ? (
        <aside className={cn('hidden w-[460px] shrink-0 overflow-y-auto border-l xl:block', DS.line, DS.panel)}>
          {inspector}
        </aside>
      ) : null}
    </div>
  );
}

/* ── Inspector ───────────────────────────────────────────────────────── */

/**
 * The right-hand record panel. Header pinned, body scrolls, actions pinned to
 * the bottom so the primary decision is always one click away regardless of how
 * long the record is.
 */
export function Inspector({
  eyebrow,
  title,
  badge,
  onClose,
  actions,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  badge?: React.ReactNode;
  onClose?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <header className={cn('flex shrink-0 items-start gap-3 border-b px-5 py-4', DS.line)}>
        <div className="min-w-0 flex-1">
          {eyebrow ? <div className="mb-1 flex items-center gap-2">{eyebrow}</div> : null}
          <h3 className={cn('truncate text-[16px] font-extrabold leading-6 tracking-[-0.01em]', DFG.strong)}>{title}</h3>
          {badge ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{badge}</div> : null}
        </div>
        {onClose ? <IconButton icon={X} label="Fermer" onClick={onClose} size="sm" /> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

      {actions ? (
        <footer className={cn('shrink-0 border-t px-5 py-3', DS.line, DS.panel)}>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </footer>
      ) : null}
    </div>
  );
}

/** Titled block inside the inspector. */
export function InspectorSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mb-5 last:mb-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h4 className={cn(DT.micro, DFG.faint)}>{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}
