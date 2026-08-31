/**
 * Trésorerie — vue « Analyse » (docs/admin-redesign/07 §3.3), habillage
 * « salle des marchés ».
 *
 * Hiérarchie explicite au lieu d'un mur de chiffres :
 *   1. LES QUATRE CHIFFRES du métier — bénéfice, marge par CNY livré, taux de
 *      revient, taux client. Rien d'autre à ce niveau.
 *   2. Les volumes achetés / vendus, deux blocs symétriques.
 *   3. UN graphique, avec un sélecteur de courbe (WAC / achats / ventes) —
 *      les trois n'ont pas la même échelle, les empiler écraserait l'une.
 *   4. Les tops contreparties, où l'écart au taux moyen est l'information
 *      actionnable (« ce fournisseur me vend 2,7 % plus cher que la moyenne »).
 */
import { useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useTopCounterparties,
  useTreasuryDashboard,
  useUsdtFlowEvolution,
  useWacEvolution,
  type TopCounterpartyRow,
} from '@/hooks/useTreasury';
import {
  M,
  T,
  NUM,
  LABEL,
  TONE,
  MCard,
  MCardHeader,
  MChip,
  MDropdown,
  MTh,
  MTd,
  MEmpty,
  MLoading,
} from './marketKit';
import { fmtNum, withSign, RATE_DECIMALS } from './treasuryFormat';
import { TreasuryRateChart, type ChartPoint } from './TreasuryRateChart';

type Period = '7d' | '30d' | '90d' | '365d';
type Curve = 'wac' | 'purchases' | 'sales';

const PERIODS = [
  { value: '7d' as const, label: '7 jours' },
  { value: '30d' as const, label: '30 jours' },
  { value: '90d' as const, label: '3 mois' },
  { value: '365d' as const, label: '1 an' },
];

const CURVES = [
  { key: 'wac' as const, label: 'Coût du stock (WAC)' },
  { key: 'purchases' as const, label: "Coût d'achat" },
  { key: 'sales' as const, label: 'Prix de vente' },
];

/** Accents du graphe : indigo (accent du kit), ambre (vente), vert (stock). */
const C_WAC = '#15803D';
const C_BUY = '#4F46E5';
const C_SELL = '#B45309';

function rangeOf(period: Period): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - Number(period.replace('d', '')));
  return { from, to };
}

function Headline({
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
  return (
    <MCard className="p-4">
      <div className={cn(LABEL, T.muted)}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            'text-[26px] font-bold leading-none tracking-[-0.02em]',
            NUM,
            tone === 'positive' ? TONE.positive : tone === 'negative' ? TONE.negative : T.ink,
          )}
        >
          {value}
        </span>
        <span className={cn('text-[11px] font-semibold', T.faint)}>{unit}</span>
      </div>
      <div className={cn('mt-2 text-[10.5px] leading-snug', T.muted)}>{hint}</div>
    </MCard>
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
}: {
  title: string;
  count: number;
  volumeUsdt: number;
  counterLabel: string;
  counterValue: string;
  rateLabel: string;
  rateValue: string;
}) {
  const cells = [
    { k: 'Volume', v: fmtNum(volumeUsdt, 2), u: 'USDT' },
    { k: counterLabel, v: counterValue, u: '' },
    { k: rateLabel, v: rateValue, u: 'moyenne pondérée' },
  ];
  return (
    <MCard>
      <MCardHeader title={title} meta={`${count} opération${count > 1 ? 's' : ''}`} />
      <div className="grid grid-cols-3">
        {cells.map((c, i) => (
          <div key={c.k} className={cn('px-4 py-3', i > 0 && cn('border-l', M.border))}>
            <div className={cn(LABEL, T.muted)}>{c.k}</div>
            <div className={cn('mt-1 text-[15px] font-bold', NUM, T.ink)}>{c.v}</div>
            {c.u && <div className={cn('mt-0.5 text-[10px]', T.faint)}>{c.u}</div>}
          </div>
        ))}
      </div>
    </MCard>
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
    <MCard className="overflow-hidden">
      <MCardHeader title={title} meta={rows.length > 0 ? `${rows.length} sur la période` : undefined} />
      {rows.length === 0 ? (
        <MEmpty icon={Users}>{emptyText}</MEmpty>
      ) : (
        <table className="w-full text-left">
          <thead className={cn('border-b', M.inset, M.border)}>
            <tr>
              <MTh>Contrepartie</MTh>
              <MTh align="right">Volume</MTh>
              <MTh align="right">Taux moyen</MTh>
              <MTh align="right">Écart</MTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // deviation_pct : positif = plus cher que la moyenne interne.
              // Pour un ACHAT c'est mauvais, pour une VENTE c'est bon — on ne
              // colore donc que l'amplitude, la lecture reste au métier.
              const notable = Math.abs(r.deviation_pct) >= 1;
              return (
                <tr key={r.id}>
                  <MTd>
                    <div className={cn('truncate text-[12.5px] font-semibold', T.ink)}>{r.display_name}</div>
                    <div className={cn('text-[10.5px]', T.faint)}>
                      <span className={NUM}>{r.operation_count}</span> op · {r.wechat_id ?? r.phone ?? '—'}
                    </div>
                  </MTd>
                  <MTd align="right" className={cn('text-[12.5px]', NUM, T.body)}>{fmtNum(r.total_usdt, 2)}</MTd>
                  <MTd align="right" className={cn('text-[12.5px] font-semibold', NUM, T.ink)}>
                    {fmtNum(r.weighted_avg_rate, rateDecimals)}
                    <div className={cn('text-[9.5px] font-normal', T.faint)}>{rateUnit}</div>
                  </MTd>
                  <MTd align="right">
                    <span className={cn('text-[11.5px] font-bold', NUM, !notable ? T.faint : r.deviation_pct > 0 ? TONE.sale : TONE.positive)}>
                      {withSign(r.deviation_pct, 1)} %
                    </span>
                  </MTd>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </MCard>
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
      return { points: (wacSeries ?? []).map((p) => ({ at: p.at, value: p.wac })), color: C_WAC, decimals: RATE_DECIMALS.xafPerUsdt, unit: 'XAF/USDT' };
    }
    if (curve === 'purchases') {
      return { points: (flowSeries?.purchases ?? []).map((p) => ({ at: p.at, value: p.rate })), color: C_BUY, decimals: RATE_DECIMALS.xafPerUsdt, unit: 'XAF/USDT' };
    }
    return { points: (flowSeries?.sales ?? []).map((p) => ({ at: p.at, value: p.rate })), color: C_SELL, decimals: RATE_DECIMALS.cnyPerUsdt, unit: 'CNY/USDT' };
  }, [curve, wacSeries, flowSeries]);

  if (isLoading) return <MLoading />;
  if (isError || !dash) return <MEmpty icon={BarChart3}>Impossible de charger l'analyse de trésorerie.</MEmpty>;

  const clientRate = dash.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
  const revient = dash.taux_de_revient_xaf_per_cny ?? null;
  const marge = clientRate !== null && revient !== null ? clientRate - revient : null;
  const benefit = dash.benefit_total_xaf;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className={cn('text-[11.5px]', NUM, T.muted)}>
          {range.from.toLocaleDateString('fr-FR')} → {range.to.toLocaleDateString('fr-FR')}
        </span>
        <MDropdown label="Période" value={period} options={PERIODS} onChange={setPeriod} />
      </div>

      {/* 1. Les quatre chiffres du métier */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Headline
          label="Bénéfice période"
          value={withSign(benefit, 0)}
          unit="XAF"
          hint="XAF reçu des clients − coût XAF des USDT vendus pour les livrer"
          tone={benefit >= 0 ? 'positive' : 'negative'}
        />
        <Headline
          label="Marge par CNY livré"
          value={marge === null ? '—' : withSign(marge, 2)}
          unit="XAF / CNY"
          hint="Taux client − taux de revient"
          tone={marge === null ? 'neutral' : marge >= 0 ? 'positive' : 'negative'}
        />
        <Headline label="Taux de revient" value={fmtNum(revient, RATE_DECIMALS.xafPerCny)} unit="XAF / CNY" hint="Ce que me coûte réellement 1 CNY livré en Chine" />
        <Headline label="Taux client" value={fmtNum(clientRate, RATE_DECIMALS.xafPerCny)} unit="XAF / CNY" hint="Ce que les clients ont payé en moyenne sur la période" />
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
        />
        <VolumeCard
          title="Ventes USDT"
          count={dash.sales.count}
          volumeUsdt={dash.sales.total_usdt}
          counterLabel="Reçu"
          counterValue={`${fmtNum(dash.sales.total_cny, 2)} CNY`}
          rateLabel="Taux de vente"
          rateValue={fmtNum(dash.sales.weighted_avg_rate_cny_per_usdt, RATE_DECIMALS.cnyPerUsdt)}
        />
      </div>

      {/* 3. Un graphique, une courbe à la fois */}
      <MCard>
        <MCardHeader
          title="Évolution des taux"
          meta={chart.points.length > 0 ? `${chart.points.length} pts · ${chart.unit}` : undefined}
        />
        <div className={cn('flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5', M.border)}>
          {CURVES.map((c) => (
            <MChip key={c.key} label={c.label} active={curve === c.key} onClick={() => setCurve(c.key)} />
          ))}
        </div>
        {chart.points.length < 2 ? (
          <MEmpty icon={curve === 'wac' ? TrendingUp : BarChart3}>
            Pas assez d'opérations sur la période pour tracer cette courbe.
          </MEmpty>
        ) : (
          <div className="px-2 py-3">
            <TreasuryRateChart points={chart.points} color={chart.color} decimals={chart.decimals} />
          </div>
        )}
      </MCard>

      {/* 4. Tops */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <TopTable title="Top fournisseurs USDT" rows={topSuppliers?.top ?? []} rateUnit="XAF/USDT" rateDecimals={RATE_DECIMALS.xafPerUsdt} emptyText="Aucun achat sur la période." />
        <TopTable title="Top acheteurs CNY" rows={topBuyers?.top ?? []} rateUnit="CNY/USDT" rateDecimals={RATE_DECIMALS.cnyPerUsdt} emptyText="Aucune vente sur la période." />
      </div>

      {/* Capital immobilisé — chiffre de contexte, pas une décision */}
      <MCard className="flex items-center justify-between px-4 py-3">
        <div>
          <div className={cn(LABEL, T.muted)}>Capital immobilisé</div>
          <div className={cn('mt-0.5 text-[10.5px]', T.faint)}>Stock USDT × WAC + soldes CNY convertis</div>
        </div>
        <div className={cn('text-[17px] font-bold', NUM, T.ink)}>
          {fmtNum(dash.capital_immobilized_current_xaf, 0)}
          <span className={cn('ml-1 text-[11px] font-semibold', T.faint)}>XAF</span>
        </div>
      </MCard>
    </div>
  );
}
