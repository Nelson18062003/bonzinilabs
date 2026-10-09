// ============================================================
// Mes équipes › Ventes — la vue d'ensemble de l'équipe commerciale
// (canManageSales ; garde serveur dans sales_series et sales_overview).
// Refaite le 08/10 à la demande du directeur : voir comment ÉVOLUENT les
// clients, les prospects, les paiements, les dépôts, le fret avion, les
// vols et le bateau — et plus seulement les chiffres d'un mois.
//
// De haut en bas :
//   · l'en-tête : « À vérifier » (les fiches dont un numéro est déjà celui
//     d'un client, avec leur nombre), « + Commercial » ; la plage ;
//   · comment ça va : huit tuiles de l'équipe sur la plage (tendance par
//     rapport à la plage précédente, mini-courbe) ;
//   · comment ça évolue : le graphique d'un indicateur, par commercial ou
//     pour l'équipe ; les prospects ; le fret ;
//   · qui fait quoi : le classement (une ligne → sa page) et les objectifs
//     du mois en cours de chacun (sales_overview).
// ============================================================
import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, UserPlus, UserSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useProspectClaims, useSalesOverview, type SalesSeries } from '@/hooks/useSales';
import { PROSPECT_CLAIMS_PATH, groupClaimsByProspect } from '@/hooks/useAdminNotifications';
import { currentMonth, type CommercialCard } from '@/lib/sales';
import { compareLabel, seriesColor, sourceSlots, type SalesRangePreset } from '@/lib/salesSeries';
import { ChartPanel, EmptyState, Leaderboard, PANEL } from '@/components/salesdash';
import { BTN_PRIMARY, BTN_SOFT } from './TeamBits';
import { TEAM_BASE } from './TeamScreen';
import { DashboardBoundary, DefinitionsNote, SalesDashboardBody, SectionLabel, presetQuery, useSalesPreset } from './SalesDashboard';
import { ObjectivesSummary } from './SalesObjectives';

export function SalesBoard() {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission('canManageSales')) return <Navigate to="/m" replace />;
  return <Board />;
}

function Board() {
  const navigate = useNavigate();
  const [preset, setPreset] = useSalesPreset();
  // Les objectifs du mois en cours (et la liste des fiches commercial, actives ou non).
  const overview = useSalesOverview(currentMonth());
  // Les fiches « À vérifier », une par prospect : au total et par commercial.
  const claims = useProspectClaims();
  const toVerify = useMemo(() => {
    const groups = groupClaimsByProspect(claims.data ?? []);
    const bySource = new Map<string, number>();
    for (const g of groups) bySource.set(g[0].source_id, (bySource.get(g[0].source_id) ?? 0) + 1);
    return { total: groups.length, bySource };
  }, [claims.data]);
  const active = (overview.data ?? []).filter((r) => r.source.is_active).length;
  const open = (sourceId: string) => navigate(`${TEAM_BASE}/ventes/${sourceId}${presetQuery(preset)}`);
  const newCommercial = () => navigate(`${TEAM_BASE}/nouveau?role=commercial`);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-0">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <button type="button" onClick={() => navigate(TEAM_BASE)} className="mb-1 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Mes équipes
          </button>
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">Ventes</h1>
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            {overview.data ? `${active} commercia${active > 1 ? 'ux' : 'l'} actif${active > 1 ? 's' : ''} · ` : ''}ce que l’équipe apporte, et comment ça évolue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToVerifyButton count={toVerify.total} onClick={() => navigate(PROSPECT_CLAIMS_PATH)} />
          <button type="button" onClick={newCommercial} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" /> Commercial
          </button>
        </div>
      </header>

      <DashboardBoundary resetKey={preset}>
        <SalesDashboardBody
          preset={preset}
          onPreset={setPreset}
          idPrefix="ventes"
          whenEmpty={
            <div className={PANEL}>
              <EmptyState title="Aucun commercial pour l’instant" height={280}>
                Créez l’accès d’un commercial : sa fiche est créée avec, et la réception pourra lui attribuer ses clients.
                <button type="button" onClick={newCommercial} className={cn(BTN_PRIMARY, 'mt-4')}>
                  <UserPlus className="h-4 w-4" /> Créer un commercial
                </button>
              </EmptyState>
            </div>
          }
          after={(series, fetching) => (
            <WhoDoesWhat
              series={series}
              fetching={fetching}
              preset={preset}
              rows={overview.data ?? []}
              loading={overview.isLoading}
              error={overview.isError}
              onRetry={() => void overview.refetch()}
              toVerify={toVerify.bySource}
              onOpen={open}
            />
          )}
        />
      </DashboardBoundary>

      <DefinitionsNote />
    </div>
  );
}

/** Qui fait quoi : le classement sur la plage, puis les objectifs du mois en cours de chacun. */
function WhoDoesWhat({
  series,
  fetching,
  preset,
  rows,
  loading,
  error,
  onRetry,
  toVerify,
  onOpen,
}: {
  series: SalesSeries;
  fetching: boolean;
  preset: SalesRangePreset;
  rows: CommercialCard[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  toVerify: Map<string, number>;
  onOpen: (sourceId: string) => void;
}) {
  // La couleur d'une fiche : celle des graphiques (stable, par identifiant) — la même pastille partout.
  const slots = useMemo(() => sourceSlots(series.sources), [series.sources]);
  const colorOf = (id: string) => (slots.has(id) ? seriesColor(slots.get(id) ?? null) : null);
  return (
    <section aria-labelledby="ventes-qui" className="space-y-3">
      <SectionLabel id="ventes-qui">Qui fait quoi</SectionLabel>
      <div className="space-y-4">
        <ChartPanel title="Les commerciaux" subtitle="Classés par paiements sur la plage ; touchez un commercial pour ouvrir sa page" padding="none" fetching={fetching}>
          <Leaderboard series={series} onSelect={onOpen} compareLabel={compareLabel(preset)} />
        </ChartPanel>
        <ObjectivesSummary rows={rows} loading={loading} error={error} onRetry={onRetry} toVerify={toVerify} colorOf={colorOf} onOpen={onOpen} />
      </div>
    </section>
  );
}

/** « À vérifier » et son nombre : ambré quand des fiches attendent, discret sinon. */
function ToVerifyButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `À vérifier : ${count} fiche${count > 1 ? 's' : ''} en attente` : 'À vérifier'}
      className={cn(BTN_SOFT, count > 0 && 'bg-amber-50 text-amber-950 ring-amber-300 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-100 dark:ring-amber-400/40')}
    >
      <UserSearch className="h-4 w-4" /> À vérifier
      {count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[12px] font-bold tabular-nums text-white">
          {count}
        </span>
      )}
    </button>
  );
}
