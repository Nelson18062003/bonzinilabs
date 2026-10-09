// ============================================================
// Mes équipes › Ventes (08/10) — le tableau de bord, partagé par la vue
// d'ensemble (/m/equipe/ventes, toute l'équipe) et la page d'un commercial
// (/m/equipe/ventes/:sourceId, lui seul). Même lecture des deux côtés :
//
//   1. « comment ça va »      huit tuiles sur la plage, avec la tendance
//                             (plage précédente) et la mini-courbe ;
//   2. « comment ça évolue »  le graphique d'un indicateur, période par
//                             période (empilé par commercial pour l'équipe),
//                             l'entonnoir des prospects, le fret ;
//   3. « qui fait quoi »      propre à chaque écran (classement, objectifs,
//                             prospects, clients).
//
// La plage (3, 6, 12 mois, 12 semaines) vit dans l'adresse (?periode=6m) :
// elle suit le responsable d'un écran à l'autre et au retour arrière.
// Données : sales_series (useSalesSeries) ; briques : src/components/salesdash.
// ============================================================
import { Component, useEffect, useId, useMemo, useRef, useState, type ErrorInfo, type ReactNode, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSalesSeries, type SalesSeries } from '@/hooks/useSales';
import { cn } from '@/lib/utils';
import {
  RANGE_PRESETS,
  SALES_METRICS,
  compareLabel,
  conversionRate,
  formatRate,
  isCurrentPeriod,
  hasActivity,
  periodLabel,
  periodsBetween,
  pickSource,
  presetDef,
  rangeForPreset,
  rangeLabel,
  type SalesMetricKey,
  type SalesRangePreset,
} from '@/lib/salesSeries';
import {
  CargoChart,
  ChartPanel,
  ChartSkeleton,
  EmptyState,
  ErrorState,
  EvolutionChart,
  KpiGrid,
  KpiGridSkeleton,
  KpiTile,
  MetricSwitcher,
  PANEL,
  PeriodPicker,
  ProspectFunnel,
  SegmentedControl,
  Skeleton,
} from '@/components/salesdash';

/* ── La plage, dans l'adresse ──────────────────────────────────────────── */

const PRESET_PARAM = 'periode';
const DEFAULT_PRESET: SalesRangePreset = '6m';

const isPreset = (v: string | null): v is SalesRangePreset => !!v && RANGE_PRESETS.some((p) => p.value === v);

/** La plage choisie (?periode=…, 6 mois par défaut) ; la changer remplace l'entrée d'historique. */
export function useSalesPreset(): [SalesRangePreset, (p: SalesRangePreset) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PRESET_PARAM);
  const preset = isPreset(raw) ? raw : DEFAULT_PRESET;
  const set = (p: SalesRangePreset) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (p === DEFAULT_PRESET) next.delete(PRESET_PARAM);
        else next.set(PRESET_PARAM, p);
        return next;
      },
      { replace: true },
    );
  return [preset, set];
}

/** « ?periode=12m » à recoller sur un lien (rien pour la plage par défaut). */
export const presetQuery = (p: SalesRangePreset) => (p === DEFAULT_PRESET ? '' : `?${PRESET_PARAM}=${p}`);

/**
 * La série d'une plage (toute l'équipe, ou une fiche). Changer de plage
 * garde l'image précédente, estompée, le temps de la nouvelle réponse : pas
 * de squelette ni de saut de page à chaque clic.
 */
function useKeptSalesSeries(preset: SalesRangePreset, sourceId?: string | null) {
  const range = useMemo(() => rangeForPreset(preset), [preset]);
  const q = useSalesSeries({ ...range, sourceId: sourceId ?? null });
  const [kept, setKept] = useState<SalesSeries | undefined>(undefined);
  useEffect(() => {
    if (q.data) setKept(q.data);
  }, [q.data]);
  const series = q.data ?? (q.isError ? undefined : kept);
  return {
    series,
    loading: !series && !q.isError,
    error: !q.data && q.isError ? ((q.error as Error | null)?.message ?? null) : null,
    failed: !q.data && q.isError,
    fetching: !q.data && q.isFetching && !!kept,
    refetch: () => void q.refetch(),
  };
}

/* ── Les pièces de mise en page ────────────────────────────────────────── */

/** Le titre d'une partie de l'écran : petit, discret ; la carte qui suit porte le contenu. */
export function SectionLabel({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 px-0.5">
      <p id={id} className="text-[13px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
        {children}
      </p>
      {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
    </div>
  );
}

/**
 * La barre de la plage, UNE fois au-dessus de tout ce qu'elle règle : le
 * segmenté, puis ce qu'on regarde (« mai – oct. 2026 ») et à quoi on le compare.
 */
function RangeBar({ preset, onChange, series }: { preset: SalesRangePreset; onChange: (p: SalesRangePreset) => void; series?: SalesSeries }) {
  const d = presetDef(preset);
  // La plage lue dans la réponse (le serveur peut l'ajuster) ; avant elle, ou en cas d'erreur, celle demandée.
  const label = useMemo(() => {
    if (series) return rangeLabel(series.periods, series.grain);
    const r = rangeForPreset(preset);
    return rangeLabel(periodsBetween(r.from, r.to, r.grain), r.grain);
  }, [series, preset]);
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <PeriodPicker value={preset} onChange={onChange} />
      <p className="text-[14px] leading-snug text-muted-foreground sm:text-right">
        <span className="font-medium text-foreground">{label}</span>
        {' · '}
        {d.grain === 'month' ? 'mois par mois' : 'semaine par semaine'}
      </p>
    </div>
  );
}

/* ── 1. Les tuiles ─────────────────────────────────────────────────────── */

/** Les huit chiffres de tête, dans l'ordre où le directeur les lit : clients et prospects, l'argent, puis le fret. */
const HEADLINE: SalesMetricKey[] = ['clients_total', 'prospects_new', 'payments_xaf', 'deposits_xaf', 'active_clients', 'air_kg', 'flights', 'sea_cbm'];

/** Les indicateurs du graphique : ceux des tuiles, plus les nouveaux clients (le flux sous le parc). */
const CHART_METRICS: SalesMetricKey[] = ['payments_xaf', 'deposits_xaf', 'clients_total', 'new_clients', 'prospects_new', 'active_clients', 'air_kg', 'flights', 'sea_cbm'];
const CHART_LABELS: Partial<Record<SalesMetricKey, string>> = { prospects_new: 'Prospects' };

/**
 * Les tuiles de la plage. Chacune choisit l'indicateur du graphique
 * (`onPick`) : la tuile choisie est cerclée, comme un onglet.
 */
function HeadlineTiles({
  series,
  preset,
  metric,
  onPick,
}: {
  series: SalesSeries;
  preset: SalesRangePreset;
  metric: SalesMetricKey;
  onPick: (m: SalesMetricKey) => void;
}) {
  const team = series.team;
  const rate = conversionRate(team.funnel);
  return (
    <KpiGrid columns={4}>
      {HEADLINE.map((m) => (
        <KpiTile
          key={m}
          metric={m}
          data={team}
          grain={series.grain}
          compareLabel={compareLabel(preset)}
          onClick={() => onPick(m)}
          selected={metric === m}
          // Sous les prospects : la part de ceux de la plage qui sont devenus clients.
          sub={m === 'prospects_new' ? (rate == null ? null : `${formatRate(rate)} devenus clients`) : undefined}
        />
      ))}
    </KpiGrid>
  );
}

/**
 * Sous les tuiles : à quoi la tendance compare, et — si la plage finit sur
 * la période en cours — qu'elle n'est pas finie (la tendance compare alors
 * une période entamée à des périodes entières : elle se lit avec prudence).
 */
function TrendNote({ series, preset }: { series: SalesSeries; preset: SalesRangePreset }) {
  const last = series.periods[series.periods.length - 1];
  const partial = !!last && isCurrentPeriod(last, series.grain);
  return (
    <p className="px-0.5 text-[13px] leading-relaxed text-muted-foreground">
      Tendances : {compareLabel(preset)}.
      {partial &&
        (series.grain === 'month'
          ? ` ${capitalize(periodLabel(last, 'month', 'long'))} n’est pas fini : ses chiffres comptent jusqu’à aujourd’hui.`
          : ' La semaine en cours n’est pas finie : ses chiffres comptent jusqu’à aujourd’hui.')}
    </p>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── 2. L'évolution ────────────────────────────────────────────────────── */

export type EvolutionMode = 'stacked' | 'total';

/**
 * Le graphique d'évolution : les onglets d'indicateur, sa définition, puis
 * les barres (ou la courbe des clients). Pour l'équipe : par commercial
 * (empilé, une couleur par fiche) ou l'équipe seule. Les vols restent
 * toujours ceux de l'équipe : un avion partagé par trois commerciaux est UN
 * vol (le serveur les dédoublonne ; empiler les fiches le compterait trois fois).
 */
function EvolutionPanel({
  series,
  metric,
  onMetric,
  mode = 'stacked',
  onMode,
  fetching,
  panelRef,
}: {
  series: SalesSeries;
  metric: SalesMetricKey;
  onMetric: (m: SalesMetricKey) => void;
  mode?: EvolutionMode;
  /** Absent : pas de choix (la page d'un commercial). */
  onMode?: (m: EvolutionMode) => void;
  fetching?: boolean;
  panelRef?: RefObject<HTMLDivElement>;
}) {
  const chartId = useId();
  const def = SALES_METRICS[metric];
  const multi = series.sources.length > 1;
  const teamOnly = metric === 'flights';
  const shown: EvolutionMode = multi && !teamOnly ? mode : 'total';
  return (
    <div ref={panelRef} className="scroll-mt-20">
      <ChartPanel
        title="Évolution"
        subtitle={`${rangeLabel(series.periods, series.grain)} · ${series.grain === 'month' ? 'par mois' : 'par semaine'}`}
        actions={
          multi && onMode && !teamOnly ? (
            <SegmentedControl
              ariaLabel="Affichage"
              value={mode}
              onChange={onMode}
              className="w-full sm:w-[260px]"
              options={[
                { value: 'stacked', label: 'Par commercial' },
                { value: 'total', label: 'Équipe' },
              ]}
            />
          ) : undefined
        }
        fetching={fetching}
      >
        <MetricSwitcher value={metric} onChange={onMetric} metrics={CHART_METRICS} labels={CHART_LABELS} controls={chartId} className="-mx-1" />
        <p className="mt-3 text-[14px] leading-snug text-muted-foreground">
          {def.definition}
          {teamOnly && multi && ' Un vol qui emporte les colis de plusieurs commerciaux compte une fois pour l’équipe.'}
        </p>
        <div id={chartId} role="tabpanel" aria-label={def.label} className="mt-4">
          <EvolutionChart series={series} metric={metric} mode={shown} height={280} />
        </div>
      </ChartPanel>
    </div>
  );
}

/** Les prospects (où en sont ceux de la plage) et le fret (avion, vols, bateau), côte à côte sur ordinateur. */
function ProspectsAndCargo({ series, fetching }: { series: SalesSeries; fetching?: boolean }) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-5">
      <ChartPanel className="lg:col-span-2" title="Prospects" subtitle="Ajoutés sur la plage, et ce qu’ils sont devenus" fetching={fetching}>
        <ProspectFunnel funnel={series.team.funnel} />
      </ChartPanel>
      <ChartPanel className="lg:col-span-3" title="Fret" subtitle="Avion (bureau de Guangzhou), vols et bateau (entrepôt)" fetching={fetching}>
        <CargoChart series={series} showSea showStats={false} />
      </ChartPanel>
    </div>
  );
}

/* ── Le tableau de bord entier ─────────────────────────────────────────── */

/**
 * La plage, puis « l'essentiel » et « l'évolution » ; `after` ajoute ce qui
 * est propre à l'écran (le classement de l'équipe…) avec la même série.
 * Lit sales_series lui-même : posé dans un DashboardBoundary, une erreur de
 * lecture ou de dessin reste dans ce cadre.
 */
export function SalesDashboardBody({
  preset,
  onPreset,
  sourceId,
  idPrefix,
  after,
  whenEmpty,
}: {
  preset: SalesRangePreset;
  onPreset: (p: SalesRangePreset) => void;
  /** Une fiche (la page d'un commercial) ; sinon toute l'équipe. */
  sourceId?: string;
  idPrefix: string;
  after?: (series: SalesSeries, fetching: boolean) => ReactNode;
  /** À la place du tableau quand la réponse ne contient aucune fiche (aucun commercial). */
  whenEmpty?: ReactNode;
}) {
  const data = useKeptSalesSeries(preset, sourceId);
  // Une fiche : la réponse ne contient qu'elle, on la réduit quand même (l'« équipe » = lui).
  const series = data.series && sourceId ? (pickSource(data.series, sourceId) ?? data.series) : data.series;
  const [metric, setMetric] = useState<SalesMetricKey>('payments_xaf');
  const [mode, setMode] = useState<EvolutionMode>('stacked');
  const chartRef = useRef<HTMLDivElement>(null);
  const pick = (m: SalesMetricKey) => {
    setMetric(m);
    revealPanel(chartRef.current);
  };

  let body: ReactNode;
  if (data.failed) body = <DashboardError detail={data.error} onRetry={data.refetch} />;
  else if (!series) body = <DashboardSkeleton />;
  else if (whenEmpty && series.sources.length === 0) body = whenEmpty;
  else
    body = (
      <div className="space-y-8">
        <section aria-labelledby={`${idPrefix}-bref`} className="space-y-3">
          <SectionLabel id={`${idPrefix}-bref`}>L’essentiel</SectionLabel>
          <div className={cn('transition-opacity duration-200', data.fetching && 'opacity-55')}>
            <HeadlineTiles series={series} preset={preset} metric={metric} onPick={pick} />
          </div>
          <TrendNote series={series} preset={preset} />
        </section>
        <section aria-labelledby={`${idPrefix}-evolution`} className="space-y-3">
          <SectionLabel id={`${idPrefix}-evolution`}>L’évolution</SectionLabel>
          {!hasActivity(series.team.totals, series.team.funnel) ? (
            // Rien sur la plage : un seul message (et non trois graphiques vides), et de quoi regarder plus loin.
            <div className={cn(PANEL, 'transition-opacity duration-200', data.fetching && 'opacity-55')}>
              <EmptyState title={`Aucune activité de ${rangeLabel(series.periods, series.grain)}`} height={240}>
                Ni paiement, ni dépôt, ni colis, ni prospect sur cette plage.
                {preset !== '12m' && (
                  <button
                    type="button"
                    onClick={() => onPreset('12m')}
                    className="sd-press mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold text-foreground ring-1 ring-border"
                  >
                    Voir les 12 derniers mois
                  </button>
                )}
              </EmptyState>
            </div>
          ) : (
          <div className="space-y-4">
            <EvolutionPanel
              series={series}
              metric={metric}
              onMetric={setMetric}
              mode={mode}
              onMode={sourceId ? undefined : setMode}
              fetching={data.fetching}
              panelRef={chartRef}
            />
            <ProspectsAndCargo series={series} fetching={data.fetching} />
          </div>
          )}
        </section>
        {after?.(series, data.fetching)}
      </div>
    );

  return (
    <div className="space-y-6">
      <RangeBar preset={preset} onChange={onPreset} series={series} />
      {body}
    </div>
  );
}

/* ── Les états ─────────────────────────────────────────────────────────── */

/** Le tableau de bord en chargement : les mêmes blocs, à leur place. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <KpiGridSkeleton count={8} columns={4} />
      <div className={cn(PANEL, 'p-4 sm:p-5')}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
        <div className="mt-5 flex gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-20" />
          ))}
        </div>
        <ChartSkeleton className="mt-6" height={280} />
      </div>
    </div>
  );
}

/** Les chiffres n'ont pas pu être lus : le message du serveur, et Réessayer. */
function DashboardError({ detail, onRetry }: { detail?: string | null; onRetry: () => void }) {
  return (
    <div className={PANEL}>
      <ErrorState detail={detail} onRetry={onRetry} height={260} />
    </div>
  );
}

/**
 * Un graphique qui plante n'emporte pas l'écran : ce qui suit (objectifs,
 * prospects, clients, « Confier à… ») reste utilisable. `resetKey` (la
 * plage) : en changer réessaie.
 */
export class DashboardBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ventes] tableau de bord', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className={PANEL}>
          <ErrorState message="Les graphiques n’ont pas pu s’afficher." detail={this.state.error.message} onRetry={() => this.setState({ error: null })} height={220} />
        </div>
      );
    }
    return this.props.children;
  }
}

/** Faire voir le graphique quand une tuile le choisit et qu'il est hors de l'écran (téléphone). */
function revealPanel(el: HTMLElement | null) {
  if (!el || typeof window === 'undefined') return;
  const r = el.getBoundingClientRect();
  if (r.top >= 0 && r.top < window.innerHeight * 0.55) return;
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView?.({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/** La note de bas d'écran : ce que chaque chiffre compte, tel que le serveur le calcule. */
export function DefinitionsNote({ className }: { className?: string }) {
  return (
    <p className={cn('px-0.5 text-[13px] leading-relaxed text-muted-foreground', className)}>
      Chiffres des clients dont le commercial est l’origine (un client confié à un autre commercial part avec son historique). Paiements terminés, dépôts validés.
      Colis enregistrés au bureau de Guangzhou (avion) ou à l’entrepôt (bateau), dépôts annulés exclus ; un vol compte s’il a emporté au moins un de leurs colis,
      à la date de son départ. Prospects : ceux ajoutés sur la plage, selon leur statut d’aujourd’hui. Périodes à l’heure de Douala.
    </p>
  );
}
