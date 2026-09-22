// L'arithmétique du devis, celle que la base refait : au kilo, au m³, ou
// montant fixe ; entiers en XAF ; une ligne sans mesure ne se chiffre pas.
import { describe, expect, it } from 'vitest';
import { defaultBasis, defaultUnitPrice, lineAmount, lineNeedsMeasure, paidSentence, quoteBalance, quotePaid, quoteStatusMeta, quoteTotal, xaf, type QuotePayment } from '@/lib/cargoQuote';

describe('lineAmount', () => {
  it('au kilo : poids × prix, arrondi à l\'unité', () => {
    expect(lineAmount('per_kg', 8.4, 6500, null)).toBe(54600);
    expect(lineAmount('per_kg', 8.4, 6333, null)).toBe(53197);
  });
  it('au m³ : volume × prix', () => {
    expect(lineAmount('per_cbm', 0.096, 250000, null)).toBe(24000);
  });
  it('fixe : le montant tapé, quantité et prix unitaire ignorés', () => {
    expect(lineAmount('fixed', 8.4, 6500, 40000)).toBe(40000);
    expect(lineAmount('fixed', null, null, 12500.4)).toBe(12500);
  });
  it('sans quantité, une ligne au kilo vaut zéro', () => {
    expect(lineAmount('per_kg', null, 6500, null)).toBe(0);
  });
});

describe('le reste', () => {
  it('la base naturelle : kilo au bureau (Air), m³ à l\'entrepôt (Sea)', () => {
    expect(defaultBasis('office')).toBe('per_kg');
    expect(defaultBasis('warehouse')).toBe('per_cbm');
    const pricing = { air_per_kg_xaf: 6500, sea_per_cbm_xaf: 250000, currency: 'XAF' };
    expect(defaultUnitPrice('office', pricing)).toBe(6500);
    expect(defaultUnitPrice('warehouse', pricing)).toBe(250000);
    expect(defaultUnitPrice('office', null)).toBe(0);
  });
  it('une ligne de colis au kilo sans poids réclame une mesure ; une ligne fixe jamais', () => {
    expect(lineNeedsMeasure({ kind: 'parcel', basis: 'per_kg', quantity: null })).toBe(true);
    expect(lineNeedsMeasure({ kind: 'parcel', basis: 'per_kg', quantity: 0 })).toBe(true);
    expect(lineNeedsMeasure({ kind: 'parcel', basis: 'fixed', quantity: null })).toBe(false);
    expect(lineNeedsMeasure({ kind: 'fee', basis: 'fixed', quantity: null })).toBe(false);
  });
  it('le total additionne des entiers, remise comprise', () => {
    expect(quoteTotal([{ amount_xaf: 54600 }, { amount_xaf: 5000 }, { amount_xaf: -2500 }])).toBe(57100);
  });
  it('les états et le format', () => {
    expect(quoteStatusMeta(null).label).toBe('Sans prix');
    expect(quoteStatusMeta('sent').tone).toBe('info');
    expect(xaf(54600)).toMatch(/54.?600 XAF/);
  });
});

// ── Phase 2 : l'encaissé et le reste à payer, tels que la base les recalcule ──
const pay = (amount: number, cancelled = false): QuotePayment => ({
  id: `p${amount}`, receipt_no: 'RE-000001', amount_xaf: amount, method: 'cash', place: 'guangzhou', paid_at: '2026-09-21T10:00:00Z',
  reference: null, proof_path: null, note: null, received_by: null, created_at: '2026-09-21T10:00:00Z',
  cancelled_at: cancelled ? '2026-09-21T11:00:00Z' : null, cancel_reason: cancelled ? 'double saisie' : null,
});

describe('quotePaid / quoteBalance', () => {
  it('additionne les encaissements non annulés', () => {
    const q = { total_xaf: 219840, amount_paid_xaf: 0, payments: [pay(100000), pay(20000), pay(50000, true)] };
    expect(quotePaid(q)).toBe(120000);
    expect(quoteBalance(q)).toBe(99840);
  });
  it('sans la liste des paiements, se fie à la valeur de la base', () => {
    expect(quotePaid({ amount_paid_xaf: 5000 })).toBe(5000);
    expect(quoteBalance({ total_xaf: 4000, amount_paid_xaf: 5000 })).toBe(0);
  });
});

describe('paidSentence', () => {
  it('dit ce qu\'il reste', () => {
    expect(paidSentence(219840, 0)).toBe(`${xaf(219840)} à payer`);
    expect(paidSentence(219840, 120000)).toBe(`Payé ${xaf(120000)} sur ${xaf(219840)} · reste ${xaf(99840)}`);
    expect(paidSentence(219840, 219840)).toBe(`Payé · ${xaf(219840)}`);
    expect(paidSentence(0, 0)).toBe('Sans montant');
  });
});
