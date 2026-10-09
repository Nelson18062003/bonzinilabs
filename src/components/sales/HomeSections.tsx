// ============================================================
// ESPACE COMMERCIAL — « Mon mois » : les cartes de l'accueil, par thème.
//
//   Paiements et dépôts   les deux montants du mois, l'un ou l'autre en
//                         courbe sur 6 mois (on touche le chiffre) ;
//   Objectifs             réalisé / cible, et un trait sur chaque barre :
//                         le rythme à tenir aujourd'hui (jour 9 sur 31) ;
//   Mes clients           nouveaux, au total, actifs ; nouveaux clients et
//                         prospects devenus clients, mois par mois ;
//   Mes prospects         ajoutés, convertis, en cours ; ce que sont
//                         devenus ceux des 6 derniers mois (entonnoir) ;
//   Fret de mes clients   avion (kg), vols, bateau (m³) ; kilos et vols
//                         mois par mois.
// Chaque chiffre du mois se compare au mois d'avant : en pourcentage pour
// un mois fini, par la valeur du mois d'avant pour le mois en cours (voir
// HomeData.ts). Purement présentationnelles : les données arrivent en props.
// Graphiques : le kit src/components/salesdash/, dans la matière de « /v ».
// ============================================================
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, CircleCheck, CircleDashed, Clock3, Sprout, TrendingUp } from 'lucide-react';
import type { SalesSeries, SalesTotals } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import { OBJECTIVES, ofMonth, shiftMonth, type Objective, type ObjectiveMetric } from '@/lib/sales';
import { SALES_METRICS, formatNumber, formatValue, num, periodLabel, plural, valueParts, type FunnelStageKey, type SalesMetricKey } from '@/lib/salesSeries';
import { CargoChart, ChartSkeleton, DeltaBadge, EmptyState, ErrorState, EvolutionChart, ProspectFunnel, Sparkline } from '@/components/salesdash';
import { MetricBars } from '@/components/salesdash/MetricBars';
import { CARD, btn } from './uiClasses';
import { compareMonth, homeSpark, monthWord, objectivePace, type MonthClock, type MonthFigures, type PaceStatus } from './HomeData';

/** Ce que toutes les cartes partagent : le mois, ses chiffres, celui d'avant, la série des 6 mois. */
export interface HomeView {
  month: string;
  clock: MonthClock;
  figures: MonthFigures;
  /** Le mois d'avant (null sans sales_series). */
  previous: SalesTotals | null;
  /** Les 6 mois (null tant qu'ils chargent, ou en erreur). */
  series: SalesSeries | null;
  seriesState: 'ready' | 'loading' | 'error';
  onRetrySeries: () => void;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Espace insécable avant « : » (pas de deux-points seul en début de ligne). */
const COLON = ' :';

/* ── La carte ──────────────────────────────────────────────────────────── */

export function HomeCard({
  id,
  title,
  subtitle,
  aside,
  children,
  className,
  delay = 0,
}: {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section aria-labelledby={id} className={cn(CARD, 'sd s-enter min-w-0 p-4 sm:p-5', className)} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-[17px] font-semibold leading-snug tracking-[-0.01em] s-ink">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-[14px] leading-snug s-ink-2">{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** « Voir › » en haut à droite d'une carte. */
function SeeAll({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} aria-label={label} className={btn('ghost', 'sm', '-mr-2 -mt-1 shrink-0 gap-0.5 px-2')}>
      Voir <ChevronRight className="h-4 w-4" aria-hidden />
    </button>
  );
}

/* ── La comparaison avec le mois d'avant ──────────────────────────────── */

/**
 * Mois fini : la tendance (« ↗ +12 % », « +3 » pour un petit compte).
 * Mois en cours : la valeur du mois d'avant (« sept. : 37,7 M »).
 * Rien quand les deux mois sont vides ou que la série manque.
 */
function Comparison({ view, metric, wide = false }: { view: HomeView; metric: SalesMetricKey; wide?: boolean }) {
  const unit = SALES_METRICS[metric].unit;
  const cur = view.figures[metric];
  const cmp = compareMonth(metric, view.figures, view.previous, !view.clock.current);
  if (cmp.previous === null || cur === null || (cmp.previous === 0 && cur === 0)) return null;
  const prevMonth = shiftMonth(view.month, -1);
  const word = monthWord(prevMonth);
  const prevText = formatValue(unit, cmp.previous, 'compact');
  const compare = `par rapport à ${word} (${formatValue(unit, cmp.previous)})`;
  const short = periodLabel(prevMonth, 'month', 'axis');
  const label = `${wide ? cap(short) : short}${COLON} ${wide ? formatNumber(unit, cmp.previous, 'compact') : prevText}`;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {cmp.delta && <DeltaBadge delta={cmp.delta} unit={unit} compareLabel={compare} />}
      {(wide || !cmp.delta) && (
        <span className="min-w-0 truncate text-[13px] tabular-nums s-ink-3" title={`En ${word}${COLON} ${formatValue(unit, cmp.previous)}`}>
          {label}
        </span>
      )}
    </span>
  );
}

/* ── Un chiffre du mois ────────────────────────────────────────────────── */

function StatCell({ view, metric, label, sub, spark = false }: { view: HomeView; metric: SalesMetricKey; label: string; sub?: ReactNode; spark?: boolean }) {
  const def = SALES_METRICS[metric];
  const v = view.figures[metric];
  const parts = v === null ? null : valueParts(def.unit, v, 'compact');
  return (
    <div className="min-w-0">
      <dt className="truncate text-[13px] font-medium s-ink-2" title={def.definition}>
        {label}
      </dt>
      <dd className="mt-1.5 min-w-0">
        <span className="flex items-baseline gap-1 whitespace-nowrap" title={parts?.full}>
          <span className="truncate text-[24px] font-semibold leading-none tracking-[-0.02em] s-ink">{parts?.number ?? '—'}</span>
          {parts?.unit && <span className="shrink-0 text-[13px] font-medium s-ink-2">{parts.unit}</span>}
        </span>
        <span className="mt-1.5 block min-h-[18px] truncate text-[13px] leading-tight s-ink-2">{sub ?? ' '}</span>
        <span className="mt-1.5 flex min-h-[24px] items-center">
          <Comparison view={view} metric={metric} />
        </span>
        {spark && <StatSpark view={view} metric={metric} />}
      </dd>
    </div>
  );
}

/** La forme des 6 mois, pour un chiffre qui n'a pas son graphique (le bateau). */
function StatSpark({ view, metric }: { view: HomeView; metric: SalesMetricKey }) {
  const values = homeSpark(view.series, metric);
  if (!values || values.every((v) => v === 0)) return null;
  return (
    <span className="mt-2 flex items-center gap-2">
      <Sparkline values={values} current={view.clock.current} width={64} height={22} label={`${SALES_METRICS[metric].label}, 6 mois`} />
      <span className="text-[12px] s-ink-3">6 mois</span>
    </span>
  );
}

function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid grid-cols-3 gap-3', className)}>{children}</dl>;
}

/** L'emplacement d'un graphique : squelette pendant le chargement, rien en erreur (la carte du haut le dit). */
function ChartSlot({ view, height, children }: { view: HomeView; height: number; children: (series: SalesSeries) => ReactNode }) {
  if (view.series) return <>{children(view.series)}</>;
  if (view.seriesState === 'loading') return <ChartSkeleton height={height} bars={6} />;
  return null;
}

/* ── Paiements et dépôts ───────────────────────────────────────────────── */

type MoneyMetric = 'payments_xaf' | 'deposits_xaf';

const MONEY: { key: MoneyMetric; label: string; count: SalesMetricKey; one: string; many: string; empty: string }[] = [
  { key: 'payments_xaf', label: 'Paiements', count: 'payments_count', one: 'paiement', many: 'paiements', empty: 'Aucun paiement de vos clients sur ces 6 mois' },
  { key: 'deposits_xaf', label: 'Dépôts', count: 'deposits_count', one: 'dépôt', many: 'dépôts', empty: 'Aucun dépôt de vos clients sur ces 6 mois' },
];

export function MoneyCard({ view, delay }: { view: HomeView; delay?: number }) {
  const [metric, setMetric] = useState<MoneyMetric>('payments_xaf');
  const chosen = MONEY.find((m) => m.key === metric) ?? MONEY[0];
  return (
    <HomeCard id="home-money" title="Paiements et dépôts" subtitle={`De vos clients, en ${monthWord(view.month)}`} delay={delay}>
      <div role="radiogroup" aria-label="Courbe affichée" className="grid grid-cols-2 gap-2.5">
        {MONEY.map((m) => {
          const v = view.figures[m.key];
          const parts = v === null ? null : valueParts('xaf', v, 'compact');
          const n = view.figures[m.count];
          const on = m.key === metric;
          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMetric(m.key)}
              title={parts?.full}
              className="s-option flex min-w-0 flex-col rounded-[14px] px-3.5 pb-3 pt-3 text-left"
            >
              <span className="flex items-center justify-between gap-2 text-[14px] font-medium s-ink-2">
                {m.label}
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full transition-opacity', on ? 'opacity-100' : 'opacity-0')} style={{ backgroundColor: 'var(--sd-cat-1)' }} />
              </span>
              <span className="mt-1.5 flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                <span className="truncate text-[27px] font-semibold leading-none tracking-[-0.025em] s-ink">{parts?.number ?? '—'}</span>
                <span className="shrink-0 text-[13px] font-medium s-ink-2">XAF</span>
              </span>
              <span className="sr-only">{parts ? `, ${parts.full}` : ''}</span>
              <span className="mt-1.5 block truncate text-[13px] s-ink-2">{n === null ? ' ' : plural(n, m.one, m.many)}</span>
              <span className="mt-2 flex min-h-[24px] items-center">
                <Comparison view={view} metric={m.key} wide />
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {view.seriesState === 'error' && !view.series ? (
          <ErrorState message="L’évolution n’a pas pu être chargée." height={160} onRetry={view.onRetrySeries} />
        ) : (
          <ChartSlot view={view} height={200}>
            {(series) => (
              <EvolutionChart
                series={series}
                metric={metric}
                height={200}
                ariaLabel={`${chosen.label} de vos clients, mois par mois`}
                emptyState={<EmptyState title={chosen.empty} height={150} />}
              />
            )}
          </ChartSlot>
        )}
      </div>
    </HomeCard>
  );
}

/* ── Objectifs ─────────────────────────────────────────────────────────── */

const OBJ_UNIT = (metric: ObjectiveMetric) => OBJECTIVES.find((o) => o.metric === metric)?.unit ?? 'count';
const OBJ_LABEL = (metric: ObjectiveMetric) => OBJECTIVES.find((o) => o.metric === metric)?.label ?? metric;

const PACE: Record<PaceStatus, { label: string; icon: typeof CircleCheck; tone: string }> = {
  reached: { label: 'Objectif atteint', icon: CircleCheck, tone: 's-good font-semibold' },
  ahead: { label: 'Dans le rythme', icon: TrendingUp, tone: 's-ink-2 font-medium' },
  behind: { label: 'Sous le rythme', icon: Clock3, tone: 's-warn font-semibold' },
  missed: { label: 'Non atteint', icon: CircleDashed, tone: 's-ink-3 font-medium' },
};

/** Un objectif : réalisé / cible, la barre, le trait du rythme, ce qu'il reste. */
export function ObjectiveRow({ objective, label, clock }: { objective: Objective; label?: string; clock: MonthClock }) {
  const unit = OBJ_UNIT(objective.metric);
  const name = label ?? OBJ_LABEL(objective.metric);
  const pace = objectivePace(objective, clock);
  const meta = PACE[pace.status];
  const Icon = meta.icon;
  const suffix = unit === 'xaf' ? ' XAF' : unit === 'kg' ? ' kg' : unit === 'cbm' ? ' m³' : '';
  const fill = pace.status === 'reached' ? 'hsl(var(--s-green))' : 'hsl(var(--s-ink))';
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 text-[15px] font-semibold s-ink">{name}</span>
        <span className="text-[14px] tabular-nums" title={`${formatValue(unit, num(objective.actual))} sur ${formatValue(unit, num(objective.target))}`}>
          <span className="font-semibold s-ink">{formatNumber(unit, num(objective.actual), 'compact')}</span>
          <span className="s-ink-3">
            {' '}
            / {formatNumber(unit, num(objective.target), 'compact')}
            {suffix}
          </span>
        </span>
      </div>
      <div className="relative mt-2.5">
        <div
          role="progressbar"
          aria-label={name}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, pace.pct))}
          aria-valuetext={`${pace.pct} %, ${meta.label.toLowerCase()}`}
          className="s-field-bg h-2 overflow-hidden rounded-full"
        >
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pace.ratio * 100}%`, backgroundColor: fill }} />
        </div>
        {pace.expected !== null && pace.status !== 'reached' && (
          // Le rythme à tenir : où il faudrait en être aujourd'hui pour finir le mois à la cible.
          <span
            aria-hidden
            className="absolute -top-1 h-4 w-[3px] -translate-x-1/2 rounded-full"
            style={{ left: `${clock.elapsed * 100}%`, backgroundColor: 'hsl(var(--s-ink-3))', boxShadow: '0 0 0 2px hsl(var(--s-surface))' }}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[13px] tabular-nums">
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.tone)} aria-hidden />
          <span className={cn('truncate', meta.tone)}>{meta.label}</span>
          {pace.status !== 'reached' && <span className="truncate s-ink-3">· encore {formatValue(unit, pace.left, 'compact')}</span>}
        </span>
        <span className="shrink-0 s-ink-2">{pace.pct} %</span>
      </div>
    </div>
  );
}

/** Dans SON espace, le commercial lit « mes clients », pas « ses clients ». */
const SELF_LABELS: Partial<Record<ObjectiveMetric, string>> = { payments_xaf: 'Paiements de mes clients' };

export function ObjectivesCard({ month, objectives, clock, delay }: { month: string; objectives: Objective[]; clock: MonthClock; delay?: number }) {
  const reached = objectives.filter((o) => objectivePace(o, clock).status === 'reached').length;
  const order = (m: ObjectiveMetric) => OBJECTIVES.findIndex((o) => o.metric === m);
  const sorted = [...objectives].sort((a, b) => order(a.metric) - order(b.metric));
  const word = monthWord(month);
  return (
    <HomeCard
      id="home-objectives"
      title={clock.current ? 'Objectifs du mois' : `Objectifs ${ofMonth(word)}`}
      subtitle={
        objectives.length === 0
          ? undefined
          : clock.current && clock.day
            ? `Jour ${clock.day} sur ${clock.days}`
            : `${cap(word)} est fini`
      }
      aside={
        objectives.length > 0 ? (
          <span className="shrink-0 pt-0.5 text-[14px] font-medium tabular-nums s-ink-2">
            {reached} / {objectives.length} atteint{objectives.length > 1 ? 's' : ''}
          </span>
        ) : undefined
      }
      delay={delay}
    >
      {objectives.length === 0 ? (
        <div className="s-note flex items-start gap-3 rounded-[14px] px-4 py-3.5">
          <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 s-ink-3" aria-hidden />
          <div>
            <p className="text-[15px] font-semibold s-ink">Pas encore d’objectif ce mois-ci</p>
            <p className="mt-0.5 text-[14px] s-ink-2">Votre responsable les fixe chaque mois.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-5">
            {sorted.map((o) => (
              <ObjectiveRow key={o.metric} objective={o} label={SELF_LABELS[o.metric]} clock={clock} />
            ))}
          </div>
          {clock.current && reached < objectives.length && (
            <p className="mt-5 flex items-start gap-2.5 text-[13px] leading-snug s-ink-3">
              <span aria-hidden className="mt-[1px] h-4 w-[3px] shrink-0 rounded-full" style={{ backgroundColor: 'hsl(var(--s-ink-3))' }} />
              Le trait marque où il faudrait en être aujourd’hui pour finir le mois à la cible.
            </p>
          )}
        </>
      )}
    </HomeCard>
  );
}

/* ── Mes clients ───────────────────────────────────────────────────────── */

export function ClientsCard({ view, delay }: { view: HomeView; delay?: number }) {
  return (
    <HomeCard id="home-clients" title="Mes clients" subtitle="Ceux dont vous êtes l’origine" aside={<SeeAll to="/v/clients" label="Voir mes clients" />} delay={delay}>
      <StatRow>
        <StatCell view={view} metric="new_clients" label="Nouveaux" sub={`en ${monthWord(view.month)}`} />
        <StatCell view={view} metric="clients_total" label="Au total" sub={!view.series || view.clock.current ? 'aujourd’hui' : `fin ${monthWord(view.month)}`} />
        <StatCell view={view} metric="active_clients" label="Actifs" sub={`en ${monthWord(view.month)}`} />
      </StatRow>
      <ChartSlot view={view} height={180}>
        {(series) => (
          <MetricBars
            className="mt-5"
            series={series}
            metrics={['new_clients', 'prospects_won']}
            labels={{ new_clients: 'Nouveaux clients', prospects_won: 'Venus de vos prospects' }}
            height={180}
            ariaLabel="Nouveaux clients et prospects devenus clients, mois par mois"
            emptyState={<EmptyState title="Aucun nouveau client sur ces 6 mois" height={140} />}
          />
        )}
      </ChartSlot>
    </HomeCard>
  );
}

/* ── Mes prospects ─────────────────────────────────────────────────────── */

const STAGE_FILTER: Record<FunnelStageKey, string> = {
  open: '/v/prospects',
  to_verify: '/v/prospects?filtre=a-verifier',
  won: '/v/prospects?filtre=clients',
  lost: '/v/prospects?filtre=perdus',
};

export function ProspectsCard({ view, delay }: { view: HomeView; delay?: number }) {
  const navigate = useNavigate();
  const word = monthWord(view.month);
  return (
    <HomeCard id="home-prospects" title="Mes prospects" subtitle="Ceux que vous avez saisis" aside={<SeeAll to="/v/prospects" label="Voir mes prospects" />} delay={delay}>
      <StatRow>
        <StatCell view={view} metric="prospects_new" label="Ajoutés" sub={`en ${word}`} />
        <StatCell view={view} metric="prospects_won" label="Convertis" sub="devenus clients" />
        <StatCell view={view} metric="prospects_lost" label="Perdus" sub={`en ${word}`} />
      </StatRow>
      <ChartSlot view={view} height={220}>
        {(series) => (
          <div className="mt-5 border-t pt-4" style={{ borderColor: 'hsl(var(--s-line))' }}>
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] s-ink-3">Vos prospects des 6 derniers mois</p>
            <ProspectFunnel funnel={series.team.funnel} onStageClick={(stage) => navigate(STAGE_FILTER[stage])} />
          </div>
        )}
      </ChartSlot>
    </HomeCard>
  );
}

/* ── Fret de mes clients ───────────────────────────────────────────────── */

export function FreightCard({ view, delay }: { view: HomeView; delay?: number }) {
  const f = view.figures;
  const kgPerFlight = f.flights && f.air_kg != null ? f.air_kg / f.flights : null;
  return (
    <HomeCard id="home-freight" title="Fret de mes clients" subtitle="Colis reçus à Guangzhou" delay={delay}>
      <StatRow>
        <StatCell view={view} metric="air_kg" label="Avion" sub={f.air_parcels === null ? undefined : `${formatNumber('count', f.air_parcels)} colis`} />
        <StatCell view={view} metric="flights" label="Vols" sub={kgPerFlight === null ? undefined : `${formatValue('kg', kgPerFlight)} par vol`} />
        <StatCell view={view} metric="sea_cbm" label="Bateau" sub={f.sea_parcels === null ? undefined : `${formatNumber('count', f.sea_parcels)} colis`} spark />
      </StatRow>
      <ChartSlot view={view} height={290}>
        {(series) => <CargoChart className="mt-5" series={series} showStats={false} />}
      </ChartSlot>
    </HomeCard>
  );
}

/* ── Fiche toute neuve ─────────────────────────────────────────────────── */

/** Rien sur 6 mois (ni client, ni paiement, ni prospect) : une seule carte, pas quatre graphiques vides. */
export function QuietCard({ delay }: { delay?: number }) {
  return (
    <section className={cn(CARD, 's-enter flex flex-col items-center px-6 py-9 text-center')} style={delay ? { animationDelay: `${delay}ms` } : undefined}>
      <span className="s-note flex h-12 w-12 items-center justify-center rounded-full" data-tone="accent">
        <Sprout className="h-5 w-5 s-accent" aria-hidden />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.01em] s-ink">Vos chiffres arrivent avec vos premiers clients</h2>
      <p className="mt-1.5 max-w-[34ch] text-[15px] leading-relaxed s-ink-2">
        Paiements, dépôts, fret avion et bateau, prospects : tout s’affichera ici, mois par mois, dès vos premiers prospects et vos premiers clients.
      </p>
    </section>
  );
}
