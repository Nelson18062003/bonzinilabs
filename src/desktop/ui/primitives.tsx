/**
 * DESKTOP primitives — the small vocabulary every console screen is built from.
 *
 * Deliberately tiny: a Panel, a Button, a Chip, a Field, a Metric, a Badge, an
 * EmptyState. If a screen needs something else it composes these rather than
 * inventing a new card shape — that is what keeps eleven modules looking like
 * one product.
 *
 * Status colour is NOT defined here: tones come from `@/mobile/designKit`
 * (`TONE_PILL`, `depositStatusTone`, …) so mobile and desktop always agree on
 * what "validé" looks like.
 */
import * as React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_PILL, TONE_HOLDER, type Tone } from '@/mobile/designKit';
import { DS, DT, DFG, DACCENT, DFOCUS } from './tokens';

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

/** Panel header: title on the left, actions on the right, hairline underneath. */
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
    <div className={cn('flex items-center gap-3 border-b px-4 py-3', DS.line, className)}>
      <div className="min-w-0 flex-1">
        <h3 className={cn(DT.title, DFG.strong, 'truncate')}>{title}</h3>
        {hint ? <p className={cn(DT.label, DFG.muted, 'mt-0.5 truncate')}>{hint}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

/* ── Button ──────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1A1725] text-white hover:bg-[#2A2637] dark:bg-[#F1F0F6] dark:text-[#15131F] dark:hover:bg-white',
  secondary: cn('border bg-white text-[#15131F] hover:bg-[#1C1836]/[0.04]', DS.line,
    'dark:bg-[#1B1A24] dark:text-[#F3F2F8] dark:hover:bg-white/[0.07]'),
  ghost: cn('text-[#3B3750] dark:text-[#C9C6D6]', DS.hover),
  danger: 'bg-[#C0504D] text-white hover:bg-[#A94340]',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-[12px]',
  md: 'h-8 gap-2 rounded-lg px-3 text-[13px]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, loading, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        BTN_SIZE[size],
        BTN_VARIANT[variant],
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      ) : Icon ? (
        <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      ) : null}
      {children}
    </button>
  );
});

/** Square icon-only button — toolbars, table row actions, topbar. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'children' | 'size'> & { label: string; size?: ButtonSize }
>(function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors',
        'disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        BTN_VARIANT[variant],
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {Icon ? <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
    </button>
  );
});

/* ── Chip (filters) ──────────────────────────────────────────────────── */

export function Chip({
  active,
  count,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; count?: number | null }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-semibold transition-colors',
        active
          ? 'bg-[#1A1725] text-white dark:bg-[#F1F0F6] dark:text-[#15131F]'
          : cn('border', DS.line, DFG.base, DS.hover),
        DFOCUS,
        className,
      )}
      {...rest}
    >
      {children}
      {count != null && count > 0 ? (
        <span
          className={cn(
            'rounded px-1 text-[10px] font-bold tabular-nums',
            active ? 'bg-white/20 dark:bg-black/15' : 'bg-[#1C1836]/[0.07] dark:bg-white/[0.09]',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Segmented control — mutually exclusive options that share one track. */
export function Segment<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn('inline-flex h-7 items-center gap-0.5 rounded-lg p-0.5', DS.well, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'h-6 rounded-md px-2.5 text-[12px] font-semibold transition-colors',
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

/** Semantic status badge — the tone comes from the shared design kit. */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-[21px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold',
        TONE_PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A copyable business reference (BZ-DP-…): monospace on a recessed chip. */
export function Ref({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 font-bold', DT.mono, DS.well, DFG.base, className)}>
      {children}
    </span>
  );
}

/** Tinted round holder for an icon or initials. */
export function Holder({
  icon: Icon,
  tone,
  size = 'md',
  children,
  className,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
}) {
  const box = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const glyph = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg',
        box,
        tone ? TONE_HOLDER[tone] : DS.holder,
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
  const box = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-7 w-7 text-[11px]';
  return src ? (
    <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover', box, className)} />
  ) : (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', box, DS.holder, className)}>
      {initials}
    </span>
  );
}

/* ── Numbers ─────────────────────────────────────────────────────────── */

/** A money/quantity figure. Always tabular so columns align. */
export function Figure({
  value,
  unit,
  size = 'md',
  tone,
  className,
}: {
  value: React.ReactNode;
  unit?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'positive' | 'negative';
  className?: string;
}) {
  const scale =
    size === 'xl' ? 'text-[26px] leading-8 font-extrabold tracking-[-0.02em]'
    : size === 'lg' ? 'text-[19px] leading-6 font-extrabold tracking-[-0.015em]'
    : size === 'sm' ? 'text-[12px] leading-4 font-semibold'
    : 'text-[13px] leading-[18px] font-bold';
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
      {unit ? <span className={cn('ml-1 text-[0.7em] font-semibold', DFG.faint)}>{unit}</span> : null}
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
        'rounded-xl border px-3.5 py-3 text-left transition-colors',
        DS.card,
        active ? cn(DACCENT.border, 'ring-1 ring-[#6B5BD2]/30') : DS.line,
        onClick && !active && DS.hover,
        onClick && DFOCUS,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Holder icon={Icon} tone={tone} size="sm" /> : null}
        <span className={cn(DT.label, DFG.muted, 'truncate font-medium')}>{label}</span>
      </div>
      <div className="mt-2">
        <Figure value={value} unit={unit} size="lg" />
      </div>
      {hint ? <p className={cn('mt-1 truncate text-[11px]', DFG.faint)}>{hint}</p> : null}
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
      <span className={cn(DT.label, DFG.base, 'mb-1.5 flex items-center gap-1 font-semibold')}>
        {label}
        {required ? <span className="text-[#C0504D]">*</span> : null}
      </span>
      {children}
      {hint ? <span className={cn('mt-1 block text-[11px]', DFG.faint)}>{hint}</span> : null}
    </label>
  );
}

export const inputClass = cn(
  'h-8 w-full rounded-lg border bg-white px-2.5 text-[13px] transition-colors',
  'placeholder:text-[#A5A1B5] dark:bg-[#1B1A24] dark:placeholder:text-[#65627A]',
  DS.line,
  DFG.strong,
  DFOCUS,
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    // The iOS auto-zoom rule that forbids raw <input> applies to the mobile app;
    // this component only ever mounts inside the desktop shell (>= lg), where
    // 13px is the intended density and Safari-iOS zoom cannot occur.
    // eslint-disable-next-line no-restricted-syntax
    return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
  },
);

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
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon ? <Holder icon={Icon} size="lg" /> : null}
      <p className={cn(DT.title, DFG.base, 'mt-3')}>{title}</p>
      {hint ? <p className={cn(DT.label, DFG.faint, 'mt-1 max-w-sm')}>{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-14', className)}>
      <Loader2 className={cn('h-5 w-5 animate-spin', DFG.faint)} />
    </div>
  );
}

/** Skeleton bar — used while a table or panel loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-[#1C1836]/[0.07] dark:bg-white/[0.07]', className)} />;
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
    <div className={cn('flex items-baseline justify-between gap-4 py-[7px]', className)}>
      <span className={cn(DT.label, DFG.muted, 'shrink-0')}>{label}</span>
      <span className={cn(DT.body, DFG.strong, 'min-w-0 text-right font-medium')}>{value}</span>
    </div>
  );
}
