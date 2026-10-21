/**
 * Analyses mobile v2 — les écrans « Argent » : paiements (03), détail d'une
 * barre / liste filtrée (04), comparer (05), dépôts (06), flux net (07),
 * par méthode (08 / 09), panier moyen (10), argent des clients (11).
 */
import * as React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BoxSegmented, Chip, ChartLegend, DayLabel, Initials, ItemList, ItemRow, LineChart, MethodCircle, PAYMENT_METHOD, RoundButton,
  SearchBox, SectionHead, ShareRow, SURFACE, TEXT, Tag, toMethodKey, FOCUS_RING,
} from '@/mobile/designKit';
import { DepositFamilyLogo, DepositMethodLogo } from '@/mobile/components/deposits/DepositLogos';
import { DEPOSIT_METHOD_LABELS_SHORT } from '@/types/deposit';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import { ChartScreen, Empty, Figure, Period } from './layout';
import { CurrentLegend, Loading, PillRow, RefBars, StackBar, KVRows } from './parts';
import {
  axisLabels, bucketText, dayKey, rangeDays, dayMonth, deltaTag, hhmm, int, niceRef, pct, periodLabel, signed, STEP_NOUN, versusLabel, weekdayDayMonth, dec,
} from './format';
import { useAnalyticsUi } from './state';
import {
  nDep, nPay, voir, useBasketData, useCompareData, useDepositsData, useFlowData, useMethodsData, useMoneyData, usePaymentsData, type GrowthSerie,
} from './datasets';
import { usePeriodDeposits, usePeriodPayments } from './data';

/** Le lien sous un graphe dont une barre est touchée : « Voir les 18 paiements du mer. 14 oct. ». */
function SelectionLink({ label, onClick }: { label: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('mx-5 mt-4 flex w-[calc(100%-40px)] items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-left text-[16px] font-semibold active:bg-[#F5F5F5] dark:active:bg-[#383838]', SURFACE.divider, FOCUS_RING, TEXT.strong)}>
      <span className="min-w-0 truncate">{label}</span>
      <ChevronRight className={cn('h-5 w-5 shrink-0', TEXT.muted)} />
    </button>
  );
}

function listHref(type: 'paiements' | 'depots', from: string, to: string, title: string, methods?: string[]) {
  const q = new URLSearchParams({ type, du: from, au: to, titre: title });
  if (methods?.length) q.set('methode', methods.join(','));
  return `/m/dashboard/liste?${q.toString()}`;
}

/** Les étiquettes d'axe : toutes si elles tiennent (≤ 6), sinon quatre. */
function labelsFor(buckets: string[], g: Parameters<typeof axisLabels>[1]) {
  if (buckets.length <= 6) return Object.fromEntries(buckets.map((b, i) => [i, bucketText(b, g)]));
  return axisLabels(buckets, g, { today: true });
}

/* ── 03 · Paiements exécutés ──────────────────────────────────────────── */
export function PaymentsScreen() {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const p = usePaymentsData();
  const [sel, setSel] = React.useState<number | null>(null);
  React.useEffect(() => setSel(null), [p.granularity, ui.range.from]);
  const max = Math.max(...p.bars.map((b) => b.value), 0);
  const ref = niceRef(max);
  const s = sel != null ? p.series[sel] : null;
  return (
    <ChartScreen title="Paiements exécutés" ds={p.ds}>
      <Period />
      <Figure label="Total de la période" value={p.loading ? '—' : int(p.total)} unit="XAF" delta={deltaTag(p.d)} note={p.d != null ? versusLabel(ui.range) : undefined} />
      {p.loading ? <Loading /> : p.error ? <Empty error onRetry={() => void ui.refresh()} /> : (
        <>
          <RefBars data={p.bars} height={240} bubbleRoom selected={sel} onSelect={setSel} refValue={ref} refText={ref ? int(ref) : undefined} xLabels={labelsFor(p.series.map((x) => x.bucket), p.granularity)} ariaLabel="Paiements par période" />
          {s && (s.count ?? 0) > 0 && (
            <SelectionLink
              label={`${voir(s.count ?? 0, nPay)} · ${bucketText(s.bucket, p.granularity, true)}`}
              onClick={() => navigate(listHref('paiements', s.bucket, p.series[sel! + 1]?.bucket ?? ui.range.to.toISOString(), bucketText(s.bucket, p.granularity, true)))}
            />
          )}
          <KVRows
            className="mx-5 mt-5"
            rows={[
              { label: 'Paiements', value: int(p.count), onClick: () => navigate('/m/dashboard/liste?type=paiements') },
              { label: 'Ticket moyen', value: `${int(p.avg)} XAF`, onClick: () => navigate('/m/dashboard/panier') },
              { label: `Meilleur${p.granularity === 'week' ? 'e' : ''} ${STEP_NOUN[p.granularity].toLowerCase()}`, value: p.peakText },
            ]}
          />
        </>
      )}
    </ChartScreen>
  );
}

/* ── 04 · Les opérations d'une barre, d'une méthode ou de la période ──── */
const PAY_FILTERS = ['alipay', 'wechat', 'bank_transfer', 'cash'] as const;
const DEP_FAMILIES: { key: string; label: string; methods: string[] }[] = [
  { key: 'om', label: 'Orange Money', methods: ['om_transfer', 'om_withdrawal'] },
  { key: 'mtn', label: 'MTN MoMo', methods: ['mtn_transfer', 'mtn_withdrawal'] },
  { key: 'bank', label: 'Banque', methods: ['bank_transfer', 'bank_cash'] },
  { key: 'agency_cash', label: 'Cash agence', methods: ['agency_cash'] },
  { key: 'wave', label: 'Wave', methods: ['wave'] },
];

export function OperationsList() {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const [params] = useSearchParams();
  const type = params.get('type') === 'depots' ? 'depots' : 'paiements';
  const from = params.get('du') ?? ui.range.from.toISOString();
  const to = params.get('au') ?? ui.range.to.toISOString();
  const initial = params.get('methode')?.split(',').filter(Boolean) ?? [];
  const [methods, setMethods] = React.useState<string[]>(initial);
  const [searching, setSearching] = React.useState(false);
  const [q, setQ] = React.useState('');
  const pays = usePeriodPayments(from, to, type === 'paiements');
  const deps = usePeriodDeposits(from, to, type === 'depots');
  const custom = params.get('du') != null;
  const title = params.get('titre') ?? (custom ? dayMonth(from) : periodLabel(ui.range));
  const multiDay = dayKey(from) !== dayKey(new Date(new Date(to).getTime() - 1));

  const all = React.useMemo(() => (type === 'paiements' ? pays.data ?? [] : deps.data ?? []), [type, pays.data, deps.data]);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => (methods.length === 0 || methods.includes(r.method)) && (!needle || `${r.clientName} ${r.reference ?? ''} ${'beneficiary' in r ? r.beneficiary ?? '' : ''}`.toLowerCase().includes(needle)));
  const totalXaf = rows.reduce((s, r) => s + r.amountXaf, 0);
  const totalRmb = type === 'paiements' ? rows.reduce((s, r) => s + ('amountRmb' in r ? r.amountRmb : 0), 0) : 0;
  const loading = type === 'paiements' ? pays.isLoading : deps.isLoading;
  const error = type === 'paiements' ? pays.isError : deps.isError;

  const filters = type === 'paiements'
    ? PAY_FILTERS.filter((m) => all.some((r) => r.method === m)).map((m) => ({ key: m, label: PAYMENT_METHOD_LABELS[m].replace(' Pay', ''), methods: [m] }))
    : DEP_FAMILIES.filter((f) => all.some((r) => f.methods.includes(r.method)));
  const isOn = (ms: string[]) => ms.length === methods.length && ms.every((m) => methods.includes(m));

  // Groupement par jour quand la liste couvre plusieurs jours.
  const groups: { day: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const k = dayKey(r.at);
    const g = groups[groups.length - 1];
    if (g && g.day === k) g.items.push(r);
    else groups.push({ day: k, items: [r] });
  }

  return (
    <ChartScreen
      title={title}
      backTo={type === 'paiements' ? '/m/dashboard/paiements' : '/m/dashboard/depots'}
      right={<RoundButton icon={Search} ariaLabel="Rechercher" onClick={() => setSearching((s) => !s)} className="border-0" />}
    >
      {searching && <div className="px-5 pt-4"><SearchBox value={q} onChange={setQ} placeholder="Client, référence…" autoFocus /></div>}
      <Figure
        label={type === 'paiements' ? 'Paiements exécutés' : 'Dépôts validés'}
        value={loading ? '—' : int(totalXaf)}
        unit="XAF"
        note={type === 'paiements' ? `${nPay(rows.length)} · ¥\u00A0${int(totalRmb)}` : nDep(rows.length)}
      />
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 pt-4">
        <Chip label="Tous" count={all.length} active={methods.length === 0} onClick={() => setMethods([])} />
        {filters.map((f) => <Chip key={f.key} label={f.label} active={isOn(f.methods)} onClick={() => setMethods(isOn(f.methods) ? [] : f.methods)} />)}
      </div>
      {loading ? <Loading /> : error ? <Empty error onRetry={() => void ui.refresh()} /> : rows.length === 0 ? <Empty /> : (
        groups.map((g) => (
          <div key={g.day}>
            {multiDay && <DayLabel>{weekdayDayMonth(`${g.day}T12:00:00Z`)}</DayLabel>}
            <ItemList className="pt-1">
              {g.items.map((r) => {
                if (type === 'paiements' && 'amountRmb' in r) {
                  const m = toMethodKey(r.method);
                  return (
                    <ItemRow
                      key={r.id}
                      leading={<MethodCircle method={m} />}
                      title={r.clientName}
                      subtitle={`${r.beneficiary || PAYMENT_METHOD[m].label} · ${hhmm(r.at)}`}
                      amount={<>¥&nbsp;{int(r.amountRmb)}</>}
                      tag={{ tone: 'success', label: 'Payé' }}
                      onClick={() => navigate(`/m/payments/${r.id}`)}
                    />
                  );
                }
                const d = r as { id: string; clientName: string; method: string; bankName?: string | null; at: string; amountXaf: number };
                return (
                  <ItemRow
                    key={d.id}
                    leading={<RoundDepositLogo method={d.method} bankName={d.bankName} />}
                    title={d.clientName}
                    subtitle={`${DEPOSIT_METHOD_LABELS_SHORT[d.method as keyof typeof DEPOSIT_METHOD_LABELS_SHORT] ?? d.method} · ${hhmm(d.at)}`}
                    amount={int(d.amountXaf)}
                    tag={{ tone: 'success', label: 'Validé' }}
                    onClick={() => navigate(`/m/deposits/${d.id}`)}
                  />
                );
              })}
            </ItemList>
          </div>
        ))
      )}
    </ChartScreen>
  );
}

/* ── 05 · Comparer ────────────────────────────────────────────────────── */
const SERIES: { value: GrowthSerie; label: string }[] = [
  { value: 'paiements', label: 'Paiements' },
  { value: 'depots', label: 'Dépôts' },
  { value: 'clients', label: 'Clients' },
];

export function CompareScreen() {
  const ui = useAnalyticsUi();
  const [params, setParams] = useSearchParams();
  const serie = (SERIES.find((s) => s.value === params.get('serie'))?.value ?? 'paiements') as GrowthSerie;
  const c = useCompareData(serie);
  const [sel, setSel] = React.useState<number | null>(null);
  React.useEffect(() => setSel(null), [serie]);
  const max = Math.max(...c.curC, ...c.prevC, 0);
  const ref = niceRef(max);
  const n = Math.max(c.curC.length, c.prevC.length);
  const word = STEP_NOUN[c.granularity];
  const xLabels: Record<number, string> = n > 1 ? { 0: `${word} 1`, [Math.floor((n - 1) / 2)]: `${word} ${Math.floor((n - 1) / 2) + 1}`, [n - 1]: `${word} ${n}` } : {};
  const d = c.prevTotal ? (c.total - c.prevTotal) / c.prevTotal : null;
  const tag = deltaTag(d);
  return (
    <ChartScreen title="Comparer" ds={c.ds}>
      <PillRow options={SERIES} value={serie} onChange={(v) => setParams({ serie: v }, { replace: true })} />
      <Figure
        label={`${serie === 'clients' ? 'Nouveaux clients' : SERIES.find((s) => s.value === serie)!.label} cumulés · ${rangeDays(ui.range)} jours`}
        value={c.loading ? '—' : tag?.label ?? '—'}
        note={`${int(c.total)} contre ${int(c.prevTotal)}${c.money ? ' XAF' : ''}`}
      />
      <ChartLegend className="px-5" items={[{ label: `${c.curEdges[0]} → ${c.curEdges[1]}` }, { label: `${c.prevEdges[0]} → ${c.prevEdges[1]}`, tone: 'grey' }]} />
      {c.loading ? <Loading /> : (
        <div className="px-5 pt-[84px]">
          <LineChart
            series={[{ values: c.curC, tone: 'ink' }, { values: c.prevC, tone: 'grey' }]}
            height={230}
            yTicks={ref ? [ref] : undefined}
            formatY={(v) => int(v)}
            xLabels={xLabels}
            selected={sel}
            onSelect={setSel}
            ariaLabel="Cumul de la période contre la précédente"
          />
        </div>
      )}
      {sel != null && (
        <div className={cn('px-5 pt-3 text-[16px]', TEXT.body)}>
          {word} {sel + 1} · {c.cur[sel] ? dayMonth(c.cur[sel].bucket) : '—'} : <b className={TEXT.strong}>{int(c.curC[sel])}</b>
          <span className={TEXT.muted}> · {c.prev[sel] ? `${int(c.prevC[sel])} le ${dayMonth(c.prev[sel].bucket)}` : '—'}</span>
        </div>
      )}
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: serie === 'clients' ? 'Nouveaux clients' : serie === 'depots' ? 'Dépôts' : 'Paiements', value: <>{int(c.count)}<span className={cn('font-medium', TEXT.muted)}> / {int(c.prevCount)}</span></> },
          ...(c.money ? [{ label: serie === 'depots' ? 'Dépôt moyen' : 'Ticket moyen', value: <>{int(c.avg)}<span className={cn('font-medium', TEXT.muted)}> / {int(c.prevAvg)}</span></> }] : []),
        ]}
      />
    </ChartScreen>
  );
}

/* ── 06 · Dépôts validés ──────────────────────────────────────────────── */
export function DepositsScreen() {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const p = useDepositsData();
  const [sel, setSel] = React.useState<number | null>(null);
  React.useEffect(() => setSel(null), [p.granularity, ui.range.from]);
  const max = Math.max(...p.bars.map((b) => b.value), 0);
  const ref = niceRef(max);
  const s = sel != null ? p.series[sel] : null;
  const hasCurrent = p.bars.some((b) => b.current);
  return (
    <ChartScreen title="Dépôts validés" ds={p.ds}>
      <Period />
      <Figure label="Total de la période" value={p.loading ? '—' : int(p.total)} unit="XAF" delta={deltaTag(p.d)} note={p.d != null ? versusLabel(ui.range) : undefined} />
      {ui.steps.length > 1 && (
        <BoxSegmented className="mx-5 mt-5" ariaLabel="Pas" options={ui.steps.map((g) => ({ value: g, label: STEP_NOUN[g] }))} value={p.granularity} onChange={(g) => ui.setStep('depots', g)} />
      )}
      {p.loading ? <Loading /> : p.error ? <Empty error onRetry={() => void ui.refresh()} /> : (
        <>
          <RefBars data={p.bars} height={220} bubbleRoom={sel != null} selected={sel} onSelect={setSel} refValue={ref} refText={ref ? int(ref) : undefined} xLabels={labelsFor(p.series.map((x) => x.bucket), p.granularity)} ariaLabel="Dépôts par période" />
          {hasCurrent && <CurrentLegend>{STEP_NOUN[p.granularity]} en cours</CurrentLegend>}
          {s && (s.count ?? 0) > 0 && (
            <SelectionLink
              label={`${voir(s.count ?? 0, nDep)} · ${bucketText(s.bucket, p.granularity, true)}`}
              onClick={() => navigate(listHref('depots', s.bucket, p.series[sel! + 1]?.bucket ?? ui.range.to.toISOString(), bucketText(s.bucket, p.granularity, true)))}
            />
          )}
          <KVRows
            className="mx-5 mt-5"
            rows={[
              { label: 'Dépôts', value: int(p.count), onClick: () => navigate('/m/dashboard/liste?type=depots') },
              { label: 'Dépôt moyen', value: `${int(p.avg)} XAF` },
              { label: 'Dépôt médian', value: p.median != null ? `${int(p.median)} XAF` : '—' },
            ]}
          />
        </>
      )}
    </ChartScreen>
  );
}

/* ── 07 · Flux net ────────────────────────────────────────────────────── */
export function FlowScreen() {
  const ui = useAnalyticsUi();
  const f = useFlowData();
  const [sel, setSel] = React.useState<number | null>(null);
  return (
    <ChartScreen title="Flux net" ds={f.ds}>
      <Period />
      <Figure label="Dépôts − paiements" value={f.loading ? '—' : int(f.net)} unit="XAF" delta={deltaTag(f.d)} note={f.ds.figure.note} />
      {f.loading ? <Loading /> : f.error ? <Empty error onRetry={() => void ui.refresh()} /> : (
        <>
          <div className={cn('px-5 pt-5 text-right text-[15px]', TEXT.muted)}>Plus d’entrées</div>
          <RefBars data={f.bars} height={230} signed selected={sel} onSelect={setSel} className="!pt-1" xLabels={f.series.length <= 6 ? undefined : labelsFor(f.series.map((x) => x.bucket), f.granularity)} ariaLabel="Solde par période" bubbleRoom={sel != null} />
          <div className={cn('px-5 pt-1 text-right text-[15px]', TEXT.muted)}>Plus de sorties</div>
          <KVRows
            className="mx-5 mt-5"
            rows={f.series.map((p, i) => ({
              label: bucketText(p.bucket, f.granularity, true),
              value: (
                <span className="inline-flex items-center gap-2.5">
                  {f.bars[i]?.current && <Tag tone="neutral">En cours</Tag>}
                  {signed(p.value)}
                </span>
              ),
            }))}
          />
        </>
      )}
    </ChartScreen>
  );
}

/* ── 08 / 09 · Par méthode ────────────────────────────────────────────── */
/** Le logo d'un moyen de dépôt en rond de 44 ; Orange Money (logo large) tient dans un rond blanc à filet. */
function RoundDepositLogo({ method, bankName }: { method: string; bankName?: string | null }) {
  if (method === 'om_transfer' || method === 'om_withdrawal') {
    return (
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-white', SURFACE.divider)}>
        <DepositFamilyLogo family="ORANGE_MONEY" size={30} radius={6} />
      </span>
    );
  }
  return <DepositMethodLogo method={method} bankName={bankName} size={44} radius={22} />;
}

function MethodLogo({ kind, rowKey }: { kind: 'paiements' | 'depots'; rowKey: string }) {
  if (kind === 'paiements') return <MethodCircle method={toMethodKey(rowKey)} />;
  if (rowKey === 'om') return <RoundDepositLogo method="om_transfer" />;
  if (rowKey === 'mtn') return <DepositFamilyLogo family="MTN_MONEY" size={44} radius={22} />;
  return <DepositMethodLogo method={rowKey} size={44} radius={22} />;
}

export function MethodsScreen() {
  const navigate = useNavigate();
  const ui = useAnalyticsUi();
  const [params, setParams] = useSearchParams();
  const kind = params.get('type') === 'depots' ? 'depots' : 'paiements';
  const m = useMethodsData(kind);
  return (
    <ChartScreen title="Par méthode" ds={m.ds}>
      <BoxSegmented className="mx-5 mt-4" ariaLabel="Opérations" options={[{ value: 'paiements', label: 'Paiements' }, { value: 'depots', label: 'Dépôts' }]} value={kind} onChange={(v) => setParams({ type: v }, { replace: true })} />
      <Period compare={false} className="pt-3" />
      <Figure label={kind === 'paiements' ? 'Paiements exécutés' : 'Dépôts validés'} value={m.loading ? '—' : int(m.total)} unit="XAF" note={m.ds.figure.note} />
      {m.loading ? <Loading /> : m.rows.length === 0 ? <Empty /> : (
        <div className="px-5 pt-3">
          {m.rows.map((r) => (
            <ShareRow
              key={r.key}
              leading={<MethodLogo kind={kind} rowKey={r.key} />}
              title={r.label}
              subtitle={r.parts && r.parts.length > 1 ? r.parts.map((x) => `${x.label} ${int(x.count)}`).join(' · ') : kind === 'paiements' ? nPay(r.count) : nDep(r.count)}
              value={int(r.amount)}
              share={r.share}
              onClick={() => navigate(listHref(kind, ui.range.from.toISOString(), ui.range.to.toISOString(), r.label, r.methods))}
            />
          ))}
        </div>
      )}
    </ChartScreen>
  );
}

/* ── 10 · Panier moyen ────────────────────────────────────────────────── */
export function BasketScreen() {
  const navigate = useNavigate();
  const b = useBasketData();
  return (
    <ChartScreen title="Panier moyen" ds={b.ds}>
      <Period />
      <Figure label="Paiement moyen" value={b.loading ? '—' : <>¥&nbsp;{int(b.avgRmb)}</>} delta={deltaTag(b.d)} note={`${int(b.avgXaf)} XAF`} />
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: 'Paiement médian', value: b.medRmb != null ? <>¥&nbsp;{int(b.medRmb)} · {int(b.medXaf)} XAF</> : '—' },
          { label: 'Paiements', value: int(b.count), onClick: () => navigate('/m/dashboard/liste?type=paiements') },
        ]}
      />
    </ChartScreen>
  );
}

/* ── 11 · Argent des clients ──────────────────────────────────────────── */
export function MoneyScreen() {
  const navigate = useNavigate();
  const m = useMoneyData();
  return (
    <ChartScreen title="Argent des clients" ds={m.ds}>
      <Figure label="Soldes des portefeuilles · maintenant" value={m.loading ? '—' : int(m.total)} unit="XAF" note={`${int(m.clients)} clients ont un solde`} />
      <div className="px-5 pt-5">
        <StackBar shares={[m.topShare, 1 - m.topShare]} height={14} tones={['#2C2C2C', '#D9D9D9']} />
        <div className={cn('mt-2 flex justify-between gap-3 text-[16px]', TEXT.body)}>
          <span><b className={cn('font-semibold', TEXT.strong)}>{Math.min(10, m.clients)} plus gros</b> · {pct(m.topShare)}</span>
          <span>{int(Math.max(m.clients - 10, 0))} autres · {pct(1 - m.topShare)}</span>
        </div>
      </div>
      <KVRows
        className="mx-5 mt-5"
        rows={[
          { label: 'Solde moyen', value: `${int(m.avg)} XAF` },
          { label: 'Dépôts / paiements', value: m.ratio != null ? dec(m.ratio, 2) : '—' },
          { label: 'Taux de validation', value: m.validation != null ? pct(m.validation) : '—' },
        ]}
      />
      {m.top.length > 0 && (
        <>
          <SectionHead title="Plus gros soldes" />
          <ItemList>
            {m.top.map((t) => (
              <ItemRow key={t.userId} leading={<Initials name={t.name} />} title={t.name} subtitle={t.code ?? undefined} amount={int(t.balance)} onClick={() => navigate(`/m/clients/${t.userId}`)} />
            ))}
          </ItemList>
        </>
      )}
    </ChartScreen>
  );
}
