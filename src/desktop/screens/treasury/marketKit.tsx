/**
 * « Salle des marchés » — le langage visuel retenu pour la Trésorerie.
 *
 * Direction choisie sur maquette (A) après rejet du kit partagé : le lilas,
 * DM Sans, les pilules tout-rond et les icônes fines. Ici :
 *
 *   · gris NEUTRES, aucun lilas ; l'indigo est un accent rare (onglet actif,
 *     focus), jamais une couleur de fond ;
 *   · Inter en texte, **JetBrains Mono sur tous les chiffres** — c'est ce qui
 *     rend une colonne de montants lisible d'un coup d'œil ;
 *   · angles nets : 6px (cartes, boutons, champs), 4px (petits contrôles).
 *     Le tout-rond est réservé aux points de statut ;
 *   · onglets SOULIGNÉS, filtres carrés, badges Achat/Vente réduits à une
 *     barre de couleur + un mot en capitales.
 *
 * Portée : la Trésorerie d'abord (décision du fondateur), le reste de l'admin
 * ensuite. Ce fichier est donc volontairement autonome du kit partagé — il
 * est écrit pour devenir le kit global, pas pour s'y greffer.
 */
import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Tokens ──────────────────────────────────────────────────────── */

export const M = {
  /** Fond de page. */
  canvas: 'bg-[#F4F4F5] dark:bg-[#09090B]',
  /** Surface d'une carte / d'un panneau. */
  card: 'bg-white dark:bg-[#18181B]',
  /** Encart posé sur une carte (en-tête de table, valeur calculée). */
  inset: 'bg-[#FAFAFA] dark:bg-[#212124]',
  /** Trait de séparation d'une surface. */
  border: 'border-[#E4E4E7] dark:border-[#27272A]',
  /** Filet entre deux lignes de table — plus clair que la bordure. */
  rule: 'border-[#F4F4F5] dark:border-[#242427]',
  /** Survol de ligne. */
  hover: 'hover:bg-[#FAFAFA] dark:hover:bg-[#212124]',
} as const;

export const T = {
  ink: 'text-[#09090B] dark:text-[#FAFAFA]',
  body: 'text-[#52525B] dark:text-[#A1A1AA]',
  muted: 'text-[#71717A] dark:text-[#8B8B93]',
  faint: 'text-[#A1A1AA] dark:text-[#6B6B73]',
} as const;

/** Chiffres : toujours en mono tabulaire. */
export const NUM = 'font-mono tabular-nums';

/** Étiquette de section / en-tête de colonne. */
export const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em]';

export const ACCENT = '#4F46E5';
/** Achat = entrée de stock · Vente = sortie. Deux teintes, pas deux pastels. */
export const TONE = {
  purchase: 'text-[#4F46E5] dark:text-[#818CF8]',
  purchaseBar: 'border-[#4F46E5] dark:border-[#818CF8]',
  sale: 'text-[#B45309] dark:text-[#FBBF24]',
  saleBar: 'border-[#B45309] dark:border-[#FBBF24]',
  positive: 'text-[#15803D] dark:text-[#4ADE80]',
  negative: 'text-[#B91C1C] dark:text-[#F87171]',
} as const;

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] dark:focus-visible:ring-[#818CF8]';

/**
 * Racine de page du module.
 *
 * La coquille de l'admin (`DesktopAppShell`) peint le canevas lilas partagé
 * sur un ANCÊTRE : un calque en `-z-10` passerait derrière lui et resterait
 * invisible (erreur commise au premier essai). Le module annule donc la
 * gouttière de `main` (`px-8 py-7`) par des marges négatives et repeint
 * lui-même la zone de contenu en neutre.
 *
 * Tant que la direction n'est pas étendue au reste de l'admin (décision :
 * Trésorerie d'abord), c'est ce qui isole le module sans toucher aux autres
 * écrans ni à la barre latérale.
 */
export const M_PAGE = cn('font-ui -mx-8 -my-7 min-h-screen px-8 py-7', M.canvas);

/* ── Boutons ─────────────────────────────────────────────────────── */

export function MButton({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  loading,
  type = 'button',
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
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
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] px-3.5 text-[12.5px] font-semibold transition-colors',
        FOCUS,
        dead && 'cursor-not-allowed opacity-45',
        variant === 'primary' && 'bg-[#18181B] text-white dark:bg-[#FAFAFA] dark:text-[#18181B]',
        variant === 'secondary' && cn('border bg-white dark:bg-[#18181B]', M.border, T.ink),
        variant === 'danger' && 'bg-[#B91C1C] text-white',
        variant === 'ghost' && cn('bg-transparent', T.body),
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ── Onglets soulignés (remplacent les pilules) ──────────────────── */

export function MTabs<K extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  value: K;
  onChange: (k: K) => void;
  ariaLabel: string;
}) {
  return (
    <nav className={cn('flex items-center gap-6 border-b', M.border)} aria-label={ariaLabel}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'relative -mb-px border-b-2 pb-2.5 text-[13px] transition-colors',
              FOCUS,
              on
                ? cn('border-[#4F46E5] font-semibold dark:border-[#818CF8]', T.ink)
                : cn('border-transparent font-medium', T.muted, 'hover:text-[#09090B] dark:hover:text-[#FAFAFA]'),
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

/* ── Filtre carré avec compteur ──────────────────────────────────── */

export function MChip({
  label,
  count,
  active,
  onClick,
}: {
  label: React.ReactNode;
  count?: number | null;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-[4px] px-2.5 text-[11.5px] font-semibold transition-colors',
        FOCUS,
        active
          ? 'bg-[#18181B] text-white dark:bg-[#FAFAFA] dark:text-[#18181B]'
          : cn('border bg-white dark:bg-[#18181B]', M.border, T.body),
      )}
    >
      {label}
      {count != null && <span className={cn(NUM, 'text-[10.5px] opacity-55')}>{count}</span>}
    </button>
  );
}

/* ── Menu déroulant compact ──────────────────────────────────────── */

export function MDropdown<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: V;
  options: ReadonlyArray<{ value: V; label: string }>;
  onChange: (v: V) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
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
        className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-[4px] border px-2.5 text-[11.5px] font-semibold', FOCUS, M.border, 'bg-white dark:bg-[#18181B]', T.body)}
      >
        {label && <span className={T.faint}>{label}</span>}
        {current?.label ?? ''}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className={cn('absolute right-0 z-30 mt-1 min-w-[150px] rounded-[6px] border py-1', M.border, M.card, 'shadow-sm')} role="listbox">
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
              className={cn('block w-full px-3 py-1.5 text-left text-[12px]', o.value === value ? cn('font-semibold', T.ink) : T.body, M.hover)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Champ de recherche ──────────────────────────────────────────── */

export function MSearch({
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
      <Search className={cn('pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', T.faint)} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'h-[26px] w-full rounded-[4px] border pl-7 pr-7 text-[11.5px]',
          FOCUS,
          M.border,
          'bg-white dark:bg-[#18181B]',
          T.ink,
          'placeholder:text-[#A1A1AA] dark:placeholder:text-[#6B6B73]',
        )}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer" className={cn('absolute right-1.5 top-1/2 -translate-y-1/2 p-1', T.faint)}>
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ── Carte ───────────────────────────────────────────────────────── */

export function MCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-[6px] border', M.border, M.card, className)}>{children}</div>;
}

export function MCardHeader({ title, meta, action }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b px-4 py-2.5', M.border)}>
      <span className={cn('text-[12.5px] font-semibold', T.ink)}>{title}</span>
      <div className="flex items-center gap-2">
        {meta && <span className={cn('text-[11.5px]', NUM, T.muted)}>{meta}</span>}
        {action}
      </div>
    </div>
  );
}

export function MSection({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn(LABEL, T.muted)}>{children}</span>
      {right}
    </div>
  );
}

/* ── Table ───────────────────────────────────────────────────────── */

export function MTh({
  children,
  align = 'left',
  sortable,
  sorted,
  onSort,
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  sorted?: 'asc' | 'desc' | null;
  onSort?: () => void;
  className?: string;
}) {
  const inner = (
    <span className={cn('inline-flex items-center gap-1', LABEL, sorted ? T.ink : T.muted)}>
      {children}
      {sorted ? <ChevronDown className={cn('h-3 w-3', sorted === 'asc' && 'rotate-180')} /> : sortable && <ChevronsUpDown className="h-3 w-3 opacity-45" />}
    </span>
  );
  return (
    <th scope="col" className={cn('whitespace-nowrap px-4 py-2.5', align === 'right' ? 'text-right' : 'text-left', className)}>
      {sortable && onSort ? (
        <button type="button" onClick={onSort} className={FOCUS}>
          {inner}
        </button>
      ) : (
        inner
      )}
    </th>
  );
}

export function MTd({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td className={cn('whitespace-nowrap border-t px-4 py-2.5', M.rule, align === 'right' && 'text-right', className)}>
      {children}
    </td>
  );
}

/** Badge Achat / Vente : barre de couleur + mot, pas de pastille pleine. */
export function MTypeTag({ kind }: { kind: 'purchase' | 'sale' }) {
  const purchase = kind === 'purchase';
  return (
    <span
      className={cn(
        'border-l-2 pl-1.5 text-[10px] font-bold uppercase tracking-[0.06em]',
        purchase ? cn(TONE.purchase, TONE.purchaseBar) : cn(TONE.sale, TONE.saleBar),
      )}
    >
      {purchase ? 'Achat' : 'Vente'}
    </span>
  );
}

/** Marqueur d'état discret (annulée, archivée…). */
export function MTag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'danger' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[3px] px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em]',
        tone === 'danger'
          ? 'bg-[#FEF2F2] text-[#B91C1C] dark:bg-[#3F1D1D] dark:text-[#F87171]'
          : cn(M.inset, T.muted),
      )}
    >
      {children}
    </span>
  );
}

/* ── Pagination ──────────────────────────────────────────────────── */

export function MPagination({
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
  return (
    <div className={cn('flex items-center justify-between border-t px-4 py-2', M.border)}>
      <span className={cn('text-[11.5px]', T.muted)}>
        <span className={NUM}>{rangeLabel}</span> sur <span className={cn(NUM, 'font-semibold', T.ink)}>{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Page précédente"
          className={cn('flex h-6 w-6 items-center justify-center rounded-[4px] border disabled:opacity-35', M.border, T.body)}
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        <span className={cn('px-2 text-[11.5px]', NUM, T.body)}>
          {page} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Page suivante"
          className={cn('flex h-6 w-6 items-center justify-center rounded-[4px] border disabled:opacity-35', M.border, T.body)}
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Formulaire ──────────────────────────────────────────────────── */

export function MField({
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
      <label htmlFor={htmlFor} className={cn('block text-[12px] font-semibold', T.ink)}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={cn('text-[11.5px] font-medium', TONE.negative)}>{error}</p>
      ) : hint ? (
        <p className={cn('text-[11.5px] leading-snug', T.muted)}>{hint}</p>
      ) : null}
    </div>
  );
}

export const M_INPUT = cn(
  'h-8 w-full rounded-[6px] border px-2.5 text-[12.5px]',
  FOCUS,
  M.border,
  'bg-white dark:bg-[#18181B]',
  T.ink,
  'placeholder:text-[#A1A1AA] dark:placeholder:text-[#6B6B73]',
);

export function MInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn(M_INPUT, className)} />;
}

/* ── Dialogue centré ─────────────────────────────────────────────── */

export function MDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  footer,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const confirmRef = React.useRef(onConfirm);
  confirmRef.current = onConfirm;

  React.useEffect(() => {
    if (!open) return;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeRef.current();
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && confirmRef.current) {
        e.preventDefault();
        return confirmRef.current();
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
    const t = window.setTimeout(() => focusables()[0]?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fermer" onClick={onClose} className="absolute inset-0 bg-black/45" />
      <div ref={panelRef} style={{ width }} className={cn('relative max-h-[85vh] overflow-auto rounded-[8px] border', M.border, M.card)}>
        <div className={cn('border-b px-4 py-3', M.border)}>
          <h2 className={cn('text-[14px] font-semibold', T.ink)}>{title}</h2>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && <div className={cn('flex gap-2 border-t px-4 py-3', M.border)}>{footer}</div>}
      </div>
    </div>
  );
}

/* ── États ───────────────────────────────────────────────────────── */

export function MEmpty({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-[6px]', M.inset, T.faint)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={cn('mt-3 text-[12.5px]', T.muted)}>{children}</p>
    </div>
  );
}

export function MLoading() {
  return (
    <div className="flex justify-center py-14">
      <span className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', T.faint)} />
    </div>
  );
}
