/**
 * Analyses mobile v2 — les écrans « Clients et équipe » : parc de clients
 * (12), clients actifs (13), top clients (14), pays (15), sources (16),
 * délais (17), équipe (18), croissance (19 / 20), meilleures contreparties
 * de la trésorerie (lien de 21).
 */
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BarChart3, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BoxSegmented, IconCircle, Initials, LineChart, SectionHead, TEXT } from '@/mobile/designKit';
import { flagUrl } from '@/components/form/CountryFlag';
import type { GrowthMode } from '@/lib/analytics/growthWindow';
import { ChartScreen, Empty, Figure, Period } from './layout';
import { BarRow, CurrentLegend, LinkRow, Loading, PillRow, RefBars, StackBar, KVRows } from './parts';
import { dayMonth, dec, deltaTag, int, niceRef, pct } from './format';
import { useAnalyticsUi } from './state';
import {
  nPay, useActiveData, useClientsData, useCountriesData, useCounterpartiesData, useDelaysData, useGrowthData, useSourcesData, useTeamData, useTopData,
  type GrowthSerie,
} from './datasets';
import { DURATION_BUCKETS } from './data';

/** Un repère « rond » au-dessus du maximum (axe d'une courbe qui ne part pas de zéro). */
function ceilRef(max: number): number | null {
  if (!Number.isFinite(max) || max <= 0) return null;
  const p = 10 ** Math.max(Math.floor(Math.log10(max)) - 1, 0);
  return Math.ceil(max / p) * p;
}

/* ── 12 · Parc de clients ─────────────────────────────────────────────── */
export function ClientsScreen() {
  const c = useClientsData();
  const values = c.points.map((p) => p.cumulative);
  const top = ceilRef(Math.max(...values, 0));
  const n = values.length;
  const xLabels: Record<number, string> = n > 1 ? { 0: dayMonth(c.points[0].bucket), [Math.floor((n - 1) / 2)]: dayMonth(c.points[Math.floor((n - 1) / 2)].bucket), [n - 1]: dayMonth(c.points[n - 1].bucket) } : {};
  const [sel, setSel] = React.useState<number | null>(null);
  return (
    <ChartScreen title="Clients" ds={c.ds}>
      <Period />
      <Figure label="Clients au total" value={c.loading ? '—' : int(c.rep?.totalAtEnd ?? 0)} delta={deltaTag(c.d)} note={c.ds.figure.note} />
      {c.loading ? <Loading /> : n < 2 ? <Empty /> : (
        <div className="px-5 pt-16">
          <LineChart series={[{ values, tone: 'ink' }]} height={220} yTicks={top ? [top] : undefined} formatY={(v) => int(v)} xLabels={xLabels} selected={sel} onSelect={setSel} ariaLabel="Total de clients sur la période" />
        </div>
      )}
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: 'Nouveaux clients', value: int(c.rep?.newClients ?? 0) },
          { label: `Meilleur${c.granularity === 'week' ? 'e semaine' : c.granularity === 'month' ? ' mois' : ' jour'}`, value: c.bestText },
          { label: 'Période précédente', value: `${int(c.rep?.previousNewClients ?? 0)} nouveaux` },
        ]}
      />
    </ChartScreen>
  );
}

/* ── 13 · Clients actifs ──────────────────────────────────────────────── */
export function ActiveScreen() {
  const a = useActiveData();
  const total = a.total || 1;
  return (
    <ChartScreen title="Clients actifs" ds={a.ds}>
      <Period />
      <Figure label="Au moins un paiement exécuté" value={a.loading ? '—' : int(a.active)} unit="clients" delta={deltaTag(a.d)} note={a.before != null ? `${int(a.before)} avant` : undefined} />
      <KVRows className="mx-5 mt-5" rows={[{ label: 'Dépôt → paiement', value: pct(a.f?.depositToPaymentRate ?? 0) }]} />
      <div className="px-5 pt-3">
        <BarRow title={<b>Clients au total</b>} value={int(a.total)} share={1} />
        <BarRow title="Ont déposé" subtitle={`${pct((a.f?.clientsWithDeposit ?? 0) / total)} des clients`} value={int(a.f?.clientsWithDeposit ?? 0)} share={(a.f?.clientsWithDeposit ?? 0) / total} />
        <BarRow title="Ont payé" subtitle={`${pct(a.active / total)} des clients`} value={int(a.active)} share={a.active / total} />
      </div>
    </ChartScreen>
  );
}

/* ── 14 · Top clients ─────────────────────────────────────────────────── */
export function TopScreen() {
  const navigate = useNavigate();
  const t = useTopData();
  const max = Math.max(...t.rows.map((r) => r.totalXAF), 1);
  return (
    <ChartScreen title="Top clients" ds={t.ds}>
      <Period compare={false} />
      <Figure label={t.ds.figure.label} value={t.loading ? '—' : int(t.sum)} unit="XAF" note={t.ds.figure.note} />
      {t.loading ? <Loading /> : t.rows.length === 0 ? <Empty /> : (
        <div className="px-5 pt-3">
          {t.rows.map((r, i) => (
            <BarRow key={r.userId} rank={i + 1} leading={<Initials name={t.name(r)} />} title={t.name(r)} subtitle={nPay(r.opCount)} value={int(r.totalXAF)} share={r.totalXAF / max} onClick={() => navigate(`/m/clients/${r.userId}`)} />
          ))}
        </div>
      )}
    </ChartScreen>
  );
}

/* ── 15 · Pays ────────────────────────────────────────────────────────── */
function Flag({ iso, fallback }: { iso?: string; fallback: string }) {
  const url = iso ? flagUrl(iso) : undefined;
  if (!url) return <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5] text-[16px] font-semibold dark:bg-[#383838]', TEXT.strong)}>{fallback}</span>;
  return <img src={url} alt="" aria-hidden className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-black/10" />;
}

export function CountriesScreen() {
  const c = useCountriesData();
  const max = Math.max(...c.head.map((r) => r.count), c.others?.count ?? 0, c.unknown?.count ?? 0, 1);
  return (
    <ChartScreen title="Pays" ds={c.ds}>
      <Figure label="Tous les clients" value={c.loading ? '—' : int(c.total)} unit="clients" note={c.ds.figure.note} />
      {c.loading ? <Loading /> : c.total === 0 ? <Empty /> : (
        <div className="px-5 pt-3">
          {c.head.map((r) => (
            <BarRow key={r.key} leading={<Flag iso={r.key.length === 2 ? r.key : undefined} fallback={r.country.slice(0, 2).toUpperCase()} />} title={r.country} value={int(r.count)} valueSub={pct(r.share)} share={r.count / max} />
          ))}
          {c.others && <BarRow leading={<Flag fallback={`+${c.others.n}`} />} title="Autres pays" value={int(c.others.count)} valueSub={pct(c.others.share)} share={c.others.count / max} />}
          {c.unknown && <BarRow leading={<Flag fallback="?" />} title="Non renseigné" value={int(c.unknown.count)} valueSub={pct(c.unknown.share)} share={c.unknown.count / max} />}
        </div>
      )}
    </ChartScreen>
  );
}

/* ── 16 · Sources d'inscription ───────────────────────────────────────── */
const SOURCE_LABEL: Record<string, string> = { facebook: 'Facebook', whatsapp: 'WhatsApp', google: 'Google', tiktok: 'TikTok', instagram: 'Instagram', '(direct)': 'Direct' };
const cap = (s: string) => SOURCE_LABEL[s.toLowerCase()] ?? (s.charAt(0).toUpperCase() + s.slice(1));

export function SourcesScreen() {
  const navigate = useNavigate();
  const s = useSourcesData();
  const team = s.s?.adminCreated ?? 0;
  const app = s.s?.selfRegistered ?? 0;
  const max = Math.max(...s.utm.map((r) => r.count), 1);
  return (
    <ChartScreen title="Sources" ds={s.ds}>
      <Period compare={false} />
      <Figure label="Nouveaux clients" value={s.loading ? '—' : int(s.s?.totalNew ?? 0)} note="Inscrits sur la période" />
      <div className="px-5 pt-5">
        <StackBar shares={[team, app]} height={14} tones={['#2C2C2C', '#9E9E9E']} />
        <div className={cn('mt-2.5 flex justify-between gap-3 text-[16px]', TEXT.body)}>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#2C2C2C]" /><b className={cn('font-semibold', TEXT.strong)}>{int(team)}</b> créés par l’équipe</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#9E9E9E]" /><b className={cn('font-semibold', TEXT.strong)}>{int(app)}</b> par l’app</span>
        </div>
      </div>
      {s.utm.length > 0 && (
        <>
          <SectionHead title="Venus par l’app" />
          <div className="px-5">
            {s.utm.map((r) => {
              const sub = [r.medium, r.campaign].filter((x) => x && x !== '(none)').join(' · ');
              return <BarRow key={`${r.source}|${r.medium}|${r.campaign}`} leading={<Flag fallback={cap(r.source).charAt(0)} />} title={cap(r.source)} subtitle={sub || undefined} value={int(r.count)} share={r.count / max} />;
            })}
          </div>
        </>
      )}
      <LinkRow className="mt-4" icon={BarChart3} title="Par commercial" subtitle="Équipe › Ventes" onClick={() => navigate('/m/equipe/ventes')} />
    </ChartScreen>
  );
}

/* ── 17 · Délais (dépôts seulement : la mesure des paiements n'existe pas côté serveur) ── */
export function DelaysScreen() {
  const d = useDelaysData();
  const max = Math.max(...d.buckets, 1);
  return (
    <ChartScreen title="Délais" ds={d.ds}>
      <Period />
      <Figure label="Validation d’un dépôt · médiane" value={d.loading ? '—' : d.ds.figure.value} unit={d.ds.figure.unit} delta={d.ds.figure.delta} note={d.ds.figure.note} />
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: '9 sur 10 en moins de', value: d.p90 != null ? fmtMin(d.p90) : '—' },
          { label: 'Rejetés · en attente', value: `${d.rejected ?? '—'} · ${d.pending ?? '—'}` },
        ]}
      />
      <div className="px-5 pt-3">
        {DURATION_BUCKETS.map((b, i) => (
          <BarRow key={b.label} title={b.label} value={int(d.buckets[i])} share={d.buckets[i] / max} strong={i === d.medianBucket} />
        ))}
      </div>
    </ChartScreen>
  );
}

function fmtMin(m: number): string {
  if (m < 60) return `${Math.round(m)}\u00A0min`;
  const h = Math.floor(m / 60);
  const r = Math.round(m % 60);
  return r ? `${h}\u00A0h\u00A0${String(r).padStart(2, '0')}` : `${h}\u00A0h`;
}

/* ── 18 · Équipe ──────────────────────────────────────────────────────── */
export function TeamScreen() {
  const navigate = useNavigate();
  const t = useTeamData();
  const max = Math.max(...t.rows.map((r) => r.totalActions), 1);
  return (
    <ChartScreen title="Équipe" ds={t.ds}>
      <Period compare={false} />
      <Figure label="Actions de l’équipe" value={t.loading ? '—' : int(t.actions)} unit="actions" note={t.ds.figure.note} />
      {t.loading ? <Loading /> : t.rows.length === 0 ? <Empty /> : (
        <div className="px-5 pt-3">
          {t.rows.map((r) => {
            const parts = [
              r.depositsValidated ? `${int(r.depositsValidated)} dépôt${r.depositsValidated > 1 ? 's' : ''}` : null,
              r.paymentsProcessed ? nPay(r.paymentsProcessed) : null,
              r.depositsRejected ? `${int(r.depositsRejected)} rejeté${r.depositsRejected > 1 ? 's' : ''}` : null,
            ].filter(Boolean);
            const name = r.name || 'Membre de l’équipe';
            return (
              <BarRow key={r.adminId} leading={r.name ? <Initials name={name} /> : <IconCircle icon={UserRound} />} title={name} subtitle={parts.join(' · ') || 'Autres actions'} value={int(r.totalActions)} share={r.totalActions / max} onClick={() => navigate(`/m/equipe/${r.adminId}`)} />
            );
          })}
        </div>
      )}
    </ChartScreen>
  );
}

/* ── 19 / 20 · Croissance ─────────────────────────────────────────────── */
const SERIES: { value: GrowthSerie; label: string }[] = [
  { value: 'paiements', label: 'Paiements' },
  { value: 'depots', label: 'Dépôts' },
  { value: 'clients', label: 'Clients' },
];

export function GrowthScreen() {
  const [params, setParams] = useSearchParams();
  const mode: GrowthMode = params.get('pas') === 'mois' ? 'month' : 'week';
  const serie = (SERIES.find((s) => s.value === params.get('serie'))?.value ?? 'paiements') as GrowthSerie;
  const set = (m: GrowthMode, s: GrowthSerie) => setParams({ pas: m === 'month' ? 'mois' : 'semaines', serie: s }, { replace: true });
  const g = useGrowthData(mode, serie);
  const [sel, setSel] = React.useState<number | null>(null);
  React.useEffect(() => setSel(null), [mode, serie]);
  const max = Math.max(...g.buckets.map((b) => b.value), 0);
  const ref = niceRef(max);
  const n = g.buckets.length;
  const xLabels: Record<number, string> = {};
  for (const i of [0, 3, 6, 9, n - 1]) if (i >= 0 && i < n) xLabels[i] = g.name(g.buckets[i].bucket);
  return (
    <ChartScreen title="Croissance" ds={g.ds}>
      <BoxSegmented className="mx-5 mt-4" ariaLabel="Fenêtre" options={[{ value: 'week', label: '12 semaines' }, { value: 'month', label: '12 mois' }]} value={mode} onChange={(m) => set(m, serie)} />
      <PillRow className="pt-3" options={SERIES} value={serie} onChange={(s) => set(mode, s)} />
      <Figure label={g.ds.figure.label} value={g.loading ? '—' : g.ds.figure.value} unit={g.ds.figure.unit} delta={g.tag} note={g.ds.figure.note} />
      {g.loading ? <Loading /> : n === 0 ? <Empty /> : (
        <>
          <RefBars data={g.bars} height={230} refValue={ref} refText={ref ? int(ref) : undefined} tagAt={g.tag && g.lastIdx >= 0 && sel == null ? { index: g.lastIdx, ...g.tag } : null} xLabels={xLabels} selected={sel} onSelect={setSel} bubbleRoom={sel != null} className={sel == null ? 'pt-14' : undefined} ariaLabel="Croissance par période" />
          <CurrentLegend>{mode === 'week' ? 'Semaine en cours' : 'Mois en cours'}</CurrentLegend>
        </>
      )}
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: mode === 'week' ? 'Moyenne par semaine' : 'Moyenne par mois', value: g.sum.average != null ? int(g.sum.average) : '—' },
          { label: mode === 'week' ? 'Meilleure semaine' : 'Meilleur mois', value: g.sum.best ? `${g.name(g.sum.best.bucket, true)} · ${int(g.sum.best.value)}` : '—' },
        ]}
      />
    </ChartScreen>
  );
}

/* ── 21 › Meilleurs fournisseurs et acheteurs ─────────────────────────── */
export function CounterpartiesScreen() {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const [params, setParams] = useSearchParams();
  const kind = params.get('type') === 'acheteurs' ? 'acheteurs' : 'fournisseurs';
  const { suppliers, buyers } = useCounterpartiesData();
  const q = kind === 'fournisseurs' ? suppliers : buyers;
  const rows = q.data?.top ?? [];
  const max = Math.max(...rows.map((r) => r.total_usdt), 1);
  const unit = kind === 'fournisseurs' ? 'XAF / USDT' : '¥ / USDT';
  const totalUsdt = rows.reduce((s, r) => s + r.total_usdt, 0);
  return (
    <ChartScreen title="Meilleures contreparties" backTo="/m/dashboard?vue=tresorerie">
      <BoxSegmented className="mx-5 mt-4" ariaLabel="Contreparties" options={[{ value: 'fournisseurs', label: 'Fournisseurs USDT' }, { value: 'acheteurs', label: 'Acheteurs CNY' }]} value={kind} onChange={(v) => setParams({ type: v }, { replace: true })} />
      <Period compare={false} className="pt-3" />
      <Figure label={kind === 'fournisseurs' ? 'USDT achetés aux 10 premiers' : 'USDT vendus aux 10 premiers'} value={q.isLoading ? '—' : dec(totalUsdt, 2)} unit="USDT" note={q.data ? `Moyenne ${dec(q.data.overall_weighted_avg_rate, kind === 'fournisseurs' ? 2 : 4)} ${unit}` : undefined} />
      {q.isLoading ? <Loading /> : q.isError ? <Empty error onRetry={() => void ui.refresh()} /> : rows.length === 0 ? <Empty /> : (
        <div className="px-5 pt-3">
          {rows.map((r, i) => (
            <BarRow
              key={r.id}
              rank={i + 1}
              leading={<Initials name={r.display_name} />}
              title={r.display_name}
              subtitle={`${int(r.operation_count)} opération${r.operation_count > 1 ? 's' : ''} · ${r.deviation_pct >= 0 ? '+' : '−'}${dec(Math.abs(r.deviation_pct), 2)} %`}
              value={dec(r.total_usdt, 0)}
              valueSub={dec(r.weighted_avg_rate, kind === 'fournisseurs' ? 2 : 4)}
              share={r.total_usdt / max}
              onClick={() => navigate(`/m/more/treasury/counterparties/${r.id}`)}
            />
          ))}
        </div>
      )}
    </ChartScreen>
  );
}

