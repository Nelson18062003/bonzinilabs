/**
 * Analyses mobile v2 — l'écran d'entrée (maquettes 01, 02, 21) : segment
 * Activité / Trésorerie ; en Activité, le gros chiffre des paiements, ses
 * barres, trois petits chiffres, les alertes, puis toutes les tuiles.
 */
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { BoxSegmented, LineChart } from '@/mobile/designKit';
import { ChartScreen, Empty, Figure, Period } from './layout';
import { AlertRow, GroupLabel, LinkRow, Loading, MiniBars, MiniLine, PillRow, RefBars, StackBar, Tile, KVRows } from './parts';
import { axisLabels, dec, deltaTag, int, pct, versusLabel } from './format';
import { useAnalyticsUi } from './state';
import {
  useActiveData, useAlerts, useBasketData, useClientsData, useCountriesData, useDelaysData, useDepositsData, useFlowData, useGrowthData,
  useMethodsData, useMoneyData, usePaymentsData, useSourcesData, useTeamData, useTopData, useTreasuryData, type TreasuryCurve,
} from './datasets';

export function Overview() {
  const { hasPermission } = useAdminAuth();
  const canTreasury = hasPermission('canViewTreasury');
  const [params, setParams] = useSearchParams();
  const tab = canTreasury && params.get('vue') === 'tresorerie' ? 'tresorerie' : 'activite';
  const seg = canTreasury ? (
    <BoxSegmented
      className="mx-5 mt-4"
      ariaLabel="Vue"
      options={[{ value: 'activite', label: 'Activité' }, { value: 'tresorerie', label: 'Trésorerie' }]}
      value={tab}
      onChange={(v) => setParams(v === 'tresorerie' ? { vue: v } : {}, { replace: true })}
    />
  ) : null;
  return tab === 'tresorerie' ? <TreasuryTab seg={seg} /> : <ActivityTab seg={seg} />;
}

/* ── 01 / 02 · Activité ───────────────────────────────────────────────── */
function ActivityTab({ seg }: { seg: React.ReactNode }) {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const p = usePaymentsData();
  const alerts = useAlerts();
  const dep = useDepositsData();
  const flow = useFlowData();
  const active = useActiveData();
  const go = (path: string) => () => navigate(`/m/dashboard/${path}`);
  return (
    <ChartScreen title="Analyses" backTo="/m/more" ds={p.ds}>
      {seg}
      <Period className={seg ? 'pt-3' : undefined} />
      <Figure label="Paiements exécutés" value={p.loading ? '—' : int(p.total)} unit="XAF" delta={deltaTag(p.d)} note={p.d != null ? versusLabel(ui.range) : undefined} />
      {p.loading ? <Loading /> : p.error ? <Empty error onRetry={() => void ui.refresh()} /> : (
        <button type="button" onClick={go('paiements')} className="block w-full text-left" aria-label="Ouvrir les paiements exécutés">
          <RefBars data={p.bars} height={200} xLabels={axisLabels(p.series.map((x) => x.bucket), p.granularity, { today: true })} className="pointer-events-none" ariaLabel="Paiements par période" />
        </button>
      )}
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: 'Dépôts validés', value: dep.loading ? '—' : `${int(dep.total)} XAF`, onClick: go('depots') },
          { label: 'Flux net', value: flow.loading ? '—' : `${int(flow.net)} XAF`, onClick: go('flux') },
          { label: 'Clients actifs', value: active.loading ? '—' : int(active.active), onClick: go('actifs') },
        ]}
      />
      {(alerts.data ?? []).map((a) => (
        <AlertRow key={a.id} tone={a.severity === 'critical' ? 'danger' : 'pending'} onClick={a.actionHref ? () => navigate(a.actionHref!) : undefined}>
          {alertText(a.id, a.count, a.title)}
        </AlertRow>
      ))}
      <Tiles p={p} dep={dep} flow={flow} active={active} />
    </ChartScreen>
  );
}

function alertText(id: string, n: number, fallback: string): string {
  const s = n > 1 ? 's' : '';
  if (id === 'stale-review') return `${n} dépôt${s} en revue depuis 48\u00A0h`;
  if (id === 'stale-deposit-proofs') return `${n} preuve${s} en attente depuis 24\u00A0h`;
  if (id === 'stale-payments') return `${n} paiement${s} en attente depuis 24\u00A0h`;
  return `${fallback} · ${n}`;
}

function Tiles({ p, dep, flow, active }: {
  p: ReturnType<typeof usePaymentsData>;
  dep: ReturnType<typeof useDepositsData>;
  flow: ReturnType<typeof useFlowData>;
  active: ReturnType<typeof useActiveData>;
}) {
  const navigate = useNavigate();
  const go = (path: string) => () => navigate(`/m/dashboard/${path}`);
  const methods = useMethodsData('paiements');
  const basket = useBasketData();
  const money = useMoneyData();
  const clients = useClientsData();
  const top = useTopData();
  const countries = useCountriesData();
  const delays = useDelaysData();
  const growth = useGrowthData('week', 'paiements');
  const sources = useSourcesData();
  const team = useTeamData();
  const firstMethod = methods.rows[0];
  const firstClient = top.rows[0];
  const firstCountry = countries.head[0];
  const shortName = firstClient ? `${firstClient.firstName ?? ''} ${(firstClient.lastName ?? '').charAt(0)}${firstClient.lastName ? '.' : ''}`.trim() : '—';
  return (
    <>
      <GroupLabel>Argent</GroupLabel>
      <div className="grid grid-cols-2 gap-2.5 px-5">
        <Tile name="Paiements" value={int(p.total)} onClick={go('paiements')}><MiniBars values={p.bars.map((b) => b.value)} currentLast={p.bars[p.bars.length - 1]?.current} /></Tile>
        <Tile name="Dépôts" value={int(dep.total)} onClick={go('depots')}><MiniBars values={dep.bars.map((b) => b.value)} currentLast={dep.bars[dep.bars.length - 1]?.current} /></Tile>
        <Tile name="Flux net" value={int(flow.net)} onClick={go('flux')}><MiniBars values={flow.bars.map((b) => b.value)} signed /></Tile>
        <Tile name="Par méthode" value={firstMethod ? `${firstMethod.label.replace(' Pay', '')} ${pct(firstMethod.share)}` : '—'} onClick={go('methodes')}>
          <div className="flex h-full items-center"><StackBar shares={methods.rows.map((r) => r.share)} height={12} /></div>
        </Tile>
        <Tile name="Panier moyen" value={<>¥&nbsp;{int(basket.avgRmb)}</>} onClick={go('panier')}><MiniBars values={p.series.map((x) => (x.count ? x.value / x.count : 0))} /></Tile>
        <Tile name="Argent des clients" value={int(money.total)} onClick={go('argent')}>
          <div className="flex h-full items-center"><StackBar shares={[money.topShare, 1 - money.topShare]} height={12} tones={['#2C2C2C', '#D9D9D9']} /></div>
        </Tile>
      </div>
      <GroupLabel>Clients et équipe</GroupLabel>
      <div className="grid grid-cols-2 gap-2.5 px-5">
        <Tile name="Parc de clients" value={int(clients.rep?.totalAtEnd ?? 0)} onClick={go('clients')}><MiniLine values={clients.points.map((x) => x.cumulative)} /></Tile>
        <Tile name="Clients actifs" value={int(active.active)} onClick={go('actifs')}><MiniBars values={[active.total, active.f?.clientsWithDeposit ?? 0, active.active]} /></Tile>
        <Tile name="Top clients" value={shortName} onClick={go('top')}><MiniBars values={top.rows.map((r) => r.totalXAF)} /></Tile>
        <Tile name="Pays" value={firstCountry ? `${firstCountry.country} ${pct(firstCountry.share)}` : '—'} onClick={go('pays')}>
          <div className="flex h-full items-center"><StackBar shares={[...countries.head.map((r) => r.count), countries.others?.count ?? 0, countries.unknown?.count ?? 0]} height={12} /></div>
        </Tile>
        <Tile name="Délai de validation" value={delays.med != null ? delays.ds.figure.value + (delays.ds.figure.unit ? `\u00A0${delays.ds.figure.unit}` : '') : '—'} onClick={go('delais')}><MiniBars values={delays.buckets} /></Tile>
        <Tile name="Croissance" value={growth.tag && growth.sum.lastComplete ? `${growth.tag.label} · ${growth.name(growth.sum.lastComplete.bucket)}` : '—'} onClick={go('croissance')}>
          <MiniBars values={growth.buckets.map((b) => b.value)} currentLast />
        </Tile>
        <Tile name="Sources" value={`${int(sources.s?.totalNew ?? 0)} nouveaux`} onClick={go('sources')}>
          <div className="flex h-full items-center"><StackBar shares={[sources.s?.adminCreated ?? 0, sources.s?.selfRegistered ?? 0]} height={12} tones={['#2C2C2C', '#9E9E9E']} /></div>
        </Tile>
        <Tile name="Équipe" value={`${int(team.actions)} actions`} onClick={go('equipe')}><MiniBars values={team.rows.slice(0, 10).map((r) => r.totalActions)} /></Tile>
      </div>
    </>
  );
}

/* ── 21 · Trésorerie ──────────────────────────────────────────────────── */
const CURVES: { value: TreasuryCurve; label: string }[] = [
  { value: 'wac', label: 'Coût du stock' },
  { value: 'achat', label: 'Achat' },
  { value: 'vente', label: 'Vente' },
];

function TreasuryTab({ seg }: { seg: React.ReactNode }) {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const t = useTreasuryData();
  const [curve, setCurve] = React.useState<TreasuryCurve>('wac');
  const [sel, setSel] = React.useState<number | null>(null);
  React.useEffect(() => setSel(null), [curve]);
  const pts = t.curves[curve];
  const values = pts.map((x) => x.v);
  const digits = curve === 'vente' ? 4 : 2;
  const hi = values.length ? Math.max(...values) : 0;
  const ref = values.length ? (curve === 'vente' ? Math.ceil(hi * 10) / 10 : Math.ceil(hi / 10) * 10) : null;
  const xLabels: Record<number, string> = pts.length > 1 ? { 0: new Date(pts[0].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), [pts.length - 1]: new Date(pts[pts.length - 1].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) } : {};
  const d = t.t;
  return (
    <ChartScreen title="Analyses" backTo="/m/more" ds={t.ds}>
      {seg}
      <Period compare={false} className="pt-3" />
      <Figure label="Bénéfice de la période" value={t.loading ? '—' : int(d?.benefit_total_xaf ?? 0)} unit="XAF" note={t.marge != null ? `Marge ${dec(t.marge, 2)} XAF par ¥ livré` : undefined} />
      <PillRow options={CURVES} value={curve} onChange={setCurve} />
      {t.loading ? <Loading /> : t.error ? <Empty error onRetry={() => void ui.refresh()} /> : values.length < 2 ? <Empty>Pas assez d’opérations sur la période.</Empty> : (
        <div className="px-5 pt-12">
          <LineChart series={[{ values, tone: 'ink', step: curve === 'wac' }]} height={200} yTicks={ref != null ? [ref] : undefined} formatY={(v) => dec(v, curve === 'vente' ? 2 : 0)} xLabels={xLabels} selected={sel} onSelect={setSel} ariaLabel={CURVES.find((c) => c.value === curve)!.label} />
          {sel != null && pts[sel] && (
            <div className="pt-3 text-[16px]">
              {new Date(pts[sel].at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · <b>{dec(pts[sel].v, digits)}</b> {curve === 'vente' ? '¥ / USDT' : 'XAF / USDT'}
            </div>
          )}
        </div>
      )}
      {d && (
        <KVRows
          className="mx-5 mt-5"
          rows={[
            { label: 'Taux de revient', value: t.revient != null ? `${dec(t.revient, 2)} XAF / ¥` : '—' },
            { label: 'Taux client', value: t.client != null ? `${dec(t.client, 2)} XAF / ¥` : '—' },
            { label: 'USDT achetés · vendus', value: `${dec(d.purchases.total_usdt, 0)} · ${dec(d.sales.total_usdt, 0)}` },
            { label: 'Stock USDT', value: dec(d.stock_usdt, 2), tone: d.is_stock_usdt_negative ? 'danger' : undefined },
          ]}
        />
      )}
      <LinkRow className="mt-5" icon={UserRound} title="Meilleurs fournisseurs" subtitle="et acheteurs de CNY" onClick={() => navigate('/m/dashboard/contreparties')} />
    </ChartScreen>
  );
}
