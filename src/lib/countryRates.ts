/**
 * Taux par pays — la couche « Gabon » du module Taux.
 *
 * Le Cameroun est la référence : ce sont ses quatre taux que l'équipe publie
 * (`daily_rates`). Chaque autre pays n'a PAS de taux propre en base : il a un
 * pourcentage d'ajustement (`rate_adjustments`, type `country`), que la RPC
 * `calculate_final_rate` applique en facteur `(1 + c)` aux taux publiés. Ce
 * module dérive, côté client, exactement les mêmes taux — pour les afficher
 * « pour 1 000 000 XAF » (palier ≥ 1 M = référence, 0 %) et les mettre sur un
 * flyer par pays. Modifier le pourcentage ici ou dans « Réglages » revient au
 * même : c'est la même ligne, la même RPC (`update_rate_adjustment`).
 */
import { COUNTRIES, PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate, PaymentMethodKey, RateAdjustment, RateCountryKey } from '@/types/rates';
import { calculateFinalRate } from './rateCalculation';

export const REFERENCE_COUNTRY_KEY: RateCountryKey = 'cameroun';

/** Paliers proposés pour l'écart d'un pays vs la référence (en %). */
export const COUNTRY_ADJUSTMENT_PRESETS: readonly number[] = [0, -0.5, -1, -1.5, -2];

export type MethodRates = Record<PaymentMethodKey, number>;

export interface CountryRateSheet {
  key: string;
  label: string;
  iso: string | null;
  /** Écart vs référence, en % (0 pour la référence). */
  percentage: number;
  isReference: boolean;
  /** Id de la ligne `rate_adjustments` — pour la modifier. */
  adjustmentId: string;
  /** Taux dérivés, CNY pour 1 000 000 XAF, arrondis comme la RPC (2 déc.). */
  rates: MethodRates;
}

export function countryMeta(key: string): { label: string; iso: string | null } {
  const found = COUNTRIES.find((c) => c.key === key);
  return found ? { label: found.label, iso: found.iso } : { label: key, iso: null };
}

/** Les quatre taux de base d'une publication, indexés par méthode. */
export function baseMethodRates(rate: DailyRate): MethodRates {
  return {
    cash: Number(rate.rate_cash) || 0,
    alipay: Number(rate.rate_alipay) || 0,
    wechat: Number(rate.rate_wechat) || 0,
    virement: Number(rate.rate_virement) || 0,
  };
}

/**
 * Taux d'un pays pour 1 000 000 XAF : base × (1 + pct/100), palier ≥ 1 M
 * (0 %). Même arrondi que `calculateFinalRate` / la RPC.
 */
export function deriveCountryRates(rate: DailyRate, percentage: number): MethodRates {
  const base = baseMethodRates(rate);
  const out = {} as MethodRates;
  for (const pm of PAYMENT_METHODS) {
    out[pm.key] = base[pm.key] > 0
      ? calculateFinalRate(base[pm.key], percentage, 1_000_000, []).finalRate
      : 0;
  }
  return out;
}

/**
 * Une fiche par pays connu des ajustements, référence en tête puis
 * `sort_order`. Sans publication active, les taux valent 0 (l'UI le dit).
 */
export function buildCountryRateSheets(
  rate: DailyRate | null | undefined,
  adjustments: readonly RateAdjustment[],
): CountryRateSheet[] {
  const countries = adjustments
    .filter((a) => a.type === 'country')
    .slice()
    .sort((a, b) => Number(b.is_reference) - Number(a.is_reference) || a.sort_order - b.sort_order);
  return countries.map((a) => {
    const meta = countryMeta(a.key);
    const pct = a.is_reference ? 0 : Number(a.percentage) || 0;
    return {
      key: a.key,
      label: a.label || meta.label,
      iso: meta.iso,
      percentage: pct,
      isReference: a.is_reference,
      adjustmentId: a.id,
      rates: rate ? deriveCountryRates(rate, pct) : { cash: 0, alipay: 0, wechat: 0, virement: 0 },
    };
  });
}

/** Forme attendue par le flyer (`RateFlyer`) — même ordre de lignes. */
export function toFlyerRates(rates: MethodRates): { alipay: number; wechat: number; bank: number; cash: number } {
  return { alipay: rates.alipay, wechat: rates.wechat, bank: rates.virement, cash: rates.cash };
}

/** « −1 % », « +0,5 % », « 0 % » — signe typographique, virgule française. */
export function formatCountryPct(pct: number): string {
  const abs = Math.abs(pct).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  if (pct === 0) return '0 %';
  return `${pct < 0 ? '−' : '+'}${abs} %`;
}

/** Suffixe de fichier pour un flyer pays : `gabon`, `guinee`… (référence : aucun). */
export function countryFileSlug(key: string, isReference: boolean): string | undefined {
  if (isReference) return undefined;
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

/**
 * Taux du jour applicable à un client, en entier « ¥ pour 1 M XAF » (les
 * écrans de paiement admin travaillent en entiers). `null` quand le pays est
 * la référence ou inconnu : l'appelant garde alors le taux de base.
 */
export function clientCountryRate(
  base: number,
  countryKey: string | null | undefined,
  adjustments: readonly RateAdjustment[] | undefined,
): { rate: number; percentage: number; key: string; label: string } | null {
  if (!countryKey || countryKey === REFERENCE_COUNTRY_KEY || !adjustments) return null;
  const adj = adjustments.find((a) => a.type === 'country' && a.key === countryKey);
  if (!adj || adj.is_reference) return null;
  const pct = Number(adj.percentage) || 0;
  if (pct === 0 || !(base > 0)) return null;
  return {
    rate: Math.round(calculateFinalRate(base, pct, 1_000_000, []).finalRate),
    percentage: pct,
    key: adj.key,
    label: adj.label || countryMeta(adj.key).label,
  };
}
