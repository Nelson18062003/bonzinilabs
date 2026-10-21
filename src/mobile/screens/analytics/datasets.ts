/**
 * Analyses mobile v2 — une fonction par graphe : elle lit les hooks partagés
 * (`useAnalytics`, `useTreasury`, et les lectures de `data.ts`) et rend les
 * chiffres de l'écran plus le « jeu de données » de « … » (tableau, export
 * CSV / PDF, image). L'écran et l'export « Toutes les analyses » appellent la
 * même fonction : ce qu'on exporte est ce qu'on voit.
 */
import { useMemo } from 'react';
import {
  useAdminProductivity,
  useClientCountryDistribution,
  useClientGrowth,
  useClientGrowthReport,
  useDashboardAlerts,
  useDepositMethodBreakdown,
  useDepositProcessingTime,
  useDepositStatusSummary,
  useDepositSummary,
  useDepositVolumeReport,
  useFlowSeries,
  useFunnel,
  usePaymentMethodBreakdown,
  usePaymentSummary,
  usePaymentVolumeReport,
  useRegistrationSource,
  useTopClients,
  useUtmSources,
  useWalletExposure,
} from '@/hooks/analytics/useAnalytics';
import { useTopCounterparties, useTreasuryDashboard, useUsdtFlowEvolution, useWacEvolution } from '@/hooks/useTreasury';
import { previousRange, type DateRange, type Granularity } from '@/lib/analytics/dateRange';
import { buildGrowthRange, type GrowthMode } from '@/lib/analytics/growthWindow';
import { buildGrowthBuckets, summarizeGrowth, type GrowthInput } from '@/desktop/screens/analytics/GrowthMatrixBlock';
import type { BarDatum } from '@/mobile/designKit';
import { DEPOSIT_METHOD_LABELS } from '@/types/deposit';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import { durationBuckets, DURATION_BUCKETS, median, usePeriodDeposits, usePeriodPayments, useTopBalances } from './data';
import {
  bucketText, dayMonth, dec, delta, deltaTag, int, isCurrentBucket, minutes, monthLong, pct, periodLabel, signed, STEP_NOUN, versusLabel,
} from './format';
import { useAnalyticsUi, type ChartDataset } from './state';

type Series = { bucket: string; value: number; count?: number }[];

/** Les barres d'une série, la période en cours en contour. */
export function toBars(series: Series, g: Granularity, range: DateRange, unit = 'XAF'): BarDatum[] {
  return series.map((p, i) => {
    const next = series[i + 1]?.bucket ?? range.to.toISOString();
    return {
      label: bucketText(p.bucket, g, true),
      value: p.value,
      display: unit ? `${int(p.value)} ${unit}` : int(p.value),
      current: isCurrentBucket(p.bucket, next),
    };
  });
}

const plural = (n: number, one: string, many = `${one}s`) => `${int(n)} ${n > 1 ? many : one}`;
export const nPay = (n: number) => plural(n, 'paiement');
export const nDep = (n: number) => plural(n, 'dépôt');
export const nCli = (n: number) => plural(n, 'client');
/** « Voir 1 paiement », « Voir les 7 paiements ». */
export const voir = (n: number, word: (n: number) => string) => (n > 1 ? `Voir les ${word(n)}` : `Voir ${word(n)}`);

/** Les bornes affichées sous une barre d'image : premier et dernier jour. */
function edges(range: DateRange): [string, string] {
  return [dayMonth(range.from), dayMonth(new Date(range.to.getTime() - 1))];
}

/* ── 03 · Paiements exécutés ───────────────────────────────────────────── */
export function usePaymentsData() {
  const ui = useAnalyticsUi();
  const r = ui.rangeFor('paiements');
  const report = usePaymentVolumeReport(r);
  const summary = usePaymentSummary(ui.range);
  return useMemo(() => {
    const cur = summary.data?.current;
    const total = cur?.totalXAF ?? report.data?.totalXAF ?? 0;
    const count = cur?.opCount ?? report.data?.opCount ?? 0;
    const d = ui.range.compareToPrevious ? delta(total, summary.data?.previous?.totalXAF) : null;
    const series = (report.data?.series ?? []).map((p) => ({ bucket: p.bucket, value: p.amountXAF, count: p.opCount }));
    const bars = toBars(series, r.granularity, r);
    const peak = report.data?.peak && report.data.peak.amountXAF > 0 ? report.data.peak : null;
    const ds: ChartDataset = {
      key: 'paiements',
      title: 'Paiements exécutés',
      figure: { label: periodLabel(ui.range), value: int(total), unit: 'XAF', delta: deltaTag(d), note: d != null ? versusLabel(ui.range) : undefined },
      bars,
      barEdges: edges(ui.range),
      columns: [{ key: 'periode', label: STEP_NOUN[r.granularity] }, { key: 'montant', label: 'Montant (XAF)' }, { key: 'nombre', label: 'Paiements' }],
      rows: series.map((p) => ({ periode: bucketText(p.bucket, r.granularity, true), montant: p.value, nombre: p.count ?? 0 })),
      stepKey: 'paiements',
      list: { label: voir(count, nPay), href: '/m/dashboard/liste?type=paiements' },
      compare: true,
    };
    return {
      ds, total, count, d, bars, granularity: r.granularity, series,
      avg: cur?.avgTicketXAF ?? report.data?.avgXAF ?? 0,
      totalRmb: cur?.totalRMB ?? 0,
      previous: summary.data?.previous ?? null,
      peakText: peak ? bucketText(peak.bucket, r.granularity, true) : '—',
      loading: report.isLoading || summary.isLoading,
      error: report.isError || summary.isError,
    };
  }, [report.data, report.isLoading, report.isError, summary.data, summary.isLoading, summary.isError, ui.range, r]);
}

/* ── 06 · Dépôts validés ───────────────────────────────────────────────── */
export function useDepositsData() {
  const ui = useAnalyticsUi();
  const r = ui.rangeFor('depots');
  const report = useDepositVolumeReport(r);
  const summary = useDepositSummary(ui.range);
  const list = usePeriodDeposits(ui.range.from.toISOString(), ui.range.to.toISOString());
  return useMemo(() => {
    const cur = summary.data?.current;
    const total = cur?.totalXAF ?? report.data?.totalXAF ?? 0;
    const count = cur?.opCount ?? report.data?.opCount ?? 0;
    const d = ui.range.compareToPrevious ? delta(total, summary.data?.previous?.totalXAF) : null;
    const series = (report.data?.series ?? []).map((p) => ({ bucket: p.bucket, value: p.amountXAF, count: p.opCount }));
    const bars = toBars(series, r.granularity, r);
    const med = median((list.data ?? []).map((x) => x.amountXaf));
    const ds: ChartDataset = {
      key: 'depots',
      title: 'Dépôts validés',
      figure: { label: periodLabel(ui.range), value: int(total), unit: 'XAF', delta: deltaTag(d), note: d != null ? versusLabel(ui.range) : undefined },
      bars,
      barEdges: edges(ui.range),
      columns: [{ key: 'periode', label: STEP_NOUN[r.granularity] }, { key: 'montant', label: 'Montant (XAF)' }, { key: 'nombre', label: 'Dépôts' }],
      rows: series.map((p) => ({ periode: bucketText(p.bucket, r.granularity, true), montant: p.value, nombre: p.count ?? 0 })),
      stepKey: 'depots',
      list: { label: voir(count, nDep), href: '/m/dashboard/liste?type=depots' },
      compare: true,
    };
    return {
      ds, total, count, d, bars, granularity: r.granularity, series, median: med,
      avg: cur?.avgTicketXAF ?? report.data?.avgXAF ?? 0,
      previous: summary.data?.previous ?? null,
      loading: report.isLoading || summary.isLoading,
      error: report.isError || summary.isError,
    };
  }, [report.data, report.isLoading, report.isError, summary.data, summary.isLoading, summary.isError, list.data, ui.range, r]);
}

/* ── 07 · Flux net ─────────────────────────────────────────────────────── */
export function useFlowData() {
  const ui = useAnalyticsUi();
  const r = ui.rangeFor('flux');
  const flow = useFlowSeries(r);
  const pay = usePaymentSummary(ui.range);
  const dep = useDepositSummary(ui.range);
  return useMemo(() => {
    const deposits = dep.data?.current.totalXAF ?? 0;
    const payments = pay.data?.current.totalXAF ?? 0;
    const net = deposits - payments;
    const prevNet = dep.data?.previous && pay.data?.previous ? dep.data.previous.totalXAF - pay.data.previous.totalXAF : null;
    const d = ui.range.compareToPrevious ? delta(net, prevNet) : null;
    const series = (flow.data?.current ?? []).map((p) => ({ bucket: p.bucket, value: p.net, deposits: p.deposits, payments: p.payments }));
    const bars = series.map((p, i) => ({
      label: bucketText(p.bucket, r.granularity, true),
      value: p.value,
      display: `${signed(p.value)} XAF`,
      current: isCurrentBucket(p.bucket, series[i + 1]?.bucket ?? r.to.toISOString()),
    }));
    const ds: ChartDataset = {
      key: 'flux',
      title: 'Flux net',
      figure: { label: 'Dépôts − paiements', value: int(net), unit: 'XAF', delta: deltaTag(d), note: net >= 0 ? 'Plus d’entrées que de sorties' : 'Plus de sorties que d’entrées' },
      bars,
      barEdges: edges(ui.range),
      columns: [
        { key: 'periode', label: STEP_NOUN[r.granularity] },
        { key: 'depots', label: 'Dépôts (XAF)' },
        { key: 'paiements', label: 'Paiements (XAF)' },
        { key: 'solde', label: 'Solde (XAF)' },
      ],
      rows: series.map((p) => ({ periode: bucketText(p.bucket, r.granularity, true), depots: p.deposits, paiements: p.payments, solde: p.value })),
      stepKey: 'flux',
      compare: true,
    };
    return { ds, net, d, bars, series, granularity: r.granularity, deposits, payments, loading: flow.isLoading || pay.isLoading || dep.isLoading, error: flow.isError };
  }, [flow.data, flow.isLoading, flow.isError, pay.data, pay.isLoading, dep.data, dep.isLoading, ui.range, r]);
}

/* ── 08 / 09 · Par méthode ─────────────────────────────────────────────── */
export interface MethodRow { key: string; label: string; methods: string[]; count: number; amount: number; share: number; parts?: { label: string; count: number }[] }

/** Les familles de dépôt de la maquette 09 : Orange Money et MTN regroupent transfert et retrait. */
const DEPOSIT_FAMILY: Record<string, { key: string; label: string; part?: string }> = {
  om_transfer: { key: 'om', label: 'Orange Money', part: 'Transfert' },
  om_withdrawal: { key: 'om', label: 'Orange Money', part: 'Retrait' },
  mtn_transfer: { key: 'mtn', label: 'MTN MoMo', part: 'Transfert' },
  mtn_withdrawal: { key: 'mtn', label: 'MTN MoMo', part: 'Retrait' },
  bank_transfer: { key: 'bank_transfer', label: 'Virement bancaire' },
  bank_cash: { key: 'bank_cash', label: 'Cash en banque' },
  agency_cash: { key: 'agency_cash', label: 'Cash agence Bonzini' },
  wave: { key: 'wave', label: 'Wave' },
};

export function useMethodsData(kind: 'paiements' | 'depots') {
  const ui = useAnalyticsUi();
  const pay = usePaymentMethodBreakdown(ui.range);
  const dep = useDepositMethodBreakdown(ui.range);
  return useMemo(() => {
    const src = kind === 'paiements' ? pay.data ?? [] : dep.data ?? [];
    const total = src.reduce((s, r) => s + r.amount, 0);
    const count = src.reduce((s, r) => s + r.count, 0);
    let rows: MethodRow[];
    if (kind === 'paiements') {
      rows = src.map((r) => ({ key: r.key, label: PAYMENT_METHOD_LABELS[r.key as keyof typeof PAYMENT_METHOD_LABELS] ?? r.label, methods: [r.key], count: r.count, amount: r.amount, share: total ? r.amount / total : 0 }));
    } else {
      const map = new Map<string, MethodRow>();
      for (const r of src) {
        const fam = DEPOSIT_FAMILY[r.key] ?? { key: r.key, label: DEPOSIT_METHOD_LABELS[r.key as keyof typeof DEPOSIT_METHOD_LABELS] ?? r.label };
        const row = map.get(fam.key) ?? { key: fam.key, label: fam.label, methods: [], count: 0, amount: 0, share: 0, parts: fam.part ? [] : undefined };
        row.methods.push(r.key);
        row.count += r.count;
        row.amount += r.amount;
        if (fam.part) row.parts?.push({ label: fam.part, count: r.count });
        map.set(fam.key, row);
      }
      rows = [...map.values()].map((r) => ({ ...r, share: total ? r.amount / total : 0 })).sort((a, b) => b.amount - a.amount);
    }
    const ds: ChartDataset = {
      key: `methodes-${kind}`,
      title: kind === 'paiements' ? 'Paiements par méthode' : 'Dépôts par méthode',
      figure: { label: periodLabel(ui.range), value: int(total), unit: 'XAF', note: kind === 'paiements' ? `${nPay(count)} · ${rows.length} méthodes` : nDep(count) },
      columns: [{ key: 'methode', label: 'Méthode' }, { key: 'nombre', label: 'Nombre' }, { key: 'montant', label: 'Montant (XAF)' }, { key: 'part', label: 'Part (%)' }],
      rows: rows.map((r) => ({ methode: r.label, nombre: r.count, montant: r.amount, part: dec(r.share * 100) })),
      list: { label: voir(count, kind === 'paiements' ? nPay : nDep), href: `/m/dashboard/liste?type=${kind}` },
    };
    const loading = kind === 'paiements' ? pay.isLoading : dep.isLoading;
    return { ds, rows, total, count, loading };
  }, [kind, pay.data, pay.isLoading, dep.data, dep.isLoading, ui.range]);
}

/* ── 10 · Panier moyen ─────────────────────────────────────────────────── */
export function useBasketData() {
  const ui = useAnalyticsUi();
  const summary = usePaymentSummary(ui.range);
  const list = usePeriodPayments(ui.range.from.toISOString(), ui.range.to.toISOString());
  return useMemo(() => {
    const cur = summary.data?.current;
    const avgRmb = cur && cur.opCount ? cur.totalRMB / cur.opCount : 0;
    const prev = summary.data?.previous;
    const prevAvgRmb = prev && prev.opCount ? prev.totalRMB / prev.opCount : null;
    const d = ui.range.compareToPrevious ? delta(avgRmb, prevAvgRmb) : null;
    const rows = list.data ?? [];
    const medRmb = median(rows.map((p) => p.amountRmb));
    const medXaf = median(rows.map((p) => p.amountXaf));
    const ds: ChartDataset = {
      key: 'panier',
      title: 'Panier moyen',
      figure: { label: 'Paiement moyen', value: `¥\u00A0${int(avgRmb)}`, delta: deltaTag(d), note: `${int(cur?.avgTicketXAF ?? 0)} XAF` },
      columns: [{ key: 'mesure', label: 'Mesure' }, { key: 'rmb', label: 'Montant (¥)' }, { key: 'xaf', label: 'Montant (XAF)' }],
      rows: [
        { mesure: 'Paiement moyen', rmb: Math.round(avgRmb), xaf: cur?.avgTicketXAF ?? 0 },
        { mesure: 'Paiement médian', rmb: medRmb != null ? Math.round(medRmb) : '', xaf: medXaf != null ? Math.round(medXaf) : '' },
        { mesure: 'Paiements', rmb: cur?.opCount ?? 0, xaf: '' },
      ],
      compare: true,
    };
    return { ds, avgRmb, avgXaf: cur?.avgTicketXAF ?? 0, d, medRmb, medXaf, count: cur?.opCount ?? 0, loading: summary.isLoading };
  }, [summary.data, summary.isLoading, list.data, ui.range]);
}

/* ── 11 · Argent des clients ───────────────────────────────────────────── */
export function useMoneyData() {
  const ui = useAnalyticsUi();
  const exposure = useWalletExposure();
  const top = useTopBalances(10);
  const pay = usePaymentSummary(ui.range);
  const dep = useDepositSummary(ui.range);
  const status = useDepositStatusSummary(ui.range);
  return useMemo(() => {
    const e = exposure.data;
    const total = e?.totalXAF ?? 0;
    const topShare = total > 0 ? (e?.top10ShareXAF ?? 0) / total : 0;
    const payments = pay.data?.current.totalXAF ?? 0;
    const ratio = payments > 0 ? (dep.data?.current.totalXAF ?? 0) / payments : null;
    const validation = status.data && status.data.validated.count + status.data.rejected.count > 0 ? status.data.validationRate : null;
    const ds: ChartDataset = {
      key: 'argent',
      title: 'Argent des clients',
      figure: { label: 'Soldes des portefeuilles · maintenant', value: int(total), unit: 'XAF', note: `${nCli(e?.clientsWithBalance ?? 0)} ont un solde` },
      columns: [{ key: 'libelle', label: 'Libellé' }, { key: 'valeur', label: 'Valeur' }],
      rows: [
        { libelle: 'Soldes des portefeuilles (XAF)', valeur: total },
        { libelle: 'Clients avec un solde', valeur: e?.clientsWithBalance ?? 0 },
        { libelle: 'Part des 10 plus gros (%)', valeur: dec(topShare * 100) },
        { libelle: 'Solde moyen (XAF)', valeur: e?.avgBalancePerClient ?? 0 },
        { libelle: 'Dépôts / paiements', valeur: ratio != null ? dec(ratio, 2) : '' },
        { libelle: 'Taux de validation (%)', valeur: validation != null ? dec(validation * 100) : '' },
        ...(top.data ?? []).map((b) => ({ libelle: `${b.name}${b.code ? ` (${b.code})` : ''}`, valeur: b.balance })),
      ],
    };
    return { ds, total, topShare, clients: e?.clientsWithBalance ?? 0, avg: e?.avgBalancePerClient ?? 0, ratio, validation, top: top.data ?? [], loading: exposure.isLoading };
  }, [exposure.data, exposure.isLoading, top.data, pay.data, dep.data, status.data]);
}

/* ── 12 · Parc de clients ──────────────────────────────────────────────── */
export function useClientsData() {
  const ui = useAnalyticsUi();
  const r = ui.rangeFor('clients');
  const report = useClientGrowthReport(r);
  return useMemo(() => {
    const rep = report.data;
    const points = rep?.points ?? [];
    let best: (typeof points)[number] | null = null;
    for (const p of points) if (p.newClients > 0 && (!best || p.newClients > best.newClients)) best = p;
    const d = ui.range.compareToPrevious ? rep?.trendPct ?? null : null;
    const ds: ChartDataset = {
      key: 'clients',
      title: 'Clients',
      figure: { label: 'Clients au total', value: int(rep?.totalAtEnd ?? 0), delta: deltaTag(d), note: `${int(rep?.newClients ?? 0)} nouveaux${ui.range.compareToPrevious ? ` · ${int(rep?.previousNewClients ?? 0)} avant` : ''}` },
      bars: toBars(points.map((p) => ({ bucket: p.bucket, value: p.newClients })), r.granularity, r, ''),
      barEdges: edges(ui.range),
      columns: [{ key: 'periode', label: STEP_NOUN[r.granularity] }, { key: 'nouveaux', label: 'Nouveaux' }, { key: 'total', label: 'Total' }],
      rows: points.map((p) => ({ periode: bucketText(p.bucket, r.granularity, true), nouveaux: p.newClients, total: p.cumulative })),
      stepKey: 'clients',
      compare: true,
    };
    return {
      ds, rep, points, d, granularity: r.granularity,
      bestText: best ? `${bucketText(best.bucket, r.granularity, true)} · ${int(best.newClients)}` : '—',
      loading: report.isLoading,
    };
  }, [report.data, report.isLoading, ui.range, r]);
}

/* ── 13 · Clients actifs ───────────────────────────────────────────────── */
export function useActiveData() {
  const ui = useAnalyticsUi();
  const funnel = useFunnel(ui.range);
  const prev = useFunnel(previousRange(ui.range));
  return useMemo(() => {
    const f = funnel.data;
    const active = f?.clientsWithPayment ?? 0;
    const before = ui.range.compareToPrevious ? prev.data?.clientsWithPayment ?? null : null;
    const d = before != null ? delta(active, before) : null;
    const total = f?.clientsTotal ?? 0;
    const ds: ChartDataset = {
      key: 'actifs',
      title: 'Clients actifs',
      figure: { label: 'Au moins un paiement exécuté', value: int(active), unit: 'clients', delta: deltaTag(d), note: before != null ? `${int(before)} avant` : undefined },
      columns: [{ key: 'etape', label: 'Étape' }, { key: 'clients', label: 'Clients' }, { key: 'part', label: 'Part (%)' }],
      rows: [
        { etape: 'Clients au total', clients: total, part: 100 },
        { etape: 'Ont déposé', clients: f?.clientsWithDeposit ?? 0, part: total ? dec(((f?.clientsWithDeposit ?? 0) / total) * 100) : '' },
        { etape: 'Ont payé', clients: active, part: total ? dec((active / total) * 100) : '' },
        { etape: 'Dépôt → paiement (%)', clients: '', part: dec((f?.depositToPaymentRate ?? 0) * 100) },
      ],
      compare: true,
    };
    return { ds, f, active, before, d, total, loading: funnel.isLoading };
  }, [funnel.data, funnel.isLoading, prev.data, ui.range]);
}

/* ── 14 · Top clients ──────────────────────────────────────────────────── */
export function useTopData() {
  const ui = useAnalyticsUi();
  const top = useTopClients(ui.range, 10);
  const pay = usePaymentSummary(ui.range);
  return useMemo(() => {
    const rows = top.data ?? [];
    const sum = rows.reduce((s, r) => s + r.totalXAF, 0);
    const all = pay.data?.current.totalXAF ?? 0;
    const name = (r: (typeof rows)[number]) => `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || 'Client';
    const ds: ChartDataset = {
      key: 'top',
      title: 'Top clients',
      figure: { label: `Les ${rows.length || 10} premiers`, value: int(sum), unit: 'XAF', note: all > 0 ? `${pct(sum / all)} des paiements` : undefined },
      columns: [{ key: 'rang', label: 'Rang' }, { key: 'client', label: 'Client' }, { key: 'paiements', label: 'Paiements' }, { key: 'volume', label: 'Volume (XAF)' }],
      rows: rows.map((r, i) => ({ rang: i + 1, client: name(r), paiements: r.opCount, volume: r.totalXAF })),
    };
    return { ds, rows, name, sum, loading: top.isLoading };
  }, [top.data, top.isLoading, pay.data]);
}

/* ── 15 · Pays ─────────────────────────────────────────────────────────── */
export function useCountriesData() {
  const dist = useClientCountryDistribution();
  return useMemo(() => {
    const all = dist.data ?? [];
    const total = all.reduce((s, r) => s + r.count, 0);
    const known = all.filter((r) => r.key !== 'unknown');
    const unknown = all.find((r) => r.key === 'unknown') ?? null;
    const head = known.slice(0, 5);
    const rest = known.slice(5);
    const others = rest.length ? { key: 'others', country: 'Autres pays', count: rest.reduce((s, r) => s + r.count, 0), share: total ? rest.reduce((s, r) => s + r.count, 0) / total : 0, n: rest.length } : null;
    const ds: ChartDataset = {
      key: 'pays',
      title: 'Pays',
      figure: { label: 'Tous les clients', value: int(total), unit: 'clients', note: `${head.length} pays${others ? ' + autres' : ''}${unknown ? ` · ${pct(unknown.share)} sans pays` : ''}` },
      columns: [{ key: 'pays', label: 'Pays' }, { key: 'clients', label: 'Clients' }, { key: 'part', label: 'Part (%)' }],
      rows: all.map((r) => ({ pays: r.country, clients: r.count, part: dec(r.share * 100) })),
    };
    return { ds, total, head, others, unknown, loading: dist.isLoading };
  }, [dist.data, dist.isLoading]);
}

/* ── 16 · Sources d'inscription ────────────────────────────────────────── */
export function useSourcesData() {
  const ui = useAnalyticsUi();
  const reg = useRegistrationSource(ui.range);
  const utm = useUtmSources(ui.range, 10);
  return useMemo(() => {
    const s = reg.data;
    const rows = utm.data ?? [];
    const ds: ChartDataset = {
      key: 'sources',
      title: 'Sources',
      figure: { label: 'Nouveaux clients', value: int(s?.totalNew ?? 0), note: 'Inscrits sur la période' },
      columns: [{ key: 'source', label: 'Source' }, { key: 'medium', label: 'Support' }, { key: 'campagne', label: 'Campagne' }, { key: 'clients', label: 'Clients' }],
      rows: [
        { source: 'Créés par l’équipe', medium: '', campagne: '', clients: s?.adminCreated ?? 0 },
        { source: 'Inscrits par l’app', medium: '', campagne: '', clients: s?.selfRegistered ?? 0 },
        ...rows.map((r) => ({ source: r.source, medium: r.medium === '(none)' ? '' : r.medium, campagne: r.campaign === '(none)' ? '' : r.campaign, clients: r.count })),
      ],
    };
    return { ds, s, utm: rows, loading: reg.isLoading || utm.isLoading };
  }, [reg.data, reg.isLoading, utm.data, utm.isLoading]);
}

/* ── 17 · Délais de traitement (dépôts) ────────────────────────────────── */
export function useDelaysData() {
  const ui = useAnalyticsUi();
  const time = useDepositProcessingTime(ui.range);
  const prev = useDepositProcessingTime(previousRange(ui.range));
  const list = usePeriodDeposits(ui.range.from.toISOString(), ui.range.to.toISOString());
  const status = useDepositStatusSummary(ui.range);
  return useMemo(() => {
    const med = time.data?.medianMinutes ?? null;
    const before = ui.range.compareToPrevious ? prev.data?.medianMinutes ?? null : null;
    const diff = med != null && before != null ? Math.round(before - med) : null;
    const buckets = durationBuckets(list.data ?? []);
    const medianBucket = (() => {
      if (med == null) return -1;
      return DURATION_BUCKETS.findIndex((b) => med < b.max);
    })();
    const pending = status.data ? status.data.pendingProof.count + status.data.pendingReview.count : null;
    const ds: ChartDataset = {
      key: 'delais',
      title: 'Délais de validation',
      figure: {
        label: 'Validation d’un dépôt · médiane',
        value: med != null && med < 60 ? int(med) : minutes(med),
        unit: med != null && med < 60 ? 'min' : undefined,
        delta: diff != null && diff !== 0 ? { tone: diff > 0 ? 'success' : 'danger', label: diff > 0 ? `${minutes(diff)} de moins` : `${minutes(-diff)} de plus` } : undefined,
        note: before != null ? `${minutes(before)} avant` : undefined,
      },
      columns: [{ key: 'tranche', label: 'Délai' }, { key: 'depots', label: 'Dépôts' }],
      rows: [
        ...DURATION_BUCKETS.map((b, i) => ({ tranche: b.label, depots: buckets[i] })),
        { tranche: 'Médiane (min)', depots: med ?? '' },
        { tranche: '9 sur 10 en moins de (min)', depots: time.data?.p90Minutes ?? '' },
        { tranche: 'Rejetés', depots: status.data?.rejected.count ?? '' },
        { tranche: 'En attente', depots: pending ?? '' },
      ],
      compare: true,
    };
    return { ds, med, p90: time.data?.p90Minutes ?? null, buckets, medianBucket, rejected: status.data?.rejected.count ?? null, pending, loading: time.isLoading };
  }, [time.data, time.isLoading, prev.data, list.data, status.data, ui.range]);
}

/* ── 18 · Équipe ───────────────────────────────────────────────────────── */
export function useTeamData() {
  const ui = useAnalyticsUi();
  const prod = useAdminProductivity(ui.range);
  return useMemo(() => {
    const rows = prod.data ?? [];
    const actions = rows.reduce((s, r) => s + r.totalActions, 0);
    const deposits = rows.reduce((s, r) => s + r.depositsValidated, 0);
    const payments = rows.reduce((s, r) => s + r.paymentsProcessed, 0);
    const ds: ChartDataset = {
      key: 'equipe',
      title: 'Équipe',
      figure: { label: 'Actions de l’équipe', value: int(actions), unit: 'actions', note: `${int(deposits)} dépôts validés · ${nPay(payments)}` },
      columns: [{ key: 'membre', label: 'Membre' }, { key: 'depots', label: 'Dépôts validés' }, { key: 'rejetes', label: 'Dépôts rejetés' }, { key: 'paiements', label: 'Paiements traités' }, { key: 'actions', label: 'Actions' }],
      rows: rows.map((r) => ({ membre: r.name || 'Membre', depots: r.depositsValidated, rejetes: r.depositsRejected, paiements: r.paymentsProcessed, actions: r.totalActions })),
    };
    return { ds, rows, actions, loading: prod.isLoading };
  }, [prod.data, prod.isLoading]);
}

/* ── 19 / 20 · Croissance ──────────────────────────────────────────────── */
export type GrowthSerie = 'paiements' | 'depots' | 'clients';

export function useGrowthData(mode: GrowthMode, serie: GrowthSerie) {
  const range = useMemo(() => buildGrowthRange(mode), [mode]);
  const clients = useClientGrowth(range);
  const deposits = useDepositVolumeReport(range);
  const payments = usePaymentVolumeReport(range);
  return useMemo(() => {
    const points: GrowthInput[] =
      serie === 'clients'
        ? (clients.data ?? []).map((p) => ({ bucket: p.bucket, value: p.newClients }))
        : ((serie === 'depots' ? deposits.data : payments.data)?.series ?? []).map((p) => ({ bucket: p.bucket, value: p.amountXAF }));
    const buckets = buildGrowthBuckets(points, range);
    const sum = summarizeGrowth(buckets);
    const money = serie !== 'clients';
    const fmt = (v: number) => int(v);
    const name = (iso: string, long = false) => (mode === 'week' ? buckets.find((b) => b.bucket === iso)?.label ?? '' : long ? monthLong(iso) : bucketText(iso, 'month'));
    const last = sum.lastComplete;
    const lastIdx = last ? buckets.findIndex((b) => b.bucket === last.bucket) : -1;
    const prevBucket = lastIdx > 0 ? buckets[lastIdx - 1] : null;
    const serieWord = serie === 'clients' ? 'nouveaux clients' : serie === 'depots' ? 'dépôts' : 'paiements';
    const label = last ? (mode === 'week' ? `Semaine dernière · ${name(last.bucket)}` : `${name(last.bucket, true)} · ${serieWord}`) : serieWord;
    const tag = last ? deltaTag(last.deltaPct) : undefined;
    const bars: BarDatum[] = buckets.map((b) => ({ label: mode === 'week' ? `${b.label} · ${dayMonth(b.bucket)}` : name(b.bucket, true), value: b.value, display: money ? `${fmt(b.value)} XAF` : fmt(b.value), current: b.isCurrent }));
    const ds: ChartDataset = {
      key: `croissance-${mode}-${serie}`,
      title: `Croissance · ${serie === 'clients' ? 'Clients' : serie === 'depots' ? 'Dépôts' : 'Paiements'}`,
      figure: { label, value: last ? fmt(last.value) : '—', unit: money ? 'XAF' : undefined, delta: tag, note: prevBucket ? `vs ${mode === 'month' ? name(prevBucket.bucket, true).toLowerCase() : name(prevBucket.bucket)}` : undefined },
      bars,
      barEdges: buckets.length ? [name(buckets[0].bucket), name(buckets[buckets.length - 1].bucket)] : undefined,
      columns: [{ key: 'periode', label: mode === 'week' ? 'Semaine' : 'Mois' }, { key: 'valeur', label: money ? 'Montant (XAF)' : 'Nouveaux clients' }, { key: 'variation', label: 'Variation (%)' }],
      rows: buckets.map((b) => ({ periode: mode === 'week' ? `${b.label} (${dayMonth(b.bucket)})` : name(b.bucket, true), valeur: b.value, variation: b.deltaPct != null && !b.isCurrent ? dec(b.deltaPct * 100) : '' })),
    };
    const loading = serie === 'clients' ? clients.isLoading : serie === 'depots' ? deposits.isLoading : payments.isLoading;
    return { ds, buckets, sum, bars, lastIdx, tag, name, money, fmt, loading };
  }, [mode, serie, range, clients.data, clients.isLoading, deposits.data, deposits.isLoading, payments.data, payments.isLoading]);
}

/* ── 05 · Comparer ─────────────────────────────────────────────────────── */
export function useCompareData(serie: GrowthSerie) {
  const ui = useAnalyticsUi();
  const r = ui.rangeFor('comparer');
  const prevR = useMemo(() => ({ ...previousRange(r), granularity: r.granularity }), [r]);
  const payCur = usePaymentVolumeReport(r);
  const payPrev = usePaymentVolumeReport(prevR);
  const depCur = useDepositVolumeReport(r);
  const depPrev = useDepositVolumeReport(prevR);
  const cliCur = useClientGrowth(r);
  const cliPrev = useClientGrowth(prevR);
  return useMemo(() => {
    const pick = (rep: { series: { amountXAF: number; opCount: number; bucket: string }[] } | undefined) => (rep?.series ?? []).map((p) => ({ value: p.amountXAF, count: p.opCount, bucket: p.bucket }));
    const cur = serie === 'clients' ? (cliCur.data ?? []).map((p) => ({ value: p.newClients, count: p.newClients, bucket: p.bucket })) : pick(serie === 'depots' ? depCur.data : payCur.data);
    const prev = serie === 'clients' ? (cliPrev.data ?? []).map((p) => ({ value: p.newClients, count: p.newClients, bucket: p.bucket })) : pick(serie === 'depots' ? depPrev.data : payPrev.data);
    const cumul = (xs: { value: number }[]) => { let s = 0; return xs.map((x) => (s += x.value)); };
    const curC = cumul(cur);
    const prevC = cumul(prev);
    const total = curC[curC.length - 1] ?? 0;
    const prevTotal = prevC[prevC.length - 1] ?? 0;
    const count = cur.reduce((s, x) => s + x.count, 0);
    const prevCount = prev.reduce((s, x) => s + x.count, 0);
    const d = delta(total, prevTotal);
    const money = serie !== 'clients';
    const word = serie === 'clients' ? 'Nouveaux clients' : serie === 'depots' ? 'Dépôts' : 'Paiements';
    const ds: ChartDataset = {
      key: `comparer-${serie}`,
      title: `Comparer · ${word}`,
      figure: { label: `${word} cumulés · ${periodLabel(ui.range)}`, value: deltaTag(d)?.label ?? '—', note: `${int(total)} contre ${int(prevTotal)}${money ? ' XAF' : ''}` },
      columns: [{ key: 'jour', label: STEP_NOUN[r.granularity] }, { key: 'actuel', label: 'Cumul actuel' }, { key: 'precedent', label: 'Cumul précédent' }],
      rows: curC.map((v, i) => ({ jour: `${STEP_NOUN[r.granularity]} ${i + 1}`, actuel: v, precedent: prevC[i] ?? '' })),
    };
    const loading = serie === 'clients' ? cliCur.isLoading : serie === 'depots' ? depCur.isLoading : payCur.isLoading;
    return {
      ds, curC, prevC, cur, prev, total, prevTotal, count, prevCount, money, granularity: r.granularity,
      curEdges: edges(r), prevEdges: edges(prevR),
      avg: count ? total / count : 0, prevAvg: prevCount ? prevTotal / prevCount : 0,
      loading,
    };
  }, [serie, payCur.data, payPrev.data, depCur.data, depPrev.data, cliCur.data, cliPrev.data, payCur.isLoading, depCur.isLoading, cliCur.isLoading, r, prevR, ui.range]);
}

/* ── 21 · Trésorerie ───────────────────────────────────────────────────── */
export type TreasuryCurve = 'wac' | 'achat' | 'vente';

export function useTreasuryData() {
  const ui = useAnalyticsUi();
  const fromIso = ui.range.from.toISOString();
  const toIso = ui.range.to.toISOString();
  const dash = useTreasuryDashboard(fromIso, toIso);
  const wac = useWacEvolution(fromIso, toIso);
  const flow = useUsdtFlowEvolution(fromIso, toIso);
  return useMemo(() => {
    const t = dash.data;
    const client = t?.client_rate.weighted_avg_rate_xaf_per_cny ?? null;
    const revient = t?.taux_de_revient_xaf_per_cny ?? null;
    const marge = client != null && revient != null ? client - revient : null;
    const curves: Record<TreasuryCurve, { at: string; v: number }[]> = {
      wac: (wac.data ?? []).filter((p) => new Date(p.at) >= ui.range.from).map((p) => ({ at: p.at, v: p.wac })),
      achat: (flow.data?.purchases ?? []).map((p) => ({ at: p.at, v: p.rate })),
      vente: (flow.data?.sales ?? []).map((p) => ({ at: p.at, v: p.rate })),
    };
    const ds: ChartDataset = {
      key: 'tresorerie',
      title: 'Trésorerie',
      figure: { label: 'Bénéfice de la période', value: int(t?.benefit_total_xaf ?? 0), unit: 'XAF', note: marge != null ? `Marge ${dec(marge, 2)} XAF par ¥ livré` : undefined },
      columns: [{ key: 'libelle', label: 'Libellé' }, { key: 'valeur', label: 'Valeur' }],
      rows: t ? [
        { libelle: 'Bénéfice (XAF)', valeur: t.benefit_total_xaf },
        { libelle: 'Taux de revient (XAF / ¥)', valeur: revient != null ? dec(revient, 2) : '' },
        { libelle: 'Taux client (XAF / ¥)', valeur: client != null ? dec(client, 2) : '' },
        { libelle: 'Marge (XAF / ¥)', valeur: marge != null ? dec(marge, 2) : '' },
        { libelle: 'USDT achetés', valeur: dec(t.purchases.total_usdt, 2) },
        { libelle: 'USDT vendus', valeur: dec(t.sales.total_usdt, 2) },
        { libelle: 'Taux d’achat moyen (XAF / USDT)', valeur: dec(t.purchases.weighted_avg_rate_xaf_per_usdt, 2) },
        { libelle: 'Taux de vente moyen (¥ / USDT)', valeur: dec(t.sales.weighted_avg_rate_cny_per_usdt, 4) },
        { libelle: 'Coût du stock (XAF / USDT)', valeur: dec(t.wac_usdt_current, 2) },
        { libelle: 'Stock USDT', valeur: dec(t.stock_usdt, 2) },
      ] : [],
    };
    return { ds, t, client, revient, marge, curves, loading: dash.isLoading, error: dash.isError };
  }, [dash.data, dash.isLoading, dash.isError, wac.data, flow.data, ui.range]);
}

export function useCounterpartiesData() {
  const ui = useAnalyticsUi();
  const fromIso = ui.range.from.toISOString();
  const toIso = ui.range.to.toISOString();
  const suppliers = useTopCounterparties('usdt_supplier', fromIso, toIso, 10);
  const buyers = useTopCounterparties('cny_buyer', fromIso, toIso, 10);
  return { suppliers, buyers };
}

/* ── 01 · Alertes ──────────────────────────────────────────────────────── */
export function useAlerts() {
  return useDashboardAlerts();
}
