/**
 * DESKTOP primitives — the small vocabulary every console screen is built from.
 *
 * Deliberately tiny: a Panel, a Button, a Chip, a Field, a Metric, a Badge, an
 * EmptyState. If a screen needs something else it composes these rather than
 * inventing a new card shape — that is what keeps eleven modules looking like
 * one product.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * HOW SIZING WORKS HERE — read before adding a prop
 *
 * No primitive below writes `h-…`, `px-…`, `rounded-…` or `text-[…px]` on a
 * control by hand. Each one asks `CONTROL[step]` (see `./tokens`) for the
 * whole geometry at once, so height, padding, radius, font size, icon size
 * and internal gap can never disagree.
 *
 * And the step itself is *inherited from where the control sits*, not passed
 * at the call site:
 *
 *     <Toolbar>   → step "toolbar" (28px)   filters, search, view controls
 *     <ScreenHead actions> → step "page" (32px)  the actions that start a task
 *     table row   → step "inline" (24px)    row actions
 *
 * This is the fix for the defect that motivated the rewrite: a 32px search
 * input rendered next to a 28px filter chip on the same row, five times over,
 * because each call site picked its own size. A control can no longer pick.
 * `step` remains available as an explicit override for the rare case where a
 * control genuinely sits outside a container — use it knowingly.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Status colour is NOT defined here: tones come from `@/mobile/designKit`
 * (`TONE_PILL`, `depositStatusTone`, …) so mobile and desktop always agree on
 * what "validé" looks like.
 */
import * as React from 'react';
import { Loader2, Search, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_PILL, TONE_HOLDER, type Tone } from '@/mobile/designKit';
import { DS, DT, DFG, DACCENT, DFOCUS, CONTROL, type StepName } from './tokens';

/* ── The step context ────────────────────────────────────────────────── */

const StepContext = React.createContext<StepName>('page');

/**
 * Declares the control step for everything inside. `Toolbar`, `ScreenHead`
 * and `DataTable` mount one; screens should not need to.
 */
export function StepScope({ step, children }: { step: StepName; children: React.ReactNode }) {
  return <StepContext.Provider value={step}>{children}</StepContext.Provider>;
}

/** The geometry a control should draw itself with, unless told otherwise. */
export function useControl(override?: StepName) {
  const inherited = React.useContext(StepContext);
  return CONTROL[override ?? inherited];
}

/** Every sizeable primitive accepts the same escape hatch, and only this one. */
interface Steppable {
  /** Overrides the step inherited from the surrounding container. */
  step?: StepName;
}

/* ── Panel ───────────────────────────────────────────────────────────── */

/** The one card shape of the console: white, hairline, 12px radius, no shadow. */
export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-xl border', DS.card, DS.line, className)} {...rest}>
      {children}
    </div>
  );
}

/**
 * Panel header: title on the left, actions on the right, hairline underneath.
 *
 * Fixed at 44px so sibling panels on one page keep a common header baseline —
 * previously a panel with a button was 52px and its neighbour without one was
 * 44px, which read as two different card types. Actions are `inline` step so
 * they fit inside that 44px without pushing it.
 */
export function PanelHead({
  title,
  hint,
  actions,
  className,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 border-b px-4', hint ? 'py-3' : 'h-11', DS.line, className)}>
      <div className="min-w-0 flex-1">
        <h3 className={cn(DT.title, DFG.strong, 'truncate')}>{title}</h3>
        {hint ? <p className={cn(DT.label, DFG.muted, 'truncate font-normal')}>{hint}</p> : null}
      </div>
      {actions ? (
        <StepScope step="inline">
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        </StepScope>
      ) : null}
    </div>
  );
}

/* ── Button ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Pressed feedback, shared by every clickable primitive. */
const PRESSED = 'active:brightness-95 active:transition-none dark:active:brightness-110';

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1A1725] text-white hover:bg-[#2A2637] dark:bg-[#F1F0F6] dark:text-[#15131F] dark:hover:bg-white',
  secondary: cn('border bg-white text-[#15131F] hover:bg-[#1C1836]/[0.04]', DS.line,
    'dark:bg-[#1B1A24] dark:text-[#F3F2F8] dark:hover:bg-white/[0.07]'),
  ghost: cn('text-[#3B3750] dark:text-[#C9C6D6]', DS.hover),
  danger: 'bg-[#C0504D] text-white hover:bg-[#A94340] dark:bg-[#B04A47] dark:hover:bg-[#C45B58]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, Steppable {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', step, icon: Icon, loading, className, children, disabled, ...rest },
  ref,
) {
  const c = useControl(step);
  return (
    <button
      ref={ref}
      // Explicit: an omitted `type` inside a <form> defaults to "submit".
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        c.box,
        BTN_VARIANT[variant],
        PRESSED,
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className={cn(c.glyph, 'animate-spin motion-reduce:animate-none')} />
      ) : Icon ? (
        <Icon className={c.glyph} />
      ) : null}
      {children}
    </button>
  );
});

/** Square icon-only button — toolbars, table row actions, topbar. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'children'> & { label: string }
>(function IconButton(
  { icon: Icon, label, variant = 'ghost', step, loading, disabled, className, ...rest },
  ref,
) {
  const c = useControl(step);
  return (
    <button
      ref={ref}
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        c.square,
        BTN_VARIANT[variant],
        PRESSED,
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className={cn(c.glyph, 'animate-spin motion-reduce:animate-none')} /> : Icon ? <Icon className={c.glyph} /> : null}
    </button>
  );
});

/* ── Chip (filters) ──────────────────────────────────────────────────── */

export function Chip({
  active,
  count,
  step,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & Steppable & { active?: boolean; count?: number | null }) {
  const c = useControl(step);
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        c.box,
        PRESSED,
        active
          ? 'bg-[#1A1725] text-white dark:bg-[#F1F0F6] dark:text-[#15131F]'
          : cn('border', DS.line, DFG.base, DS.hover),
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {children}
      {/* `count != null`, not `count > 0`. A bucket that genuinely holds zero
          and a bucket whose counters have not loaded are different facts, and
          on a financial queue the operator must be able to tell them apart —
          omitting the badge for both made them identical. Pass `null` while
          the count is unknown; pass `0` when it is known to be empty. */}
      {count != null ? (
        <span
          className={cn(
            'rounded px-1 text-[12px] font-bold leading-4 tabular-nums',
            active ? 'bg-white/20 dark:bg-black/15' : 'bg-[#1C1836]/[0.07] dark:bg-white/[0.09]',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Segmented control — mutually exclusive options that share one track.
 *
 * The track is exactly the step height and the inner buttons sit 4px inside
 * it, so a `Segment` and a `Chip` on the same row have identical outer edges.
 */
export function Segment<T extends string>({
  value,
  onChange,
  options,
  step,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
} & Steppable) {
  const c = useControl(step);
  // The track is one grid unit taller than its buttons: 4px of inset, 2px per
  // side, which keeps the outer edge exactly on the step so a Segment and a
  // Chip on the same toolbar row share a silhouette.
  const inner = c.h - 4;
  return (
    <div
      style={{ height: c.h, padding: 2 }}
      className={cn('inline-flex items-center gap-1 rounded-md', DS.well, className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          style={{ height: inner }}
          className={cn(
            'rounded px-2 text-[12px] font-semibold transition-colors',
            value === o.value
              ? cn('border bg-white dark:bg-[#22212C]', DS.line, DFG.strong)
              : cn(DFG.muted, 'hover:text-[#15131F] dark:hover:text-[#F3F2F8]'),
            DFOCUS,
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Badges & references ─────────────────────────────────────────────── */

/**
 * Semantic status badge — the tone comes from the shared design kit.
 *
 * 20px tall: one grid step below the smallest control, so a badge inside a
 * 24px table cell action row never sets the row height. The console shipped
 * four different badge heights (21 / 20 / 17 / 16); this is the only one.
 */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold leading-4',
        // `TONE_PILL.neutral` resolves to the shadcn CSS variables, which sit
        // outside this token system — keep neutral inside it.
        tone === 'neutral' ? cn(DS.well, DFG.base) : TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small numeric count — nav items, tabs, the bell. The one count shape. */
export function Count({ value, className }: { value: number | string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[12px] font-bold leading-4 tabular-nums',
        className,
      )}
    >
      {value}
    </span>
  );
}

/** A copyable business reference (BZ-DP-…): monospace on a recessed chip. */
export function Ref({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 items-center rounded px-1 font-bold', DT.mono, DS.well, DFG.base, className)}>
      {children}
    </span>
  );
}

/**
 * Tinted round holder for an icon or initials.
 *
 * Decorative holders use a strict 0.5 glyph ratio — unlike label-bearing
 * controls, where the icon is sized to the cap height of the text beside it.
 */
export function Holder({
  icon: Icon,
  tone,
  size = 'md',
  children,
  className,
}: {
  icon?: React.ElementType;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
}) {
  const box = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const glyph = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg',
        box,
        tone && tone !== 'neutral' ? TONE_HOLDER[tone] : DS.holder,
        className,
      )}
    >
      {Icon ? <Icon className={glyph} /> : children}
    </span>
  );
}

/** Initials avatar — deterministic, no colour randomness. */
export function Avatar({ name, size = 'md', src, className }: { name?: string | null; size?: 'sm' | 'md'; src?: string | null; className?: string }) {
  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
  // Both steps land on the control ladder (24 / 28) so an avatar can sit in a
  // row of controls without changing its height.
  const box = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  return src ? (
    <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', box, className)} />
  ) : (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full text-[12px] font-bold leading-4', box, DS.holder, className)}>
      {initials}
    </span>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────── */

/**
 * A money/quantity figure. Always tabular so columns align.
 *
 * The four sizes are the four type steps that carry numbers — 12, 13, 20, 28.
 * There is no 19px or 26px figure any more: those were off the scale and made
 * a KPI value and a screen title look *almost* the same size, which is worse
 * than making them either equal or clearly different.
 */
export function Figure({
  value,
  unit,
  size = 'md',
  tone,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  /** sm 12 · md 13 · lg 20 (KPI) · hero 28 (the one big number on a screen) */
  size?: 'sm' | 'md' | 'lg' | 'hero';
  tone?: 'positive' | 'negative';
  className?: string;
}) {
  const scale =
    size === 'hero' ? 'text-[28px] leading-8 font-extrabold tracking-[-0.022em]'
    : size === 'lg' ? 'text-[20px] leading-7 font-extrabold tracking-[-0.018em]'
    : size === 'sm' ? 'text-[12px] leading-4 font-semibold'
    : 'text-[13px] leading-5 font-bold';
  return (
    <span
      className={cn(
        'tabular-nums',
        scale,
        tone === 'positive' ? 'text-[#2E7D52] dark:text-[#7FCBA0]'
        : tone === 'negative' ? 'text-[#C0504D] dark:text-[#E79A9A]'
        : DFG.strong,
        className,
      )}
    >
      {value}
      {unit ? <span className={cn('ml-1 text-[12px] font-semibold', DFG.faint)}>{unit}</span> : null}
    </span>
  );
}

/** KPI tile. `onClick` turns it into a filter shortcut. */
export function Metric({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone,
  active,
  onClick,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-pressed': !!active } : {})}
      className={cn(
        'rounded-xl border p-3 text-left transition-colors',
        DS.card,
        active ? cn(DACCENT.border, 'ring-1 ring-[#6B5BD2]/30 dark:ring-[#A99BF0]/40') : DS.line,
        onClick && !active && DS.hover,
        onClick && DFOCUS,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Holder icon={Icon} tone={tone} size="sm" /> : null}
        <span className={cn(DT.label, DFG.muted, 'truncate font-medium')}>{label}</span>
      </div>
      <span className="mt-2 block">
        <Figure value={value} unit={unit} size="lg" />
      </span>
      {hint ? <span className={cn('mt-1 block truncate', DT.label, DFG.muted, 'font-normal')}>{hint}</span> : null}
    </Tag>
  );
}

/* ── Forms ───────────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block', className)}>
      <span className={cn(DT.label, DFG.base, 'mb-1 flex items-center gap-1 font-semibold')}>
        {label}
        {required ? <span className="text-[#C0504D]">*</span> : null}
      </span>
      {children}
      {hint ? <span className={cn('mt-1 block text-[12px] leading-4', DFG.faint)}>{hint}</span> : null}
    </label>
  );
}

/** Shared skin for `<input>` and `<select>` — geometry comes from the step. */
export const FIELD_SKIN = cn(
  'w-full border bg-white transition-colors dark:bg-[#1B1A24]',
  'disabled:cursor-not-allowed disabled:opacity-45',
  // Money entry: an invalid field has to look invalid, not just fail on submit.
  'aria-[invalid=true]:border-[#C0504D] aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-[#C0504D]/30',
  'placeholder:text-[#767187] dark:placeholder:text-[#8B8799]',
  DS.line,
  DFG.strong,
  DFOCUS,
);

/**
 * @deprecated Prefer `<Input>`, which picks up the step from its container.
 * Kept for the few places that style a raw `<input>` themselves.
 */
export const inputClass = cn(FIELD_SKIN, CONTROL.page.box, 'gap-0');

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & Steppable>(
  function Input({ className, step, ...rest }, ref) {
    const c = useControl(step);
    // The iOS auto-zoom rule that forbids raw <input> applies to the mobile app;
    // this component only ever mounts inside the desktop shell (>= lg), where
    // this density is intended and Safari-iOS zoom cannot occur.
    // eslint-disable-next-line no-restricted-syntax
    return <input ref={ref} className={cn(FIELD_SKIN, c.box, 'gap-0', className)} {...rest} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & Steppable>(
  function Select({ className, step, children, ...rest }, ref) {
    const c = useControl(step);
    return (
      <select ref={ref} className={cn(FIELD_SKIN, c.box, 'gap-0 pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

/**
 * The console's search field. One component, one width, one height —
 * previously each screen wrote its own (`w-64` on three screens, `w-72` on
 * two) and set it 4px taller than the filters beside it.
 */
export const SearchField = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & Steppable & { width?: number }
>(function SearchField({ className, step, width = 256, ...rest }, ref) {
  const c = useControl(step);
  return (
    <div className="relative shrink-0" style={{ width }}>
      <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2', c.glyph, DFG.faint)} />
      {/* eslint-disable-next-line no-restricted-syntax */}
      <input
        ref={ref}
        type="search"
        className={cn(FIELD_SKIN, c.box, 'gap-0 pl-8', className)}
        {...rest}
      />
    </div>
  );
});

/* ── States ──────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {Icon ? <Holder icon={Icon} size="lg" /> : null}
      <p className={cn(DT.title, DFG.base, 'mt-3')}>{title}</p>
      {hint ? <p className={cn(DT.label, DFG.faint, 'mt-1 max-w-sm')}>{hint}</p> : null}
      {action ? (
        <StepScope step="page">
          <div className="mt-4">{action}</div>
        </StepScope>
      ) : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className={cn('h-5 w-5 animate-spin motion-reduce:animate-none', DFG.muted)} />
    </div>
  );
}

/** Skeleton bar — used while a table or panel loads. */
export function Skeleton({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded bg-[#1C1836]/[0.07] motion-reduce:animate-none dark:bg-white/[0.07]', className)}
      {...rest}
    />
  );
}

/** Section label above a group of panels. */
export function GroupTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn(DT.micro, DFG.faint, className)}>{children}</p>;
}

/** Key/value row — the backbone of every inspector. */
export function DataRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-2', className)}>
      <span className={cn(DT.label, DFG.muted, 'shrink-0')}>{label}</span>
      <span className={cn(DT.body, DFG.strong, 'min-w-0 text-right font-medium')}>{value}</span>
    </div>
  );
}
