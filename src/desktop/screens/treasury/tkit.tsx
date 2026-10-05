/**
 * Trésorerie desktop — le kit visuel du module (refonte d'octobre 2026).
 *
 * Pourquoi un kit à part : l'ancien module empilait QUATRE langages visuels
 * (marketKit « salle des marchés », kit mobile, kit desktop, composants
 * treasury), 23 tailles de texte et des contrastes jusqu'à 1,07:1 — d'où le
 * « flou » et le « on ne voit pas ». Ici, une seule grammaire, alignée sur le
 * thème `.admin-theme` du reste de l'admin desktop :
 *
 *   · fond gris clair, cartes blanches cerclées, encre noire, rayon 10 px ;
 *   · la COULEUR PORTE UN SENS, jamais une décoration : vert = entrée / hausse,
 *     rouge = sortie / alerte, ambre = à surveiller ;
 *   · une devise est TOUJOURS écrite (pastille XAF / USDT / CNY), jamais
 *     suggérée par une couleur ;
 *   · trois tailles de texte utiles (12 / 13.5 / 15) + les chiffres-titres ;
 *   · chaque bloc de données gère ses trois états : chargement, erreur
 *     (avec « Réessayer »), vide — un chargement ne s'affiche plus « 0 ».
 *
 * Les fenêtres (panneau latéral, confirmation) sont rendues EN LIGNE et non
 * dans un portail : elles héritent ainsi des variables de `.admin-theme`.
 */
import * as React from 'react';
import { AlertTriangle, ArrowLeft, CalendarDays, Check, ChevronDown, Clock, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { TreasuryCurrency } from './treasuryFormat';
import { BTN, INPUT, TK, parseAmount } from './tstyle';
import { normalizeText } from '@/lib/clientSearch';
import { CURRENCY_DECIMALS, fmtNum } from './treasuryFormat';
import { sourceLabel, sourcePath } from './treasuryLabels';

/* ── Montants ───────────────────────────────────────────────────────────── */

/** La devise, écrite. Jamais une couleur seule. */
export function Cur({ c, className }: { c: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-[5px] bg-muted px-1.5 text-[11px] font-bold tracking-[0.03em] text-foreground/75',
        className,
      )}
    >
      {c}
    </span>
  );
}


/**
 * Un montant dans sa devise. `sign` affiche + / − ; `tone` colore selon le
 * sens (entrée verte, sortie rouge) — seulement quand le sens est l'information.
 */
export function Money({
  value,
  cur,
  decimals,
  sign = false,
  tone = false,
  size = 'md',
  showCur = true,
  className,
}: {
  value: number | null | undefined;
  cur: TreasuryCurrency;
  decimals?: number;
  sign?: boolean;
  tone?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showCur?: boolean;
  className?: string;
}) {
  const d = decimals ?? CURRENCY_DECIMALS[cur];
  const n = value === null || value === undefined || !Number.isFinite(value) ? null : value;
  const text = n === null ? '—' : `${sign ? (n > 0 ? '+ ' : n < 0 ? '− ' : '') : n < 0 ? '− ' : ''}${fmtNum(Math.abs(n), d)}`;
  const color = tone && n !== null && n !== 0 ? (n > 0 ? TK.in : TK.out) : '';
  const sz =
    size === 'xl' ? 'text-[30px] font-extrabold tracking-tight' :
    size === 'lg' ? 'text-[20px] font-bold tracking-tight' :
    size === 'sm' ? 'text-[13px] font-semibold' : 'text-[14px] font-semibold';
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', TK.num, className)}>
      <span className={cn(sz, color)}>{text}</span>
      {showCur && n !== null && <Cur c={cur} className={size === 'xl' || size === 'lg' ? 'translate-y-[-3px]' : ''} />}
    </span>
  );
}

/** Un taux, avec son unité écrite en entier. */
export function Rate({ value, unit, decimals = 2, className }: { value: number | null | undefined; unit: string; decimals?: number; className?: string }) {
  const ok = value !== null && value !== undefined && Number.isFinite(value) && value !== 0;
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 whitespace-nowrap', TK.num, className)}>
      <span className="text-[14px] font-semibold">{ok ? fmtNum(value as number, decimals) : '—'}</span>
      {ok && <span className="text-[11.5px] font-semibold text-muted-foreground">{unit}</span>}
    </span>
  );
}

/* ── Cartes ─────────────────────────────────────────────────────────────── */

export function Card({ className, children, as: As = 'section' }: { className?: string; children: React.ReactNode; as?: 'section' | 'div' | 'aside' }) {
  return <As className={cn(TK.card, className)}>{children}</As>;
}

export function CardHead({ title, meta, action, className }: { title: React.ReactNode; meta?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[56px] items-center justify-between gap-4 border-b border-border px-5', className)}>
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-bold text-foreground">{title}</h3>
        {meta && <div className="text-[12.5px] text-muted-foreground">{meta}</div>}
      </div>
      {action}
    </div>
  );
}

/** Lien de bas de carte ou d'en-tête : « Voir les comptes › ». */
export function MoreLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-foreground hover:underline', TK.focus)}>
      {children} <span aria-hidden>›</span>
    </button>
  );
}

/** Un chiffre clé avec son libellé et une ligne d'explication. */
export function Stat({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn(TK.inset, 'p-3.5', className)}>
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className="mt-1">{children}</div>
      {hint && <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Rangée de chiffres sous un en-tête de carte : « Achats 14 · USDT 40 500 … ». */
export function SummaryBar({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="flex min-h-[48px] flex-wrap items-center gap-x-7 gap-y-1 border-b border-border px-5 py-2 text-[13px]">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">{it.label}</span>
          <span className={cn('font-bold text-foreground', TK.num)}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Tableaux ───────────────────────────────────────────────────────────── */

export function Th({ children, align = 'left', className }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-border bg-muted/40 px-4 py-2.5 text-[12px] font-semibold text-muted-foreground',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', className, muted }: { children?: React.ReactNode; align?: 'left' | 'right'; className?: string; muted?: boolean }) {
  return (
    <td
      className={cn(
        'whitespace-nowrap border-b border-border/60 px-4 py-3 text-[13.5px]',
        align === 'right' && 'text-right',
        muted ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      {children}
    </td>
  );
}

/**
 * Ligne cliquable ET atteignable au clavier (Entrée / Espace) — l'ancien
 * tableau ne s'ouvrait qu'à la souris.
 */
export function RowButton({
  onOpen,
  selected,
  muted,
  children,
  label,
}: {
  onOpen: () => void;
  selected?: boolean;
  muted?: boolean;
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <tr
      tabIndex={0}
      role="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none',
        selected && 'bg-muted/70 hover:bg-muted/70',
        muted && 'text-muted-foreground [&_td]:text-muted-foreground',
      )}
    >
      {children}
    </tr>
  );
}

/* ── États : chargement, erreur, vide ───────────────────────────────────── */

export function Loading({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2.5 p-5', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-md bg-muted" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry, children, className }: { onRetry?: () => void; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)} role="alert">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div>
        <div className="text-[14px] font-semibold text-foreground">Impossible de charger ces données</div>
        <div className="mt-0.5 text-[13px] text-muted-foreground">{children ?? 'Vérifiez votre connexion, puis réessayez.'}</div>
      </div>
      {onRetry && (
        <button type="button" onClick={onRetry} className={BTN.soft}>
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      )}
    </div>
  );
}

export function Empty({ icon: Icon, title, children, action, className }: { icon?: React.ElementType; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div>
        <div className="text-[14px] font-semibold text-foreground">{title}</div>
        {children && <div className="mx-auto mt-0.5 max-w-[420px] text-[13px] text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ── Contrôles ──────────────────────────────────────────────────────────── */

/** Interrupteur segmenté (sous-rubriques, modes de saisie). */
export function Segmented<V extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
}: {
  value: V;
  onChange: (v: V) => void;
  options: ReadonlyArray<{ value: V; label: React.ReactNode; count?: number }>;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex shrink-0 gap-1 rounded-lg bg-muted p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3.5 font-semibold transition-colors',
              size === 'sm' ? 'h-7 text-[12.5px]' : 'h-8 text-[13.5px]',
              TK.focus,
              active ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-foreground/70 hover:text-foreground',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('rounded px-1 text-[11.5px]', TK.num, active ? 'bg-muted text-foreground' : 'text-muted-foreground')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Ferme un menu au clic extérieur et à Échap. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement>) {
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, close, ref]);
}

export interface PickOption {
  value: string;
  label: string;
  /** Petite étiquette à gauche (F-003) ou à droite (solde). */
  tag?: string;
  hint?: string;
}

/**
 * Sélecteur avec recherche, rendu EN LIGNE (pas de portail). Sert pour les
 * filtres (« Fournisseur : tous ») et pour les champs de formulaire. L'option
 * « Tous » est un vrai choix : l'ancien sélecteur ne permettait plus d'y
 * revenir sans tout réinitialiser.
 */
export function Picker({
  value,
  onChange,
  options,
  placeholder = 'Choisir…',
  allLabel,
  prefix,
  variant = 'filter',
  searchable,
  footer,
  invalid,
  id,
  ariaLabel,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PickOption[];
  placeholder?: string;
  /** Présent = filtre avec option « Tous » (valeur ''). */
  allLabel?: string;
  /** Texte avant la valeur dans un filtre : « Fournisseur : ». */
  prefix?: string;
  variant?: 'filter' | 'field';
  searchable?: boolean;
  footer?: (close: () => void) => React.ReactNode;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
  /** Champ étroit : l'indication (solde) n'est montrée que dans la liste. */
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => {
    setOpen(false);
    setQ('');
  }, []);
  useDismiss(open, close, ref);

  const selected = options.find((o) => o.value === value);
  const canSearch = searchable ?? options.length > 7;
  const shown = q ? options.filter((o) => normalizeText(`${o.tag ?? ''} ${o.label} ${o.hint ?? ''}`).includes(normalizeText(q))) : options;
  const display = selected ? selected.label : allLabel && value === '' ? allLabel : null;

  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div ref={ref} className={cn('relative', variant === 'field' && 'w-full')}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 text-left transition-colors',
          TK.focus,
          variant === 'filter'
            ? cn('h-9 rounded-lg border bg-card px-3 text-[13.5px] font-medium hover:bg-accent', value ? 'border-foreground/40' : 'border-border')
            : cn('h-11 rounded-lg border bg-card px-3 text-[14px]', invalid ? 'border-red-500' : 'border-input hover:border-foreground/40'),
        )}
      >
        {variant === 'field' && selected?.tag && (
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px] font-bold text-foreground/80">{selected.tag}</span>
        )}
        <span className={cn('min-w-0 flex-1 truncate', !display && 'text-muted-foreground')}>
          {prefix && <span className="text-muted-foreground">{prefix} </span>}
          {display ?? placeholder}
        </span>
        {variant === 'field' && !compact && selected?.hint && <span className="shrink-0 text-[12px] text-muted-foreground">{selected.hint}</span>}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-full min-w-[260px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
          {canSearch && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="h-10 w-full bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <ul role="listbox" className="max-h-[280px] overflow-y-auto py-1">
            {allLabel && !q && (
              <PickRow active={value === ''} onClick={() => pick('')}>
                {allLabel}
              </PickRow>
            )}
            {shown.map((o) => (
              <PickRow key={o.value} active={o.value === value} onClick={() => pick(o.value)} tag={o.tag} hint={o.hint}>
                {o.label}
              </PickRow>
            ))}
            {shown.length === 0 && <li className="px-3 py-3 text-[13px] text-muted-foreground">Aucun résultat</li>}
          </ul>
          {footer && <div className="border-t border-border p-1">{footer(close)}</div>}
        </div>
      )}
    </div>
  );
}

function PickRow({ active, onClick, tag, hint, children }: { active: boolean; onClick: () => void; tag?: string; hint?: string; children: React.ReactNode }) {
  return (
    <li role="option" aria-selected={active}>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] hover:bg-accent">
        <Check className={cn('h-4 w-4 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
        {tag && <span className="rounded bg-muted px-1.5 text-[11.5px] font-bold text-foreground/80">{tag}</span>}
        <span className="min-w-0 flex-1 truncate">{children}</span>
        {hint && <span className="shrink-0 text-[12px] text-muted-foreground">{hint}</span>}
      </button>
    </li>
  );
}

/** Champ de recherche de barre d'outils. */
export function SearchInput({ value, onChange, placeholder = 'Rechercher…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cn('flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:ring-2 focus-within:ring-ring', className)}>
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Effacer la recherche" className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

/* ── Formulaires ────────────────────────────────────────────────────────── */

export function Field({ label, optional, hint, error, htmlFor, children, className }: { label: string; optional?: boolean; hint?: React.ReactNode; error?: string | null; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('block', className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-foreground">
        {label} {optional && <span className="font-normal text-muted-foreground">(facultatif)</span>}
      </label>
      {children}
      {error ? (
        <div className="mt-1 text-[12.5px] font-medium text-red-700 dark:text-red-400">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-[12.5px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const { className, invalid, ...rest } = props;
  return <input {...rest} className={cn(INPUT, invalid && 'border-red-500', className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cn(INPUT, 'h-auto min-h-[84px] py-2.5 leading-snug', className)} />;
}

/**
 * Champ de montant : affiche les milliers pendant la saisie, garde la valeur
 * en nombre, et écrit l'unité à droite (XAF, USDT, « XAF / USDT »).
 */
export function AmountInput({
  value,
  onChange,
  unit,
  decimals,
  invalid,
  id,
  placeholder = '0',
  autoFocus,
  readOnly,
  ariaLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
  decimals: number;
  invalid?: boolean;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const fmt = React.useCallback(
    (n: number | null) => (n === null ? '' : n.toLocaleString('fr-FR', { maximumFractionDigits: decimals }).replace(/\u202f/g, ' ')),
    [decimals],
  );
  const [text, setText] = React.useState(() => fmt(value));
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value, fmt]);

  return (
    <div
      className={cn(
        'flex h-11 items-center gap-2 rounded-lg border bg-card px-3 transition-colors focus-within:ring-2 focus-within:ring-ring',
        invalid ? 'border-red-500' : 'border-input hover:border-foreground/40',
        readOnly && 'bg-muted/50',
      )}
    >
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        readOnly={readOnly}
        value={text}
        placeholder={placeholder}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(fmt(value));
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/-/g, '');
          setText(raw);
          onChange(parseAmount(raw, decimals));
        }}
        className={cn('h-full min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground', TK.num)}
      />
      <span className="shrink-0 rounded-[5px] bg-muted px-1.5 py-0.5 text-[11.5px] font-bold text-foreground/75">{unit}</span>
    </div>
  );
}

/**
 * Date et heure d'une opération, en heure du poste. Le calendrier s'ouvre EN
 * LIGNE (pas de portail) : dans un panneau latéral, un calendrier en portail
 * passait sous le panneau.
 */
export function WhenField({ value, onChange, id }: { value: string; onChange: (iso: string) => void; id?: string }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, ref);
  const d = React.useMemo(() => {
    const p = new Date(value);
    return Number.isNaN(p.getTime()) ? new Date() : p;
  }, [value]);
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const [time, setTime] = React.useState(hhmm);
  React.useEffect(() => setTime(hhmm), [hhmm]);
  const label = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  // Une opération ne se date pas dans le futur : le calendrier bloque les
  // jours à venir, l'heure est ramenée à maintenant.
  const emit = (next: Date) => {
    const now = new Date();
    onChange((next > now ? now : next).toISOString());
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative flex-1">
        <button
          id={id}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn('flex h-11 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-left text-[14px] hover:border-foreground/40', TK.focus)}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="first-letter:uppercase">{label}</span>
        </button>
        {open && (
          <div className="absolute left-0 z-50 mt-1.5 rounded-lg border border-border bg-popover shadow-lg">
            <Calendar
              mode="single"
              selected={d}
              defaultMonth={d}
              locale={fr}
              disabled={{ after: new Date() }}
              onSelect={(day) => {
                if (!day) return;
                const next = new Date(day);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                emit(next);
                close();
              }}
            />
          </div>
        )}
      </div>
      <label className="flex h-11 w-[108px] items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring">
        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          inputMode="numeric"
          aria-label="Heure (24 h)"
          value={time}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
            setTime(raw);
            const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
            if (m) {
              const next = new Date(d);
              next.setHours(Number(m[1]), Number(m[2]), 0, 0);
              emit(next);
            }
          }}
          onBlur={() => setTime(hhmm)}
          className={cn('h-full w-full min-w-0 bg-transparent text-[14px] outline-none', TK.num)}
        />
      </label>
      <button type="button" className={BTN.ghost} onClick={() => onChange(new Date().toISOString())}>
        Maintenant
      </button>
    </div>
  );
}

/** Une étape numérotée d'un formulaire. */
export function Step({ n, title, hint, children }: { n: number; title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-border pb-6 last:border-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">{n}</span>
        <div>
          <h3 className="text-[15px] font-bold text-foreground">{title}</h3>
          {hint && <p className="text-[12.5px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <div className="mt-4 space-y-3 pl-9">{children}</div>
    </section>
  );
}

/** Encadré d'une valeur calculée : « Vous payez 7 266 000 XAF ». */
export function Computed({ label, children, tone }: { label: string; children: React.ReactNode; tone?: 'warn' }) {
  return (
    <div
      className={cn(
        'flex min-h-[48px] items-center justify-between gap-4 rounded-lg border px-4 py-2',
        tone === 'warn' ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40' : 'border-border/70 bg-muted/50',
      )}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn('text-[16px] font-extrabold text-foreground', TK.num)}>{children}</span>
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'danger' | 'info'; children: React.ReactNode }) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
      : tone === 'info'
        ? 'border-border bg-muted/50 text-foreground'
        : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-snug', cls)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/* ── Fenêtres ───────────────────────────────────────────────────────────── */

const layers: symbol[] = [];
/** Nombre de fenêtres ouvertes : le défilement de la page reprend au dernier fermé. */
let scrollLocks = 0;

/** Échap ferme seulement la couche du dessus ; le défilement de la page est gelé. */
function useLayer(open: boolean, onEscape: () => void) {
  const ref = React.useRef(onEscape);
  ref.current = onEscape;
  React.useEffect(() => {
    if (!open) return;
    const me = Symbol('layer');
    layers.push(me);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (layers[layers.length - 1] !== me) return;
      ref.current();
    };
    window.addEventListener('keydown', onKey);
    if (++scrollLocks === 1) document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      // Un compteur et non « la valeur d'avant » : une confirmation fermée en
      // même temps que son panneau remettait `hidden` après lui.
      if (--scrollLocks === 0) document.body.style.overflow = '';
      const i = layers.indexOf(me);
      if (i >= 0) layers.splice(i, 1);
    };
  }, [open]);
}

/**
 * Panneau latéral des saisies. Fermer un formulaire REMPLI demande une
 * confirmation (Échap ou un clic à côté effaçaient la saisie sans prévenir).
 */
export function SideSheet({
  open,
  onClose,
  title,
  description,
  dirty,
  footer,
  width = 560,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  dirty?: boolean;
  footer?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}) {
  const [askClose, setAskClose] = React.useState(false);
  const requestClose = () => (dirty ? setAskClose(true) : onClose());
  useLayer(open && !askClose, requestClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] !mt-0" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" tabIndex={-1} onClick={requestClose} className="absolute inset-0 h-full w-full cursor-default bg-black/25" />
      <div className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-card shadow-2xl" style={{ maxWidth: width }}>
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[18px] font-extrabold tracking-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
          <button type="button" onClick={requestClose} className={BTN.icon} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <footer className="border-t border-border bg-muted/40 px-6 py-4">{footer}</footer>}
      </div>
      <Confirm
        open={askClose}
        title="Abandonner la saisie ?"
        confirmLabel="Abandonner"
        danger
        onCancel={() => setAskClose(false)}
        onConfirm={() => {
          setAskClose(false);
          onClose();
        }}
      >
        Les informations tapées seront perdues.
      </Confirm>
    </div>
  );
}

/** Fenêtre centrée (formulaires courts, confirmations). */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  width = 480,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  children?: React.ReactNode;
}) {
  useLayer(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] !mt-0 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fermer" tabIndex={-1} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/30" />
      <div className="relative flex w-full flex-col rounded-[14px] border border-border bg-card shadow-2xl" style={{ maxWidth: width }}>
        <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 className="text-[17px] font-extrabold tracking-tight text-foreground">{title}</h2>
            {description && <div className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className={BTN.icon} aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </header>
        {/* Pas de `overflow` : la liste d'un sélecteur dépasse de la fenêtre au lieu d'y être coupée. */}
        {children && <div className="space-y-4 px-6 py-3">{children}</div>}
        {footer && <footer className="flex items-center justify-end gap-2 px-6 pb-5 pt-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  title,
  children,
  confirmLabel = 'Confirmer',
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={children}
      width={440}
      footer={
        <>
          <button type="button" onClick={onCancel} className={BTN.soft}>
            Retour
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={danger ? BTN.dangerSolid : BTN.primary}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

/** Bouton d'enregistrement avec état « en cours ». */
export function SubmitButton({ busy, disabled, onClick, children }: { busy?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className={BTN.primary}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ── Étiquettes ─────────────────────────────────────────────────────────── */

/** Identifiant lisible d'une contrepartie (F-003, A-001). */
export function IdTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-6 shrink-0 items-center rounded-md bg-muted px-1.5 text-[11.5px] font-bold text-foreground/80', TK.num, className)}>{children}</span>;
}

export function StatusPill({ tone, children }: { tone: 'neutral' | 'danger' | 'warn' | 'ok'; children: React.ReactNode }) {
  const cls = {
    neutral: 'bg-muted text-muted-foreground',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
    warn: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  }[tone];
  return <span className={cn('inline-flex h-6 items-center rounded-md px-2 text-[12px] font-semibold', cls)}>{children}</span>;
}

/** Lien d'action dans un formulaire : « + Nouveau fournisseur ». */
export function TextLink({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-md text-[13.5px] font-semibold text-foreground hover:underline', TK.focus, className)}>
      {children}
    </button>
  );
}

/** Retour d'une fiche vers sa liste : « ← Tous les comptes ». */
export function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold hover:underline', TK.focus)}>
      <ArrowLeft className="h-4 w-4" /> {children}
    </button>
  );
}

/** L'origine d'une écriture du grand livre, cliquable quand elle mène à une opération. */
export function OriginCell({ source, id, onOpen }: { source: string | null; id: string | null; onOpen: (path: string) => void }) {
  const path = sourcePath(source, id);
  if (!path) return <span className="text-muted-foreground">{sourceLabel(source)}</span>;
  return (
    <button type="button" onClick={() => onOpen(path)} className={cn('rounded font-medium underline-offset-2 hover:underline', TK.focus)}>
      {sourceLabel(source)} ›
    </button>
  );
}
