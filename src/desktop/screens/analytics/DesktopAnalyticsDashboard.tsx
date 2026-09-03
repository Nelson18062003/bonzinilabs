/**
 * Tableau de bord — DESKTOP.
 *
 * Ce fichier faisait 15 lignes et rendait les 1 799 lignes de l'écran mobile :
 * il n'y avait pas de tableau de bord desktop, seulement l'écran téléphone
 * élargi. Conséquences mesurées (docs/admin-redesign/09-dashboard-rebuild.md) :
 *
 *   · 5 sections sur 6 REPLIÉES par défaut. Sur 390 px c'est la bonne réponse ;
 *     sur 1 440 px c'est cacher ce qu'on a la place de montrer.
 *   · les 6 indicateurs de tête en « 18,4 M » — l'abréviation bannie ailleurs.
 *   · une seule référence à `components/ui/` dans 1 799 lignes : l'écran vit à
 *     côté du design system.
 *
 * Ici : tout est visible, les montants sont entiers, et les atomes viennent du
 * design system (`dashboardKit`). La couche de données ne bouge pas.
 *
 * La COMPOSITION, elle, suit les demandes successives de l'utilisateur : sept
 * graphiques que la première version desktop avait laissés de côté ont été
 * restaurés (`dashboardBlocks`), puis trois ont été retirés à sa demande
 * (statut des dépôts dans le temps, qualité des dépôts, évolution des taux),
 * et une section « Croissance » est venue répondre à la question qui manquait :
 * non pas « combien sur la période » mais « est-ce que ça monte, semaine après
 * semaine, mois après mois » (`GrowthMatrixSection`).
 *
 * Le mobile garde son écran : ses accordéons sont justifiés par sa largeur.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Warning, Info } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker, formatCurrencyFull, formatInteger, formatPercent } from '@/components/analytics';
import { DateRangeProvider, useDateRange } from '@/lib/analytics/DateRangeContext';
import { bucketAxisLabel } from '@/lib/analytics/dateRange';
import {
  useFlowSeries,
  usePaymentSummary,
  useDepositSummary,
  useDepositMethodBreakdown,
  usePaymentMethodBreakdown,
  useTopClients,
  useWalletExposure,
  useDashboardAlerts,
  useAdminProductivity,
  useClientGrowthReport,
  useDepositVolumeReport,
  usePaymentVolumeReport,
  useFunnel,
  useDepositProcessingTime,
  useRegistrationSource,
  useUtmSources,
  useClientCountryDistribution,
} from '@/hooks/analytics/useAnalytics';
import {
  NUM,
  TONE,
  StatCard,
  Block,
  ChartSkeleton,
  EmptyBlock,
  DTable,
  DHead,
  DBody,
  DRow,
  DTh,
  DTd,
} from './dashboardKit';
import { VolumeGrowthBlock } from './VolumeGrowthBlock';
import { ClientGrowthBlock } from './ClientGrowthBlock';
import {
  RegistrationSourcesBlock,
  CountryDistributionBlock,
  formatMinutes,
} from './dashboardBlocks';
import { GrowthMatrixSection } from './GrowthMatrixSection';

/** Couleurs des séries — jetons Tailwind, donc cohérentes clair/sombre. */
const C = {
  deposits: '#4F46E5',
  payments: '#D97706',
  clients: '#059669',
} as const;

/** Variation relative entre deux périodes. `null` = rien à comparer. */
function delta(current: number, previous: number | null | undefined): number | null {
  if (previous == null || previous === 0) return null;
  return (current - previous) / previous;
}

const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } as const;

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600 },
} as const;

/**
 * L'écran FOURNIT son contexte de plage, comme le fait `MobileAnalyticsDashboard`.
 *
 * Sans ce fournisseur, `useDateRange()` lève « must be used within a
 * DateRangeProvider » et toute la page tombe sur l'écran d'erreur — c'est ce
 * qui est arrivé en production. Le laisser à la charge de l'appelant, c'est
 * garantir qu'un jour un appelant l'oubliera : le composant doit être montable
 * n'importe où et fonctionner.
 */
export function DesktopAnalyticsDashboard() {
  return (
    <DateRangeProvider defaultPreset="last_30_days">
      <DashboardBody />
    </DateRangeProvider>
  );
}

function DashboardBody() {
  const { range } = useDateRange();

  // Chaque métrique périodique prend la plage : c'est le sélecteur en haut à
  // droite qui pilote tout l'écran, pas un état par bloc.
  const flow = useFlowSeries(range);
  // Les deux séries, chacune pour elle-même. Ces hooks existaient déjà et
  // servaient le mobile ; l'écran desktop ne les affichait nulle part.
  const depositGrowth = useDepositVolumeReport(range);
  const paymentGrowth = usePaymentVolumeReport(range);
  const payments = usePaymentSummary(range);
  const deposits = useDepositSummary(range);
  const depositMethods = useDepositMethodBreakdown(range);
  const paymentMethods = usePaymentMethodBreakdown(range);
  const topClients = useTopClients(range);
  const productivity = useAdminProductivity(range);
  const growth = useClientGrowthReport(range);
  // Les métriques que la première version desktop n'affichait pas — le
  // mobile les avait, l'utilisateur les a réclamées.
  const funnel = useFunnel(range);
  const processing = useDepositProcessingTime(range);
  const registration = useRegistrationSource(range);
  const utm = useUtmSources(range, 10);
  // Ces trois-là sont des instantanés : ils ignorent la plage, à dessein.
  const exposure = useWalletExposure();
  const countries = useClientCountryDistribution();
  const alerts = useDashboardAlerts();

  const paymentsXAF = payments.data?.current.totalXAF ?? 0;
  const depositsXAF = deposits.data?.current.totalXAF ?? 0;
  const net = depositsXAF - paymentsXAF;

  const netPrevious = useMemo(() => {
    const dp = deposits.data?.previous?.totalXAF;
    const pp = payments.data?.previous?.totalXAF;
    return dp == null || pp == null ? null : dp - pp;
  }, [deposits.data, payments.data]);

  const compare = range.compareToPrevious;

  /* ── Axes X ───────────────────────────────────────────────────────────
   *
   * Deux choses, distinctes, rendaient les axes « bizarres » :
   *
   *  1. Le NOMBRE de seaux — corrigé à la source (DateRangeContext) : la
   *     granularité suit maintenant la plage, plus de 365 barres-filaments
   *     sur « Cette année ».
   *  2. Les ÉTIQUETTES, exactes mais sans contexte : « Ven 16 · Lun 2 ·
   *     Mer 18 » ne dit pas le mois ; « 14h » répété ne dit pas le jour.
   *     `bucketAxisLabel` ajoute le contexte au premier seau et à chaque
   *     changement (1er du mois, minuit).
   *
   * Recharts élague les étiquettes en mesurant le texte (`preserveEnd`) ;
   * `preserveStartEnd` garde en plus la PREMIÈRE, celle qui porte le
   * contexte. On ne pose PAS d'`interval` numérique : il désactiverait cet
   * élagage par mesure — le seul qui tienne quelle que soit la largeur — et
   * les plafonds de `timeXAxisProps` sont calibrés pour une carte mobile de
   * 360 px, pas pour un axe de 1 000 px. */
  const withAxisLabel = <T extends { bucket: string }>(rows: T[]) =>
    rows.map((p) => ({ ...p, axisLabel: bucketAxisLabel(new Date(p.bucket), range.granularity, range) }));

  const flowData = useMemo(() => withAxisLabel(flow.data?.current ?? []), [flow.data, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const flowEmpty = flowData.length === 0 || flowData.every((p) => p.deposits === 0 && p.payments === 0);

  return (
    <div className="space-y-4 font-ui">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[19px] font-bold tracking-[-0.02em] text-foreground">Tableau de bord</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Volumes, clients et exposition sur la période choisie
          </p>
        </div>
        <DateRangePicker />
      </header>

      {/* Ce qui demande une action passe EN PREMIER. `useDashboardAlerts`
          existait déjà mais se retrouvait noyée au milieu de l'écran. */}
      {!alerts.isLoading && (alerts.data?.length ?? 0) > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {(alerts.data ?? []).map((a) => {
            const critical = a.severity === 'critical';
            const Icon = a.severity === 'info' ? Info : Warning;
            return (
              <div
                key={a.id}
                className={cn(
                  'flex items-start gap-2.5 rounded-md border p-3',
                  critical
                    ? 'border-destructive/30 bg-destructive/10'
                    : a.severity === 'warning'
                      ? 'border-amber-500/30 bg-amber-50 dark:bg-amber-950/40'
                      : 'border-border bg-muted/50',
                )}
              >
                <Icon
                  className={cn('mt-0.5 size-4 shrink-0', critical ? TONE.negative : 'text-amber-600 dark:text-amber-400')}
                  weight="bold"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-foreground">{a.title}</span>
                    {a.count > 0 && <Badge variant="secondary" className={NUM}>{formatInteger(a.count)}</Badge>}
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{a.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Montants ENTIERS : `formatCurrencyFull`, dont la documentation dit
          elle-même « Use for KPI primary values » — l'écran mobile passait
          pourtant `{ compact: true }`. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Paiements exécutés"
          value={formatCurrencyFull(paymentsXAF, 'XAF')}
          hint={`${formatInteger(payments.data?.current.opCount ?? 0)} opérations`}
          delta={compare ? delta(paymentsXAF, payments.data?.previous?.totalXAF) : undefined}
          loading={payments.isLoading}
        />
        <StatCard
          label="Dépôts validés"
          value={formatCurrencyFull(depositsXAF, 'XAF')}
          hint={`${formatInteger(deposits.data?.current.opCount ?? 0)} dépôts`}
          delta={compare ? delta(depositsXAF, deposits.data?.previous?.totalXAF) : undefined}
          loading={deposits.isLoading}
        />
        <StatCard
          label="Flux net"
          value={formatCurrencyFull(net, 'XAF')}
          hint={net >= 0 ? "Plus d'entrées que de sorties" : 'Plus de sorties que d’entrées'}
          delta={compare ? delta(net, netPrevious) : undefined}
          loading={payments.isLoading || deposits.isLoading}
          tone={net >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Exposition portefeuilles"
          value={formatCurrencyFull(exposure.data?.totalXAF ?? 0, 'XAF')}
          hint={`${formatInteger(exposure.data?.clientsWithBalance ?? 0)} clients · hors filtre période`}
          loading={exposure.isLoading}
        />
      </div>

      {/* Deuxième ligne : les CLIENTS et le SERVICE. L'entonnoir et le délai
          de validation vivaient sur mobile ; ils avaient disparu ici. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Nouveaux clients"
          value={formatInteger(growth.data?.newClients ?? 0)}
          hint={`${formatInteger(growth.data?.totalAtEnd ?? 0)} clients au total`}
          delta={compare ? growth.data?.trendPct : undefined}
          loading={growth.isLoading}
        />
        <StatCard
          label="Clients actifs"
          value={formatInteger(funnel.data?.clientsWithPayment ?? 0)}
          hint="au moins un paiement exécuté sur la période"
          loading={funnel.isLoading}
        />
        <StatCard
          label="Conversion dépôt → paiement"
          value={formatPercent(funnel.data?.depositToPaymentRate ?? 0)}
          hint={`${formatInteger(funnel.data?.clientsWithDeposit ?? 0)} ont déposé · ${formatInteger(funnel.data?.clientsWithPayment ?? 0)} ont payé`}
          loading={funnel.isLoading}
        />
        <StatCard
          label="Délai de validation (médiane)"
          value={formatMinutes(processing.data?.medianMinutes)}
          hint={
            processing.data && processing.data.sampleSize > 0
              ? `P90 ${formatMinutes(processing.data.p90Minutes)} · ${formatInteger(processing.data.sampleSize)} dépôts`
              : 'aucun dépôt validé sur la période'
          }
          loading={processing.isLoading}
        />
      </div>

      <Block
        title="Flux financier"
        description="Dépôts validés contre paiements exécutés, agrégés par période"
      >
        {flow.isLoading ? (
          <ChartSkeleton height={300} />
        ) : flowEmpty ? (
          <EmptyBlock height={300}>Aucun mouvement sur la période.</EmptyBlock>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={flowData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="axisLabel"
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              {/* Graduations en ENTIER, pas « 1,6 M ». `formatAxisTick` abrège
                  pour tenir dans 60-80 px : on élargit l'axe plutôt que de
                  réintroduire l'abréviation que le reste de l'écran bannit. */}
              <YAxis
                tick={axisTick}
                tickFormatter={(v) => formatInteger(Number(v))}
                axisLine={false}
                tickLine={false}
                width={96}
              />
              <Tooltip
                {...tooltipStyle}
                // L'infobulle garde l'étiquette COMPLÈTE du seau, pas l'abrégé de l'axe.
                labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? '')}
                formatter={(v, name) => [formatCurrencyFull(Number(v), 'XAF'), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deposits" name="Dépôts" fill={C.deposits} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="payments" name="Paiements" fill={C.payments} radius={[3, 3, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Block>

      {/* Le flux combiné répond « entre-t-il plus qu'il ne sort ? ». Ces deux
          blocs suivent chaque flux POUR LUI-MÊME sur la période choisie, avec
          son cumul. Le RYTHME (semaine après semaine) est une autre question,
          traitée plus bas par `GrowthMatrixSection` — d'où les titres
          « Volume … sur la période » ici et « Croissance … » là-bas : deux
          blocs ne peuvent pas porter le même nom sur un même écran. */}
      <VolumeGrowthBlock
        title="Volume des dépôts sur la période"
        description="Volume validé par seau, et cumul depuis le début de la période"
        report={depositGrowth.data}
        loading={depositGrowth.isLoading}
        range={range}
        color={C.deposits}
        cumulativeColor="#312E81"
        unit="Dépôts"
      />

      <VolumeGrowthBlock
        title="Volume des paiements sur la période"
        description="Volume exécuté par seau, et cumul depuis le début de la période"
        report={paymentGrowth.data}
        loading={paymentGrowth.isLoading}
        range={range}
        color={C.payments}
        cumulativeColor="#7C2D12"
        unit="Paiements"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Dépôts par méthode" description="Volume validé sur la période">
          <MethodTable rows={depositMethods.data ?? []} loading={depositMethods.isLoading} />
        </Block>
        <Block title="Paiements par méthode" description="Volume exécuté sur la période">
          <MethodTable rows={paymentMethods.data ?? []} loading={paymentMethods.isLoading} />
        </Block>
      </div>

      {/* LE graphique clients : le parc au fil de la période, une seule
          courbe. Les barres qui s'y superposaient sont parties — « il a une
          ligne et aussi des barres dedans, je ne comprends pas ». */}
      <ClientGrowthBlock report={growth.data} loading={growth.isLoading} range={range} color={C.clients} />

      <div className="grid gap-4 xl:grid-cols-2">
        <RegistrationSourcesBlock stats={registration.data} utm={utm.data ?? []} loading={registration.isLoading || utm.isLoading} />
        <CountryDistributionBlock rows={countries.data ?? []} loading={countries.isLoading} />
      </div>

      {/* Les trois matrices de croissance : le RYTHME, sur douze semaines ou
          douze mois, indépendamment de la période choisie en haut. */}
      <GrowthMatrixSection />

      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Top clients" description="Classés par volume de paiements sur la période">
          {topClients.isLoading ? (
            <ChartSkeleton height={200} />
          ) : (topClients.data ?? []).length === 0 ? (
            <EmptyBlock height={200}>Aucun paiement sur la période.</EmptyBlock>
          ) : (
            <DTable>
              <DHead>
                <DRow className="hover:bg-transparent">
                  <DTh>Client</DTh>
                  <DTh align="right">Opérations</DTh>
                  <DTh align="right">Volume</DTh>
                </DRow>
              </DHead>
              <DBody>
                {(topClients.data ?? []).slice(0, 10).map((c) => (
                  <DRow key={c.userId}>
                    <DTd className="font-semibold text-foreground">
                      {`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || '—'}
                    </DTd>
                    <DTd align="right" className={NUM}>{formatInteger(c.opCount)}</DTd>
                    <DTd align="right" className={cn(NUM, 'font-semibold')}>
                      {formatCurrencyFull(c.totalXAF, 'XAF')}
                    </DTd>
                  </DRow>
                ))}
              </DBody>
            </DTable>
          )}
        </Block>

        <Block title="Productivité des administrateurs" description="Actions par administrateur sur la période">
          {productivity.isLoading ? (
            <ChartSkeleton height={200} />
          ) : (productivity.data ?? []).length === 0 ? (
            <EmptyBlock height={200}>Aucune action enregistrée sur la période.</EmptyBlock>
          ) : (
            <DTable>
              <DHead>
                <DRow className="hover:bg-transparent">
                  <DTh>Administrateur</DTh>
                  <DTh align="right">Actions</DTh>
                </DRow>
              </DHead>
              <DBody>
                {(productivity.data ?? []).slice(0, 10).map((r) => (
                  <DRow key={r.adminId}>
                    <DTd className="font-semibold text-foreground">{r.name}</DTd>
                    <DTd align="right" className={cn(NUM, 'font-semibold')}>{formatInteger(r.totalActions)}</DTd>
                  </DRow>
                ))}
              </DBody>
            </DTable>
          )}
        </Block>
      </div>
    </div>
  );
}

/** Table d'une répartition par méthode — même forme des deux côtés. */
function MethodTable({
  rows,
  loading,
}: {
  rows: ReadonlyArray<{ key: string; label: string; count: number; amount: number }>;
  loading: boolean;
}) {
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (loading) return <ChartSkeleton height={200} />;
  if (rows.length === 0) return <EmptyBlock height={200}>Aucune opération sur la période.</EmptyBlock>;
  return (
    <DTable>
      <DHead>
        <DRow className="hover:bg-transparent">
          <DTh>Méthode</DTh>
          <DTh align="right">Nombre</DTh>
          <DTh align="right">Montant</DTh>
          <DTh align="right">Part</DTh>
        </DRow>
      </DHead>
      <DBody>
        {rows.map((r) => (
          <DRow key={r.key}>
            <DTd className="font-semibold text-foreground">{r.label}</DTd>
            <DTd align="right" className={NUM}>{formatInteger(r.count)}</DTd>
            <DTd align="right" className={cn(NUM, 'font-semibold')}>{formatCurrencyFull(r.amount, 'XAF')}</DTd>
            <DTd align="right" className={cn(NUM, 'text-muted-foreground')}>
              {total > 0 ? `${((r.amount / total) * 100).toFixed(1).replace('.', ',')} %` : '—'}
            </DTd>
          </DRow>
        ))}
      </DBody>
    </DTable>
  );
}
