/**
 * Tableau de bord des ventes (08/10) — les calculs purs de src/lib/salesSeries.ts :
 * formats, écarts (0 → x, 0 → 0, x → 0), conversion, périodes de Douala,
 * préréglages (période en cours comprise), lignes recharts (couleur stable par
 * fiche, masquage, « Autres »), totaux d'équipe — sans jamais un NaN.
 */
import { describe, expect, it } from 'vitest';
import type { SalesPoint, SalesSeries, SalesSeriesSource, SalesTotals } from '@/hooks/useSales';
import {
  SALES_METRICS,
  SALES_METRIC_KEYS,
  addPeriods,
  axisYear,
  compareLabel,
  computeDelta,
  conversionRate,
  doualaToday,
  emptyTotals,
  formatAxis,
  formatDelta,
  formatNumber,
  formatRate,
  formatValue,
  funnelStages,
  hasActivity,
  isCurrentPeriod,
  metricSub,
  niceTicks,
  num,
  periodLabel,
  periodStart,
  periodsBetween,
  pickSource,
  rangeForPreset,
  rangeLabel,
  rankSources,
  sourceSlots,
  sumTotals,
  teamOf,
  toChartRows,
  valueParts,
} from '@/lib/salesSeries';

const nb = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

const totals = (o: Partial<SalesTotals> = {}): SalesTotals => ({ ...emptyTotals(), ...o });
const point = (period: string, o: Partial<SalesTotals> = {}): SalesPoint => ({ period, ...totals(o) });
const source = (id: string, label: string, pts: SalesPoint[], o: Partial<SalesSeriesSource> = {}): SalesSeriesSource => ({
  source_id: id,
  label,
  is_active: true,
  staff_user_id: `u-${id}`,
  points: pts,
  totals: sumTotals(pts),
  previous_totals: totals(),
  funnel: { total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 },
  ...o,
});
const PERIODS = ['2026-08-01', '2026-09-01', '2026-10-01'];
function seriesOf(sources: SalesSeriesSource[]): SalesSeries {
  return { grain: 'month', from: PERIODS[0], to: '2026-11-01', periods: PERIODS, sources, team: teamOf(sources, PERIODS) };
}
const NOW = new Date('2026-10-09T10:00:00Z');

describe('Indicateurs', () => {
  it('chaque clé du contrat a sa définition française, son unité et son sens', () => {
    expect(SALES_METRIC_KEYS).toHaveLength(15);
    for (const k of SALES_METRIC_KEYS) {
      const d = SALES_METRICS[k];
      expect(d.key).toBe(k);
      expect(d.label.length).toBeGreaterThan(2);
      expect(d.definition.length).toBeGreaterThan(10);
    }
    expect(SALES_METRICS.prospects_lost.higherIsBetter).toBe(false);
    expect(SALES_METRICS.clients_total.chart).toBe('line');
    expect(SALES_METRICS.payments_xaf.unit).toBe('xaf');
    expect(SALES_METRICS.air_kg.unit).toBe('kg');
    expect(SALES_METRICS.sea_cbm.unit).toBe('cbm');
  });

  it('num : jamais NaN (null, texte, infini → 0)', () => {
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num('12.5')).toBe(12.5);
    expect(num('abc')).toBe(0);
    expect(num(Infinity)).toBe(0);
    expect(num(NaN)).toBe(0);
  });
});

describe('Formats', () => {
  it('montants, kilos, m³, comptes', () => {
    expect(nb(formatValue('xaf', 48_312_500))).toBe('48 312 500 XAF');
    expect(nb(formatValue('xaf', 48_312_500, 'compact'))).toBe('48,3 M XAF');
    expect(nb(formatValue('xaf', 2_350_000, 'compact'))).toBe('2,35 M XAF');
    expect(nb(formatValue('xaf', 850_000, 'compact'))).toBe('850 000 XAF');
    expect(nb(formatValue('kg', 1234.5))).toBe('1 235 kg');
    expect(nb(formatValue('kg', 12.5))).toBe('12,5 kg');
    expect(nb(formatValue('cbm', 12.345))).toBe('12,35 m³');
    expect(formatValue('count', 42)).toBe('42');
    expect(formatNumber('xaf', NaN)).toBe('0');
    expect(valueParts('xaf', 312_225_000)).toMatchObject({ unit: 'XAF' });
    expect(nb(valueParts('xaf', 312_225_000).number)).toBe('312,2 M');
  });

  it('graduations courtes, sans unité', () => {
    expect(formatAxis('xaf', 0)).toBe('0');
    expect(nb(formatAxis('xaf', 40_000_000))).toBe('40 M');
    expect(formatAxis('count', 12)).toBe('12');
    expect(nb(formatAxis('kg', 1500))).toBe('1 500');
    expect(nb(formatAxis('kg', 25_000))).toBe('25 k');
    expect(nb(formatAxis('xaf', 500_000))).toBe('500 k');
  });

  it('graduations rondes : 0 compris, jamais sous le maximum', () => {
    expect(niceTicks(67_400_000)).toEqual([0, 20_000_000, 40_000_000, 60_000_000, 80_000_000]);
    expect(niceTicks(15_500_000)).toEqual([0, 5_000_000, 10_000_000, 15_000_000, 20_000_000]);
    expect(niceTicks(40, 'count')).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(3, 'count')).toEqual([0, 1, 2, 3]);
    expect(niceTicks(9, 'count', 2)).toEqual([0, 5, 10]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(NaN)).toEqual([0, 1]);
    expect(niceTicks(0.4, 'cbm', 2)).toEqual([0, 0.2, 0.4]);
    for (const m of [1, 7, 13, 99, 101, 2_450, 312_225_000]) {
      const t = niceTicks(m, 'kg');
      expect(t[0]).toBe(0);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(m);
      expect(t.length).toBeLessThanOrEqual(6);
    }
  });

  it('la ligne sous une tuile', () => {
    const t = totals({ payments_xaf: 1, payments_count: 1, deposits_count: 3, air_parcels: 64, air_kg: 1200, flights: 10, new_clients: 5, clients_total: 40 });
    expect(nb(metricSub('payments_xaf', t)!)).toBe('1 paiement');
    expect(nb(metricSub('deposits_xaf', t)!)).toBe('3 dépôts');
    expect(nb(metricSub('air_kg', t)!)).toBe('64 colis');
    expect(nb(metricSub('flights', t)!)).toBe('120 kg par vol');
    expect(nb(metricSub('clients_total', t)!)).toBe('dont 5 nouveaux');
    expect(metricSub('flights', totals())).toBeNull();
  });
});

describe('Écarts avec la plage précédente', () => {
  it('0 → 0 : rien à montrer', () => {
    const d = computeDelta(0, 0);
    expect(d.kind).toBe('none');
    expect(d.pct).toBeNull();
    expect(formatDelta(d, 'xaf')).toBe('');
  });

  it('0 → x : « nouveau » (pas de pourcentage) ; « +3 » pour un petit compte', () => {
    const d = computeDelta(12_000_000, 0);
    expect(d.kind).toBe('new');
    expect(d.pct).toBeNull();
    expect(d.tone).toBe('good');
    expect(formatDelta(d, 'xaf')).toBe('nouveau');
    expect(formatDelta(computeDelta(3, 0), 'count')).toBe('+3');
  });

  it('x → 0 : −100 %, en rouge', () => {
    const d = computeDelta(0, 5_000_000);
    expect(d.pct).toBe(-1);
    expect(d.tone).toBe('bad');
    expect(nb(formatDelta(d, 'xaf'))).toBe('−100 %');
  });

  it('hausse, baisse, stable ; le sens dépend de l’indicateur', () => {
    expect(nb(formatDelta(computeDelta(112, 100), 'kg'))).toBe('+12 %');
    expect(computeDelta(112, 100).tone).toBe('good');
    expect(computeDelta(112, 100, false).tone).toBe('bad');
    expect(nb(formatDelta(computeDelta(92, 100), 'kg'))).toBe('−8 %');
    expect(formatDelta(computeDelta(100.2, 100), 'kg')).toBe('stable');
    expect(computeDelta(100.2, 100).tone).toBe('neutral');
    // Un petit compte : l'écart en nombre.
    expect(nb(formatDelta(computeDelta(2, 5), 'count'))).toBe('−3');
    expect(nb(formatDelta(computeDelta(30, 20), 'count'))).toBe('+50 %');
  });

  it('jamais NaN, même avec des valeurs absentes', () => {
    const d = computeDelta(undefined as unknown as number, null as unknown as number);
    expect(d.kind).toBe('none');
    expect(Number.isNaN(d.abs)).toBe(false);
  });
});

describe('Prospects', () => {
  const f = { total: 40, new: 5, contacted: 8, interested: 7, to_verify: 2, won: 10, lost: 8 };
  it('conversion = devenus clients / ajoutés ; null sans prospect', () => {
    expect(conversionRate(f)).toBe(0.25);
    expect(conversionRate({ won: 0, total: 0 })).toBeNull();
    expect(nb(formatRate(0.25))).toBe('25 %');
    expect(nb(formatRate(0.045))).toBe('4,5 %');
    expect(formatRate(null)).toBe('—');
  });
  it('les étapes forment une partition du total', () => {
    const s = funnelStages(f);
    expect(s.map((x) => x.key)).toEqual(['open', 'to_verify', 'won', 'lost']);
    expect(s[0].count).toBe(20);
    expect(s.reduce((a, x) => a + x.count, 0)).toBe(40);
    expect(s.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1);
    expect(funnelStages(null).every((x) => x.count === 0 && x.share === 0)).toBe(true);
  });
});

describe('Périodes (Douala)', () => {
  it('le jour de Douala (UTC+1) : 23 h 30 UTC est déjà le lendemain', () => {
    expect(doualaToday(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
    expect(doualaToday(NOW)).toBe('2026-10-09');
  });
  it('début de période, décalage, liste', () => {
    expect(periodStart('2026-10-09', 'month')).toBe('2026-10-01');
    expect(periodStart('2026-10-09', 'week')).toBe('2026-10-05'); // lundi
    expect(periodStart('2026-10-11', 'week')).toBe('2026-10-05'); // dimanche → lundi d'avant
    expect(addPeriods('2026-01-01', 'month', -2)).toBe('2025-11-01');
    expect(addPeriods('2026-10-05', 'week', 1)).toBe('2026-10-12');
    expect(periodsBetween('2026-08-01', '2026-11-01', 'month')).toEqual(PERIODS);
    expect(isCurrentPeriod('2026-10-01', 'month', NOW)).toBe(true);
    expect(isCurrentPeriod('2026-09-01', 'month', NOW)).toBe(false);
  });
  it('libellés', () => {
    expect(periodLabel('2026-10-01', 'month', 'axis')).toBe('oct.');
    expect(periodLabel('2026-10-01', 'month', 'short')).toBe('oct. 2026');
    expect(periodLabel('2026-10-01', 'month', 'long')).toBe('octobre 2026');
    expect(nb(periodLabel('2026-10-05', 'week', 'short'))).toBe('sem. du 5 oct.');
    expect(nb(periodLabel('2026-10-05', 'week', 'axis'))).toBe('5 oct.');
    expect(nb(periodLabel('2026-10-05', 'week', 'long'))).toBe('semaine du 5 au 11 oct. 2026');
    expect(nb(periodLabel('2026-09-28', 'week', 'long'))).toBe('semaine du 28 sept. au 4 oct. 2026');
    expect(axisYear(['2025-12-01', '2026-01-01', '2026-02-01'], 0)).toBe('2025');
    expect(axisYear(['2025-12-01', '2026-01-01', '2026-02-01'], 1)).toBe('2026');
    expect(axisYear(['2025-12-01', '2026-01-01', '2026-02-01'], 2)).toBeNull();
    expect(rangeLabel(PERIODS, 'month')).toBe('août 2026 – oct. 2026');
    expect(nb(rangeLabel(['2026-07-20', '2026-10-05'], 'week'))).toBe('20 juil. – 11 oct. 2026');
  });
  it('préréglages : période en cours comprise, `to` exclu', () => {
    expect(rangeForPreset('3m', NOW)).toEqual({ from: '2026-08-01', to: '2026-11-01', grain: 'month' });
    expect(rangeForPreset('6m', NOW)).toEqual({ from: '2026-05-01', to: '2026-11-01', grain: 'month' });
    expect(rangeForPreset('12m', NOW)).toEqual({ from: '2025-11-01', to: '2026-11-01', grain: 'month' });
    expect(rangeForPreset('12w', NOW)).toEqual({ from: '2026-07-20', to: '2026-10-12', grain: 'week' });
    expect(periodsBetween('2026-07-20', '2026-10-12', 'week')).toHaveLength(12);
    // À Douala, le 31 octobre 23 h 30 UTC, on est déjà en novembre.
    expect(rangeForPreset('3m', new Date('2026-10-31T23:30:00Z')).to).toBe('2026-12-01');
    expect(compareLabel('3m')).toBe('par rapport aux 3 mois précédents');
    expect(compareLabel('12w')).toBe('par rapport aux 12 semaines précédentes');
  });
});

describe('Lignes recharts et couleurs', () => {
  const rod = source('src-rodrigue', 'Rodrigue Tchami', [point(PERIODS[0], { payments_xaf: 10 }), point(PERIODS[1], { payments_xaf: 20 }), point(PERIODS[2], { payments_xaf: 5 })]);
  const car = source('src-carine', 'Carine Ewane', [point(PERIODS[0]), point(PERIODS[1], { payments_xaf: 7 }), point(PERIODS[2], { payments_xaf: 3 })]);
  const her = source('src-herve', 'Hervé Nkoulou', [point(PERIODS[0], { payments_xaf: 4 }), point(PERIODS[1]), point(PERIODS[2])], { is_active: false });

  it('la couleur suit la fiche, pas l’ordre du serveur ni le rang', () => {
    const a = sourceSlots([rod, car, her]);
    const b = sourceSlots([her, rod, car]);
    expect([...a.entries()]).toEqual([...b.entries()]);
    expect(a.get('src-carine')).toBe(1);
    expect(a.get('src-herve')).toBe(2);
    expect(a.get('src-rodrigue')).toBe(3);
  });

  it('une ligne par période, une colonne par fiche, total et équipe', () => {
    const { rows, series } = toChartRows(seriesOf([rod, car, her]), 'payments_xaf', { now: NOW });
    expect(series.map((s) => s.label)).toEqual(['Carine Ewane', 'Hervé Nkoulou', 'Rodrigue Tchami']);
    expect(series.map((s) => s.color)).toEqual(['var(--sd-cat-1)', 'var(--sd-cat-2)', 'var(--sd-cat-3)']);
    expect(series[1].archived).toBe(true);
    expect(rows.map((r) => r.total)).toEqual([14, 27, 8]);
    expect(rows.map((r) => r.team)).toEqual([14, 27, 8]);
    expect(rows[2].current).toBe(true);
    expect(rows[0].year).toBe('2026');
    expect(rows[0].top).toBe('s3'); // Rodrigue, la dernière série non nulle de la pile
    for (const r of rows) for (const v of Object.values(r)) if (typeof v === 'number') expect(Number.isNaN(v)).toBe(false);
  });

  it('masquer une fiche ne repeint pas les autres et retire sa part du total', () => {
    const { rows, series } = toChartRows(seriesOf([rod, car, her]), 'payments_xaf', { hidden: new Set(['s3']), now: NOW });
    expect(series.map((s) => s.color)).toEqual(['var(--sd-cat-1)', 'var(--sd-cat-2)', 'var(--sd-cat-3)']);
    expect(rows.map((r) => r.total)).toEqual([4, 7, 3]);
    expect(rows.map((r) => r.team)).toEqual([14, 27, 8]);
    expect(rows[0].top).toBe('s2');
  });

  it('au-delà de huit fiches : « Autres », en gris', () => {
    const many = Array.from({ length: 10 }, (_, i) => source(`src-${String(i).padStart(2, '0')}`, `C${i}`, PERIODS.map((p) => point(p, { payments_xaf: 1 }))));
    const { series, rows } = toChartRows(seriesOf(many), 'payments_xaf');
    expect(series).toHaveLength(9);
    expect(series[8]).toMatchObject({ key: 'other', label: 'Autres', color: 'var(--sd-other)', sourceIds: ['src-08', 'src-09'] });
    expect(rows[0].other).toBe(2);
    expect(rows[0].total).toBe(10);
  });

  it('une réponse sans point pour une période : des zéros, pas de trou', () => {
    const sparse = source('src-x', 'X', [point(PERIODS[1], { payments_xaf: 9 })]);
    const { rows } = toChartRows(seriesOf([sparse]), 'payments_xaf');
    expect(rows.map((r) => r.s1)).toEqual([0, 9, 0]);
  });
});

describe('Totaux d’équipe, sélection, classement', () => {
  const a = source('src-a', 'Alpha', [point(PERIODS[0], { payments_xaf: 5, flights: 2 })]);
  const b = source('src-b', 'Bravo', [point(PERIODS[0], { payments_xaf: 7, flights: 3 })], { is_active: false });
  const c = source('src-c', 'Charlie', [point(PERIODS[0], { payments_xaf: 1 })]);

  it('teamOf somme clé par clé, période par période', () => {
    const t = teamOf([a, b], PERIODS);
    expect(t.points).toHaveLength(3);
    expect(t.points[0].payments_xaf).toBe(12);
    expect(t.points[1].payments_xaf).toBe(0);
    expect(t.totals.flights).toBe(5);
  });

  it('pickSource : la fiche devient l’équipe ; null si absente', () => {
    const s = pickSource(seriesOf([a, b]), 'src-b')!;
    expect(s.sources).toHaveLength(1);
    expect(s.team.totals.payments_xaf).toBe(7);
    expect(pickSource(seriesOf([a]), 'src-z')).toBeNull();
  });

  it('classement : actives d’abord, par valeur ; archivées ensuite', () => {
    expect(rankSources([a, b, c]).map((s) => s.label)).toEqual(['Alpha', 'Charlie', 'Bravo']);
  });

  it('hasActivity', () => {
    expect(hasActivity(totals())).toBe(false);
    expect(hasActivity(totals({ clients_total: 4 }))).toBe(false); // un parc sans mouvement
    expect(hasActivity(totals({ air_kg: 0.5 }))).toBe(true);
    expect(hasActivity(totals(), { total: 1, new: 1, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 })).toBe(true);
    expect(hasActivity(null)).toBe(false);
  });
});
