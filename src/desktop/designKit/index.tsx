/**
 * Desktop design kit — the production counterpart of the V3 mockups
 * (docs/admin-redesign, src/__screenshot__/adminRedesign).
 *
 * One language, two densities: this kit RE-EXPORTS the mobile kit's tokens and
 * atoms (single source of truth for color/tone/surfaces — flat, ring-delimited,
 * no drop shadows) and adds the desktop-only grammar the archetype needs:
 * filter chips with counts, dropdown chips, table cells with sortable headers,
 * pagination, SLA age, reference chips, section labels, card header bands and
 * a centered dialog (the desktop replacement for the mobile BottomSheet).
 *
 * Structure rules (02-foundation.md §1.5) are enforced here by construction:
 * every toolbar control is 36px tall; every card header band and section label
 * has exactly one style.
 */
import * as React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Search,
  X,
} from 'lucide-react';
import { format, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
// SURFACE / TEXT / PRIMARY_PILL / SOFT_PILL ne sont PAS importés du mobile :
// ils sont redéfinis plus bas pour le desktop (voir « Jetons DESKTOP »), et les
// composants de ce fichier consomment ces versions-là.
import { TextInput, type Tone } from '@/mobile/designKit';

/* Tokens & atoms shared with mobile — one import site for desktop screens. */
export * from '@/mobile/designKit';

/* ── Jetons DESKTOP — recouvrent ceux du mobile ────────────────────────────
 *
 * Le kit mobile porte une palette lilas écrite en dur (`#ECEAF7` de fond,
 * `#EDEAFA` pour les pastilles, pilules `rounded-full`). Le mobile est validé
 * et ne bouge pas ; l'admin desktop, lui, passe sur la bibliothèque de
 * composants (shadcn/Figma) posée par la classe `.admin-theme` de la coquille.
 *
 * Les déclarations locales ci-dessous l'emportent sur le `export *` au-dessus
 * (règle ESM : un export explicite masque un export étoile de même nom). Les
 * écrans desktop qui importent `@/desktop/designKit` basculent donc sur le
 * design system SANS changer une seule ligne d'appel — et le mobile, qui
 * importe `@/mobile/designKit`, garde exactement son rendu actuel.
 *
 * Toutes les valeurs sont des jetons sémantiques (`bg-card`, `text-foreground`,
 * `border-border`…) : elles suivent automatiquement le thème clair/sombre. */

export const SURFACE = {
  canvas: 'bg-background',
  card: 'bg-card',
  /** Séparation par bordure, comme les cartes shadcn (pas d'ombre portée). */
  shadow: 'ring-1 ring-border',
  holder: 'bg-muted text-foreground',
  /** « surface-2 » : encart posé sur une carte. */
  inset: 'bg-muted/50',
} as const;

export const TEXT = {
  strong: 'text-foreground',
  body: 'text-foreground/85',
  muted: 'text-muted-foreground',
} as const;

/** Action principale — le bouton plein du design system (choix « 1 / Plein »). */
export const PRIMARY_PILL =
  'rounded-md bg-primary text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
/** Action secondaire. */
export const SOFT_PILL =
  'rounded-md border border-input bg-background text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Pastilles de statut — angles adoucis (rayon du thème), plus `rounded-full`. */
export const TONE_PILL: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
  neutral: 'bg-muted text-muted-foreground',
};

export const TONE_HOLDER: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
  info: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400',
  neutral: 'bg-muted text-foreground',
};

/**
 * Porte-icône DESKTOP — recouvre celui du mobile.
 *
 * Le composant mobile est un rond de 36/44/48px peint avec la palette lilas
 * (il lit `TONE_HOLDER` de SON module, donc la redéfinition de jeton ci-dessus
 * ne l'atteint pas : il faut recouvrir le composant lui-même). Ici : angles du
 * thème, densité desktop, et les tonalités du design system.
 */
export function Holder({
  icon: Icon,
  tone = 'neutral',
  size = 'md',
  className,
  onClick,
  ariaLabel,
  children,
}: {
  icon?: React.ElementType;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  const box = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const ic = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const inner = Icon ? <Icon className={ic} /> : children;
  const classes = cn(
    'flex shrink-0 items-center justify-center rounded-md',
    box,
    TONE_HOLDER[tone],
    onClick && 'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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


/* ── Action pill recipes (same as the mobile fiches — kept as constants) ── */

export const EMERALD_PILL = 'rounded-md bg-emerald-600 text-white font-bold';
export const VIOLET_PILL = 'rounded-md bg-indigo-600 text-white font-bold';
export const DANGER_SOFT_PILL =
  'rounded-md bg-destructive/10 font-semibold text-destructive hover:bg-destructive/15';

/* ── Méthodes de dépôt — vignette de marque (source unique desktop) ─────── */

export const FAMILIES_CONF: Record<string, { letter: string; bg: string; dark?: boolean }> = {
  BANK: { letter: 'B', bg: '#1e3a5f' },
  AGENCY_BONZINI: { letter: 'A', bg: '#A947FE' },
  ORANGE_MONEY: { letter: 'O', bg: '#ff6600' },
  MTN_MONEY: { letter: 'M', bg: '#ffcb05', dark: true },
  WAVE: { letter: 'W', bg: '#1dc3e3' },
};

export function MIcon({ family, size = 28 }: { family: string; size?: number }) {
  const f = FAMILIES_CONF[family];
  if (!f) return null;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-black"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: f.bg,
        fontSize: Math.round(size * 0.38),
        color: f.dark ? '#1a1028' : '#fff',
      }}
    >
      {f.letter}
    </div>
  );
}

/* ── Dates courtes pour la colonne d'âge ────────────────────────────────── */

/** "25 min" · "3 h" · "2 j" */
export function relShort(iso: string): string {
  const mins = Math.max(0, differenceInMinutes(new Date(), new Date(iso)));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

/** "14:07" · "hier 22:41" · "18 août 15:44" */
export function absShort(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `hier ${format(d, 'HH:mm')}`;
  return format(d, 'd MMM HH:mm', { locale: fr });
}

/** Âge teinté SLA : relatif coloré, absolu sourd dessous. */
export function Age({
  date,
  level,
  relOnly,
}: {
  date: string;
  level?: 'fresh' | 'aging' | 'overdue' | null;
  relOnly?: boolean;
}) {
  const color =
    level === 'overdue'
      ? 'text-destructive font-bold'
      : level === 'aging'
        ? 'text-amber-700 font-bold dark:text-amber-400'
        : level === 'fresh'
          ? 'text-emerald-700 font-bold dark:text-emerald-400'
          : cn(TEXT.muted, 'font-medium');
  return (
    <div className="whitespace-nowrap leading-[16px]">
      <div className={cn('text-[12px] tabular-nums', color)}>{relShort(date)}</div>
      {!relOnly && <div className={cn('text-[11px] tabular-nums', TEXT.muted)}>{absShort(date)}</div>}
    </div>
  );
}

/* ── Chips de filtre (36px, la seule hauteur de barre d'outils) ─────────── */

export function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: React.ReactNode;
  count?: number | string | null;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12px] font-semibold transition-colors',
        active ? PRIMARY_PILL : SOFT_PILL,
      )}
    >
      {label}
      {count != null && count !== 0 && (
        <span
          className={cn(
            'rounded-md px-1.5 py-px text-[9px] font-extrabold tabular-nums',
            active
              ? 'bg-white/20 text-white dark:bg-black/15 dark:text-foreground'
              : 'bg-black/[0.06] dark:bg-white/10',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Chip-menu déroulant : « Label Valeur ▾ » avec un vrai popover d'options. */
export function DropChip<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('flex h-9 items-center gap-1.5 rounded-md px-3.5 text-[12px] font-semibold', SOFT_PILL)}
      >
        <span className="opacity-70">{label}</span>
        <span className="font-bold">{current?.label ?? value}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-70 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute right-0 top-[calc(100%+6px)] z-40 min-w-[180px] overflow-hidden rounded-2xl p-1.5',
            SURFACE.card,
            'ring-1 ring-black/[0.10] dark:ring-white/[0.10]',
          )}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition-colors',
                o.value === value ? cn('bg-accent', TEXT.strong) : cn(TEXT.strong, 'hover:bg-muted/50 dark:hover:bg-white/[0.05]'),
              )}
            >
              {o.label}
              {o.value === value && <Check className="h-3.5 w-3.5 text-indigo-700 dark:text-indigo-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recherche 36px — contrôlée, avec effacement. */
export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2', TEXT.muted)} />
      <TextInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-full pl-9 pr-8 text-[13px]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer"
          className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1', TEXT.muted)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/* ── Anatomie de carte & sections (règles 2 et 3) ───────────────────────── */

export function CardHeader({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-5 py-2.5 dark:border-white/[0.06]">
      <span className={cn('text-[13px] font-bold', TEXT.strong)}>{title}</span>
      {meta && <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>{meta}</span>}
    </div>
  );
}

export function SecLabel({
  children,
  right,
  className,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</span>
      {right}
    </div>
  );
}

/** Cellule label/valeur des grilles de faits. */
export function KV({ k, v, className }: { k: string; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{k}</div>
      <div className={cn('mt-0.5 truncate text-[13px] font-semibold tabular-nums', TEXT.strong)}>{v}</div>
    </div>
  );
}

/* ── Table (typo des tables actuelles + tri) ────────────────────────────── */

export function Th({
  children,
  align = 'left',
  sortable,
  sorted,
  onSort,
  className,
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  className?: string;
  first?: boolean;
  last?: boolean;
}) {
  const inner = (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider', sorted ? TEXT.strong : TEXT.muted)}>
      {children}
      {sorted ? (
        <ChevronDown className={cn('h-3 w-3', sorted === 'asc' && 'rotate-180')} />
      ) : (
        sortable && <ChevronsUpDown className="h-3 w-3 opacity-50" />
      )}
    </span>
  );
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap py-3',
        first ? 'pl-5 pr-2' : last ? 'pl-2 pr-5' : 'px-2',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {sortable && onSort ? (
        <button type="button" onClick={onSort} className="outline-none focus-visible:ring-2 focus-visible:ring-ring ">
          {inner}
        </button>
      ) : (
        inner
      )}
    </th>
  );
}

export function Td({
  children,
  align = 'left',
  className,
  first,
  last,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <td
      className={cn(
        'whitespace-nowrap border-t border-black/[0.05] py-3 dark:border-white/[0.05]',
        first ? 'pl-5 pr-2' : last ? 'pl-2 pr-5' : 'px-2',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Pagination — pages numérotées, jamais de scroll infini sur desktop. */
export function PaginationBar({
  page,
  pages,
  rangeLabel,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  rangeLabel: string;
  total: string;
  onPage: (p: number) => void;
}) {
  const nums: number[] = [];
  for (let n = Math.max(1, page - 1); n <= Math.min(pages, Math.max(3, page + 1)); n++) nums.push(n);
  if (nums[0] !== 1) nums.unshift(1);
  return (
    <div className="flex items-center justify-between border-t border-black/[0.05] px-5 py-2.5 dark:border-white/[0.05]">
      <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>
        {rangeLabel} sur <span className={cn('font-bold', TEXT.strong)}>{total}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Page précédente"
          className={cn('flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40', SOFT_PILL)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {nums.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className={cn('px-0.5 text-[12px]', TEXT.muted)}>…</span>}
            <button
              type="button"
              onClick={() => onPage(n)}
              className={cn('h-7 min-w-7 rounded-md px-2 text-[12px] font-bold tabular-nums', n === page ? PRIMARY_PILL : SOFT_PILL)}
            >
              {n}
            </button>
          </React.Fragment>
        ))}
        {pages > (nums[nums.length - 1] ?? 1) && (
          <>
            {pages - (nums[nums.length - 1] ?? 1) > 1 && <span className={cn('px-0.5 text-[12px]', TEXT.muted)}>…</span>}
            <button type="button" onClick={() => onPage(pages)} className={cn('h-7 rounded-md px-2 text-[12px] font-bold tabular-nums', SOFT_PILL)}>
              {pages}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Page suivante"
          className={cn('flex h-7 w-7 items-center justify-center rounded-full disabled:opacity-40', SOFT_PILL)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Référence — le holder-chip mono, sans retour à la ligne ────────────── */

export function RefChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap rounded-lg px-2 py-1 font-mono text-[12px] font-bold', SURFACE.holder, className)}>
      {children}
    </span>
  );
}

/* ── Dialogue centré — le remplaçant desktop du BottomSheet ─────────────── */

export function CenterDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose: () => void;
  /** Bound to ⌘⏎ / Ctrl+⏎ while the dialog is open. */
  onConfirm?: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const onConfirmRef = React.useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  React.useEffect(() => {
    if (!open) return;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onConfirmRef.current) {
        e.preventDefault();
        onConfirmRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        className={cn(
          'relative max-h-[calc(100vh-64px)] overflow-y-auto rounded-[28px] p-5',
          SURFACE.card,
          'ring-1 ring-black/[0.08] dark:ring-white/[0.08]',
        )}
        style={{ width }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className={cn('text-[17px] font-bold', TEXT.strong)}>{title}</h2>
          <Holder icon={X} size="sm" onClick={onClose} ariaLabel="Fermer" />
        </div>
        {children}
        {footer && <div className="mt-4 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}
