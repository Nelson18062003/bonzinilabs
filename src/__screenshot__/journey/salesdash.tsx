// Captures du kit du tableau de bord des ventes (08/10) — domaine « salesdash » :
// clés « j.salesdash.<planche> » (données : tools/journey/salesdash.mjs, qui sert
// sales_series avec le générateur tools/journey/salesSeriesFixture.mjs).
//
// Une planche par brique de src/components/salesdash/, posée DEUX fois : dans le
// thème de l'administration (« Mes équipes », `.admin-theme`) puis dans celui de
// l'espace commercial (« /v », `.admin-theme.sales-ui`). Le mode sombre est posé
// par le module de captures (classe `dark` sur <html>). Aujourd'hui : 9 octobre 2026.
import { useMemo, useState, type ReactNode } from 'react';
// DM Sans servie en local : Google Fonts passe mal par le mandataire des captures.
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import type { JourneyEntry } from './types';
import { useSalesSeries, type SalesSeries } from '@/hooks/useSales';
import {
  HEADLINE_METRICS,
  compareLabel,
  conversionRate,
  formatRate,
  pickSource,
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
  Leaderboard,
  MetricSwitcher,
  PeriodPicker,
  ProspectFunnel,
  SegmentedControl,
} from '@/components/salesdash';

const NOW = new Date('2026-10-09T10:00:00Z');

/** Les deux matières : l'administration, puis l'espace commercial. */
function Both({ title, children }: { title: string; children: (side: 'admin' | 'v') => ReactNode }) {
  return (
    <div className="min-h-screen">
      <section className="admin-theme bg-background px-4 py-6 text-foreground sm:px-10 sm:py-10">
        <Caption kit="Administration — Mes équipes" title={title} />
        <div className="mx-auto max-w-[1100px] space-y-4">{children('admin')}</div>
      </section>
      <section className="admin-theme sales-ui bg-background px-4 py-6 text-foreground sm:px-10 sm:py-10">
        <Caption kit="Espace commercial — /v" title={title} />
        <div className="mx-auto max-w-[1100px] space-y-4">{children('v')}</div>
      </section>
    </div>
  );
}

function Caption({ kit, title }: { kit: string; title: string }) {
  return (
    <div className="mx-auto mb-5 max-w-[1100px]">
      <p className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{kit}</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
    </div>
  );
}

function useSeries(preset: SalesRangePreset, sourceId?: string) {
  const r = rangeForPreset(preset, NOW);
  return useSalesSeries({ ...r, sourceId });
}

/** Les données d'une planche, ou son état (chargement, erreur). */
function WithSeries({ preset, sourceId, children }: { preset: SalesRangePreset; sourceId?: string; children: (s: SalesSeries) => ReactNode }) {
  const q = useSeries(preset, sourceId);
  if (q.isLoading) return <ChartSkeleton />;
  if (q.isError || !q.data) return <ErrorState detail={(q.error as Error | null)?.message} onRetry={() => void q.refetch()} />;
  return <>{children(q.data)}</>;
}

/* ── 1. Période et tuiles ──────────────────────────────────────────────── */

function KpisBoard() {
  return (
    <Both title="Période et tuiles">
      {() => <KpisSide />}
    </Both>
  );
}

function KpisSide() {
  const [preset, setPreset] = useState<SalesRangePreset>('3m');
  const [metric, setMetric] = useState<SalesMetricKey>('payments_xaf');
  const q = useSeries(preset);
  const s = q.data;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted-foreground">{s ? rangeLabel(s.periods, s.grain) : '…'}</p>
        <PeriodPicker value={preset} onChange={setPreset} />
      </div>
      {s ? (
        <KpiGrid columns={6}>
          {HEADLINE_METRICS.map((m) => (
            <KpiTile key={m} metric={m} data={s.team} grain={s.grain} now={NOW} compareLabel={compareLabel(preset)} onClick={() => setMetric(m)} selected={metric === m} />
          ))}
        </KpiGrid>
      ) : (
        <KpiGridSkeleton columns={6} />
      )}
      {s && (
        <KpiGrid>
          <KpiTile label="Taux de conversion" value={formatRate(conversionRate(s.team.funnel))} sub={`${s.team.funnel.won} sur ${s.team.funnel.total} prospects`} />
          <KpiTile metric="clients_total" data={s.team} grain={s.grain} now={NOW} compareLabel={compareLabel(preset)} />
          <KpiTile metric="active_clients" data={s.team} grain={s.grain} now={NOW} compareLabel={compareLabel(preset)} />
          <KpiTile metric="prospects_lost" data={s.team} grain={s.grain} now={NOW} compareLabel={compareLabel(preset)} />
        </KpiGrid>
      )}
      <p className="pt-2 text-[13px] font-medium text-muted-foreground">En chargement</p>
      <KpiGridSkeleton count={4} />
    </>
  );
}

/* ── 2. Évolution ──────────────────────────────────────────────────────── */

function EvolutionBoard() {
  return <Both title="Graphique d’évolution">{() => <EvolutionSide />}</Both>;
}

function EvolutionSide() {
  const [metric, setMetric] = useState<SalesMetricKey>('payments_xaf');
  const [mode, setMode] = useState<'stacked' | 'total'>('stacked');
  return (
    <>
      <WithSeries preset="12m">
        {(s) => (
          <ChartPanel
            title="Évolution sur 12 mois"
            subtitle={rangeLabel(s.periods, s.grain)}
            actions={
              <SegmentedControl
                ariaLabel="Affichage"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'stacked', label: 'Par commercial' },
                  { value: 'total', label: 'Équipe' },
                ]}
                className="w-full sm:w-[260px]"
              />
            }
          >
            <MetricSwitcher value={metric} onChange={setMetric} totals={s.team.totals} className="mb-4" />
            <div data-chart="evolution">
              <EvolutionChart series={s} metric={metric} mode={mode} now={NOW} />
            </div>
          </ChartPanel>
        )}
      </WithSeries>
      <div className="grid gap-4 lg:grid-cols-2">
        <WithSeries preset="12m">
          {(s) => (
            <ChartPanel title="Clients" subtitle="Le parc de chaque commercial, à la fin du mois">
              <EvolutionChart series={s} metric="clients_total" now={NOW} height={220} />
            </ChartPanel>
          )}
        </WithSeries>
        <WithSeries preset="12w" sourceId="src-rodrigue">
          {(s) => (
            <ChartPanel title="Paiements — Rodrigue Tchami" subtitle={`12 semaines · ${rangeLabel(s.periods, s.grain)}`}>
              <EvolutionChart series={s} metric="payments_xaf" now={NOW} height={220} />
            </ChartPanel>
          )}
        </WithSeries>
      </div>
    </>
  );
}

/* ── 3. Fret avion ─────────────────────────────────────────────────────── */

function CargoBoard() {
  return (
    <Both title="Fret avion">
      {() => (
        <div className="grid gap-4 lg:grid-cols-2">
          <WithSeries preset="12m">
            {(s) => (
              <ChartPanel title="Fret avion de l’équipe" subtitle={rangeLabel(s.periods, s.grain)}>
                <CargoChart series={s} now={NOW} />
              </ChartPanel>
            )}
          </WithSeries>
          <WithSeries preset="12w" sourceId="src-rodrigue">
            {(s) => (
              <ChartPanel title="Fret — Rodrigue Tchami" subtitle={`12 semaines, avec le bateau`}>
                <CargoChart series={s} now={NOW} showSea />
              </ChartPanel>
            )}
          </WithSeries>
        </div>
      )}
    </Both>
  );
}

/* ── 4. Prospects ──────────────────────────────────────────────────────── */

function FunnelBoard() {
  return (
    <Both title="Prospects">
      {() => (
        <div className="grid gap-4 md:grid-cols-3">
          <WithSeries preset="12m">
            {(s) => (
              <ChartPanel title="L’équipe, 12 mois">
                <ProspectFunnel funnel={s.team.funnel} />
              </ChartPanel>
            )}
          </WithSeries>
          <WithSeries preset="3m" sourceId="src-carine">
            {(s) => (
              <ChartPanel title="Carine Ewane, 3 mois">
                <ProspectFunnel funnel={s.team.funnel} onStageClick={() => undefined} />
              </ChartPanel>
            )}
          </WithSeries>
          <ChartPanel title="Une fiche toute neuve">
            <ProspectFunnel funnel={{ total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 }} />
          </ChartPanel>
        </div>
      )}
    </Both>
  );
}

/* ── 5. Classement ─────────────────────────────────────────────────────── */

function LeaderboardBoard() {
  return (
    <Both title="Les commerciaux">
      {() => (
        <WithSeries preset="12m">
          {(s) => (
            <ChartPanel title="Les commerciaux" subtitle={`${rangeLabel(s.periods, s.grain)} · classés par paiements`} padding="none">
              <Leaderboard series={s} onSelect={() => undefined} compareLabel={compareLabel('12m')} now={NOW} />
            </ChartPanel>
          )}
        </WithSeries>
      )}
    </Both>
  );
}

/* ── 6. États ──────────────────────────────────────────────────────────── */

function StatesBoard() {
  return (
    <Both title="Chargement, vide, erreur, une seule fiche">
      {() => <StatesSide />}
    </Both>
  );
}

function StatesSide() {
  const empty = useSeries('3m', 'src-vide');
  const failing = useSeries('3m', 'src-erreur');
  const all = useSeries('12m');
  const herve = useMemo(() => (all.data ? pickSource(all.data, 'src-herve') : null), [all.data]);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartPanel title="En chargement" subtitle="Squelette à la taille du vrai graphique">
          <ChartSkeleton height={220} />
        </ChartPanel>
        <ChartPanel title="En erreur" subtitle="Le message du serveur, et Réessayer">
          {failing.isError ? (
            <ErrorState detail={(failing.error as Error).message} onRetry={() => void failing.refetch()} height={220} />
          ) : (
            <ChartSkeleton height={220} />
          )}
        </ChartPanel>
        <ChartPanel title="Une fiche sans activité" subtitle="Bertrand Fouda, arrivé aujourd’hui">
          {empty.data ? <EvolutionChart series={empty.data} metric="payments_xaf" now={NOW} height={220} /> : <ChartSkeleton height={220} />}
        </ChartPanel>
        <ChartPanel title="Une fiche archivée, 12 mois" subtitle="Hervé Nkoulou, parti fin juin : ses derniers mois sont vides">
          {herve ? <EvolutionChart series={herve} metric="payments_xaf" now={NOW} height={220} /> : <ChartSkeleton height={220} />}
        </ChartPanel>
      </div>
      {empty.data && (
        <KpiGrid>
          {(['payments_xaf', 'new_clients', 'air_kg', 'prospects_new'] as SalesMetricKey[]).map((m) => (
            <KpiTile key={m} metric={m} data={empty.data!.team} grain={empty.data!.grain} now={NOW} />
          ))}
        </KpiGrid>
      )}
      {empty.data && (
        <ChartPanel title="Classement d’une seule fiche" padding="none">
          <Leaderboard series={empty.data} now={NOW} />
        </ChartPanel>
      )}
      <ChartPanel title="État vide seul">
        <EmptyState>Les chiffres apparaîtront au premier paiement, dépôt ou colis de ses clients.</EmptyState>
      </ChartPanel>
    </>
  );
}

export const SCREENS: Record<string, JourneyEntry> = {
  'j.salesdash.kpis': { Comp: KpisBoard, route: '/m/equipe/ventes' },
  'j.salesdash.evolution': { Comp: EvolutionBoard, route: '/m/equipe/ventes' },
  'j.salesdash.cargo': { Comp: CargoBoard, route: '/m/equipe/ventes' },
  'j.salesdash.funnel': { Comp: FunnelBoard, route: '/m/equipe/ventes' },
  'j.salesdash.leaderboard': { Comp: LeaderboardBoard, route: '/m/equipe/ventes' },
  'j.salesdash.states': { Comp: StatesBoard, route: '/m/equipe/ventes' },
};
