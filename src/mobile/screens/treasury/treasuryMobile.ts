/**
 * Trésorerie mobile v2 — la partie SANS composant (chemins, période
 * partagée, dates, calculs de lecture). Les écrans sont dans les .tsx
 * voisins ; les briques visuelles dans `parts.tsx`.
 *
 * Les données ne changent pas : mêmes hooks (`@/hooks/useTreasury`), mêmes
 * RPC, mêmes formats que la version ordinateur (`@/desktop/screens/treasury`),
 * qu'on réutilise sans la modifier.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ElementType, type RefObject } from 'react';
import { toast } from 'sonner';
import { captureNodePng, copyNodePng, prewarmFontEmbedCss } from '@/lib/nodeImage';
import { receiptFilename, type ReceiptData } from '@/desktop/screens/treasury/receiptData';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardCheck, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import {
  buildCustomRange,
  buildRangeFromPreset,
  formatBusinessDay,
  toSupabaseBounds,
  PRESET_LABELS,
  type DateRange,
  type PresetId,
} from '@/lib/analytics/dateRange';
import { triggerDownload } from '@/lib/nodeImage';
import { useTreasuryOperations, type LedgerEntry, type TreasuryAccountBalance, type TreasuryDashboard } from '@/hooks/useTreasury';
import { treasuryPaths, TREASURY_ROOT, type CounterpartyFilter, type OperationFilter } from '@/desktop/screens/treasury/treasuryNav';
import { fmtNum, type TreasuryCurrency } from '@/desktop/screens/treasury/treasuryFormat';

/* ── Chemins ──────────────────────────────────────────────────────────────
 * Ceux de l'ordinateur (`treasuryPaths`), plus les parcours propres au
 * téléphone. Chacun reste lisible par la coquille desktop : un lien ouvert
 * sur ordinateur mène à la rubrique la plus proche. */
export const tp = {
  ...treasuryPaths,
  operationsQ: (filter: OperationFilter = 'all', q?: string) => {
    const base = treasuryPaths.operations(filter);
    if (!q) return base;
    return `${base}${base.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;
  },
  adjust: (accountId: string) => `${TREASURY_ROOT}/accounts/${accountId}/adjust`,
  count: (accountId: string) => `${TREASURY_ROOT}/accounts/${accountId}/inventory`,
  ledgerOf: (accountId?: string | null, cur?: TreasuryCurrency) => {
    const q = new URLSearchParams();
    if (cur) q.set('cur', cur);
    if (accountId) q.set('account', accountId);
    const s = q.toString();
    return s ? `${treasuryPaths.ledger}?${s}` : treasuryPaths.ledger;
  },
  inventoriesOf: (accountId?: string | null) => (accountId ? `${treasuryPaths.inventory}?account=${accountId}` : treasuryPaths.inventory),
  counterpartyEdit: (id: string) => `${TREASURY_ROOT}/counterparties/${id}/edit`,
  counterpartyNew: (type: CounterpartyFilter) => `${treasuryPaths.counterparties(type)}${type === 'usdt_supplier' ? '?' : '&'}new=1`,
} as const;

/* ── La période partagée ──────────────────────────────────────────────────
 * Comme sur ordinateur, une seule période (le mois en cours par défaut)
 * sert aux Opérations, aux Contreparties, aux Inventaires et à l'Analyse.
 * Le téléphone n'a pas de coquille commune : la période vit dans un petit
 * magasin de module, et survit au passage d'un écran à l'autre. La plage
 * est calculée UNE fois au choix : ses bornes restent stables (clé de
 * requête), au lieu de bouger à chaque rendu. */
export interface PeriodState {
  preset: PresetId;
  range: DateRange;
  fromIso: string;
  toIso: string;
}

function makePeriod(preset: PresetId, from?: string, to?: string): PeriodState {
  const range = preset === 'custom' && from && to ? buildCustomRange(from, to) : buildRangeFromPreset(preset === 'custom' ? 'this_month' : preset);
  const { fromISO, toISO } = toSupabaseBounds(range);
  return { preset: range.preset, range, fromIso: fromISO, toIso: toISO };
}

let period: PeriodState = makePeriod('this_month');
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setPeriodPreset(preset: PresetId) {
  period = makePeriod(preset);
  listeners.forEach((l) => l());
}
export function setPeriodCustom(from: string, to: string) {
  period = makePeriod('custom', from, to);
  listeners.forEach((l) => l());
}

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/** « Octobre 2026 » pour un mois entier, sinon le libellé du préréglage ou les deux dates. */
export function periodLabel(p: PeriodState): string {
  if (p.preset === 'this_month' || p.preset === 'last_month') {
    // `from` est minuit à Douala (23 h UTC la veille) : on lit le mois à Douala.
    const d = new Date(p.range.from.getTime() + 3600_000);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  if (p.preset === 'custom') return `${formatBusinessDay(p.range.from)} → ${formatBusinessDay(p.range.to)}`;
  return PRESET_LABELS[p.preset];
}

/** Le nom court du mois de la période (« octobre »), pour « Bénéfice · octobre ». */
export function periodNoun(p: PeriodState): string {
  if (p.preset === 'this_month' || p.preset === 'last_month') return periodLabel(p).split(' ')[0].toLowerCase();
  return periodLabel(p).toLowerCase();
}

export function usePeriod(): PeriodState & { label: string } {
  const p = useSyncExternalStore(subscribe, () => period, () => period);
  return useMemo(() => ({ ...p, label: periodLabel(p) }), [p]);
}

/** Des bornes fixes (les N derniers jours), calculées une fois au montage. */
export function useFixedWindow(preset: PresetId) {
  return useMemo(() => {
    const { fromISO, toISO } = toSupabaseBounds(buildRangeFromPreset(preset));
    return { fromIso: fromISO, toIso: toISO };
  }, [preset]);
}

/** Les opérations des 90 derniers jours : récents, derniers taux, noms des origines. */
export function useRecentOperations() {
  const w = useFixedWindow('last_90_days');
  return useTreasuryOperations(w.fromIso, w.toIso);
}

/* ── Dates, à l'heure de Douala ─────────────────────────────────────────── */
const TZ = 'Africa/Douala';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

/** Le jour civil à Douala (« 2026-10-21 »). */
export function bizDay(iso: string | Date): string {
  return dayKey(typeof iso === 'string' ? new Date(iso) : iso);
}

/** Les jours civils (Douala) d'une période, bornés à aujourd'hui. */
export function daysOf(range: DateRange, now = new Date()): string[] {
  const out: string[] = [];
  const end = Math.min(range.to.getTime(), now.getTime());
  for (let t = range.from.getTime(); t <= end && out.length < 800; t += 86_400_000) {
    const k = dayKey(new Date(t));
    if (out[out.length - 1] !== k) out.push(k);
  }
  const last = dayKey(new Date(end));
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** « 22 sept. » à partir d'un jour « 2026-09-22 ». */
export function shortDay(key: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`));
}

/** « 10:12 ». */
export function hm(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** « Aujourd'hui », « Hier », « 19 oct. ». */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const k = dayKey(d);
  if (k === dayKey(now)) return 'Aujourd’hui';
  if (k === dayKey(new Date(now.getTime() - 86_400_000))) return 'Hier';
  const sameYear = k.slice(0, 4) === dayKey(now).slice(0, 4);
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
}

/** « Aujourd'hui, 10:12 », « Hier, 17:30 », « 19 oct., 11:05 ». */
export function whenShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${dayLabel(iso)}, ${hm(iso)}`;
}

/** « 21 oct. 2026, 10:12 » — pour une fiche. */
export function whenFull(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  return `${day}, ${hm(iso)}`;
}

/** Jours écoulés depuis une date (0 = aujourd'hui), à Douala. */
export function daysSince(iso: string, now = new Date()): number {
  const a = Date.parse(`${dayKey(new Date(iso))}T00:00:00Z`);
  const b = Date.parse(`${dayKey(now)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** « il y a 3 jours », « hier », « aujourd'hui ». */
export function agoLabel(iso: string | null | undefined): string {
  if (!iso) return 'jamais';
  const n = daysSince(iso);
  if (n <= 0) return 'aujourd’hui';
  if (n === 1) return 'hier';
  return `il y a ${n} jours`;
}

/** Les éléments groupés par jour, dans l'ordre reçu. */
export function groupByDay<T>(items: T[], iso: (t: T) => string): Array<{ key: string; label: string; items: T[] }> {
  const out: Array<{ key: string; label: string; items: T[] }> = [];
  for (const it of items) {
    const at = iso(it);
    const key = dayKey(new Date(at));
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(it);
    else out.push({ key, label: dayLabel(at), items: [it] });
  }
  return out;
}

/* ── Montants ───────────────────────────────────────────────────────────── */
/** L'USDT sans « ,00 » quand il est rond (« 5 000 »), sinon au centime (« 30 350,50 »). */
export function fmtUsdt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return fmtNum(n, Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2);
}

/** Un montant dans SA devise : XAF entier, USDT et CNY au centime. */
export function fmtCur(n: number | null | undefined, cur: string | null | undefined): string {
  if (cur === 'XAF') return fmtNum(n, 0);
  if (cur === 'USDT') return fmtUsdt(n);
  return fmtNum(n, 2);
}

/** « ¥ 41 400 » / « 1 275 000 XAF » / « 8 000 USDT ». */
export function withCur(n: number | null | undefined, cur: string | null | undefined, decimals?: number): string {
  const v = decimals !== undefined ? fmtNum(n, decimals) : cur === 'CNY' ? fmtNum(n, Number.isInteger(n ?? 0) ? 0 : 2) : fmtCur(n, cur);
  if (cur === 'CNY') return `¥ ${v}`;
  return `${v} ${cur ?? ''}`.trim();
}

/** Le nom court d'un compte pour une ligne serrée : « UBA Cameroun » → « UBA », « Afriland First Bank » → « Afriland ». */
export function shortAccount(label: string | null | undefined): string {
  const l = (label ?? '—').trim();
  if (/^caisse/i.test(l)) return l;
  const short = l.replace(/\s+(First Bank|Cameroun|Cameroon|Douala|Guangzhou|Bonzini)$/i, '');
  return short || l;
}

/** Signe typographique (« − » et non « - »). */
export function signed(n: number, text: string): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${text}`;
}

/* ── Soldes après chaque écriture ─────────────────────────────────────────
 * Les écritures arrivent de la plus récente à la plus ancienne et forment un
 * bloc continu dans le temps : le solde après une écriture = le solde
 * actuel du compte − les écritures PLUS RÉCENTES de ce même compte. Vrai
 * aussi dans une liste qui mêle plusieurs comptes (grand livre). */
export function balancesAfter(entries: LedgerEntry[], balances: TreasuryAccountBalance[] | undefined): Map<string, number> {
  const now = new Map<string, number>((balances ?? []).filter((b) => b.id).map((b) => [b.id as string, Number(b.balance ?? 0)]));
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!e.account_id || !now.has(e.account_id)) continue;
    const cur = now.get(e.account_id)!;
    out.set(e.id, cur);
    now.set(e.account_id, cur - Number(e.amount));
  }
  return out;
}

/* ── Une écriture, dite en clair ────────────────────────────────────────── */
/** Le libellé d'une écriture, avec le nom de la contrepartie quand on le connaît. */
export function entryTitle(e: LedgerEntry, names: Map<string, string>): string {
  const name = e.source_id ? names.get(e.source_id) : undefined;
  if (e.entry_kind === 'void') return 'Contre-passation';
  if (e.source_table === 'usdt_purchase') return name ? `Achat · ${name}` : 'Achat USDT';
  if (e.source_table === 'usdt_sale') return name ? `Vente · ${name}` : 'Vente USDT';
  if (e.source_table === 'inventory_snapshot') return 'Inventaire · écart';
  return Number(e.amount) >= 0 ? 'Ajustement · apport' : 'Ajustement · retrait';
}

/** La nature seule (grand livre) : « Achat USDT », « Contre-passation »… */
export function entryNature(e: LedgerEntry): string {
  if (e.entry_kind === 'void') return 'Contre-passation';
  if (e.source_table === 'usdt_purchase') return 'Achat USDT';
  if (e.source_table === 'usdt_sale') return 'Vente USDT';
  if (e.source_table === 'inventory_snapshot') return 'Inventaire · écart';
  return 'Ajustement';
}

export function entryIcon(e: LedgerEntry): ElementType {
  if (e.entry_kind === 'void') return Undo2;
  if (e.source_table === 'inventory_snapshot') return ClipboardCheck;
  if (e.source_table === 'manual_adjustment') return SlidersHorizontal;
  return Number(e.amount) >= 0 ? ArrowDownToLine : ArrowUpFromLine;
}

/** Les noms des contreparties des opérations récentes, par identifiant d'opération. */
export function useOriginNames(): Map<string, string> {
  const ops = useRecentOperations();
  return useMemo(
    () => new Map((ops.data ?? []).map((o) => (o.kind === 'purchase' ? [o.id, o.supplier?.display_name ?? '—'] : [o.id, o.buyer?.display_name ?? '—']))),
    [ops.data],
  );
}

/* ── Le nom d'un membre de l'équipe (qui a annulé) ─────────────────────── */
export function useStaffName(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['treasury', 'staff-name', userId],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('user_roles').select('first_name, last_name').eq('user_id', userId!).maybeSingle();
      if (error) throw error;
      return data ? [data.first_name, data.last_name].filter(Boolean).join(' ') || null : null;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

/* ── Semaines d'une période (graphiques d'analyse) ──────────────────────── */
export interface WeekBucket {
  label: string;
  fromIso: string;
  toIso: string;
  current: boolean;
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Les semaines (lundi → dimanche, heure de Douala) qui touchent la période,
 * bornées à la période, les `max` dernières. La semaine en cours est marquée.
 */
export function weeksOf(range: DateRange, max = 8, now = new Date()): WeekBucket[] {
  const H = 3600_000;
  const start = range.from.getTime();
  const end = Math.min(range.to.getTime(), now.getTime());
  if (end <= start) return [];
  // Le lundi 00:00 (Douala) de la semaine de `end`.
  const endBiz = new Date(end + H);
  const dow = endBiz.getUTCDay() || 7;
  let monday = Date.UTC(endBiz.getUTCFullYear(), endBiz.getUTCMonth(), endBiz.getUTCDate() - (dow - 1)) - H;
  const out: WeekBucket[] = [];
  while (out.length < max && monday + 7 * 86_400_000 > start) {
    const from = Math.max(monday, start);
    const to = Math.min(monday + 7 * 86_400_000 - 1, range.to.getTime());
    out.unshift({
      label: `S${isoWeek(new Date(monday + H))}`,
      fromIso: new Date(from).toISOString(),
      toIso: new Date(to).toISOString(),
      current: now.getTime() >= monday && now.getTime() < monday + 7 * 86_400_000,
    });
    monday -= 7 * 86_400_000;
  }
  return out;
}

/** `get_treasury_dashboard` sur chaque semaine : le bénéfice semaine par semaine (même RPC, même clé). */
export function useWeeklyDashboards(weeks: WeekBucket[]) {
  return useQueries({
    queries: weeks.map((w) => ({
      queryKey: ['treasury', 'dashboard', w.fromIso, w.toIso],
      queryFn: async () => {
        const { data, error } = await supabaseAdmin.rpc('get_treasury_dashboard', { p_from_date: w.fromIso, p_to_date: w.toIso });
        if (error) throw error;
        const result = data as unknown as TreasuryDashboard & { error?: string };
        if (!result?.success) throw new Error(result?.error ?? 'Tableau de bord indisponible');
        return result;
      },
      staleTime: 30_000,
    })),
  });
}

/* ── Partager une image ───────────────────────────────────────────────────
 * Le partage natif quand le téléphone sait partager un fichier (l'app
 * BONZINI HQ l'intercepte), sinon un téléchargement. */
export async function shareOrDownload(dataUrl: string, filename: string): Promise<'shared' | 'downloaded'> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
  }
  triggerDownload(dataUrl, filename);
  return 'downloaded';
}

/* ── Le reçu : copier l'image, télécharger ──────────────────────────────── */
export interface ReceiptActions {
  busy: 'copy' | 'download' | null;
  copy: () => Promise<void>;
  download: () => Promise<void>;
}

export function useReceiptActions(target: RefObject<HTMLDivElement>, data: ReceiptData | null): ReceiptActions {
  const [busy, setBusy] = useState<'copy' | 'download' | null>(null);
  const warmed = useRef(false);
  useEffect(() => {
    if (!warmed.current && target.current) {
      warmed.current = true;
      prewarmFontEmbedCss(target.current);
    }
  });
  const copy = useCallback(async () => {
    if (busy || !target.current || !data) return;
    setBusy('copy');
    try {
      const outcome = await copyNodePng(target.current, receiptFilename(data), { pixelRatio: 2, backgroundColor: '#ffffff' });
      toast.success(outcome === 'copied' ? 'Reçu copié' : 'Reçu téléchargé');
    } catch {
      toast.error('Impossible de copier le reçu');
    } finally {
      setBusy(null);
    }
  }, [busy, target, data]);
  const download = useCallback(async () => {
    if (busy || !target.current || !data) return;
    setBusy('download');
    try {
      triggerDownload(await captureNodePng(target.current, { pixelRatio: 2, backgroundColor: '#ffffff' }), receiptFilename(data));
    } catch {
      toast.error('Impossible de télécharger le reçu');
    } finally {
      setBusy(null);
    }
  }, [busy, target, data]);
  return { busy, copy, download };
}

/** Revenir en arrière, ou à `fallback` quand l'écran a été ouvert par un lien direct. */
export function useGoBack(fallback: string = TREASURY_ROOT) {
  const navigate = useNavigate();
  return useCallback(() => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

/* ── Motif ──────────────────────────────────────────────────────────────── */
export const REASON_MIN = 10;
