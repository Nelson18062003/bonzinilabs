// « Mon mois » du commercial (08/10) : le calcul, sans affichage.
//   · la plage lue : les 6 mois qui finissent au mois choisi ;
//   · les chiffres du mois viennent de sales_series, sinon de
//     commercial_dashboard (sans vols ni perdus) ;
//   · un mois PAS FINI ne se compare pas en pourcentage au mois d'avant ;
//   · un objectif se juge au rythme du calendrier.
import { describe, it, expect } from 'vitest';
import type { SalesPoint, SalesSeries, SalesTotals } from '@/hooks/useSales';
import type { SalesMetrics } from '@/lib/sales';
import {
  compareMonth,
  figuresFromMetrics,
  figuresFromSeries,
  homeRange,
  isQuiet,
  monthClock,
  objectivePace,
  previousFigures,
} from '@/components/sales/HomeData';

const ZERO: SalesTotals = {
  clients_total: 0, new_clients: 0, active_clients: 0, prospects_new: 0, prospects_won: 0, prospects_lost: 0,
  payments_xaf: 0, payments_count: 0, deposits_xaf: 0, deposits_count: 0,
  air_parcels: 0, air_kg: 0, flights: 0, sea_parcels: 0, sea_cbm: 0,
};
const FUNNEL0 = { total: 0, new: 0, contacted: 0, interested: 0, to_verify: 0, won: 0, lost: 0 };

function point(period: string, patch: Partial<SalesPoint> = {}): SalesPoint {
  return { period, ...ZERO, ...patch };
}

function series(points: SalesPoint[], totals: Partial<SalesTotals> = {}): SalesSeries {
  const t = { ...ZERO, ...totals };
  return {
    grain: 'month',
    from: points[0]?.period ?? '2026-05-01',
    to: '2026-11-01',
    periods: points.map((p) => p.period),
    sources: [{ source_id: 's1', label: 'Rodrigue Tchami', is_active: true, staff_user_id: 'u1', points, totals: t, previous_totals: ZERO, funnel: FUNNEL0 }],
    team: { points, totals: t, previous_totals: ZERO, funnel: FUNNEL0 },
  };
}

const SEPT = point('2026-09-01', { payments_xaf: 37_700_000, payments_count: 12, flights: 9, clients_total: 37 });
const OCT = point('2026-10-01', { payments_xaf: 21_200_000, payments_count: 11, flights: 3, clients_total: 40, prospects_lost: 1 });

describe('Mon mois — la plage et le calendrier', () => {
  it('lit les 6 mois qui finissent au mois choisi, fin exclue', () => {
    expect(homeRange('2026-10-01')).toEqual({ from: '2026-05-01', to: '2026-11-01', grain: 'month' });
    expect(homeRange('2026-02-01')).toEqual({ from: '2025-09-01', to: '2026-03-01', grain: 'month' });
  });

  it('le 9 octobre à Douala, octobre n’est pas fini ; septembre l’est', () => {
    const now = new Date('2026-10-09T10:00:00Z');
    const oct = monthClock('2026-10-01', now);
    expect(oct).toMatchObject({ current: true, future: false, day: 9, days: 31 });
    expect(oct.elapsed).toBeCloseTo(9 / 31);
    expect(monthClock('2026-09-01', now)).toMatchObject({ current: false, elapsed: 1 });
  });

  it('le 30 septembre à 23 h 30 UTC, Douala est déjà en octobre', () => {
    expect(monthClock('2026-10-01', new Date('2026-09-30T23:30:00Z'))).toMatchObject({ current: true, day: 1 });
  });
});

describe('Mon mois — d’où viennent les chiffres', () => {
  it('de sales_series quand il répond, vols compris', () => {
    const f = figuresFromSeries(series([SEPT, OCT]), '2026-10-01');
    expect(f).toMatchObject({ payments_xaf: 21_200_000, flights: 3, clients_total: 40, prospects_lost: 1 });
  });

  it('un mois absent de la réponse : rien plutôt qu’un zéro inventé', () => {
    expect(figuresFromSeries(series([SEPT, OCT]), '2026-04-01')).toBeNull();
    expect(figuresFromSeries(undefined, '2026-10-01')).toBeNull();
  });

  it('sinon de commercial_dashboard : vols et perdus inconnus (null), pas zéro', () => {
    const m = {
      clients: 40, new_clients: 3, active_clients: 16, payments_xaf: 21_200_000, payments_count: 11,
      deposits_xaf: 17_900_000, deposits_count: 8, air_parcels: 4, air_kg: 103, sea_parcels: 0, sea_cbm: 0,
      prospects_open: 46, prospects_new: 10, prospects_won: 1, prospects_due: 4,
    } as SalesMetrics;
    const f = figuresFromMetrics(m);
    expect(f).toMatchObject({ payments_xaf: 21_200_000, clients_total: 40, air_kg: 103 });
    expect(f?.flights).toBeNull();
    expect(f?.prospects_lost).toBeNull();
    expect(figuresFromMetrics(undefined)).toBeNull();
  });

  it('le mois d’avant vient de la même réponse', () => {
    expect(previousFigures(series([SEPT, OCT]), '2026-10-01')).toMatchObject({ payments_xaf: 37_700_000, flights: 9 });
    expect(previousFigures(series([OCT]), '2026-10-01')).toBeNull();
  });
});

describe('Mon mois — la comparaison au mois d’avant', () => {
  const s = series([SEPT, OCT]);
  const figures = figuresFromSeries(s, '2026-10-01');
  const previous = previousFigures(s, '2026-10-01');

  it('mois en cours : la valeur de septembre, sans pourcentage trompeur', () => {
    const c = compareMonth('payments_xaf', figures, previous, false);
    expect(c.previous).toBe(37_700_000);
    expect(c.delta).toBeNull();
  });

  it('mois fini : le pourcentage', () => {
    const c = compareMonth('payments_xaf', figures, previous, true);
    expect(c.delta).not.toBeNull();
  });

  it('une valeur inconnue (vols sans sales_series) ne se compare pas', () => {
    const fallback = { ...figures!, flights: null };
    expect(compareMonth('flights', fallback, previous, true).delta).toBeNull();
  });
});

describe('Mon mois — une fiche toute neuve', () => {
  it('6 mois vides, aucun client : « calme »', () => {
    expect(isQuiet(series([point('2026-09-01'), point('2026-10-01')]))).toBe(true);
  });

  it('un seul client au compteur suffit à ne plus l’être', () => {
    expect(isQuiet(series([SEPT, OCT], { clients_total: 40, payments_xaf: 58_900_000 }))).toBe(false);
  });

  it('pas de réponse : on ne conclut rien', () => {
    expect(isQuiet(undefined)).toBe(false);
  });
});

describe('Mon mois — les objectifs au rythme du calendrier', () => {
  const nineOf31 = { current: true, elapsed: 9 / 31 };

  it('le 9 octobre, 35 % de la cible : dans le rythme', () => {
    expect(objectivePace({ metric: 'payments_xaf', target: 60_000_000, actual: 21_200_000 }, nineOf31).status).toBe('ahead');
  });

  it('le 9 octobre, 20 % de la cible : sous le rythme', () => {
    const p = objectivePace({ metric: 'air_kg', target: 250, actual: 50 }, nineOf31);
    expect(p.status).toBe('behind');
    expect(p.left).toBe(200);
    expect(p.expected).toBeCloseTo(250 * (9 / 31));
  });

  it('atteint, même en avance ; la barre ne dépasse pas, le pourcentage si', () => {
    const p = objectivePace({ metric: 'new_clients', target: 3, actual: 4 }, nineOf31);
    expect(p.status).toBe('reached');
    expect(p.ratio).toBe(1);
    expect(p.pct).toBe(133);
    expect(p.left).toBe(0);
  });

  it('mois fini sans l’atteindre : manqué, plus de rythme attendu', () => {
    const p = objectivePace({ metric: 'sea_cbm', target: 5, actual: 2 }, { current: false, elapsed: 1 });
    expect(p.status).toBe('missed');
    expect(p.expected).toBeNull();
  });
});
