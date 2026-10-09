// ============================================================
// Ventes — pièces partagées par l'espace du commercial (« /v ») et par le
// pilotage du responsable : le sélecteur de mois, la barre d'objectif, les
// chiffres, les états vides / en erreur / pas encore relié.
//
// Purement présentationnelles (aucune requête) : les données arrivent en
// props. Cartes sur filet léger, chiffres tabulaires, couleur réservée au
// sens (atteint, en retard). Dans « /v », la portée `.sales-ui` les relit
// dans le langage de l'espace commercial (les classes `s-*` n'agissent que
// là) ; dans « Mes équipes », elles gardent le thème de l'administration.
// ============================================================
import type { ElementType, ReactNode } from 'react';
import { ChevronLeft, ChevronRight, CircleCheck, Link2Off, Target } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { cn } from '@/lib/utils';
import { TONE_PILL } from '@/mobile/designKit';
import { CountryFlag } from '@/components/form/CountryFlag';
import { formatE164ForDisplay } from '@/components/form/PhoneNumberInput';
import {
  OBJECTIVES,
  PROSPECT_STATUS,
  currentMonth,
  fmtObjective,
  monthLabel,
  progress,
  shiftMonth,
  type Objective,
  type ObjectiveMetric,
  type ProspectStatus,
} from '@/lib/sales';

/** La carte : blanche, rayon 18, filet à peine marqué (dans « /v » : filet et ombre en couches). */
export const SALES_CARD = 'rounded-[18px] bg-card ring-1 ring-black/[0.06] dark:ring-white/10 s-card';

/* ── En-tête d'écran ───────────────────────────────────────────────────── */

/** Titre d'écran : retour éventuel au-dessus, titre, sous-titre, action à droite. */
export function ScreenHeader({
  title,
  subtitle,
  back,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { label: string; onClick: () => void };
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('s-enter flex items-end justify-between gap-3 px-4 pb-1 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-6', className)}>
      <div className="min-w-0">
        {back && (
          <button
            type="button"
            onClick={back.onClick}
            className="-ml-1 mb-1 inline-flex h-9 items-center gap-1 rounded-lg px-1 text-[14px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" /> {back.label}
          </button>
        )}
        <h1 className="break-words text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h1>
        {subtitle != null && <p className="mt-1 text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/* ── Mois ──────────────────────────────────────────────────────────────── */

/**
 * ‹ octobre 2026 › — les mois de Douala (« AAAA-MM-01 »). On ne va pas
 * au-delà de `max` (le mois en cours par défaut) : l'avenir n'a pas de chiffres.
 */
export function MonthSwitcher({
  month,
  onChange,
  max,
  min,
  className,
}: {
  month: string;
  onChange: (month: string) => void;
  max?: string;
  min?: string;
  className?: string;
}) {
  const top = max ?? currentMonth();
  const canNext = month < top;
  const canPrev = !min || month > min;
  const btn =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30';
  return (
    <div className={cn('inline-flex items-center gap-1 p-1', SALES_CARD, className)}>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, -1))} disabled={!canPrev} aria-label="Mois précédent">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span aria-live="polite" className="min-w-[9.5rem] flex-1 text-center text-[15px] font-semibold capitalize tabular-nums">
        {monthLabel(month)}
      </span>
      <button type="button" className={btn} onClick={() => onChange(shiftMonth(month, 1))} disabled={!canNext} aria-label="Mois suivant">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

/* ── Objectifs ─────────────────────────────────────────────────────────── */

const unitOf = (metric: ObjectiveMetric) => OBJECTIVES.find((o) => o.metric === metric)?.unit ?? 'count';
const labelOf = (metric: ObjectiveMetric) => OBJECTIVES.find((o) => o.metric === metric)?.label ?? metric;

/** Un objectif : réalisé / cible, la barre, ce qu'il reste. Vert une fois atteint. */
export function ObjectiveBar({ objective, label, className }: { objective: Objective; label?: string; className?: string }) {
  const unit = unitOf(objective.metric);
  const ratio = progress(objective);
  const pct = objective.target > 0 ? Math.round((objective.actual / objective.target) * 100) : 0;
  const reached = objective.target > 0 && objective.actual >= objective.target;
  const left = Math.max(0, objective.target - objective.actual);
  const name = label ?? labelOf(objective.metric);
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 text-[14px] font-semibold">{name}</span>
        <span className="text-[14px] tabular-nums">
          <span className="font-semibold">{fmtObjective(unit, objective.actual)}</span>
          <span className="text-muted-foreground"> / {fmtObjective(unit, objective.target)}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-700 ease-out', reached ? 'bg-emerald-500' : 'bg-foreground')}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 text-[13px] tabular-nums text-muted-foreground">
        {reached ? (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <CircleCheck className="h-3.5 w-3.5" /> Objectif atteint
          </span>
        ) : (
          <span>Encore {fmtObjective(unit, left)}</span>
        )}
        <span>{pct} %</span>
      </div>
    </div>
  );
}

/** Les objectifs d'un mois, dans l'ordre du catalogue ; aucun → un état vide calme. */
export function ObjectiveList({
  objectives,
  labels,
  emptyText = 'Pas encore d’objectif ce mois-ci',
  emptyHint,
  className,
}: {
  objectives: Objective[];
  /** Libellés à la place de ceux du catalogue (ex. « Paiements de mes clients »). */
  labels?: Partial<Record<ObjectiveMetric, string>>;
  emptyText?: string;
  emptyHint?: string;
  className?: string;
}) {
  if (objectives.length === 0) {
    return (
      <div className={cn('s-note flex items-start gap-3 rounded-xl bg-muted/60 px-4 py-4', className)}>
        <Target className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="text-[14px] font-semibold">{emptyText}</div>
          {emptyHint && <div className="mt-0.5 text-[13px] text-muted-foreground">{emptyHint}</div>}
        </div>
      </div>
    );
  }
  const order = (m: ObjectiveMetric) => OBJECTIVES.findIndex((o) => o.metric === m);
  const sorted = [...objectives].sort((a, b) => order(a.metric) - order(b.metric));
  return (
    <div className={cn('space-y-5', className)}>
      {sorted.map((o) => (
        <ObjectiveBar key={o.metric} objective={o} label={labels?.[o.metric]} />
      ))}
    </div>
  );
}

/* ── Chiffres ──────────────────────────────────────────────────────────── */

/** Un chiffre clé : étiquette, valeur, indice. Cliquable s'il mène quelque part. */
export function Figure({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  size = 'md',
  onClick,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ElementType;
  tone?: 'default' | 'warn' | 'good';
  size?: 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col p-4 text-left sm:p-5',
        SALES_CARD,
        onClick && 's-row transition-colors hover:bg-accent/60 active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        tone === 'warn' && 'bg-amber-50 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-400/25',
        className,
      )}
      data-tone={tone === 'warn' ? 'warn' : undefined}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium leading-tight text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 shrink-0" />}
        <span className="min-w-0">{label}</span>
        {onClick && <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-60" />}
      </span>
      <span
        className={cn(
          'mt-2 font-semibold tracking-[-0.02em] tabular-nums',
          size === 'lg' ? 'text-[30px] sm:text-[34px]' : 'text-[22px] sm:text-[24px]',
          tone === 'warn' && 'text-amber-700 dark:text-amber-400 s-warn',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-400 s-good',
        )}
      >
        {value}
      </span>
      {hint != null && <span className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">{hint}</span>}
    </Tag>
  );
}

/* ── Statut d'un prospect ──────────────────────────────────────────────── */

export function ProspectStatusPill({ status, className }: { status: ProspectStatus; className?: string }) {
  const meta = PROSPECT_STATUS[status];
  return (
    <span className={cn('inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-semibold', TONE_PILL[meta.tone], className)}>
      {meta.label}
    </span>
  );
}

/* ── Numéro de téléphone ───────────────────────────────────────────────── */

/** Le pays d'un numéro E.164 (« CN » pour +86…), pour son drapeau. */
function phoneCountry(e164: string): string | undefined {
  try {
    return parsePhoneNumberFromString(e164)?.country;
  } catch {
    return undefined;
  }
}

/** Un numéro tel qu'on le lit : le drapeau de son pays, puis « +237 6 99 12 34 56 ». Illisible : tel quel, sans drapeau. */
export function PhoneNumber({ e164, className }: { e164: string; className?: string }) {
  const iso = phoneCountry(e164);
  return (
    // align-middle : posé dans une ligne de texte, le drapeau ne fait pas monter les chiffres.
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap align-middle tabular-nums', className)}>
      {iso && <CountryFlag iso={iso} size={16} />}
      {formatE164ForDisplay(e164)}
    </span>
  );
}

/* ── États ─────────────────────────────────────────────────────────────── */

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2 p-4', className)} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="s-skeleton h-14 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function LoadError({ message = 'Ces informations n’ont pas pu être chargées.', onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('p-8 text-center text-[14px]', className)} role="alert">
      {message}{' '}
      {onRetry && (
        <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">
          Réessayer
        </button>
      )}
    </div>
  );
}

/** Le commercial dont le compte n'est pas encore relié à sa fiche : rien n'est cassé, il faut attendre le responsable. */
export function UnlinkedNotice({ message, onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', SALES_CARD, className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Link2Off className="h-5 w-5 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em]">Votre espace n’est pas encore prêt</h2>
      <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        {message || 'Votre compte n’est pas encore relié à votre fiche commercial. Demandez-le au responsable.'}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl px-4 text-[14px] font-semibold ring-1 ring-black/10 hover:bg-accent dark:ring-white/15"
        >
          Réessayer
        </button>
      )}
    </div>
  );
}
