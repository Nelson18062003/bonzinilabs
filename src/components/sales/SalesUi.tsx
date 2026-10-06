// ============================================================
// ESPACE COMMERCIAL — les primitives de « /v », dans le langage de
// beautifului.dev : étiquette de statut (RECORDS TABLE), segmenté à
// pastille glissante (FINE-TUNE CARD), compteur qui roule et progression
// (APPROVAL CARD), recherche (SEARCH), reflet de chargement (LOADING
// STATE). Couleurs et mouvements : src/index.css, sous `.sales-ui`.
// Purement présentationnelles : aucune requête.
// ============================================================
import { useEffect, useRef, type ReactNode } from 'react';
import { AlertCircle, Pencil, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PROSPECT_STATUS, type ProspectStatus } from '@/lib/sales';
import { CARD, SECTION_TITLE, STATUS_TONE, btn, descId } from './uiClasses';

/* ── Statut ────────────────────────────────────────────────────────────── */

/** « ● Intéressé » : une étiquette teintée, comme une cellule de RECORDS TABLE. */
export function StatusTag({ status, className }: { status: ProspectStatus; className?: string }) {
  return (
    <span
      data-tone={STATUS_TONE[status]}
      className={cn('s-tag inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[13px] font-medium', className)}
    >
      <span className="s-tag-dot h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden />
      {PROSPECT_STATUS[status].label}
    </span>
  );
}

/* ── Segmenté ──────────────────────────────────────────────────────────── */

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/** Des options de même largeur sur une piste grise ; la pastille blanche glisse sous celle qui est choisie. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled,
  className,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  const i = options.findIndex((o) => o.value === value);
  const n = options.length;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('s-seg relative grid rounded-[14px] p-1', className)}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {i >= 0 && (
        <span
          aria-hidden
          className="s-seg-thumb absolute bottom-1 left-1 top-1 rounded-[11px]"
          style={{ width: `calc((100% - 8px) / ${n})`, transform: `translateX(${i * 100}%)` }}
        />
      )}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(o.value)}
            className="s-seg-opt relative z-10 flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-[11px] px-2 text-[15px] font-semibold disabled:cursor-not-allowed"
          >
            {o.icon}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Étapes ────────────────────────────────────────────────────────────── */

/** Un nombre qui roule quand il change : vers le haut s'il augmente, vers le bas sinon. */
export function Odometer({ value, className }: { value: number; className?: string }) {
  const prev = useRef(value);
  const first = useRef(true);
  const dir = value >= prev.current ? 'up' : 'down';
  useEffect(() => {
    prev.current = value;
    first.current = false;
  }, [value]);
  return (
    <span className={cn('relative inline-flex overflow-hidden align-bottom tabular-nums', className)}>
      <span key={value} className={first.current ? undefined : dir === 'up' ? 's-roll-up' : 's-roll-down'}>
        {value}
      </span>
    </span>
  );
}

/** La progression fine en tête de l'assistant : un segment par étape, celle en cours en violet. */
export function StepProgress({ index, count, className }: { index: number; count: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={`Étape ${index + 1} sur ${count}`}
      aria-valuemin={1}
      aria-valuemax={count}
      aria-valuenow={index + 1}
      className={cn('s-progress flex gap-1', className)}
    >
      {Array.from({ length: count }, (_, k) => (
        <span key={k} data-current={k === index} className="h-[3px] flex-1 overflow-hidden rounded-full">
          <i className="block h-full w-full rounded-full" style={{ transform: `scaleX(${k <= index ? 1 : 0})` }} />
        </span>
      ))}
    </div>
  );
}

/* ── Champs ────────────────────────────────────────────────────────────── */

/**
 * Un champ : son libellé (« facultatif » en gris), le contrôle, puis l'erreur
 * — qui apparaît d'un léger « pop » — ou l'indice, sous l'identifiant
 * `descId(htmlFor)` (le contrôle le pose en `aria-describedby`, et
 * `aria-required` s'il est obligatoire : l'étoile, elle, n'est pas lue).
 * `group` : le libellé nomme un groupe (sexe, ville) et non un champ unique.
 */
export function Field({
  label,
  htmlFor,
  optional,
  required,
  group,
  hint,
  error,
  aside,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  optional?: boolean;
  /** Une étoile discrète : le serveur le refusera vide. */
  required?: boolean;
  group?: boolean;
  hint?: ReactNode;
  error?: string | null;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const labelCls = 'text-[14px] font-semibold s-ink';
  const text = (
    <>
      {label}
      {required && <span className="ml-0.5 s-accent" aria-hidden>*</span>}
      {optional && <span className="ml-1.5 font-normal s-ink-3">facultatif</span>}
    </>
  );
  return (
    <div className={className}>
      <div className="mb-2 flex min-h-[20px] items-baseline justify-between gap-3">
        {group ? (
          <span id={`${htmlFor}-label`} className={labelCls}>
            {text}
          </span>
        ) : (
          <label htmlFor={htmlFor} className={labelCls}>
            {text}
          </label>
        )}
        {aside}
      </div>
      {children}
      {error ? (
        <p key={error} id={descId(htmlFor)} role="alert" className="s-pop mt-2 flex items-start gap-1.5 text-[14px] font-medium s-bad">
          <AlertCircle className="mt-[2px] h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <div id={descId(htmlFor)} className="mt-2 text-[14px] leading-snug s-ink-2">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ── Recherche ─────────────────────────────────────────────────────────── */

export function SearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div className={cn('s-raised flex h-12 items-center gap-2.5 rounded-[14px] pl-3.5 pr-2', className)}>
      <Search className="h-[18px] w-[18px] shrink-0 s-ink-3" aria-hidden />
      {/* eslint-disable-next-line no-restricted-syntax -- champ de recherche de « /v » : 16 px, pas de zoom iOS */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none s-ink placeholder:text-[hsl(var(--s-ink-4))]"
      />
      {value && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onClick={() => onChange('')}
          className="s-pop flex h-8 w-8 items-center justify-center rounded-full s-ink-3 transition-colors hover:bg-[hsl(var(--s-hover-2))]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ── Chargement ────────────────────────────────────────────────────────── */

/** Un libellé sur lequel court un reflet (« Enregistrement… »). Immobile si le mouvement est réduit. */
export function Shimmer({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('s-shimmer', className)}>{children}</span>;
}

/* ── Fiche ─────────────────────────────────────────────────────────────── */

/** Une section de la fiche : titre en petites capitales, « Modifier » à droite. */
export function SectionCard({
  title,
  onEdit,
  editLabel,
  children,
  className,
  delay = 0,
}: {
  title: string;
  onEdit?: () => void;
  editLabel?: string;
  children: ReactNode;
  className?: string;
  /** Décalage de l'apparition, en ms (les sections entrent l'une après l'autre). */
  delay?: number;
}) {
  return (
    <section className={cn(CARD, 's-enter overflow-hidden', className)} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <header className="flex min-h-[48px] items-center justify-between gap-3 pl-4 pr-2 sm:pl-5">
        <h2 className={SECTION_TITLE}>{title}</h2>
        {onEdit && (
          <button type="button" onClick={onEdit} aria-label={editLabel ?? `Modifier : ${title}`} className={btn('ghost', 'sm', 'gap-1.5')}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Modifier
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** Une ligne « libellé — valeur » d'une section. Vide : « Non renseigné », en gris. */
export function DetailRow({ label, children, className }: { label: string; children?: ReactNode; className?: string }) {
  const empty = children == null || children === '' || children === false;
  return (
    <div className={cn('flex items-start justify-between gap-4 px-4 py-3 sm:px-5', className)}>
      <dt className="shrink-0 pt-px text-[14px] s-ink-2">{label}</dt>
      <dd className={cn('min-w-0 break-words text-right text-[15px]', empty ? 's-ink-3' : 'font-medium s-ink')}>{empty ? 'Non renseigné' : children}</dd>
    </div>
  );
}
