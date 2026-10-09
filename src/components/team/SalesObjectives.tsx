// ============================================================
// Mes équipes › Ventes — les objectifs du mois (commercial_objectives).
//
//   · ObjectiveMeter     un objectif : réalisé / cible, une jauge, et — pour
//                        le mois en cours — un trait au jour du mois (« où
//                        devrait en être la jauge à ce rythme ») ;
//   · ObjectivesSummary  la vue d'ensemble : chacun, ses objectifs du mois
//                        en cours (sales_overview), ses prospects à
//                        relancer et ses fiches à vérifier ;
//   · ObjectivesPanel    la page d'un commercial : ses objectifs d'un mois,
//                        à fixer ou modifier (set_commercial_objective).
// Le commercial voit les mêmes objectifs dans son espace « /v ».
// ============================================================
import { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, CircleCheck, Target, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSetObjective } from '@/hooks/useSales';
import { OBJECTIVES, currentMonth, fmtObjective, monthLabel, ofMonth, progress, type CommercialCard, type Objective, type ObjectiveMetric } from '@/lib/sales';
import { formatValue, valueParts, type SalesUnit } from '@/lib/salesSeries';
import { MonthSwitcher } from '@/components/sales/SalesBits';
import { TextField } from '@/components/form';
import { ChartPanel, ErrorState, SeriesSwatch, Skeleton } from '@/components/salesdash';
import { BTN_PRIMARY, BTN_SOFT, Modal } from './TeamBits';

const metaOf = (metric: ObjectiveMetric) => OBJECTIVES.find((o) => o.metric === metric) ?? { metric, label: metric, unit: 'count' as const };
const order = (m: ObjectiveMetric) => OBJECTIVES.findIndex((o) => o.metric === m);
const sorted = (list: Objective[]) => [...list].sort((a, b) => order(a.metric) - order(b.metric));

/**
 * L'avancée du mois à Douala (0 à 1) si `month` est le mois en cours : le
 * 5 octobre, 5/31. Null pour un autre mois (passé : la jauge dit tout).
 */
export function monthPace(month: string, now: Date = new Date()): { ratio: number; day: number; days: number } | null {
  if (month !== currentMonth(now)) return null;
  const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Douala', day: 'numeric' }).format(now));
  const [y, m] = month.split('-').map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { ratio: Math.min(1, day / days), day, days };
}

/* ── Une jauge ─────────────────────────────────────────────────────────── */

/** « 18,8 M / 50 M XAF », « 64,5 / 200 kg », « 1 / 3 ». */
function actualOverTarget(unit: SalesUnit, actual: number, target: number) {
  const a = valueParts(unit, actual, 'compact');
  const t = valueParts(unit, target, 'compact');
  return { actual: a.number, rest: ` / ${t.number}${t.unit ? ` ${t.unit}` : ''}`, full: `${formatValue(unit, actual)} sur ${formatValue(unit, target)}` };
}

export function ObjectiveMeter({
  objective,
  pace,
  size = 'md',
  label,
}: {
  objective: Objective;
  pace?: { ratio: number; day: number; days: number } | null;
  /** `sm` : une ligne et la jauge (vue d'ensemble) ; `md` : plus ce qu'il reste et le pourcentage. */
  size?: 'sm' | 'md';
  label?: string;
}) {
  const meta = metaOf(objective.metric);
  const ratio = progress(objective);
  const pct = objective.target > 0 ? Math.round((objective.actual / objective.target) * 100) : 0;
  const reached = objective.target > 0 && objective.actual >= objective.target;
  const name = label ?? meta.label;
  const v = actualOverTarget(meta.unit, objective.actual, objective.target);
  const paceText = pace ? `Repère : jour ${pace.day} sur ${pace.days} du mois` : undefined;
  return (
    <div className="sd min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn('min-w-0 truncate', size === 'sm' ? 'text-[14px] text-muted-foreground' : 'text-[14px] font-semibold')}>{name}</span>
        <span className="shrink-0 whitespace-nowrap text-[14px] tabular-nums" title={v.full}>
          {reached && <CircleCheck className="mr-1 inline h-3.5 w-3.5 -translate-y-px" style={{ color: 'var(--sd-good)' }} aria-hidden />}
          <span className="font-semibold text-foreground">{v.actual}</span>
          <span className="text-muted-foreground">{v.rest}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)}
        aria-valuetext={`${v.full} (${pct} %)`}
        className={cn('relative mt-2 rounded-full', size === 'sm' ? 'h-1.5' : 'h-2')}
        style={{ backgroundColor: 'var(--sd-track)' }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${ratio * 100}%`, minWidth: objective.actual > 0 ? 4 : 0, backgroundColor: reached ? 'var(--sd-good)' : 'var(--sd-ink)' }}
        />
        {pace && !reached && (
          <span
            aria-hidden
            title={paceText}
            className="absolute -bottom-1 -top-1 w-[2px] rounded-full"
            style={{ left: `calc(${pace.ratio * 100}% - 1px)`, backgroundColor: 'var(--sd-ink-2)', boxShadow: '0 0 0 1.5px var(--sd-surface)' }}
          />
        )}
      </div>
      {size === 'md' && (
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[13px] tabular-nums text-muted-foreground">
          {reached ? (
            <span className="font-semibold" style={{ color: 'var(--sd-good)' }}>
              Objectif atteint
            </span>
          ) : (
            <span>Encore {fmtObjective(meta.unit, Math.max(0, objective.target - objective.actual))}</span>
          )}
          <span>{pct} %</span>
        </div>
      )}
    </div>
  );
}

/** Sous les jauges du mois en cours : ce que veut dire le trait. */
function PaceLegend({ pace }: { pace: { day: number; days: number } }) {
  return (
    <span className="flex items-start gap-2.5">
      <span aria-hidden className="mt-[4px] inline-block h-3.5 w-[2px] shrink-0 rounded-full" style={{ backgroundColor: 'var(--sd-ink-2)' }} />
      <span>Le trait marque le jour {pace.day} sur {pace.days} du mois : une jauge qui le dépasse est dans les temps.</span>
    </span>
  );
}

/* ── La vue d'ensemble : les objectifs de chacun ───────────────────────── */

export function ObjectivesSummary({
  rows,
  loading,
  error,
  onRetry,
  toVerify,
  colorOf,
  onOpen,
  now,
}: {
  rows: CommercialCard[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Les fiches « À vérifier » de chacun (par fiche). */
  toVerify: Map<string, number>;
  /** La couleur de la fiche dans les graphiques (la même partout). */
  colorOf: (sourceId: string) => string | null;
  onOpen: (sourceId: string) => void;
  now?: Date;
}) {
  const month = currentMonth(now);
  const pace = monthPace(month, now);
  // Les fiches archivées sans objectif n'ont rien à dire ici (elles restent au classement).
  const shown = rows.filter((r) => r.source.is_active || r.objectives.length > 0);
  return (
    <ChartPanel
      title={`Objectifs ${ofMonth(monthLabel(month))}`}
      subtitle="Où en est chacun ce mois-ci ; touchez un commercial pour fixer ou modifier les siens"
      footer={pace && shown.some((r) => r.objectives.length > 0) ? <PaceLegend pace={pace} /> : undefined}
    >
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-2xl p-4 ring-1 ring-border/70">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Les objectifs n’ont pas pu être chargés." onRetry={onRetry} />
      ) : shown.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">Aucun commercial actif pour l’instant.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((r) => (
            <li key={r.source.id}>
              <SummaryCard card={r} pace={pace} toVerify={toVerify.get(r.source.id) ?? 0} color={colorOf(r.source.id)} onOpen={() => onOpen(r.source.id)} />
            </li>
          ))}
        </ul>
      )}
    </ChartPanel>
  );
}

function SummaryCard({
  card,
  pace,
  toVerify,
  color,
  onOpen,
}: {
  card: CommercialCard;
  pace: ReturnType<typeof monthPace>;
  toVerify: number;
  color: string | null;
  onOpen: () => void;
}) {
  const name = card.staff?.name || card.source.label;
  const due = card.metrics?.prospects_due ?? 0;
  const note = !card.source.is_active ? 'fiche archivée' : !card.staff ? 'sans accès' : card.staff.is_disabled ? 'accès désactivé' : null;
  const list = sorted(card.objectives);
  return (
    // Toute la carte s'ouvre (le bouton du nom s'étend dessus) ; les jauges restent lisibles par un lecteur d'écran.
    <div className="sd-press sd relative flex h-full flex-col rounded-2xl p-4 ring-1 ring-border/70">
      <div className="flex items-center gap-2.5">
        {color && <SeriesSwatch color={color} shape="dot" muted={!card.source.is_active} />}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Ouvrir ${name}`}
          className="min-w-0 flex-1 text-left outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-foreground"
        >
          <span className="block truncate text-[15.5px] font-semibold text-foreground">{name}</span>
          {note && <span className="block text-[13px] text-muted-foreground">{note}</span>}
        </button>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      {(due > 0 || toVerify > 0) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {due > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {due} prospect{due > 1 ? 's' : ''} à relancer
            </span>
          )}
          {toVerify > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-700 dark:text-amber-400">
              <UserSearch className="h-3.5 w-3.5" aria-hidden /> {toVerify} fiche{toVerify > 1 ? 's' : ''} à vérifier
            </span>
          )}
        </div>
      )}

      {list.length > 0 ? (
        <div className="mt-4 space-y-3.5">
          {list.map((o) => (
            <ObjectiveMeter key={o.metric} objective={o} pace={pace} size="sm" />
          ))}
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-[14px] text-muted-foreground">
          <Target className="h-4 w-4 shrink-0" aria-hidden /> Pas d’objectif ce mois-ci
        </p>
      )}
    </div>
  );
}

/* ── La page d'un commercial : ses objectifs, à fixer ──────────────────── */

export function ObjectivesPanel({
  card,
  month,
  onMonth,
  sourceId,
  loading,
}: {
  card: CommercialCard | null | undefined;
  month: string;
  onMonth: (m: string) => void;
  sourceId: string;
  loading?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const set = sorted(card?.objectives ?? []);
  const pace = monthPace(month);
  return (
    <ChartPanel
      title={`Objectifs ${ofMonth(monthLabel(month))}`}
      subtitle="Il les voit dans son espace, avec son avancement"
      actions={
        <>
          <MonthSwitcher month={month} onChange={onMonth} className="max-sm:flex-1" />
          {card && (
            <button type="button" onClick={() => setEditing(true)} className={BTN_SOFT}>
              {set.length ? 'Modifier' : 'Fixer ses objectifs'}
            </button>
          )}
        </>
      }
      footer={pace && set.length > 0 ? <PaceLegend pace={pace} /> : undefined}
    >
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : set.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-4">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-[14.5px] font-semibold">Pas d’objectif ce mois-ci</p>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">Nouveaux clients, paiements, fret, prospects : fixez-en un ou plusieurs, il suivra son avancement.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {set.map((o) => (
            <ObjectiveMeter key={o.metric} objective={o} pace={pace} />
          ))}
        </div>
      )}
      {editing && card && <ObjectivesDialog card={card} month={month} sourceId={sourceId} onClose={() => setEditing(false)} />}
    </ChartPanel>
  );
}

function ObjectivesDialog({ card, month, sourceId, onClose }: { card: CommercialCard; month: string; sourceId: string; onClose: () => void }) {
  const save = useSetObjective();
  const initial = useMemo(
    () => Object.fromEntries(OBJECTIVES.map((o) => [o.metric, groupTarget(card.objectives.find((x) => x.metric === o.metric)?.target ?? null)])),
    [card.objectives],
  ) as Record<ObjectiveMetric, string>;
  const [values, setValues] = useState<Record<ObjectiveMetric, string>>(initial);
  const [saving, setSaving] = useState(false);

  const invalid = OBJECTIVES.some((o) => Number.isNaN(parseTarget(values[o.metric])));

  const submit = async () => {
    if (invalid || saving) return;
    setSaving(true);
    try {
      for (const o of OBJECTIVES) {
        const n = parseTarget(values[o.metric]);
        if (n === parseTarget(initial[o.metric])) continue;
        await save.mutateAsync({ sourceId, month, metric: o.metric, target: n && n > 0 ? n : null });
      }
      onClose();
    } catch {
      /* le hook a déjà affiché l'erreur ; la fenêtre reste ouverte */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Objectifs ${ofMonth(monthLabel(month))}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SOFT}>
            Annuler
          </button>
          <button type="button" onClick={() => void submit()} disabled={invalid || saving} className={BTN_PRIMARY}>
            {saving ? '…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <p className="text-[13px] text-muted-foreground">Laissez vide (ou 0) pour ne pas fixer d’objectif. Réalisé à ce jour entre parenthèses.</p>
      <div className="space-y-3">
        {OBJECTIVES.map((o) => {
          const actual = card.objectives.find((x) => x.metric === o.metric)?.actual ?? actualOf(card, o.metric);
          const bad = Number.isNaN(parseTarget(values[o.metric]));
          return (
            <label key={o.metric} className="flex items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{o.label}</span>
                <span className="block text-[12px] text-muted-foreground">({fmtObjective(o.unit, actual)} à ce jour)</span>
              </span>
              <TextField
                variant="decimal"
                value={values[o.metric]}
                onChange={(e) => setValues((v) => ({ ...v, [o.metric]: e.target.value }))}
                onBlur={() => setValues((v) => ({ ...v, [o.metric]: groupTarget(parseTarget(v[o.metric]), v[o.metric]) }))}
                placeholder="—"
                aria-label={o.label}
                error={bad ? ' ' : undefined}
                wrapperClassName="w-36"
                controlClassName="rounded-xl bg-card text-right tabular-nums"
              />
              <span className="w-10 text-[12.5px] text-muted-foreground">{o.unit === 'xaf' ? 'XAF' : o.unit === 'kg' ? 'kg' : o.unit === 'cbm' ? 'm³' : ''}</span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

/** Une cible tapée (« 50 000 000 », « 2,5 ») : null si vide, NaN si invalide. */
function parseTarget(v: string): number | null {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() === '' ? null : Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** La cible lisible, avec séparateur de milliers (« 50 000 000 ») ; `raw` est gardé tel quel s'il est invalide. */
function groupTarget(n: number | null, raw = ''): string {
  if (n === null) return '';
  if (Number.isNaN(n)) return raw;
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 3 });
}

function actualOf(card: CommercialCard, metric: ObjectiveMetric): number {
  const m = card.metrics;
  switch (metric) {
    case 'new_clients':
      return m.new_clients;
    case 'payments_xaf':
      return m.payments_xaf;
    case 'air_kg':
      return m.air_kg;
    case 'sea_cbm':
      return m.sea_cbm;
    case 'prospects_new':
      return m.prospects_new;
    case 'prospects_won':
      return m.prospects_won;
  }
}
