// Le relevé de compte refait (28/09/2026) : ce que le fondateur ne voyait pas
// — le TAUX et le montant en ¥ de chaque paiement — et des soldes justes.
import { describe, expect, it } from 'vitest';
import {
  buildStatementDocument, buildStatementRow, statementFileName, statementNumber, statementPages, statementRmb, statementTotals,
  type StatementDetails, type StatementEntry,
} from '@/lib/accountStatement';

const details: StatementDetails = {
  payments: {
    p1: { reference: 'BZ-PY-2026-1110', amountRmb: 10000, rate: 10850, method: 'alipay', beneficiary: 'Guangzhou Hongda Trading', status: 'completed' },
    p2: { reference: 'BZ-PY-2026-1111', amountRmb: 850, rate: 10850, method: 'wechat', beneficiary: 'Yiwu Jinli', status: 'processing' },
    p3: { reference: 'BZ-PY-2026-1112', amountRmb: 2782, rate: 10800, method: 'bank_transfer', beneficiary: null, status: 'cancelled_by_admin' },
  },
  deposits: { d1: { reference: 'BZ-DP-2026-0793', method: 'bank_transfer', bank: 'Ecobank Cameroun' } },
};

const e = (id: string, entryType: string, amountXAF: number, before: number, after: number, ref: [string, string] | null, at: string, description?: string): StatementEntry =>
  ({ id, entryType, amountXAF, balanceBefore: before, balanceAfter: after, referenceType: ref?.[0] ?? null, referenceId: ref?.[1] ?? null, createdAt: at, description: description ?? null });

const entries: StatementEntry[] = [
  // Reçues dans le désordre : le relevé les trie.
  e('4', 'PAYMENT_RESERVED', 78341, 3_078_341 + 921_659 - 921_659, 3_000_000, ['payment', 'p2'], '2026-09-12T09:00:00Z'),
  e('1', 'DEPOSIT_VALIDATED', 5_000_000, 0, 5_000_000, ['deposit', 'd1'], '2026-09-02T08:00:00Z'),
  e('2', 'PAYMENT_RESERVED', 921_659, 5_000_000, 4_078_341, ['payment', 'p1'], '2026-09-05T10:00:00Z'),
  e('3', 'PAYMENT_EXECUTED', 0, 4_078_341, 4_078_341, ['payment', 'p1'], '2026-09-05T11:00:00Z'),
  e('5', 'PAYMENT_RESERVED', 257_593, 3_000_000, 2_742_407, ['payment', 'p3'], '2026-09-13T09:00:00Z'),
  e('6', 'PAYMENT_CANCELLED_REFUNDED', 257_593, 2_742_407, 3_000_000, ['payment', 'p3'], '2026-09-14T09:00:00Z'),
  e('7', 'ADMIN_DEBIT', 150_000, 3_000_000, 2_850_000, ['adjustment', 'x'], '2026-09-15T09:00:00Z', 'Frais de dédouanement avancés'),
];
// La ligne 4 démarre au solde laissé par la ligne 2 (le paiement exécuté ne bouge rien).
entries[0].balanceBefore = 4_078_341;
entries[0].balanceAfter = 4_000_000;
entries[4].balanceBefore = 4_000_000; entries[4].balanceAfter = 3_742_407;
entries[5].balanceBefore = 3_742_407; entries[5].balanceAfter = 4_000_000;
entries[6].balanceBefore = 4_000_000; entries[6].balanceAfter = 3_850_000;

const range = { from: new Date('2026-08-31T23:00:00Z'), to: new Date('2026-09-30T22:59:59Z') };
const build = (lang: 'fr' | 'en' = 'fr') => buildStatementDocument({ lang, client: { name: 'Jean-Paul Kamdem', code: 'BZ-4K7Q' }, entries, details, range, now: new Date('2026-09-28T09:05:00Z') });

describe('le relevé de compte', () => {
  it('montre, pour chaque paiement, le taux (¥ pour 1 000 000 XAF), le montant ¥, le mode et le bénéficiaire', () => {
    const doc = build();
    const pay = doc.rows.find((r) => r.reference === 'BZ-PY-2026-1110')!;
    expect(pay).toMatchObject({ kind: 'payment', label: 'Paiement · Alipay', detail: 'Guangzhou Hongda Trading', rate: 10850, amountRmb: 10000, debit: 921_659, credit: 0 });
    const dep = doc.rows.find((r) => r.kind === 'deposit')!;
    expect(dep).toMatchObject({ label: 'Dépôt · Virement bancaire', detail: 'Ecobank Cameroun', reference: 'BZ-DP-2026-0793', credit: 5_000_000 });
  });

  it('trie, écarte les écritures sans effet (paiement exécuté) et lit les soldes aux bons endroits', () => {
    const doc = build();
    expect(doc.rows.map((r) => r.date)).toEqual([...doc.rows.map((r) => r.date)].sort());
    expect(doc.rows).toHaveLength(6);
    expect(doc.openingBalance).toBe(0);
    expect(doc.closingBalance).toBe(3_850_000);
  });

  it('marque « en cours » un paiement pas encore exécuté, « annulé » un paiement annulé et remboursé', () => {
    const rows = build().rows;
    expect(rows.find((r) => r.reference === 'BZ-PY-2026-1111')).toMatchObject({ pending: true, cancelled: false });
    expect(rows.find((r) => r.kind === 'payment' && r.reference === 'BZ-PY-2026-1112')).toMatchObject({ pending: false, cancelled: true });
    const refund = rows.find((r) => r.kind === 'refund')!;
    expect(refund.detail).toBe('Paiement annulé BZ-PY-2026-1112');
    // La colonne ¥ reste celle des ¥ payés.
    expect(refund.amountRmb).toBeNull();
  });

  it('compte les ¥ payés et le taux moyen SANS le paiement annulé', () => {
    const { totals } = build();
    expect(totals.rmb).toBe(10850);
    expect(totals.xafForRmb).toBe(921_659 + 78_341);
    expect(totals.averageRate).toBe(10850);
    expect(totals.payments).toBe(3);
    expect(totals.deposits).toBe(1);
  });

  it('écrit le motif d’un ajustement, sans référence technique', () => {
    const adj = build().rows.find((r) => r.kind === 'debit')!;
    expect(adj).toMatchObject({ label: 'Ajustement · Débit', detail: 'Frais de dédouanement avancés', reference: '—', debit: 150_000 });
  });

  it('période vide : ouverture = clôture = solde d’avant la période ; un découvert reste négatif', () => {
    const doc = buildStatementDocument({ lang: 'fr', client: { name: 'X' }, entries: [], details, range, balanceBeforeRange: -250_000 });
    expect(doc.rows).toEqual([]);
    expect(doc.openingBalance).toBe(-250_000);
    expect(doc.closingBalance).toBe(-250_000);
    expect(statementTotals([]).averageRate).toBeNull();
  });

  it('en anglais : mots, dates et nombres (virgules)', () => {
    const doc = build('en');
    expect(doc.rows.find((r) => r.kind === 'payment')!.label).toBe('Payment · Alipay');
    expect(doc.periodFrom).toBe('1 September 2026');
    expect(statementNumber(1_250_000, 'en')).toBe('1,250,000');
    expect(statementNumber(-78_704, 'fr')).toBe('-78 704');
    expect(statementRmb(2782.5, 'en')).toBe('2,782.50');
    expect(statementRmb(850, 'fr')).toBe('850');
  });

  it('nomme le fichier par client, période et langue', () => {
    expect(statementFileName(build('fr'), range)).toBe('releve_Jean-Paul-Kamdem_2026-09-01_2026-09-30.pdf');
    expect(statementFileName(build('en'), range)).toBe('statement_Jean-Paul-Kamdem_2026-09-01_2026-09-30.pdf');
  });

  it('découpe les pages lui-même, et garde la place du solde de clôture sur la dernière', () => {
    const rows = Array.from({ length: 30 }, (_, i) => i);
    const pages = statementPages(rows, 9, 16);
    expect(pages.map((p) => p.length)).toEqual([9, 16, 5]);
    expect(pages.flat()).toEqual(rows);
    // Dernière page pleine : les totaux passent sur une page à eux.
    expect(statementPages(Array.from({ length: 25 }, (_, i) => i), 9, 16).map((p) => p.length)).toEqual([9, 16, 0]);
    expect(statementPages([], 9, 16)).toEqual([[]]);
  });

  it('ignore une écriture de test', () => {
    const row = buildStatementRow(entries[1], details, 'fr');
    expect(row.kind).toBe('deposit');
    const doc = buildStatementDocument({ lang: 'fr', client: { name: 'X' }, entries: [{ ...entries[1], isTest: true }], details, range });
    expect(doc.rows).toHaveLength(0);
  });
});
