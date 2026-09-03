/**
 * « Le graphique clients ne marche pas. »
 *
 * RÉGRESSION RÉELLE : le bloc desktop traçait `dataKey="count"` sur des
 * points `{ newClients, cumulative }`. Recharts ne signale pas une clé
 * absente — il ne dessine rien. Le graphique était vide sous un titre plein,
 * indistinguable d'une période sans inscription.
 *
 * Ces tests fixent la chaîne complète : des points du hook aux lignes du
 * graphique (les clés que le graphique lit existent et portent les bonnes
 * valeurs), aux chiffres de tête, et au rendu du bloc.
 *
 * SECONDE demande, après coup : « il a une ligne, mais il a aussi des barres
 * dedans, je ne comprends pas ce graphique ». Les barres sont parties, le bloc
 * ne dessine plus qu'une série — le parc de clients. `GrowthRow.nouveaux`
 * reste rempli : l'infobulle le donne, et c'est ce qui permet de retirer les
 * barres sans perdre ce qu'elles disaient.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildRangeFromPreset } from '@/lib/analytics/dateRange';
import { buildClientGrowthReport, type ClientGrowthPoint } from '@/hooks/analytics/useAnalytics';
import {
  ClientGrowthBlock,
  buildClientGrowthRows,
  totalAxisFloor,
  GROWTH_KEYS,
} from '@/desktop/screens/analytics/ClientGrowthBlock';

const range = buildRangeFromPreset('last_30_days');

// jsdom n'a pas de ResizeObserver ; Recharts en veut un pour mesurer le
// conteneur. Le graphique ne se dessine pas ici (pas de mise en page), seul
// l'en-tête chiffré est vérifié.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

const points: ClientGrowthPoint[] = [
  { bucket: '2026-08-10T23:00:00.000Z', label: 'Mar 11', newClients: 2, cumulative: 1182 },
  { bucket: '2026-08-11T23:00:00.000Z', label: 'Mer 12', newClients: 0, cumulative: 1182 },
  { bucket: '2026-08-12T23:00:00.000Z', label: 'Jeu 13', newClients: 5, cumulative: 1187 },
  { bucket: '2026-08-13T23:00:00.000Z', label: 'Ven 14', newClients: 1, cumulative: 1188 },
];

describe('Croissance clients — des points au graphique', () => {
  it('les lignes du graphique portent les nouveaux et le total, sous les clés que le graphique lit', () => {
    const rows = buildClientGrowthRows(points, range);
    expect(rows).toHaveLength(4);
    // Les clés du graphique existent sur chaque ligne — c'est exactement ce
    // qui manquait (`count`).
    for (const row of rows) {
      expect(typeof row[GROWTH_KEYS.nouveaux]).toBe('number');
      expect(typeof row[GROWTH_KEYS.total]).toBe('number');
    }
    expect(rows.map((r) => r.nouveaux)).toEqual([2, 0, 5, 1]);
    expect(rows.map((r) => r.total)).toEqual([1182, 1182, 1187, 1188]);
    // L'infobulle garde le libellé complet ; l'axe reçoit un libellé contextuel.
    expect(rows[0].label).toBe('Mar 11');
    expect(rows.every((r) => r.axisLabel.length > 0)).toBe(true);
  });

  it('les chiffres de tête : nouveaux, total, départ, pic, variation', () => {
    const report = buildClientGrowthReport(points, 4);
    expect(report.newClients).toBe(8);
    expect(report.totalAtEnd).toBe(1188);
    expect(report.totalAtStart).toBe(1180);
    expect(report.peak).toEqual({ label: 'Jeu 13', newClients: 5 });
    expect(report.previousNewClients).toBe(4);
    expect(report.trendPct).toBe(1); // 4 → 8 : +100 %
  });

  it('sans inscription : pas de pic, pas de variation sur une précédente vide', () => {
    const flat = points.map((p) => ({ ...p, newClients: 0, cumulative: 1180 }));
    const report = buildClientGrowthReport(flat, 0);
    expect(report.newClients).toBe(0);
    expect(report.peak).toBeNull();
    expect(report.trendPct).toBeNull();
    expect(report.totalAtStart).toBe(1180);
  });

  it("l'axe du total part juste sous le total de départ, jamais de zéro ni sous zéro", () => {
    // 1 180 → 1 188 : partir de zéro serait une ligne plate.
    const floor = totalAxisFloor(1180, 1188);
    expect(floor).toBeLessThan(1180);
    expect(floor).toBeGreaterThan(1100);
    expect(totalAxisFloor(0, 3)).toBe(0);
    expect(totalAxisFloor(2, 2)).toBeGreaterThanOrEqual(0);
  });

  it('le bloc rendu affiche les chiffres de tête tirés des points', () => {
    const report = buildClientGrowthReport(points, 4);
    render(<ClientGrowthBlock report={report} loading={false} range={range} color="#059669" />);
    expect(screen.getByText('Nouveaux sur la période')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('1 188')).toBeTruthy();
    expect(screen.getByText('Jeu 13 · 5')).toBeTruthy();
    expect(screen.getByText('+100,0 %')).toBeTruthy();
  });

  it('le bloc vide le dit, au lieu de dessiner un graphique sans données', () => {
    render(<ClientGrowthBlock report={buildClientGrowthReport([], 0)} loading={false} range={range} color="#059669" />);
    expect(screen.getByText('Aucune donnée sur la période.')).toBeTruthy();
  });
});
