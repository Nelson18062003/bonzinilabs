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
 * design system (`dashboardKit`). La couche de données ne bouge pas — elle est
 * bonne : 21 métriques dans `useAnalytics`, 20 déjà consommées.
 *
 * Le mobile garde son écran : ses accordéons sont justifiés par sa largeur.
 */
import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { DateRangePicker, formatCurrencyFull, formatInteger } from '@/components/analytics';
import { useDateRange } from '@/lib/analytics/DateRangeContext';
import {
  useFlowSeries,
  usePaymentSummary,
  useDepositSummary,
  useDepositMethodBreakdown,
  usePaymentMethodBreakdown,
  useDepositStatusSummary,
  useTopClients,
  useWalletExposure,
  useDashboardAlerts,
  useAdminProductivity,
  useClientGrowth,
} from '@/hooks/analytics/useAnalytics';
import {
  NUM,
  LABEL,
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

export function DesktopAnalyticsDashboard() {
  const { range } = useDateRange();

  // Chaque métrique périodique prend la plage : c'est le sélecteur en haut à
  // droite qui pilote tout l'écran, pas un état par bloc.
  const flow = useFlowSeries(range);
  const payments = usePaymentSummary(range);
  const deposits = useDepositSummary(range);
  const depositMethods = useDepositMethodBreakdown(range);
  const paymentMethods = usePaymentMethodBreakdown(range);
  const depositStatus = useDepositStatusSummary(range);
  const topClients = useTopClients(range);
  const productivity = useAdminProductivity(range);
  const growth = useClientGrowth(range);
  // Ces deux-là sont des instantanés : ils ignorent la plage, à dessein.
  const exposure = useWalletExposure();
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
  const flowData = flow.data?.current ?? [];
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
              <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
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
                formatter={(v, name) => [formatCurrencyFull(Number(v), 'XAF'), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="deposits" name="Dépôts" fill={C.deposits} radius={[3, 3, 0, 0]} />
              <Bar dataKey="payments" name="Paiements" fill={C.payments} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Block>

      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Dépôts par méthode" description="Volume XAF sur la période">
          <MethodTable rows={depositMethods.data ?? []} loading={depositMethods.isLoading} />
        </Block>
        <Block title="Paiements par méthode" description="Volume XAF sur la période">
          <MethodTable rows={paymentMethods.data ?? []} loading={paymentMethods.isLoading} />
        </Block>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Block title="Croissance clients" description="Nouveaux clients par période">
          {growth.isLoading ? (
            <ChartSkeleton />
          ) : (growth.data ?? []).length === 0 ? (
            <EmptyBlock>Aucune inscription sur la période.</EmptyBlock>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={growth.data ?? []} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="count" name="Nouveaux clients" stroke={C.clients} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Block>

        <Block title="Qualité des dépôts" description="Répartition des statuts sur la période">
          {depositStatus.isLoading ? (
            <ChartSkeleton />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={LABEL}>Taux de validation</div>
                  <div className={cn('mt-1 text-[20px] font-bold', NUM, TONE.positive)}>
                    {((depositStatus.data?.validationRate ?? 0) * 100).toFixed(1).replace('.', ',')} %
                  </div>
                </div>
                <div>
                  <div className={LABEL}>Taux de rejet</div>
                  <div className={cn('mt-1 text-[20px] font-bold', NUM, TONE.negative)}>
                    {((depositStatus.data?.rejectionRate ?? 0) * 100).toFixed(1).replace('.', ',')} %
                  </div>
                </div>
              </div>
              <DTable>
                <DHead>
                  <DRow className="hover:bg-transparent">
                    <DTh>Statut</DTh>
                    <DTh align="right">Nombre</DTh>
                    <DTh align="right">Montant</DTh>
                  </DRow>
                </DHead>
                <DBody>
                  {([
                    ['Validés', depositStatus.data?.validated],
                    ['En attente de preuve', depositStatus.data?.pendingProof],
                    ['En revue', depositStatus.data?.pendingReview],
                    ['Rejetés', depositStatus.data?.rejected],
                    ['Annulés', depositStatus.data?.cancelled],
                  ] as const).map(([label, s]) => (
                    <DRow key={label}>
                      <DTd>{label}</DTd>
                      <DTd align="right" className={NUM}>{formatInteger(s?.count ?? 0)}</DTd>
                      <DTd align="right" className={cn(NUM, 'font-semibold')}>
                        {formatCurrencyFull(s?.amountXAF ?? 0, 'XAF')}
                      </DTd>
                    </DRow>
                  ))}
                </DBody>
              </DTable>
            </div>
          )}
        </Block>
      </div>

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
