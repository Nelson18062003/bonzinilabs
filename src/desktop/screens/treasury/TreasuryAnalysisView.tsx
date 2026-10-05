/**
 * Trésorerie — Analyse : les chiffres du métier sur la période choisie.
 *
 * Les FORMULES ne changent pas (elles viennent de `get_treasury_dashboard`,
 * `get_top_counterparties` et des séries WAC / flux) ; seule la lecture est
 * refaite, dans l'ordre où on se pose les questions :
 *   1. ai-je gagné de l'argent ? — bénéfice, marge par CNY, revient, taux client ;
 *   2. combien ai-je acheté et vendu ? — deux blocs symétriques ;
 *   3. comment les taux ont-ils bougé ? — une courbe à la fois, avec son unité ;
 *   4. avec qui ? — les meilleures contreparties et leur écart au taux moyen.
 *
 * Une erreur de chargement le DIT (l'ancien écran affichait des zéros).
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { DateRangeProvider, useOptionalDateRange } from '@/lib/analytics/DateRangeContext';
import { formatRangeLabel } from '@/lib/analytics/dateRange';
import {
  useTopCounterparties,
  useTreasuryDashboard,
  useUsdtFlowEvolution,
  useWacEvolution,
  type TopCounterpartyRow,
} from '@/hooks/useTreasury';
import { TK } from './tstyle';
import { Card, CardHead, Empty, ErrorState, Loading, Money, RowButton, Segmented, Td, Th } from './tkit';
import { TreasuryRateChart, type ChartPoint } from './TreasuryRateChart';
import { useTreasuryBounds, TREASURY_DEFAULT_PRESET } from './treasuryPeriod';
import { treasuryPaths } from './treasuryNav';
import { fmtNum, RATE_DECIMALS, withSign } from './treasuryFormat';
import { plural } from './treasuryLabels';

type Curve = 'wac' | 'purchases' | 'sales';

const CURVE_COLOR: Record<Curve, string> = { wac: '#15803D', purchases: '#4F46E5', sales: '#B45309' };

/**
 * Montable seule (tests, harnais) : fournit son contexte de période quand la
 * coquille ne le fait pas. Dans le module, la période est PARTAGÉE avec les
 * Opérations et les Contreparties.
 */
export function TreasuryAnalysisView() {
  const parent = useOptionalDateRange();
  if (parent) return <AnalysisBody />;
  return (
    <DateRangeProvider defaultPreset={TREASURY_DEFAULT_PRESET}>
      <AnalysisBody />
    </DateRangeProvider>
  );
}

function AnalysisBody() {
  const [curve, setCurve] = useState<Curve>('wac');
  const { range, fromIso, toIso } = useTreasuryBounds();
  const dash = useTreasuryDashboard(fromIso, toIso);
  const topSuppliers = useTopCounterparties('usdt_supplier', fromIso, toIso, 5);
  const topBuyers = useTopCounterparties('cny_buyer', fromIso, toIso, 5);
  const wac = useWacEvolution(fromIso, toIso);
  const flow = useUsdtFlowEvolution(fromIso, toIso);

  const chart = useMemo(() => {
    if (curve === 'wac') return { points: (wac.data ?? []).map((p) => ({ at: p.at, value: p.wac })) as ChartPoint[], decimals: RATE_DECIMALS.xafPerUsdt, unit: 'XAF / USDT' };
    if (curve === 'purchases') return { points: (flow.data?.purchases ?? []).map((p) => ({ at: p.at, value: p.rate })), decimals: RATE_DECIMALS.xafPerUsdt, unit: 'XAF / USDT' };
    return { points: (flow.data?.sales ?? []).map((p) => ({ at: p.at, value: p.rate })), decimals: RATE_DECIMALS.cnyPerUsdt, unit: 'CNY / USDT' };
  }, [curve, wac.data, flow.data]);
  const chartQuery = curve === 'wac' ? wac : flow;

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-[13.5px] text-muted-foreground">
        Période : <span className="font-semibold text-foreground">{formatRangeLabel(range)}</span>
      </div>
      <DateRangePicker showGranularity={false} showCompare={false} size="sm" />
    </div>
  );

  if (dash.isLoading) return <div className="space-y-4">{header}<Card><Loading rows={6} /></Card></div>;
  if (dash.isError || !dash.data) return <div className="space-y-4">{header}<Card><ErrorState onRetry={() => void dash.refetch()}>L’analyse n’a pas pu être calculée. Réessayez.</ErrorState></Card></div>;

  const d = dash.data;
  const clientRate = d.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revient = d.taux_de_revient_xaf_per_cny ?? null;
  const marge = clientRate !== null && revient !== null ? clientRate - revient : null;

  return (
    <div className="space-y-4">
      {header}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Headline label="Bénéfice de la période" hint="XAF reçus des clients − coût en XAF des USDT vendus pour les livrer" tone={d.benefit_total_xaf >= 0 ? 'in' : 'out'}>
          {withSign(d.benefit_total_xaf, 0)} <Unit>XAF</Unit>
        </Headline>
        <Headline label="Marge par CNY livré" hint="Taux client − taux de revient" tone={marge === null ? undefined : marge >= 0 ? 'in' : 'out'}>
          {marge === null ? '—' : withSign(marge, 2)} <Unit>XAF / CNY</Unit>
        </Headline>
        <Headline label="Taux de revient" hint="Ce que coûte réellement 1 CNY livré en Chine">
          {fmtNum(revient, RATE_DECIMALS.xafPerCny)} <Unit>XAF / CNY</Unit>
        </Headline>
        <Headline label="Taux client" hint="Ce que les clients ont payé en moyenne">
          {fmtNum(clientRate, RATE_DECIMALS.xafPerCny)} <Unit>XAF / CNY</Unit>
        </Headline>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <VolumeCard
          title="Achats d’USDT"
          count={d.purchases.count}
          cells={[
            { label: 'USDT achetés', value: <Money value={d.purchases.total_usdt} cur="USDT" size="lg" /> },
            { label: 'XAF payés', value: <Money value={d.purchases.total_xaf} cur="XAF" size="lg" /> },
            { label: 'Taux moyen', value: <RateBig value={d.purchases.weighted_avg_rate_xaf_per_usdt} decimals={RATE_DECIMALS.xafPerUsdt} unit="XAF / USDT" /> },
          ]}
        />
        <VolumeCard
          title="Ventes d’USDT"
          count={d.sales.count}
          cells={[
            { label: 'USDT vendus', value: <Money value={d.sales.total_usdt} cur="USDT" size="lg" /> },
            { label: 'CNY reçus', value: <Money value={d.sales.total_cny} cur="CNY" size="lg" /> },
            { label: 'Taux moyen', value: <RateBig value={d.sales.weighted_avg_rate_cny_per_usdt} decimals={RATE_DECIMALS.cnyPerUsdt} unit="CNY / USDT" /> },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <CardHead
          title="Évolution des taux"
          meta={chart.points.length > 0 ? `${plural(chart.points.length, 'point')} · ${chart.unit}` : chart.unit}
          action={
            <Segmented
              ariaLabel="Courbe affichée"
              size="sm"
              value={curve}
              onChange={setCurve}
              options={[
                { value: 'wac', label: 'Coût du stock (WAC)' },
                { value: 'purchases', label: 'Taux d’achat' },
                { value: 'sales', label: 'Taux de vente' },
              ]}
            />
          }
        />
        {chartQuery.isLoading ? (
          <Loading rows={4} />
        ) : chartQuery.isError ? (
          <ErrorState onRetry={() => void chartQuery.refetch()} />
        ) : chart.points.length < 2 ? (
          <Empty icon={curve === 'wac' ? TrendingUp : BarChart3} title="Pas assez d’opérations pour tracer cette courbe">
            Il faut au moins deux opérations sur la période.
          </Empty>
        ) : (
          <div className="px-3 py-4">
            <TreasuryRateChart points={chart.points} color={CURVE_COLOR[curve]} decimals={chart.decimals} from={range.from} to={range.to} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <TopTable title="Meilleurs fournisseurs USDT" query={topSuppliers} unit="XAF / USDT" decimals={RATE_DECIMALS.xafPerUsdt} empty="Aucun achat sur la période." buying />
        <TopTable title="Meilleurs acheteurs CNY" query={topBuyers} unit="CNY / USDT" decimals={RATE_DECIMALS.cnyPerUsdt} empty="Aucune vente sur la période." />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <div className="text-[14px] font-bold">Capital immobilisé aujourd’hui</div>
          <div className="text-[12.5px] text-muted-foreground">Stock d’USDT × coût moyen, plus les soldes CNY convertis</div>
        </div>
        <Money value={d.capital_immobilized_current_xaf} cur="XAF" size="lg" />
      </Card>
    </div>
  );
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-[12px] font-semibold text-muted-foreground">{children}</span>;
}

function Headline({ label, hint, tone, children }: { label: string; hint: string; tone?: 'in' | 'out'; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className={TK.label}>{label}</div>
      <div className={cn('mt-2 text-[26px] font-extrabold leading-none tracking-tight', TK.num, tone === 'in' ? TK.in : tone === 'out' ? TK.out : '')}>{children}</div>
      <div className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{hint}</div>
    </Card>
  );
}

function RateBig({ value, decimals, unit }: { value: number | null | undefined; decimals: number; unit: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', TK.num)}>
      <span className="text-[20px] font-bold tracking-tight">{value ? fmtNum(value, decimals) : '—'}</span>
      {!!value && <Unit>{unit}</Unit>}
    </span>
  );
}

function VolumeCard({ title, count, cells }: { title: string; count: number; cells: Array<{ label: string; value: ReactNode }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHead title={title} meta={plural(count, 'opération')} />
      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {cells.map((c) => (
          <div key={c.label} className="px-5 py-4">
            <div className="text-[12.5px] text-muted-foreground">{c.label}</div>
            <div className="mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopTable({
  title,
  query,
  unit,
  decimals,
  empty,
  buying,
}: {
  title: string;
  query: { data?: { top: TopCounterpartyRow[] }; isLoading: boolean; isError: boolean; refetch: () => unknown };
  unit: string;
  decimals: number;
  empty: string;
  buying?: boolean;
}) {
  const navigate = useNavigate();
  const rows = query.data?.top ?? [];
  return (
    <Card className="overflow-hidden">
      <CardHead
        title={title}
        meta={buying ? 'Écart au taux moyen : + = plus cher que la moyenne' : 'Écart au taux moyen : + = meilleur prix que la moyenne'}
      />
      {query.isLoading ? (
        <Loading rows={4} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <Empty icon={Users} title={empty} />
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <Th>Contrepartie</Th>
              <Th align="right">USDT</Th>
              <Th align="right">Taux moyen</Th>
              <Th align="right">Écart</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const notable = Math.abs(r.deviation_pct) >= 1;
              // Un achat plus cher que la moyenne est mauvais ; une vente plus
              // chère que la moyenne est bonne.
              const good = buying ? r.deviation_pct < 0 : r.deviation_pct > 0;
              return (
                <RowButton key={r.id} onOpen={() => navigate(treasuryPaths.counterparty(r.id))} label={`Ouvrir la fiche de ${r.display_name}`}>
                  <Td>
                    <div className="max-w-[220px] truncate font-semibold">{r.display_name}</div>
                    <div className="text-[12px] text-muted-foreground">{plural(r.operation_count, 'opération')}</div>
                  </Td>
                  <Td align="right" className={TK.num}>{fmtNum(r.total_usdt, 2)}</Td>
                  <Td align="right">
                    <span className={cn('font-semibold', TK.num)}>{fmtNum(r.weighted_avg_rate, decimals)}</span>
                    <div className="text-[11.5px] text-muted-foreground">{unit}</div>
                  </Td>
                  <Td align="right">
                    <span className={cn('font-semibold', TK.num, !notable ? 'text-muted-foreground' : good ? TK.in : TK.out)}>{withSign(r.deviation_pct, 1)} %</span>
                  </Td>
                </RowButton>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
