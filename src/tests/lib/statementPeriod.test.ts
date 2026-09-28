/**
 * Relevé de compte sur une période — la logique pure.
 *
 * Les bornes de la période (jours civils de Douala) et son libellé. Le
 * document lui-même (lignes, soldes, taux, ¥) : accountStatement.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  buildStatementRange,
  statementPeriodLabel,
  statementQueryRange,
  STATEMENT_PRESETS,
} from '@/lib/statementPeriod';
import { buildStatementDocument } from '@/lib/accountStatement';


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
    const doc = buildStatementDocument({
      lang: 'fr', client: { name: 'Test' }, details: { payments: {}, deposits: {} }, range: r,
      entries: [{ id: 'e', entryType: 'DEPOSIT_VALIDATED', amountXAF: 100, balanceBefore: 0, balanceAfter: 100, createdAt: '2026-09-10T22:30:00.000Z' }],
    });
    expect(doc.rows).toHaveLength(1);
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
