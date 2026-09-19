/**
 * Relevé de compte sur une période — la logique pure.
 *
 * Ce qui se testait mal jusqu'ici : le relevé n'avait PAS de solde
 * d'ouverture (la première ligne « tombait du ciel »), coupait à 100 lignes
 * en silence et couvrait toujours tout l'historique. On vérifie ici que la
 * préparation borne, trie, et lit les soldes au bon endroit — y compris les
 * soldes négatifs (découvert), qui sont désormais possibles.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStatementRange,
  prepareStatement,
  statementPeriodLabel,
  statementQueryRange,
  STATEMENT_PRESETS,
} from '@/lib/statementPeriod';
import type { StatementMovement } from '@/lib/pdf/templates/ClientStatementPDF';

function mv(date: string, soldeAvant: number, delta: number): StatementMovement {
  return {
    date,
    reference: `REF-${date}`,
    type: delta >= 0 ? 'Dépôt' : 'Paiement',
    motif: 'test',
    debit: delta < 0 ? -delta : 0,
    credit: delta > 0 ? delta : 0,
    soldeAvant,
    solde: soldeAvant + delta,
  };
}

// Mercredi 16 septembre 2026, 10:00 UTC (11:00 à Douala).
const NOW = new Date('2026-09-16T10:00:00.000Z');

describe('buildStatementRange', () => {
  it('expose les neuf préréglages, dans l\'ordre du sélecteur', () => {
    expect(STATEMENT_PRESETS.map((p) => p.id)).toEqual([
      'today', 'last_7_days', 'last_14_days', 'last_30_days', 'last_90_days',
      'this_month', 'last_month', 'all_time', 'custom',
    ]);
  });

  it('« 14 derniers jours » = 14 jours civils de Douala, aujourd\'hui inclus', () => {
    const r = buildStatementRange('last_14_days', undefined, NOW);
    // 3 septembre 00:00 Douala = 2 septembre 23:00 UTC
    expect(r.from.toISOString()).toBe('2026-09-02T23:00:00.000Z');
    // 16 septembre 23:59:59.999 Douala = 22:59:59.999 UTC
    expect(r.to.toISOString()).toBe('2026-09-16T22:59:59.999Z');
    expect(r.preset).toBe('last_14_days');
  });

  it('une plage personnalisée est INCLUSIVE sur la date de fin', () => {
    const r = buildStatementRange('custom', { from: '2026-09-01', to: '2026-09-10' }, NOW);
    expect(r.from.toISOString()).toBe('2026-08-31T23:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-09-10T22:59:59.999Z');
    // Une écriture à 22:30 UTC le 10 (23:30 à Douala) est DANS la période.
    const inside = mv('2026-09-10T22:30:00.000Z', 0, 100);
    const out = prepareStatement({ movements: [inside], range: r, allTime: false });
    expect(out.movements).toHaveLength(1);
  });

  it('remet dans l\'ordre des bornes personnalisées inversées', () => {
    const r = buildStatementRange('custom', { from: '2026-09-10', to: '2026-09-01' }, NOW);
    expect(r.from.getTime()).toBeLessThan(r.to.getTime());
  });

  it('« tout l\'historique » ne pose aucune borne de requête', () => {
    expect(statementQueryRange(buildStatementRange('all_time', undefined, NOW))).toBeNull();
    expect(statementQueryRange(buildStatementRange('today', undefined, NOW))).not.toBeNull();
  });

  it('le libellé se lit en jour civil de Douala', () => {
    const r = buildStatementRange('custom', { from: '2026-09-01', to: '2026-09-18' }, NOW);
    expect(statementPeriodLabel(r, 'fr')).toBe('Du 1 sept. 2026 au 18 sept. 2026');
    expect(statementPeriodLabel(r, 'en')).toBe('From 1 Sept 2026 to 18 Sept 2026');
    expect(statementPeriodLabel(buildStatementRange('today', undefined, NOW), 'fr')).toBe('Le 16 sept. 2026');
  });
});

describe('prepareStatement', () => {
  const range = buildStatementRange('custom', { from: '2026-09-01', to: '2026-09-30' }, NOW);

  it('lit le solde d\'ouverture sur la PREMIÈRE ligne de la période, quel que soit l\'ordre reçu', () => {
    const movements = [
      mv('2026-09-20T08:00:00.000Z', 700_000, -200_000),   // → 500 000
      mv('2026-08-15T08:00:00.000Z', 0, 1_000_000),         // hors période
      mv('2026-09-05T08:00:00.000Z', 1_000_000, -300_000),  // → 700 000 (première de la période)
    ];
    const out = prepareStatement({ movements, range, allTime: false, lastBalanceBeforeRange: 999 });
    expect(out.movements.map((m) => m.date)).toEqual([
      '2026-09-05T08:00:00.000Z',
      '2026-09-20T08:00:00.000Z',
    ]);
    expect(out.openingBalance).toBe(1_000_000); // pas le « 999 » passé en secours
    expect(out.closingBalance).toBe(500_000);
    expect(out.totalDebits).toBe(500_000);
    expect(out.totalCredits).toBe(0);
  });

  it('période vide : ouverture = clôture = solde d\'avant la période', () => {
    const out = prepareStatement({
      movements: [mv('2026-08-15T08:00:00.000Z', 0, 1_000_000)],
      range,
      allTime: false,
      lastBalanceBeforeRange: 1_000_000,
    });
    expect(out.movements).toHaveLength(0);
    expect(out.openingBalance).toBe(1_000_000);
    expect(out.closingBalance).toBe(1_000_000);
    expect(out.totalCredits).toBe(0);
    expect(out.totalDebits).toBe(0);
  });

  it('période vide sans écriture antérieure : 0', () => {
    const out = prepareStatement({ movements: [], range, allTime: false });
    expect(out.openingBalance).toBe(0);
    expect(out.closingBalance).toBe(0);
  });

  it('conserve les soldes NÉGATIFS (découvert) tels quels', () => {
    const movements = [
      mv('2026-09-02T08:00:00.000Z', -50_000, -20_000),  // → -70 000
      mv('2026-09-03T08:00:00.000Z', -70_000, 100_000),  // → 30 000
    ];
    const out = prepareStatement({ movements, range, allTime: false });
    expect(out.openingBalance).toBe(-50_000);
    expect(out.closingBalance).toBe(30_000);
    expect(out.movements[0].solde).toBe(-70_000);

    const empty = prepareStatement({ movements: [], range, allTime: false, lastBalanceBeforeRange: -12_345 });
    expect(empty.openingBalance).toBe(-12_345);
    expect(empty.closingBalance).toBe(-12_345);
  });

  it('« tout l\'historique » ignore les bornes et garde tout, trié', () => {
    const movements = [
      mv('2027-01-01T00:00:00.000Z', 100, 10),
      mv('2024-01-01T00:00:00.000Z', 0, 100),
    ];
    const out = prepareStatement({ movements, range, allTime: true });
    expect(out.movements).toHaveLength(2);
    expect(out.openingBalance).toBe(0);
    expect(out.closingBalance).toBe(110);
    expect(out.totalCredits).toBe(110);
  });
});
