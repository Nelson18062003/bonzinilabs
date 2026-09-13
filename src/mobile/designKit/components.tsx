/**
 * Design kit mobile — les composants, aux valeurs du Figma « Simple Design
 * System » (docs/admin-redesign/mobile/01-figma-kit.md).
 *
 * Mêmes noms exportés que le kit précédent (Card, PrimaryPill, StatusPill,
 * Segmented, BottomSheet…) pour que les écrans existants basculent sans être
 * réécrits ; nouveaux : Button, IconButton, Chip, ListRow.
 *
 * Purement présentationnels : pas de données, pas de hooks au-delà de l'état
 * local. Le mode sombre passe entièrement par les jetons.
 */
import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Loader2, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SURFACE, TEXT, TYPE,
  PRIMARY_PILL, SOFT_PILL, SUBTLE_PILL, DANGER_PILL, DANGER_SOFT_PILL, DISABLED_PILL,
  TOGGLE_ON, TOGGLE_OFF, TONE_PILL, TONE_HOLDER,
  type Tone,
} from './tokens';

/* ── Card ─────────────────────────────────────────────────────────────────
 * Card (Stroke) : blanc, bord #D9D9D9, rayon 8. Padding 16 par défaut (la
 * carte de liste) ; 24 pour une carte « objet » via className. */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-lg p-4', SURFACE.card, SURFACE.shadow, className)} {...rest}>
      {children}
    </div>
  );
}

/* ── Button ───────────────────────────────────────────────────────────────
 * Le bouton du kit. Medium h 40 / padding 12 / étiquette 16 ; Small h 32 /
 * padding 8. Icônes 20 px (medium) ou 16 px (small), écart 8. */
export type ButtonVariant = 'primary' | 'neutral' | 'subtle' | 'danger' | 'dangerSubtle';
const VARIANT: Record<ButtonVariant, string> = {
  primary: PRIMARY_PILL, neutral: SOFT_PILL, subtle: SUBTLE_PILL, danger: DANGER_PILL, dangerSubtle: DANGER_SOFT_PILL,
};

export function Button({
  children, onClick, disabled, loading, variant = 'primary', size = 'md', type = 'button', className, ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  type?: 'button' | 'submit';
  className?: string;
  ariaLabel?: string;
}) {
  const dead = disabled || loading;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={dead}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors',
        size === 'sm' ? 'h-8 px-2 text-[14px] [&_svg]:h-4 [&_svg]:w-4' : 'h-10 px-3 text-[16px] [&_svg]:h-5 [&_svg]:w-5',
        dead ? DISABLED_PILL : VARIANT[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="animate-spin" /> : children}
    </button>
  );
}

/* ── IconButton ───────────────────────────────────────────────────────────
 * Rond. Medium 44 × 44 (padding 12), Small 36 × 36 (padding 8). */
export function IconButton({
  icon: Icon, onClick, ariaLabel, variant = 'neutral', size = 'md', disabled, className,
}: {
  icon: React.ElementType;
  onClick?: () => void;
  ariaLabel: string;
  variant?: 'primary' | 'neutral' | 'subtle';
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}) {
  const look =
    variant === 'primary' ? PRIMARY_PILL
    : variant === 'subtle' ? SUBTLE_PILL
    : 'border border-[#D9D9D9] bg-[#F5F5F5] text-[#1E1E1E] active:bg-[#E6E6E6] dark:border-[#444444] dark:bg-[#383838] dark:text-[#F5F5F5]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex shrink-0 items-center justify-center !rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#2C2C2C] focus-visible:ring-offset-2',
        size === 'sm' ? 'h-9 w-9 [&_svg]:h-4 [&_svg]:w-4' : 'h-11 w-11 [&_svg]:h-5 [&_svg]:w-5',
        disabled ? DISABLED_PILL : look,
        className,
      )}
    >
      <Icon />
    </button>
  );
}

/* ── Holder ───────────────────────────────────────────────────────────────
 * Pastille ronde pour une icône ou des initiales. Neutre par défaut, tonée
 * quand la couleur porte un sens. Tailles du kit : 36 / 44 / 48. */
export function Holder({
  icon: Icon, tone = 'neutral', size = 'md', className, onClick, ariaLabel, children,
}: {
  icon?: React.ElementType;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  const box = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12' : 'h-11 w-11';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const inner = Icon ? <Icon className={ic} /> : children;
  const classes = cn(
    'flex shrink-0 items-center justify-center rounded-full',
    box,
    TONE_HOLDER[tone],
    tone === 'neutral' && 'border border-[#D9D9D9] dark:border-[#444444]',
    onClick && 'transition-colors active:bg-[#E6E6E6] dark:active:bg-[#444444]',
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={classes}>
        {inner}
      </button>
    );
  }
  return <div className={classes}>{inner}</div>;
}

/* ── Avatar ───────────────────────────────────────────────────────────────
 * Rond, initiales en 14/600. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name, tone = 'neutral', size = 'md', className,
}: {
  name: string;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const box = size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-12 w-12 text-[16px]' : 'h-11 w-11';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-[14px] font-semibold',
        box,
        TONE_HOLDER[tone],
        tone === 'neutral' && 'border border-[#D9D9D9] dark:border-[#444444]',
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}

/* ── Row ──────────────────────────────────────────────────────────────────
 * Étiquette / valeur, 14 px, valeur alignée à droite en chiffres tabulaires. */
export function Row({ label, value, className }: { label: React.ReactNode; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2 text-[16px]', className)}>
      <span className={TEXT.muted}>{label}</span>
      <span className={cn('text-right font-semibold tabular-nums', TEXT.strong)}>{value}</span>
    </div>
  );
}

/* ── ListRow ──────────────────────────────────────────────────────────────
 * Une ligne de liste ou de menu : élément de tête, titre 16/600, sous-titre
 * 14 sourd, élément de queue, chevron. 56 px minimum — une vraie cible. */
export function ListRow({
  leading, title, subtitle, trailing, onClick, chevron = !!onClick, className, divider = true,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
  /** Filet sous la ligne (sauf la dernière du groupe : `last:border-b-0`). */
  divider?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full min-h-[56px] items-center gap-3 py-2 text-left',
        divider && cn('border-b last:border-b-0', SURFACE.divider),
        onClick && 'transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]',
        className,
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words', TYPE.bodyStrong, TEXT.strong)}>{title}</span>
        {subtitle != null && <span className={cn('mt-0.5 block break-words text-[16px] leading-snug', TEXT.muted)}>{subtitle}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />}
    </Tag>
  );
}

/* ── Amount ───────────────────────────────────────────────────────────────
 * Le chiffre focal d'une carte ou d'un écran. 20 / 24 / 32, semi-gras, avec
 * l'unité en sourd. */
export function Amount({
  value, unit, size = 'lg', className,
}: {
  value: React.ReactNode;
  unit?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const num = size === 'md' ? 'text-[20px]' : size === 'xl' ? 'text-[32px]' : 'text-[24px]';
  return (
    <div className={cn('font-semibold leading-none tracking-[-0.02em] tabular-nums', num, TEXT.strong, className)}>
      {value}
      {unit != null && <span className={cn('ml-1 text-[16px] font-medium', TEXT.muted)}>{unit}</span>}
    </div>
  );
}

/* ── PrimaryPill / SoftPill ───────────────────────────────────────────────
 * Les anciens noms, sur le nouveau bouton. `PrimaryPill` = Button primary
 * (danger → Button danger) ; `SoftPill` = Button neutral. */
export function PrimaryPill({
  children, onClick, disabled, loading, danger, type = 'button', className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} loading={loading} variant={danger ? 'danger' : 'primary'} type={type} className={className}>
      {children}
    </Button>
  );
}

export function SoftPill({
  children, onClick, disabled, type = 'button', className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <Button onClick={onClick} disabled={disabled} variant="neutral" type={type} className={className}>
      {children}
    </Button>
  );
}

/* ── StatusPill ───────────────────────────────────────────────────────────
 * Tag Secondary : h 32, padding 8, rayon 8, 14/600. La couleur porte le
 * statut, le libellé le dit en toutes lettres. */
export function StatusPill({ tone, label, className }: { tone: Tone; label: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 text-[16px] font-semibold', TONE_PILL[tone], className)}>
      {label}
    </span>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────
 * Tag Toggle : le filtre. h 32, rayon 8 ; On #2C2C2C, Off #F5F5F5. Le
 * compteur s'écrit dans l'étiquette, jamais dans une micro-pastille. */
export function Chip({
  label, active, count, onClick, icon: Icon, className,
}: {
  label: React.ReactNode;
  active?: boolean;
  count?: number | null;
  onClick?: () => void;
  icon?: React.ElementType;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-[16px] font-semibold transition-colors',
        active ? TOGGLE_ON : TOGGLE_OFF,
        className,
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {label}
      {count != null && count > 0 && <span className={cn('tabular-nums', active ? 'opacity-80' : TEXT.muted)}>{count}</span>}
    </button>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────────────
 * Stats Card : icône 40, étiquette 14, chiffre 20/24, indice 14. */
export function StatCard({
  label, value, unit, hint, icon, tone = 'neutral', onClick, className,
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
        'flex w-full flex-col gap-2 rounded-lg p-4 text-left',
        SURFACE.card, SURFACE.shadow,
        onClick && 'transition-colors active:bg-[#F5F5F5] dark:active:bg-[#383838]',
        className,
      )}
    >
      {icon && <Holder icon={icon} tone={tone} size="sm" />}
      <div className={cn('text-[16px]', TEXT.muted)}>{label}</div>
      <Amount value={value} unit={unit} size="md" />
      {hint != null && <div className={cn('text-[16px]', TEXT.muted)}>{hint}</div>}
    </Wrapper>
  );
}

/* ── Segmented ────────────────────────────────────────────────────────────
 * Tag Toggle Group : une rangée de chips, écart 8, chacune prend sa part.
 * Générique sur le type de valeur. */
export function Segmented<T extends string>({
  options, value, onChange, className,
}: {
  options: ReadonlyArray<{ value: T; label: React.ReactNode; count?: number | null }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full items-center gap-2', className)} role="tablist">
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
              'inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap px-2 text-[16px] font-semibold transition-colors',
              active ? TOGGLE_ON : TOGGLE_OFF,
            )}
          >
            {opt.label}
            {opt.count != null && opt.count > 0 && <span className={cn('tabular-nums', active ? 'opacity-80' : TEXT.muted)}>{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── FormField ────────────────────────────────────────────────────────────
 * Étiquette 14/600 au-dessus, écart 8, indice ou erreur 14 dessous. */
export function FormField({
  label, htmlFor, hint, error, children, className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className={cn('block', TYPE.bodyStrong, TEXT.strong)}>{label}</label>
      {children}
      {error ? (
        <p className="text-[16px] leading-snug text-[#900B09] dark:text-[#FCB3AD]">{error}</p>
      ) : hint ? (
        <p className={cn('text-[16px] leading-snug', TEXT.muted)}>{hint}</p>
      ) : null}
    </div>
  );
}

/* ── TextInput ────────────────────────────────────────────────────────────
 * Input Field : h 40, rayon 8, bord #D9D9D9, padding 12, texte 16 (pas de
 * zoom iOS), placeholder #B3B3B3, focus bord #2C2C2C. */
export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-lg border border-[#D9D9D9] bg-white px-3 text-[16px] outline-none transition-colors',
          TEXT.strong,
          'placeholder:text-[#B3B3B3] focus:border-[#2C2C2C] focus:ring-1 focus:ring-[#2C2C2C]',
          'disabled:border-[#B3B3B3] disabled:bg-[#D9D9D9] disabled:text-[#B3B3B3]',
          'dark:border-[#444444] dark:bg-[#2C2C2C] dark:placeholder:text-[#757575] dark:focus:border-[#E3E3E3] dark:focus:ring-[#E3E3E3]',
          className,
        )}
        {...rest}
      />
    );
  },
);

/* ── BottomSheet ──────────────────────────────────────────────────────────
 * Feuille basse : blanc, rayon 16 en haut, bord, padding 24 ; voile
 * #000000 à 50 % (Utilities). Ferme sur le voile, le X et Échap ; bloque le
 * défilement du document tant qu'elle est ouverte. */
export function BottomSheet({
  open, onClose, title, children, className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  // onClose dans une ref : l'effet ne dépend QUE de `open`, sinon une
  // fonction fléchée recréée à chaque rendu relancerait le focus initial à
  // chaque frappe et fermerait le clavier.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  React.useEffect(() => {
    if (!open) return;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return; }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    const focusTimer = window.setTimeout(() => focusables()[0]?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div key="bottomsheet" className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.div
            ref={panelRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.9 }}
            className={cn(
              'relative max-h-[90dvh] overflow-y-auto rounded-t-2xl border-t p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
              SURFACE.card, SURFACE.divider,
              className,
            )}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#D9D9D9] dark:bg-[#444444]" />
            {title != null && (
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={cn(TYPE.subheading, 'font-semibold', TEXT.strong)}>{title}</h2>
                <IconButton icon={X} size="sm" variant="subtle" onClick={onClose} ariaLabel="Fermer" />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── ScreenLoader ─────────────────────────────────────────────────────── */
export function ScreenLoader({ label = 'Chargement…', className }: { label?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[50vh] flex-col items-center justify-center gap-3', className)}>
      <Loader2 className={cn('h-6 w-6 animate-spin', TEXT.muted)} />
      <p className={cn(TYPE.small, TEXT.muted)}>{label}</p>
    </div>
  );
}

/* ── ScreenError ──────────────────────────────────────────────────────── */
export function ScreenError({
  title = 'Une erreur est survenue', description, onRetry, retryLabel = 'Réessayer', className,
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
      <h2 className={cn(TYPE.bodyStrong, TEXT.strong)}>{title}</h2>
      {description != null && <p className={cn('max-w-xs', TYPE.small, TEXT.muted)}>{description}</p>}
      {onRetry && <Button variant="neutral" onClick={onRetry} className="mt-1">{retryLabel}</Button>}
    </div>
  );
}

/* ── SectionTitle ─────────────────────────────────────────────────────────
 * Titre de section : Body Small Strong 14/600 encre, action à droite en
 * 14/600. Pas de majuscules espacées — le kit n'en a pas. */
export function SectionTitle({
  children, action, className,
}: {
  children: React.ReactNode;
  action?: { label: React.ReactNode; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex items-center justify-between', className)}>
      <h2 className={cn(TYPE.bodyStrong, TEXT.strong)}>{children}</h2>
      {action && (
        <button type="button" onClick={action.onClick} className={cn('inline-flex h-8 items-center gap-0.5 text-[14px] font-semibold', TEXT.body, 'active:opacity-70')}>
          {action.label}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
