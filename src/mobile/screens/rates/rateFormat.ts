/**
 * Module Taux (refonte v2) — les fonctions de mise en forme, à part des
 * composants (parts.tsx) pour que les fichiers .tsx n'exportent que des
 * composants.
 */
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import { deriveCountryRates, type MethodRates } from '@/lib/countryRates';

/** Une ligne « étiquette / avant → après » (même forme que `KV` du kit). */
export interface RateKV { label: string; before?: string; value: string }

/* ── Nombres ─────────────────────────────────────────────────────────── */

/** « 10 838 » — entier, espace insécable (l'espace fine disparaît en gros corps). */
export function nb(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return r < 0 ? `−${s}` : s;
}

/** « 10 675,43 » — décimales à la française, `d` au plus. */
export function dec(n: number, d = 2, min = 0): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: d }).replace(/\u202F/g, '\u00A0');
}

/** « +26 », « −5 », « 0 ». */
export function signed(n: number): string {
  const r = Math.round(n);
  if (r === 0) return '0';
  return `${r > 0 ? '+' : '−'}${nb(Math.abs(r))}`;
}

/* ── Dates ───────────────────────────────────────────────────────────── */

export function hm(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** « Aujourd'hui », « Hier », « 20 oct. ». */
export function dayLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, now)) return 'Aujourd’hui';
  if (sameDay(d, y)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

/** « Aujourd'hui, 08:00 », « 20 oct., 08:05 ». */
export function dayTime(iso: string | Date): string {
  return `${dayLabel(iso)}, ${hm(iso)}`;
}

/* ── Méthodes ────────────────────────────────────────────────────────── */

export const METHOD_ORDER: PaymentMethodKey[] = ['alipay', 'wechat', 'virement', 'cash'];
export const METHOD_NAME: Record<PaymentMethodKey, string> = { alipay: 'Alipay', wechat: 'WeChat Pay', virement: 'Virement', cash: 'Cash' };
export const METHOD_SHORT: Record<PaymentMethodKey, string> = { alipay: 'Alipay', wechat: 'WeChat', virement: 'Virement', cash: 'Cash' };

export interface RateGroup {
  key: string;
  methods: PaymentMethodKey[];
  label: string;
  value: number;
  prev?: number;
}

/** Les lignes d'un jeu de taux : Alipay et WeChat réunis quand ils sont égaux (comme sur le flyer). */
export function rateGroups(values: MethodRates, prev?: MethodRates | null): RateGroup[] {
  const out: RateGroup[] = [];
  const merged = values.alipay === values.wechat && (!prev || prev.alipay === prev.wechat);
  if (merged) {
    out.push({ key: 'alipay', methods: ['alipay', 'wechat'], label: 'Alipay · WeChat', value: values.alipay, prev: prev?.alipay });
  } else {
    out.push({ key: 'alipay', methods: ['alipay'], label: 'Alipay', value: values.alipay, prev: prev?.alipay });
    out.push({ key: 'wechat', methods: ['wechat'], label: 'WeChat Pay', value: values.wechat, prev: prev?.wechat });
  }
  out.push({ key: 'virement', methods: ['virement'], label: 'Virement', value: values.virement, prev: prev?.virement });
  out.push({ key: 'cash', methods: ['cash'], label: 'Cash', value: values.cash, prev: prev?.cash });
  return out;
}

/** Repères « ronds » pour l'axe d'une courbe (3 ou 4 valeurs). */
export function niceTicks(values: number[], count = 3): number[] {
  const v = values.filter(Number.isFinite);
  if (!v.length) return [];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  if (hi === lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.ceil(lo / step) * step;
  const out: number[] = [];
  for (let t = start; t <= hi + 1e-9; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

/** L'avant → après des taux d'un pays quand son écart passe de `from` à `to`. */
export function countryRows(rate: DailyRate | null, from: number, to: number): RateKV[] {
  if (!rate) return [];
  return rateGroups(deriveCountryRates(rate, to), deriveCountryRates(rate, from)).map((g) => ({
    label: g.label,
    before: g.prev != null && g.prev !== g.value ? nb(g.prev) : undefined,
    value: nb(g.value),
  }));
}

/** « du Gabon », « du Tchad », « de la Centrafrique », « du Congo », « de la Guinée Équatoriale ». */
export function elision(label: string): string {
  const fem = /^(Centrafrique|Guinée)/.test(label);
  return fem ? `de la ${label}` : `du ${label}`;
}
