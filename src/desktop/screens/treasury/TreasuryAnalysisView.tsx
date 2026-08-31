/**
 * Trésorerie — vue « Analyse » (docs/admin-redesign/07 §3.3).
 *
 * L'ancien dashboard disait tout en même temps : héros bénéfice + 8 KPI +
 * 2 encarts + jusqu'à 5 graphes + 2 tops + 3 raccourcis, d'un seul scroll.
 * C'est le défaut déjà rejeté sur le module Taux.
 *
 * Ici la hiérarchie est explicite :
 *   1. LES QUATRE CHIFFRES du métier — bénéfice, marge par CNY livré, taux de
 *      revient, taux client. Rien d'autre à ce niveau.
 *   2. Les volumes achetés / vendus, deux cartes symétriques.
 *   3. UN graphique, avec un sélecteur de courbe (WAC / achats / ventes) —
 *      les trois n'ont pas la même échelle, les empiler écraserait l'une.
 *   4. Les tops contreparties, où l'écart au taux moyen est l'information
 *      actionnable (« ce fournisseur me vend 3 % plus cher que la moyenne »).
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  SURFACE,
  TEXT,
  Card,
  CardHeader,
  Chip,
  DropChip,
  Th,
  Td,
  Holder,
  ScreenLoader,
  ScreenError,
} from '@/desktop/designKit';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import {
  useTopCounterparties,
  useTreasuryDashboard,
  useUsdtFlowEvolution,
  useWacEvolution,
  type TopCounterpartyRow,
} from '@/hooks/useTreasury';
import { fmtNum, withSign, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryRateChart, type ChartPoint } from './TreasuryRateChart';

type Period = '7d' | '30d' | '90d' | '365d';
type Curve = 'wac' | 'purchases' | 'sales';

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '3 mois' },
  { value: '365d', label: '1 an' },
];

const CURVES: ReadonlyArray<{ key: Curve; label: string }> = [
  { key: 'wac', label: 'Coût du stock (WAC)' },
  { key: 'purchases', label: "Coût d'achat" },
  { key: 'sales', label: 'Prix de vente' },
];

const VIOLET = '#8B5CF6';
const AMBER = '#F59E0B';
const EMERALD = '#10B981';

function rangeOf(period: Period): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - Number(period.replace('d', '')));
  return { from, to };
}

/** Chiffre focal : grand, signé, coloré seulement quand le signe a un sens. */
function HeadlineFigure({
  label,
  value,
  unit,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const color =
    tone === 'positive'
      ? 'text-[#2E7D52] dark:text-[#7FCBA0]'
      : tone === 'negative'
        ? 'text-[#C0504D] dark:text-[#E79A9A]'
        : TEXT.strong;
  return (
    <div className={cn('rounded-[14px] p-4', SURFACE.card, SURFACE.shadow)}>
      <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn('text-[28px] font-extrabold leading-none tracking-tight tabular-nums', color)}>{value}</span>
        <span className={cn('text-[12px] font-semibold', TEXT.muted)}>{unit}</span>
      </div>
      <div className={cn('mt-1.5 text-[11px] leading-snug', TEXT.muted)}>{hint}</div>
    </div>
  );
}

function VolumeCard({
  title,
  count,
  volumeUsdt,
  counterLabel,
  counterValue,
  rateLabel,
  rateValue,
  accent,
}: {
  title: string;
  count: number;
  volumeUsdt: number;
  counterLabel: string;
  counterValue: string;
  rateLabel: string;
  rateValue: string;
  accent: string;
}) {
  return (
    <Card className="p-0">
      <CardHeader title={title} meta={`${count} opération${count > 1 ? 's' : ''}`} />
      <div className="grid grid-cols-3 divide-x divide-black/[0.06] dark:divide-white/[0.06]">
        <div className="px-4 py-3.5">
          <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Volume</div>
          <div className={cn('mt-1 text-[16px] font-extrabold tabular-nums', TEXT.strong)}>{fmtNum(volumeUsdt, 2)}</div>
          <div className={cn('text-[10.5px]', TEXT.muted)}>USDT</div>
        </div>
        <div className="px-4 py-3.5">
          <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>{counterLabel}</div>
          <div className={cn('mt-1 text-[16px] font-extrabold tabular-nums', TEXT.strong)}>{counterValue}</div>
        </div>
        <div className="px-4 py-3.5">
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: accent }}>
            {rateLabel}
          </div>
          <div className={cn('mt-1 text-[16px] font-extrabold tabular-nums', TEXT.strong)}>{rateValue}</div>
          <div className={cn('text-[10.5px]', TEXT.muted)}>moyenne pondérée</div>
        </div>
      </div>
    </Card>
  );
}

function TopTable({
  title,
  rows,
  rateUnit,
  rateDecimals,
  emptyText,
}: {
  title: string;
  rows: TopCounterpartyRow[];
  rateUnit: string;
  rateDecimals: number;
  emptyText: string;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader title={title} meta={rows.length > 0 ? `${rows.length} sur la période` : undefined} />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Holder icon={Users} size="lg" />
          <p className={cn('mt-3 text-[13px]', TEXT.muted)}>{emptyText}</p>
        </div>
      ) : (
        <table className="w-full text-left">
          <thead className={SURFACE.inset}>
            <tr>
              <Th first>Contrepartie</Th>
              <Th align="right">Volume</Th>
              <Th align="right">Taux moyen</Th>
              <Th last align="right">Écart</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // deviation_pct : positif = plus cher que la moyenne du marché
              // interne. Pour un ACHAT c'est mauvais, pour une VENTE c'est bon —
              // on ne colore donc que l'amplitude, la lecture reste au métier.
              const notable = Math.abs(r.deviation_pct) >= 1;
              return (
                <tr key={r.id}>
                  <Td first>
                    <div className={cn('truncate text-[13px] font-semibold', TEXT.strong)}>{r.display_name}</div>
                    <div className={cn('text-[11px]', TEXT.muted)}>
                      {r.operation_count} op · {r.wechat_id ?? r.phone ?? '—'}
                    </div>
                  </Td>
                  <Td align="right" className={cn('text-[13px] tabular-nums', TEXT.body)}>{fmtNum(r.total_usdt, 2)}</Td>
                  <Td align="right" className={cn('text-[13px] font-semibold tabular-nums', TEXT.strong)}>
                    {fmtNum(r.weighted_avg_rate, rateDecimals)}
                    <div className={cn('text-[10px] font-normal', TEXT.muted)}>{rateUnit}</div>
                  </Td>
                  <Td last align="right">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
                        !notable
                          ? cn(SURFACE.inset, TEXT.muted)
                          : r.deviation_pct > 0
                            ? 'bg-[#F8EFD8] text-[#9A6B12] dark:bg-[#372D14] dark:text-[#E7C083]'
                            : 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
                      )}
                    >
                      {withSign(r.deviation_pct, 1)} %
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function TreasuryAnalysisView() {
  const [period, setPeriod] = useState<Period>('30d');
  const [curve, setCurve] = useState<Curve>('wac');

  const range = useMemo(() => rangeOf(period), [period]);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const { data: dash, isLoading, isError } = useTreasuryDashboard(fromIso, toIso);
  const { data: topSuppliers } = useTopCounterparties('usdt_supplier', fromIso, toIso, 5);
  const { data: topBuyers } = useTopCounterparties('cny_buyer', fromIso, toIso, 5);
  const { data: wacSeries } = useWacEvolution(fromIso, toIso);
  const { data: flowSeries } = useUsdtFlowEvolution(fromIso, toIso);

  const chart = useMemo<{ points: ChartPoint[]; color: string; decimals: number; unit: string }>(() => {
    if (curve === 'wac') {
      return {
        points: (wacSeries ?? []).map((p) => ({ at: p.at, value: p.wac })),
        color: EMERALD,
        decimals: RATE_DECIMALS.xafPerUsdt,
        unit: 'XAF/USDT',
      };
    }
    if (curve === 'purchases') {
      return {
        points: (flowSeries?.purchases ?? []).map((p) => ({ at: p.at, value: p.rate })),
        color: VIOLET,
        decimals: RATE_DECIMALS.xafPerUsdt,
        unit: 'XAF/USDT',
      };
    }
    return {
      points: (flowSeries?.sales ?? []).map((p) => ({ at: p.at, value: p.rate })),
      color: AMBER,
      decimals: RATE_DECIMALS.cnyPerUsdt,
      unit: 'CNY/USDT',
    };
  }, [curve, wacSeries, flowSeries]);

  if (isLoading) return <ScreenLoader />;
  if (isError || !dash) {
    return <ScreenError title="Erreur de chargement" description="Impossible de charger l'analyse de trésorerie." />;
  }

  const clientRate = dash.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revient = dash.taux_de_revient_xaf_per_cny ?? null;
  const marge = clientRate !== null && revient !== null ? clientRate - revient : null;
  const benefit = dash.benefit_total_xaf;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-[12px] tabular-nums', TEXT.muted)}>
          {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
        </span>
        <DropChip label="Période" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      {/* 1. Les quatre chiffres du métier */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <HeadlineFigure
          label="Bénéfice période"
          value={withSign(benefit, 0)}
          unit="XAF"
          hint="XAF reçu des clients − coût XAF des USDT vendus pour les livrer"
          tone={benefit >= 0 ? 'positive' : 'negative'}
        />
        <HeadlineFigure
          label="Marge par CNY livré"
          value={marge === null ? '—' : withSign(marge, 2)}
          unit="XAF / CNY"
          hint="Taux client − taux de revient"
          tone={marge === null ? 'neutral' : marge >= 0 ? 'positive' : 'negative'}
        />
        <HeadlineFigure
          label="Taux de revient"
          value={fmtNum(revient, RATE_DECIMALS.xafPerCny)}
          unit="XAF / CNY"
          hint="Ce que me coûte réellement 1 CNY livré en Chine"
        />
        <HeadlineFigure
          label="Taux client"
          value={fmtNum(clientRate, RATE_DECIMALS.xafPerCny)}
          unit="XAF / CNY"
          hint="Ce que les clients ont payé en moyenne sur la période"
        />
      </div>

      {/* 2. Volumes */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <VolumeCard
          title="Achats USDT"
          count={dash.purchases.count}
          volumeUsdt={dash.purchases.total_usdt}
          counterLabel="Payé"
          counterValue={`${fmtNum(dash.purchases.total_xaf, 0)} XAF`}
          rateLabel="Taux d'achat"
          rateValue={fmtNum(dash.purchases.weighted_avg_rate_xaf_per_usdt, RATE_DECIMALS.xafPerUsdt)}
          accent={VIOLET}
        />
        <VolumeCard
          title="Ventes USDT"
          count={dash.sales.count}
          volumeUsdt={dash.sales.total_usdt}
          counterLabel="Reçu"
          counterValue={`${fmtNum(dash.sales.total_cny, 2)} CNY`}
          rateLabel="Taux de vente"
          rateValue={fmtNum(dash.sales.weighted_avg_rate_cny_per_usdt, RATE_DECIMALS.cnyPerUsdt)}
          accent={AMBER}
        />
      </div>

      {/* 3. Un graphique, une courbe à la fois */}
      <Card className="p-0">
        <CardHeader
          title="Évolution des taux"
          meta={chart.points.length > 0 ? `${chart.points.length} point${chart.points.length > 1 ? 's' : ''} · ${chart.unit}` : undefined}
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-5 py-3 dark:border-white/[0.06]">
          {CURVES.map((c) => (
            <Chip key={c.key} label={c.label} active={curve === c.key} onClick={() => setCurve(c.key)} />
          ))}
        </div>
        {chart.points.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Holder icon={curve === 'wac' ? TrendingUp : BarChart3} size="lg" />
            <p className={cn('mt-3 text-[13px]', TEXT.muted)}>
              Pas assez d'opérations sur la période pour tracer cette courbe.
            </p>
          </div>
        ) : (
          <div className="px-3 py-3">
            <TreasuryRateChart points={chart.points} color={chart.color} decimals={chart.decimals} />
          </div>
        )}
      </Card>

      {/* 4. Tops — l'écart au taux moyen est l'information actionnable */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <TopTable
          title="Top fournisseurs USDT"
          rows={topSuppliers?.top ?? []}
          rateUnit="XAF/USDT"
          rateDecimals={RATE_DECIMALS.xafPerUsdt}
          emptyText="Aucun achat sur la période."
        />
        <TopTable
          title="Top acheteurs CNY"
          rows={topBuyers?.top ?? []}
          rateUnit="CNY/USDT"
          rateDecimals={RATE_DECIMALS.cnyPerUsdt}
          emptyText="Aucune vente sur la période."
        />
      </div>

      {/* Capital immobilisé — un chiffre de contexte, pas une décision */}
      <div className={cn('flex items-center justify-between rounded-[14px] px-5 py-3.5', SURFACE.card, SURFACE.shadow)}>
        <div>
          <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Capital immobilisé</div>
          <div className={cn('mt-0.5 text-[11px]', TEXT.muted)}>Stock USDT × WAC + soldes CNY convertis</div>
        </div>
        <div className={cn('text-[18px] font-extrabold tabular-nums', TEXT.strong)}>
          {fmtNum(dash.capital_immobilized_current_xaf, 0)} <span className={cn('text-[12px] font-semibold', TEXT.muted)}>XAF</span>
        </div>
      </div>
    </div>
  );
}
