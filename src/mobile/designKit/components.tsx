/**
 * Design kit — shared presentational components (Phase 0.2 of the mobile refonte).
 *
 * The ONE component library for the whole mobile app, distilled from the
 * validated Ofspace/Mola reference (see MobileAssistantScreen + __screenshot__/
 * flyer). Every screen migrates onto these so the app speaks ONE language:
 *   soft tinted canvas · white cards with a soft diffuse shadow (no hard border)
 *   · NEUTRAL round holders · dark pills · big neutral figures (tabular-nums) ·
 *   restrained color (color carries meaning only). No gradients, no divider lines.
 *
 * These are PURELY presentational (no data, no hooks beyond local UI state) and
 * fully typed. Dark mode is handled entirely through the token classes.
 */
import * as React from 'react';
import { ChevronRight, Loader2, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  PRIMARY_PILL,
  SOFT_PILL,
  TONE_PILL,
  TONE_HOLDER,
  type Tone,
} from './tokens';

/* ── Card ─────────────────────────────────────────────────────────────────
 * Primary elevated surface: white, soft diffuse shadow, NO hard border. */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-[22px] p-4', SURFACE.card, SURFACE.shadow, className)} {...rest}>
      {children}
    </div>
  );
}

/* ── Holder ───────────────────────────────────────────────────────────────
 * Round soft holder for an icon (or any glyph). Neutral by default; a `tone`
 * tints it where color carries meaning (result/status icons). */
export function Holder({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
  onClick,
  children,
}: {
  /** Optional lucide-style icon component. */
  icon?: React.ElementType;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** When set, the holder renders as a button. */
  onClick?: () => void;
  /** Alternative content (e.g. initials) when no icon is given. */
  children?: React.ReactNode;
}) {
  const box = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const inner = Icon ? <Icon className={ic} /> : children;
  const classes = cn(
    'flex shrink-0 items-center justify-center rounded-full',
    box,
    TONE_HOLDER[tone],
    onClick && 'transition active:scale-95',
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }
  return <div className={classes}>{inner}</div>;
}

/* ── Avatar ───────────────────────────────────────────────────────────────
 * Round holder showing initials derived from a name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  name: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-9 w-9 text-[12px]' : size === 'lg' ? 'h-12 w-12 text-[15px]' : 'h-11 w-11 text-[14px]';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        box,
        TONE_HOLDER[tone],
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────────
 * Label / value line — NO divider hairline (the reference uses spacing only).
 * `value` aligned right, tabular-nums for figures. */
export function Row({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-[7px] text-[13.5px]', className)}>
      <span className={TEXT.muted}>{label}</span>
      <span className={cn('text-right font-semibold tabular-nums', TEXT.strong)}>{value}</span>
    </div>
  );
}

/* ── Amount ───────────────────────────────────────────────────────────────
 * Big neutral figure with a dimmed unit. The focal number of a card/screen. */
export function Amount({
  value,
  unit,
  size = 'lg',
  className,
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const num = size === 'md' ? 'text-[24px]' : size === 'xl' ? 'text-[38px]' : 'text-[30px]';
  const u = size === 'md' ? 'text-[13px]' : size === 'xl' ? 'text-[17px]' : 'text-[15px]';
  return (
    <div className={cn('font-extrabold leading-none tracking-tight tabular-nums', num, TEXT.strong, className)}>
      {value}
      {unit != null && (
        <span className={cn('ml-1.5 font-bold text-[#AAA7BD] dark:text-[#6F6C82]', u)}>{unit}</span>
      )}
    </div>
  );
}

/* ── PrimaryPill ──────────────────────────────────────────────────────────
 * The ONE primary action of a screen — dark charcoal pill (or red for danger).
 * Disabled & loading states baked in. */
export function PrimaryPill({
  children,
  onClick,
  disabled,
  loading,
  danger,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const dead = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={dead}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full py-[13px] px-6 text-[14px] font-bold transition active:scale-[0.99]',
        dead
          ? 'bg-muted text-muted-foreground'
          : danger
            ? 'bg-[#D14343] text-white'
            : PRIMARY_PILL,
        className,
      )}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}

/* ── SoftPill ─────────────────────────────────────────────────────────────
 * Soft secondary pill (e.g. "Annuler", "Voir tout"). */
export function SoftPill({
  children,
  onClick,
  disabled,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-full py-[13px] px-6 text-[14px] font-semibold transition active:scale-[0.99] disabled:opacity-50',
        SOFT_PILL,
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── StatusPill ───────────────────────────────────────────────────────────
 * Compact soft badge carrying a status, coloured by tone. */
export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: Tone;
  label: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold',
        TONE_PILL[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────────────
 * Small KPI tile: optional icon holder, label, big figure, optional hint. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  tone = 'neutral',
  onClick,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ElementType;
  tone?: Tone;
  onClick?: () => void;
  className?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-[22px] p-4 text-left',
        SURFACE.card,
        SURFACE.shadow,
        onClick && 'transition active:scale-[0.99]',
        className,
      )}
    >
      {icon && <Holder icon={icon} tone={tone} size="sm" />}
      <div className={cn('text-[12px] font-medium', TEXT.muted)}>{label}</div>
      <Amount value={value} unit={unit} size="md" />
      {hint != null && <div className={cn('text-[12px]', TEXT.muted)}>{hint}</div>}
    </Wrapper>
  );
}

/* ── Segmented ────────────────────────────────────────────────────────────
 * Segmented control / tabs — the ONE chip language for switching views.
 * Generic over the option value type. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-full p-1',
        SURFACE.card,
        SURFACE.shadow,
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
              active ? PRIMARY_PILL : cn('bg-transparent', TEXT.muted),
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── FormField ────────────────────────────────────────────────────────────
 * Label + control wrapper, with optional hint/error. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className={cn('block text-[13px] font-semibold', TEXT.strong)}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] font-medium text-[#C0504D] dark:text-[#E79A9A]">{error}</p>
      ) : hint ? (
        <p className={cn('text-[12px]', TEXT.muted)}>{hint}</p>
      ) : null}
    </div>
  );
}

/* ── TextInput ────────────────────────────────────────────────────────────
 * Consistent input: h-12, rounded, card surface, focus ring. Use 16px font on
 * mobile to avoid iOS zoom (default text-[16px]). */
export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-12 w-full rounded-2xl px-4 text-[16px] outline-none transition',
          SURFACE.card,
          SURFACE.shadow,
          TEXT.strong,
          'placeholder:text-[#9B98AD] focus:ring-2 focus:ring-[#C9C2F0] dark:focus:ring-[#4A4660]',
          className,
        )}
        {...rest}
      />
    );
  },
);

/* ── BottomSheet ──────────────────────────────────────────────────────────
 * Overlay + bottom panel. Closes on backdrop click, on the X, and on Escape;
 * locks body scroll while open. Presentational (controlled via `open`). */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        className={cn(
          'relative max-h-[90dvh] overflow-y-auto rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]',
          SURFACE.card,
          'shadow-[0_-12px_40px_-12px_rgba(46,32,92,0.30)] dark:shadow-none dark:ring-1 dark:ring-white/[0.06]',
          className,
        )}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10 dark:bg-white/15" />
        {title != null && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className={cn('text-[17px] font-bold', TEXT.strong)}>{title}</h2>
            <Holder icon={X} size="sm" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ── ScreenLoader ─────────────────────────────────────────────────────────
 * Full-area centered spinner for a loading screen. */
export function ScreenLoader({
  label = 'Chargement…',
  className,
}: {
  label?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn('h-7 w-7 animate-spin', TEXT.muted)} />
      <p className={cn('text-[13px]', TEXT.muted)}>{label}</p>
    </div>
  );
}

/* ── ScreenError ──────────────────────────────────────────────────────────
 * Full-area centered error with an optional retry. */
export function ScreenError({
  title = 'Une erreur est survenue',
  description,
  onRetry,
  retryLabel = 'Réessayer',
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-3 px-8 text-center', className)}>
      <Holder icon={AlertTriangle} tone="danger" size="lg" />
      <h2 className={cn('text-[16px] font-bold', TEXT.strong)}>{title}</h2>
      {description != null && <p className={cn('max-w-xs text-[13px]', TEXT.muted)}>{description}</p>}
      {onRetry && (
        <SoftPill onClick={onRetry} className="mt-1">
          {retryLabel}
        </SoftPill>
      )}
    </div>
  );
}

/* ── SectionTitle ─────────────────────────────────────────────────────────
 * Calm uppercase section label with an optional right-aligned action. (Kept
 * here for parity with treasury/ui.tsx so screens have one source.) */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: { label: React.ReactNode; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between px-1', className)}>
      <h2 className={cn('text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#6B5BD2] active:opacity-70 dark:text-[#A99BF0]"
        >
          {action.label}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
