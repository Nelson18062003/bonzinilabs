/**
 * Anchored transient surfaces — the console's answer to "too many buttons".
 *
 * The density audit found toolbars carrying 18 to 21 controls where seven is
 * workable, and headers carrying four buttons where the two least-used were
 * also the two widest. Nothing there is a capability worth removing; it is a
 * *hierarchy* problem. These two components are how the rarely-used half gets
 * folded away without being lost:
 *
 *   · `FilterPopover` — one trigger that reports how many filters are active,
 *     opening onto the axes an operator touches once a day (method, period).
 *   · `MenuButton`    — one overflow trigger for the actions a screen offers
 *     but nobody starts their day with (refresh, export).
 *
 * Both are built on `Anchored`, which handles the four things a popover has to
 * get right and is easy to get wrong: it flips instead of overflowing the
 * viewport, closes on Escape and on outside pointerdown, returns focus to the
 * trigger, and keeps `aria-expanded` truthful.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, MoreHorizontal, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS, DACCENT, DBADGE, CONTROL } from './tokens';
import { Button, IconButton, useControl, StepScope, type ButtonProps } from './primitives';

/* ── Anchored surface ────────────────────────────────────────────────── */

type Align = 'start' | 'end';

interface AnchoredProps {
  /** Renders the trigger. `props` must be spread onto a focusable element. */
  trigger: (props: {
    ref: React.Ref<HTMLButtonElement>;
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'dialog' | 'menu';
    open: boolean;
  }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  /** Which edge of the trigger the panel lines up with. */
  align?: Align;
  role?: 'dialog' | 'menu';
  label: string;
  width?: number;
}

export function Anchored({ trigger, children, align = 'start', role = 'dialog', label, width = 280 }: AnchoredProps) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Position against the trigger, flipping when the panel would leave the
     viewport. Recomputed on scroll/resize because the toolbar can scroll. */
  React.useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const gutter = 8;
      const left = align === 'end' ? r.right - width : r.left;
      const maxLeft = window.innerWidth - width - gutter;
      const panelH = panelRef.current?.offsetHeight ?? 0;
      const below = r.bottom + 6;
      // Flip above only if there is genuinely more room there.
      const flip = below + panelH > window.innerHeight - gutter && r.top - panelH - 6 > gutter;
      setPos({ top: flip ? r.top - panelH - 6 : below, left: Math.max(gutter, Math.min(left, maxLeft)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, align, width]);

  /* Escape closes; outside pointerdown closes. `pointerdown` rather than
     `click` so dragging out of the panel does not dismiss it. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, close]);

  /* Move focus into the panel so keyboard users are not stranded behind it. */
  React.useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
    first?.focus();
  }, [open, pos]);

  return (
    <>
      {trigger({ ref: triggerRef, onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': role, open })}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              role={role}
              aria-label={label}
              style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
              className={cn('z-50 rounded-xl border p-2', DS.panel, DS.line, DS.float)}
            >
              {children(close)}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── Filter popover ──────────────────────────────────────────────────── */

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Rendered right-aligned — a count, a hint. */
  meta?: React.ReactNode;
  /** Greyed out and unselectable; use for an axis value with no rows. */
  disabled?: boolean;
}

export interface FilterAxis<T extends string = string> {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
  /** The value that means "no filter on this axis". Defaults to the first. */
  neutral?: T;
}

/** One selectable line inside the popover. */
function OptionRow({
  selected,
  disabled,
  label,
  meta,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  label: string;
  meta?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-lg px-2 text-[12px] transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        selected ? cn(DACCENT.soft, 'font-semibold') : cn(DFG.base, DS.hover),
        DFOCUS,
      )}
    >
      <Check className={cn('h-3.5 w-3.5 shrink-0', selected ? 'opacity-100' : 'opacity-0')} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {meta != null ? <span className={cn(DT.label, DFG.faint, 'shrink-0 tabular-nums')}>{meta}</span> : null}
    </button>
  );
}

/**
 * The single filter entry point for a workbench toolbar.
 *
 * The trigger states how many axes are narrowed, so the operator never has to
 * open it to find out whether a filter is hiding rows — the failure mode that
 * makes a "why is this list empty?" support ticket.
 */
export function FilterPopover({
  axes,
  extra,
  onClear,
  clearable,
  label = 'Filtres',
}: {
  axes: FilterAxis<string>[];
  /** Rendered under the axes — date range inputs, for instance. */
  extra?: React.ReactNode;
  /** Resets every axis *and* whatever `clearable` refers to. */
  onClear?: () => void;
  /**
   * True when something outside these axes is narrowing the list — a search
   * term, a status chip left in the toolbar.
   *
   * Without it the clear action only appeared once one of *these* axes was
   * off-neutral, so a screen filtered by search alone had no single reset at
   * all. The badge on the trigger still counts only the axes it owns, because
   * that is what the operator is about to open.
   */
  clearable?: boolean;
  label?: string;
}) {
  const c = useControl();
  const activeCount = axes.filter((a) => a.value !== (a.neutral ?? a.options[0]?.value)).length;
  const showClear = activeCount > 0 || !!clearable;

  return (
    <Anchored
      align="start"
      label={label}
      width={288}
      trigger={({ ref, onClick, open, ...aria }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          {...aria}
          className={cn(
            'inline-flex shrink-0 items-center font-semibold transition-colors',
            c.box,
            activeCount > 0 || open
              ? 'bg-[#1A1725] text-white dark:bg-[#F1F0F6] dark:text-[#15131F]'
              : cn('border', DS.line, DFG.base, DS.hover),
            DFOCUS,
          )}
        >
          <SlidersHorizontal className={c.glyph} aria-hidden />
          {label}
          {activeCount > 0 ? (
            <span className={cn('rounded px-1 text-[12px] font-bold leading-4 tabular-nums', 'bg-white/20 dark:bg-black/15')}>
              {activeCount}
            </span>
          ) : (
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
          )}
        </button>
      )}
    >
      {() => (
        <div className="space-y-2">
          {axes.map((axis) => (
            <div key={axis.id}>
              <p className={cn(DT.micro, DFG.faint, 'px-2 pb-1 pt-1')}>{axis.label}</p>
              <div role="group" aria-label={axis.label}>
                {axis.options.map((o) => (
                  <OptionRow
                    key={o.value}
                    label={o.label}
                    meta={o.meta}
                    disabled={o.disabled}
                    selected={axis.value === o.value}
                    onSelect={() => axis.onChange(o.value)}
                  />
                ))}
              </div>
            </div>
          ))}

          {extra ? (
            <div className={cn('border-t pt-2', DS.line)}>
              <StepScope step="toolbar">{extra}</StepScope>
            </div>
          ) : null}

          {onClear && showClear ? (
            <div className={cn('border-t pt-2', DS.line)}>
              <Button step="toolbar" variant="ghost" icon={X} onClick={onClear} className="w-full justify-start">
                Effacer les filtres
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </Anchored>
  );
}

/* ── Overflow menu ───────────────────────────────────────────────────── */

export interface MenuItem {
  label: string;
  icon?: React.ElementType;
  onSelect: () => void;
  disabled?: boolean;
  /** Explains a disabled item — the reason belongs next to the control. */
  hint?: string;
  danger?: boolean;
}

/**
 * The "…" that lets a screen head keep to three visible actions.
 *
 * Items carry `hint` so a disabled action can say *why* it is disabled at the
 * point of use, instead of leaving the operator to guess.
 */
export function MenuButton({
  items,
  label = 'Plus d’actions',
  align = 'end',
  step,
}: {
  items: MenuItem[];
  label?: string;
  align?: Align;
} & Pick<ButtonProps, 'step'>) {
  return (
    <Anchored
      align={align}
      role="menu"
      label={label}
      width={224}
      trigger={({ ref, onClick, open, ...aria }) => (
        <IconButton
          ref={ref}
          step={step}
          icon={MoreHorizontal}
          label={label}
          variant={open ? 'secondary' : 'ghost'}
          onClick={onClick}
          {...aria}
        />
      )}
    >
      {(close) => (
        <div className="space-y-1">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.disabled ? item.hint : undefined}
              onClick={() => { item.onSelect(); close(); }}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-medium transition-colors',
                'disabled:pointer-events-none disabled:opacity-40',
                item.danger ? 'text-[#C0504D] hover:bg-[#C0504D]/10 dark:text-[#E79A9A]' : cn(DFG.base, DS.hover),
                DFOCUS,
              )}
            >
              {item.icon ? <item.icon className={CONTROL.page.glyph} aria-hidden /> : null}
              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </Anchored>
  );
}

/** Re-exported so screens import their popover vocabulary from one place. */
export { DBADGE };
