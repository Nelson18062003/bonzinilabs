// L'achat d'USDT (12/10/2026) : « quand je mets plusieurs comptes, je veux
// que ça totalise automatiquement, que ça le mette dans le montant payé, et
// que ça calcule les USDT reçus ». Chaque cas de la vraie vie, ici.
import { describe, it, expect } from 'vitest';
import {
  EMPTY_PURCHASE,
  addAccount,
  rateDeviation,
  removeAccount,
  resolvePurchase,
  splitAccounts,
  typeAmount,
  typeSplit,
  type PurchaseInputs,
} from '@/lib/treasuryPurchaseMath';

/** Tape une suite de valeurs dans l'ordre, comme l'opérateur. */
function typed(...steps: Array<['total' | 'rate' | 'usdt', number | null] | ['split', number, number | null] | ['split+'] | ['split-', number]>): PurchaseInputs {
  let s: PurchaseInputs = EMPTY_PURCHASE;
  for (const step of steps) {
    if (step[0] === 'split') s = typeSplit(s, step[1], step[2]);
    else if (step[0] === 'split+') s = s.splits.length === 1 ? splitAccounts(s) : addAccount(s);
    else if (step[0] === 'split-') s = removeAccount(s, step[1]);
    else s = typeAmount(s, step[0], step[1]);
  }
  return s;
}

describe('Un seul compte : deux montants, le troisième se calcule', () => {
  it('USDT + taux → le total payé en XAF', () => {
    const r = resolvePurchase(typed(['usdt', 10_000], ['rate', 655]));
    expect(r.total).toBe(6_550_000);
    expect(r.source).toEqual({ total: 'computed', rate: 'typed', usdt: 'typed' });
    expect(r.splits).toEqual([{ amount: 6_550_000, computed: true }]);
    expect(r.remaining).toBe(0);
  });

  it('total + taux → les USDT reçus (2 décimales)', () => {
    const r = resolvePurchase(typed(['total', 10_000_000], ['rate', 655]));
    expect(r.usdt).toBe(15_267.18);
    expect(r.source.usdt).toBe('computed');
  });

  it('total + USDT → le taux, sans arrondi dans le calcul', () => {
    const r = resolvePurchase(typed(['total', 10_000_000], ['usdt', 15_267.18]));
    expect(r.rate).toBeCloseTo(655.0001, 3);
    expect(r.source.rate).toBe('computed');
  });

  it('les trois tapés : le plus ancien se recalcule', () => {
    const r = resolvePurchase(typed(['total', 10_000_000], ['rate', 655], ['usdt', 15_000]));
    expect(r.source.total).toBe('computed');
    expect(r.total).toBe(9_825_000);
  });

  it('vider un champ le rend calculable', () => {
    const r = resolvePurchase(typed(['usdt', 10_000], ['rate', 655], ['total', 6_600_000], ['usdt', null]));
    expect(r.source.usdt).toBe('computed');
    expect(r.usdt).toBe(10_076.34);
  });

  it('un seul montant : rien ne s’invente', () => {
    const r = resolvePurchase(typed(['rate', 655]));
    expect(r.total).toBeNull();
    expect(r.usdt).toBeNull();
    expect(r.remaining).toBeNull();
  });
});

describe('Plusieurs comptes, tous chiffrés : le total est la somme', () => {
  it('deux comptes + le taux → total automatique et USDT calculés', () => {
    const r = resolvePurchase(typed(['split+'], ['split', 0, 6_000_000], ['split', 1, 4_000_000], ['rate', 655]));
    expect(r.total).toBe(10_000_000);
    expect(r.totalLocked).toBe(true);
    expect(r.source.total).toBe('sum');
    expect(r.usdt).toBe(15_267.18);
    expect(r.source.usdt).toBe('computed');
    expect(r.remaining).toBe(0);
  });

  it('deux comptes + les USDT reçus, sans taux → le taux se calcule', () => {
    const r = resolvePurchase(typed(['split+'], ['split', 0, 6_000_000], ['split', 1, 4_000_000], ['usdt', 15_000]));
    expect(r.total).toBe(10_000_000);
    expect(r.rate).toBeCloseTo(666.67, 2);
    expect(r.source.rate).toBe('computed');
  });

  it('un compte qui change : les USDT suivent le nouveau total', () => {
    const r = resolvePurchase(typed(['split+'], ['split', 0, 6_000_000], ['split', 1, 4_000_000], ['rate', 655], ['split', 1, 3_000_000]));
    expect(r.total).toBe(9_000_000);
    expect(r.usdt).toBe(13_740.46);
  });

  it('taux ET USDT tapés : le plus ancien suit le total', () => {
    const r = resolvePurchase(typed(['rate', 655], ['usdt', 15_000], ['split+'], ['split', 0, 6_000_000], ['split', 1, 4_000_000]));
    expect(r.source.rate).toBe('computed');
    expect(r.rate).toBeCloseTo(666.67, 2);
    expect(r.usdt).toBe(15_000);
  });

  it('un total tapé avant ne gêne pas : la somme l’emporte', () => {
    const r = resolvePurchase(typed(['total', 10_000_000], ['split+'], ['split', 0, 6_000_000], ['split', 1, 5_000_000]));
    expect(r.total).toBe(11_000_000);
    expect(r.totalLocked).toBe(true);
  });

  it('trois comptes', () => {
    const r = resolvePurchase(typed(['split+'], ['split+'], ['split', 0, 1_000_000], ['split', 1, 2_000_000], ['split', 2, 3_500_000], ['rate', 650]));
    expect(r.total).toBe(6_500_000);
    expect(r.usdt).toBe(10_000);
  });
});

describe('Plusieurs comptes, un seul sans montant : il prend le reste', () => {
  it('total connu + un compte chiffré → le second paie le reste', () => {
    const r = resolvePurchase(typed(['total', 10_000_000], ['rate', 655], ['split+'], ['split', 0, 6_000_000]));
    expect(r.splits).toEqual([
      { amount: 6_000_000, computed: false },
      { amount: 4_000_000, computed: true },
    ]);
    expect(r.remaining).toBe(0);
    expect(r.usdt).toBe(15_267.18);
  });

  it('USDT + taux (total calculé) + un compte chiffré → le reste sur l’autre', () => {
    const r = resolvePurchase(typed(['usdt', 10_000], ['rate', 655], ['split+'], ['split', 1, 2_550_000]));
    expect(r.total).toBe(6_550_000);
    expect(r.splits[0]).toEqual({ amount: 4_000_000, computed: true });
    expect(r.remaining).toBe(0);
  });

  it('le compte chiffré dépasse le total : pas de reste négatif inventé', () => {
    const r = resolvePurchase(typed(['total', 5_000_000], ['split+'], ['split', 0, 6_000_000]));
    expect(r.splits[1]).toEqual({ amount: null, computed: false });
    expect(r.remaining).toBe(-1_000_000);
  });

  it('total inconnu : rien à déduire', () => {
    const r = resolvePurchase(typed(['rate', 655], ['split+'], ['split', 0, 6_000_000]));
    expect(r.total).toBeNull();
    expect(r.remaining).toBeNull();
    expect(r.splits[1].amount).toBeNull();
  });
});

describe('Plusieurs comptes sans montant : il reste à répartir', () => {
  it('au passage à plusieurs comptes, les deux partent vides et le total reste', () => {
    const s = typed(['total', 10_000_000], ['split+']);
    expect(s.splits).toEqual([null, null]);
    const r = resolvePurchase(s);
    expect(r.total).toBe(10_000_000);
    expect(r.remaining).toBe(10_000_000);
  });

  it('trois comptes, un seul chiffré : le reste est annoncé, pas réparti', () => {
    const r = resolvePurchase(typed(['total', 9_000_000], ['split+'], ['split+'], ['split', 0, 3_000_000]));
    expect(r.remaining).toBe(6_000_000);
    expect(r.splits.filter((s) => s.computed)).toHaveLength(0);
  });
});

describe('Retirer un compte', () => {
  it('il en reste un, chiffré : son montant devient le total', () => {
    const s = typed(['rate', 655], ['split+'], ['split', 0, 6_000_000], ['split', 1, 4_000_000], ['split-', 1]);
    const r = resolvePurchase(s);
    expect(s.splits).toEqual([null]);
    expect(r.total).toBe(6_000_000);
    expect(r.usdt).toBe(9_160.31);
  });

  it('il en reste un, vide : le total ne bouge pas', () => {
    const s = typed(['usdt', 10_000], ['rate', 655], ['split+'], ['split', 1, 2_000_000], ['split-', 1]);
    const r = resolvePurchase(s);
    expect(r.total).toBe(6_550_000);
    expect(r.source.total).toBe('computed');
  });

  it('il en reste plusieurs : les autres gardent leur montant', () => {
    const s = typed(['split+'], ['split+'], ['split', 0, 1], ['split', 1, 2], ['split', 2, 3], ['split-', 1]);
    expect(s.splits).toEqual([1, 3]);
  });
});

describe('Taux inhabituel (faute de frappe probable)', () => {
  it('655 tapé 6 550 : signalé', () => {
    expect(rateDeviation(6_550, 652)).toBeGreaterThan(8);
  });
  it('dans les 8 % : rien', () => {
    expect(rateDeviation(670, 652)).toBeNull();
  });
  it('sans référence : rien', () => {
    expect(rateDeviation(655, 0)).toBeNull();
    expect(rateDeviation(null, 652)).toBeNull();
  });
});
