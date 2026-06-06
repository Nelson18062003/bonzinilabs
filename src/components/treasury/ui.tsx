import * as React from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Treasury design language — the SINGLE source of truth for the module's look,
 * distilled from the chosen premium banking reference:
 *  - elevated surfaces with a soft shadow and NO hard border (`SOFT_CARD`)
 *  - round, soft-tinted icon chips (`IconChip`) instead of loud solid squares
 *  - a dark charcoal "pill" for the ONE primary action of a screen (`PrimaryPill`)
 *  - calm uppercase section labels with an optional "Voir tout" link (`SectionTitle`)
 *
 * Every Treasury screen imports from here so the module speaks ONE language —
 * the foundation, not per-screen patches.
 */

export type Tone = 'violet' | 'amber' | 'orange' | 'neutral' | 'danger';

/**
 * Primary surface: rounded-3xl, flat, separated by a hairline border (NO drop
 * shadow). The "épuré" fintech look — nothing floats, the figures lead.
 */
export const SOFT_CARD = 'rounded-3xl bg-card border border-border';

/** Inset/nested surface (fields, split rows) — filled, no border, no shadow. */
export const INSET = 'rounded-2xl bg-muted/60';

export const TONE_BG: Record<Tone, string> = {
  violet: 'bg-violet-500/10',
  amber: 'bg-amber-500/10',
  orange: 'bg-orange-500/10',
  neutral: 'bg-muted',
  danger: 'bg-red-500/10',
};
export const TONE_TEXT: Record<Tone, string> = {
  violet: 'text-bonzini-violet',
  amber: 'text-bonzini-amber',
  orange: 'text-bonzini-orange',
  neutral: 'text-muted-foreground',
  danger: 'text-red-600 dark:text-red-400',
};
export const TONE_DOT: Record<Tone, string> = {
  violet: 'bg-bonzini-violet',
  amber: 'bg-bonzini-amber',
  orange: 'bg-bonzini-orange',
  neutral: 'bg-muted-foreground',
  danger: 'bg-red-500',
};

/** Soft round icon chip — tinted background + colored icon. */
export function IconChip({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
}: {
  icon: React.ElementType;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const ic = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full', box, TONE_BG[tone], TONE_TEXT[tone], className)}>
      <Icon className={ic} />
    </div>
  );
}

/** Elevated surface wrapper. */
export function SoftCard({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(SOFT_CARD, className)} {...rest}>
      {children}
    </div>
  );
}

/** Calm uppercase section label, with an optional right-aligned "Voir tout" action. */
export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h2>
      {action && (
        <button onClick={action.onClick} className="text-[12px] font-semibold text-bonzini-violet active:opacity-70">
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Navigation row: soft card + round icon chip + title/desc + chevron. */
export function ActionTile({
  icon,
  label,
  description,
  onClick,
  tone = 'neutral',
}: {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick: () => void;
  tone?: Tone;
}) {
  return (
    <button onClick={onClick} className={cn(SOFT_CARD, 'flex w-full items-center gap-3.5 p-4 text-left transition active:scale-[0.99]')}>
      <IconChip icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-foreground">{label}</div>
        {description && <div className="truncate text-[12px] text-muted-foreground">{description}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </button>
  );
}

/** Consistent field label. */
export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn('mb-1.5 block text-[13px] font-semibold text-foreground', className)}>{children}</label>;
}

/** Soft chip — the single chip language for filters/toggles/tabs. */
export function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold transition-colors',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The signature dark charcoal button — reserved for the ONE primary action of a
 * screen (form submit). Moderate radius (sophisticated, not a playful pill).
 * Disabled & loading states are baked in.
 */
export function PrimaryPill({
  children,
  onClick,
  disabled,
  loading,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
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
        'flex h-[52px] w-full items-center justify-center rounded-2xl text-[15px] font-bold transition active:scale-[0.99]',
        dead ? 'bg-muted text-muted-foreground' : 'bg-foreground text-background hover:opacity-90',
        className,
      )}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
    </button>
  );
}

/**
 * Soft secondary button — for the small "+" / icon affordances beside fields.
 * Same radius/height as the fields so the row reads as one control group.
 */
export function SoftIconButton({
  icon: Icon,
  onClick,
  label,
  className,
}: {
  icon: React.ElementType;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-muted/70 text-foreground transition active:scale-95',
        className,
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
