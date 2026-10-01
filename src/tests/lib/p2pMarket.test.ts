// Marché Binance (01/10/2026) : distribution du carnet P2P, filtres et zoom.
import { describe, expect, it } from 'vitest';
import {
  binKey, blankFilters, bonziniFilters, bestPrice, histogram, impliedRate, levels, matcher, median, sameFilters, zoomOf,
  type P2PAd,
} from '@/lib/p2pMarket';

const METHODS = [{ id: 'ALIPAY', name: 'Alipay' }, { id: 'BANK', name: 'Bank Transfer' }, { id: 'WECHAT', name: 'WeChat' }];
const ad = (price: number, o: Partial<{ usdt: number; min: number; max: number; orders: number; finish: number; pay: number; time: number; kind: 0 | 1 | 2 }> = {}): P2PAd =>
  [price, o.usdt ?? 100, o.min ?? 100, o.max ?? 10_000, o.orders ?? 500, o.finish ?? 990, o.pay ?? 1, o.time ?? 15, o.kind ?? 1, 'x'];

describe('paliers', () => {
  it('range 6,64 dans le palier 6,64 malgré l’arrondi flottant', () => {
    expect(binKey(6.64, 0.01)).toBe(664);
    expect(binKey(6.65, 0.01)).toBe(665);
    expect(binKey(614.99, 1)).toBe(614);
  });

  it('donne pour chaque prix le nombre d’annonces et sa part du total', () => {
    const ads = [ad(6.65), ad(6.65), ad(6.64), ad(6.63, { usdt: 700 })];
    const ls = levels(ads, 0.01);
    expect(ls.map((l) => [l.price, l.count])).toEqual([[6.63, 1], [6.64, 1], [6.65, 2]]);
    expect(ls[2].shareCount).toBe(50);
    expect(ls[0].shareUsdt).toBe(70);
  });

  it('l’histogramme garde les paliers vides de la fenêtre', () => {
    const ads = [ad(6.6), ad(6.63)];
    const h = histogram(levels(ads, 0.01), 0.01, { lo: 6.6, hi: 6.63, mode: 'full' }, 'CNY');
    expect(h.map((l) => l.count)).toEqual([1, 0, 0, 1]);
  });

  it('plafond de barres : garde le côté du meilleur prix', () => {
    const ls = levels([ad(1), ad(6.64)], 0.01);
    const cny = histogram(ls, 0.01, { lo: 1, hi: 6.64, mode: 'full' }, 'CNY', 10);
    expect(cny[cny.length - 1].price).toBe(6.64);
    const xaf = histogram(ls, 0.01, { lo: 1, hi: 6.64, mode: 'full' }, 'XAF', 10);
    expect(xaf[0].price).toBe(1);
  });
});

describe('filtres', () => {
  it('Bonzini = Alipay ou WeChat, 200 ordres, 95 %', () => {
    const f = bonziniFilters('CNY', METHODS);
    expect(f.pay).toEqual(['ALIPAY', 'WECHAT']);
    const ok = matcher(f, METHODS);
    expect(ok(ad(6.6, { pay: 0b100 }))).toBe(true); // WeChat seul
    expect(ok(ad(6.6, { pay: 0b010 }))).toBe(false); // virement seul
    expect(ok(ad(6.6, { orders: 199 }))).toBe(false);
    expect(ok(ad(6.6, { finish: 949 }))).toBe(false);
  });

  it('le filtre de paiement suit les ids, même si Binance réordonne ses méthodes', () => {
    const f = { ...blankFilters(), pay: ['WECHAT'] };
    const reordered = [METHODS[2], METHODS[0], METHODS[1]]; // WeChat passe en position 0
    expect(matcher(f, reordered)(ad(6.6, { pay: 0b001 }))).toBe(true);
    expect(matcher(f, reordered)(ad(6.6, { pay: 0b010 }))).toBe(false);
    expect(sameFilters({ ...blankFilters(), pay: ['A', 'B'] }, { ...blankFilters(), pay: ['B', 'A'] })).toBe(true);
  });

  it('le montant doit tenir dans les limites de l’annonce', () => {
    const ok = matcher({ ...blankFilters(), amount: 50_000 }, METHODS);
    expect(ok(ad(6.6, { min: 1_000, max: 60_000 }))).toBe(true);
    expect(ok(ad(6.6, { min: 1_000, max: 40_000 }))).toBe(false);
    expect(ok(ad(6.6, { min: 60_000, max: 90_000 }))).toBe(false);
  });

  it('« Pro » exclut les marchands simples, « Marchands » garde les pro', () => {
    expect(matcher({ ...blankFilters(), kind: 2 }, METHODS)(ad(6.6, { kind: 1 }))).toBe(false);
    expect(matcher({ ...blankFilters(), kind: 1 }, METHODS)(ad(6.6, { kind: 2 }))).toBe(true);
    expect(matcher({ ...blankFilters(), kind: 1 }, METHODS)(ad(6.6, { kind: 0 }))).toBe(false);
  });
});

describe('zoom', () => {
  // 97 annonces entre 6,50 et 6,66, 3 dans la traîne basse à 6,03
  const book = [...Array.from({ length: 97 }, (_, i) => ad(6.5 + (i % 17) / 100)), ad(6.03), ad(6.03), ad(6.03)];

  it('auto côté Chine : coupe la traîne basse, garde le meilleur prix (le plus haut)', () => {
    const z = zoomOf(book, 'CNY', blankFilters(), false)!;
    expect(z.mode).toBe('auto');
    expect(z.lo).toBeGreaterThan(6.03);
    expect(z.hi).toBe(6.66);
  });

  it('auto côté Cameroun : coupe la traîne HAUTE, garde le meilleur prix (le plus bas)', () => {
    const xaf = [...Array.from({ length: 97 }, (_, i) => ad(610 + (i % 10))), ad(700), ad(700), ad(700)];
    const z = zoomOf(xaf, 'XAF', blankFilters(), false)!;
    expect(z.lo).toBe(610);
    expect(z.hi).toBeLessThan(700);
  });

  it('« tout le carnet » et la fourchette choisie l’emportent sur l’auto', () => {
    expect(zoomOf(book, 'CNY', blankFilters(), true)!.lo).toBe(6.03);
    const z = zoomOf(book, 'CNY', { ...blankFilters(), lo: 6.6, hi: 6.62 }, false)!;
    expect([z.mode, z.lo, z.hi]).toEqual(['custom', 6.6, 6.62]);
  });
});

describe('chiffres clés', () => {
  it('médiane par nombre d’annonces, meilleur prix selon le côté', () => {
    const ads = [ad(6.6), ad(6.62), ad(6.64), ad(6.67)];
    expect(median(ads)).toBeCloseTo(6.63);
    expect(bestPrice(ads, 'CNY')).toBe(6.67);
    expect(bestPrice(ads, 'XAF')).toBe(6.6);
  });

  it('taux = round(1e6 × CNY ÷ XAF / 10) × 10', () => {
    expect(impliedRate(6.62, 615)).toBe(10760);
    expect(impliedRate(6.62, NaN)).toBeNaN();
  });
});
