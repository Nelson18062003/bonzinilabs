/**
 * Le calcul du simulateur et de la cotation — repris tel quel du simulateur
 * de l'ordinateur (RateQuoteSimulator) : une seule valeur saisie et le côté
 * où elle vit, l'autre côté toujours dérivé ; `calculateFinalRate` /
 * `convertCNYtoXAF` ; un taux personnalisé (négocié) remplace pays et palier.
 * Le texte à copier est celui de l'ordinateur, en français ou en anglais.
 */
import { calculateFinalRate, convertCNYtoXAF, getBaseRate } from '@/lib/rateCalculation';
import { QUOTE_TEXT, quoteDate, quoteNumber } from '@/lib/rateQuote';
import { CONTACT_PHONE_CM } from '@/lib/companyContacts';
import type { FlyerLang } from '@/lib/rateFlyer';
import type { DailyRate, PaymentMethodKey, RateAdjustment } from '@/types/rates';

export type Side = 'xaf' | 'cny';

export interface QuoteInput {
  amount: number;
  side: Side;
  method: PaymentMethodKey;
  country: string;
  /** Taux personnalisé (¥ pour 1 M XAF) ; 0 ou NaN = taux automatique. */
  customRate: number;
}

export interface QuoteResult {
  amountXAF: number;
  amountCNY: number;
  finalRate: number;
  custom: boolean;
  /** Le calcul automatique (même quand un taux personnalisé le remplace). */
  auto: { baseRate: number; countryPct: number; tierPct: number; tierKey: string; finalRate: number } | null;
}

export function computeQuote(activeRate: DailyRate | null, adjustments: readonly RateAdjustment[], q: QuoteInput): QuoteResult | null {
  if (!(q.amount > 0) || !Number.isSafeInteger(q.amount)) return null;
  const countryAdjs = adjustments.filter((a) => a.type === 'country');
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');
  let auto: QuoteResult['auto'] = null;
  let autoXAF = 0;
  let autoCNY = 0;
  if (activeRate) {
    const baseRate = getBaseRate(activeRate, q.method);
    const countryPct = countryAdjs.find((c) => c.key === q.country)?.percentage ?? 0;
    const amountXAF = q.side === 'xaf' ? q.amount : convertCNYtoXAF(q.amount, baseRate, countryPct, tierAdjs);
    if (amountXAF > 0) {
      const calc = calculateFinalRate(baseRate, countryPct, amountXAF, tierAdjs);
      auto = { baseRate, countryPct, tierPct: tierAdjs.find((t) => t.key === calc.tierKey)?.percentage ?? 0, tierKey: calc.tierKey, finalRate: calc.finalRate };
      autoXAF = amountXAF;
      autoCNY = q.side === 'cny' ? q.amount : calc.amountCNY;
    }
  }
  const custom = Number.isFinite(q.customRate) && q.customRate > 0;
  if (custom) {
    const perUnit = q.customRate / 1_000_000;
    const amountXAF = q.side === 'xaf' ? q.amount : Math.round(q.amount / perUnit);
    const amountCNY = q.side === 'cny' ? q.amount : Math.round(amountXAF * perUnit * 100) / 100;
    return { amountXAF, amountCNY, finalRate: q.customRate, custom: true, auto };
  }
  if (!auto) return null;
  return { amountXAF: autoXAF, amountCNY: autoCNY, finalRate: auto.finalRate, custom: false, auto };
}

export const TIER_SHORT: Record<string, string> = {
  t3: '1 000 000 XAF et plus',
  t2: '400 000 à 999 999 XAF',
  t1: 'Moins de 400 000 XAF',
};

const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Le texte WhatsApp de la cotation (même texte que l'ordinateur). */
export function quoteText(r: QuoteResult, method: PaymentMethodKey, methodLabel: string, lang: FlyerLang): string {
  const now = new Date();
  const t = QUOTE_TEXT[lang];
  const n = (v: number) => quoteNumber(v, lang);
  const colon = lang === 'en' ? ':' : ' :';
  const lines = lang === 'en'
    ? [
      `🧾 Bonzini quote — ${quoteDate(now, 'en')}`,
      `You pay${colon} ${n(r.amountXAF)} XAF`,
      `Your supplier receives${colon} ¥${n(r.amountCNY)} (${t.methods[method]})`,
      `Rate${colon} ¥${n(r.finalRate)} / 1M XAF — valid today`,
      `WhatsApp${colon} ${CONTACT_PHONE_CM} · bonzinilabs.com`,
    ]
    : [
      `🧾 Cotation Bonzini — ${FR_DAYS[now.getDay()]} ${now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
      `Vous payez${colon} ${n(r.amountXAF)} XAF`,
      `Votre fournisseur reçoit${colon} ¥${n(r.amountCNY)} (${methodLabel})`,
      `Taux${colon} ¥${n(r.finalRate)} / 1M XAF — valable aujourd'hui`,
      `WhatsApp${colon} ${CONTACT_PHONE_CM} · bonzinilabs.com`,
    ];
  return lines.join('\n');
}

/** Paramètres d'URL de la cotation : ce qu'on a simulé, relu à l'ouverture. */
export function quoteSearch(q: QuoteInput): string {
  const p = new URLSearchParams({ a: String(q.amount), s: q.side, m: q.method, c: q.country });
  if (Number.isFinite(q.customRate) && q.customRate > 0) p.set('r', String(q.customRate));
  return p.toString();
}

const METHODS: PaymentMethodKey[] = ['alipay', 'wechat', 'virement', 'cash'];

export function readQuote(params: URLSearchParams): QuoteInput {
  const a = Number(params.get('a'));
  const m = params.get('m') as PaymentMethodKey | null;
  const r = Number(String(params.get('r') ?? '').replace(',', '.'));
  return {
    amount: Number.isSafeInteger(a) && a > 0 ? a : 1_000_000,
    side: params.get('s') === 'cny' ? 'cny' : 'xaf',
    method: m && METHODS.includes(m) ? m : 'alipay',
    country: params.get('c') || params.get('country') || 'cameroun',
    customRate: Number.isFinite(r) && r > 0 ? r : NaN,
  };
}
