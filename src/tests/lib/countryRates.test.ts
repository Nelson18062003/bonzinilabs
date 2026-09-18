import { describe, it, expect } from 'vitest';
import {
  buildCountryRateSheets,
  clientCountryRate,
  countryFileSlug,
  deriveCountryRates,
  formatCountryPct,
  toFlyerRates,
} from '@/lib/countryRates';
import type { DailyRate, RateAdjustment } from '@/types/rates';

const rate: DailyRate = {
  id: 'r1', rate_cash: 11530, rate_alipay: 11480, rate_wechat: 11350, rate_virement: 11200,
  effective_at: '2026-09-18T08:00:00Z', created_at: '2026-09-18T08:00:00Z', created_by: null, is_active: true,
};
const adj = (key: string, percentage: number, is_reference = false, sort_order = 0): RateAdjustment => ({
  id: `adj-${key}`, type: 'country', key, label: '', percentage, is_reference, sort_order, updated_at: '', updated_by: null,
});
const adjustments = [
  adj('gabon', -1, false, 1),
  adj('cameroun', 0, true, 0),
  adj('tchad', -1.5, false, 2),
  { ...adj('t2', -1), type: 'tier' as const },
];

describe('deriveCountryRates', () => {
  it('applique le pourcentage pays aux quatre taux, arrondi à 2 décimales comme la RPC', () => {
    expect(deriveCountryRates(rate, -1)).toEqual({ cash: 11414.7, alipay: 11365.2, wechat: 11236.5, virement: 11088 });
  });
  it('0 % restitue les taux publiés tels quels', () => {
    expect(deriveCountryRates(rate, 0)).toEqual({ cash: 11530, alipay: 11480, wechat: 11350, virement: 11200 });
  });
});

describe('buildCountryRateSheets', () => {
  it('met la référence en tête, ignore les tranches, dérive les autres pays', () => {
    const sheets = buildCountryRateSheets(rate, adjustments);
    expect(sheets.map((s) => s.key)).toEqual(['cameroun', 'gabon', 'tchad']);
    expect(sheets[0].isReference).toBe(true);
    expect(sheets[0].rates.cash).toBe(11530);
    expect(sheets[1].iso).toBe('GA');
    expect(sheets[1].label).toBe('Gabon');
    expect(sheets[1].percentage).toBe(-1);
    expect(sheets[1].rates.cash).toBe(11414.7);
  });
  it('sans publication active, les taux valent 0', () => {
    const sheets = buildCountryRateSheets(null, adjustments);
    expect(sheets[1].rates).toEqual({ cash: 0, alipay: 0, wechat: 0, virement: 0 });
  });
});

describe('formats', () => {
  it('pourcentage typographique', () => {
    expect(formatCountryPct(-1)).toBe('−1 %');
    expect(formatCountryPct(-1.5)).toBe('−1,5 %');
    expect(formatCountryPct(0)).toBe('0 %');
    expect(formatCountryPct(0.5)).toBe('+0,5 %');
  });
  it('flyer : virement → bank, référence sans suffixe de fichier', () => {
    expect(toFlyerRates({ cash: 1, alipay: 2, wechat: 3, virement: 4 })).toEqual({ alipay: 2, wechat: 3, bank: 4, cash: 1 });
    expect(countryFileSlug('cameroun', true)).toBeUndefined();
    expect(countryFileSlug('gabon', false)).toBe('gabon');
  });
});

describe('clientCountryRate', () => {
  it('donne le taux entier du pays du client', () => {
    expect(clientCountryRate(11530, 'gabon', adjustments)).toEqual({ rate: 11415, percentage: -1, key: 'gabon', label: 'Gabon' });
  });
  it('null pour la référence, un pays inconnu ou un écart nul', () => {
    expect(clientCountryRate(11530, 'cameroun', adjustments)).toBeNull();
    expect(clientCountryRate(11530, 'mars', adjustments)).toBeNull();
    expect(clientCountryRate(11530, 'gabon', [adj('gabon', 0)])).toBeNull();
    expect(clientCountryRate(11530, null, adjustments)).toBeNull();
  });
});
