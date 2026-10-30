// Marché P2P (01/10/2026, OKX le 30/10/2026) : distribution du carnet P2P, filtres et zoom.
import { describe, expect, it, vi } from 'vitest';
import { fmtClock } from '@/components/rates/market/format';
import {
  MARKET, binKey, blankFilters, niceAxis, bonziniFilters, bestPrice, histogram, impliedRate, levels, matcher, median, sameFilters, zoomOf,
  type P2PAd,
} from '@/lib/p2pMarket';
import { fetchOkxBook, okxFetcher, toAd } from '../../../supabase/functions/binance-p2p-book/okx';

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
    const f = bonziniFilters('binance', 'CNY', METHODS);
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

  it('petit carnet : une annonce isolée hors de ±3 % de la médiane sort du graphique', () => {
    const okxXaf = [622.8, 623, 624.6, 625, 625.4, 626, 627, 628, 700, 750].map((p) => ad(p));
    const z = zoomOf(okxXaf, 'XAF', blankFilters(), false)!;
    expect(z.mode).toBe('auto');
    expect(z.lo).toBe(622.8);
    expect(z.hi).toBeLessThan(700);
    expect(zoomOf(okxXaf, 'XAF', blankFilters(), true)!.hi).toBe(750);
  });

  it('« tout le carnet » et la fourchette choisie l’emportent sur l’auto', () => {
    expect(zoomOf(book, 'CNY', blankFilters(), true)!.lo).toBe(6.03);
    const z = zoomOf(book, 'CNY', { ...blankFilters(), lo: 6.6, hi: 6.62 }, false)!;
    expect([z.mode, z.lo, z.hi]).toEqual(['custom', 6.6, 6.62]);
  });
});

describe('heure des relevés', () => {
  it('se lit dans le pays du marché : Chine (UTC+8) et Cameroun (UTC+1)', () => {
    const iso = '2026-10-01T16:38:46Z';
    expect(fmtClock(iso, MARKET.CNY.timeZone)).toBe('00:38:46');
    expect(fmtClock(iso, MARKET.XAF.timeZone)).toBe('17:38:46');
    expect(fmtClock(iso, MARKET.XAF.timeZone, false)).toBe('17:38');
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

describe('OKX (30/10/2026)', () => {
  const OKX_METHODS = [{ id: 'aliPay', name: 'Alipay' }, { id: 'bank', name: 'Virement bancaire' }, { id: 'wxPay', name: 'WeChat' }];

  it('le filtre Bonzini OKX vise Alipay et WeChat avec les identifiants OKX', () => {
    const f = bonziniFilters('okx', 'CNY', OKX_METHODS);
    expect(f.pay).toEqual(['aliPay', 'wxPay']);
    const ok = matcher(f, OKX_METHODS);
    expect(ok(ad(6.63, { pay: 0b100, orders: 5_000 }))).toBe(true); // WeChat, annonceur établi
    expect(ok(ad(6.63, { pay: 0b010, orders: 5_000 }))).toBe(false); // virement seul
    expect(ok(ad(6.63, { pay: 0b100, orders: 500 }))).toBe(false); // 500 ordres au total : trop peu chez OKX
    // les identifiants Binance n'existent pas chez OKX : pas de filtre de paiement fantôme
    expect(bonziniFilters('binance', 'CNY', OKX_METHODS).pay).toEqual([]);
    // OKX publie les ordres au TOTAL : seuil plus haut que les 200/mois de Binance
    expect(bonziniFilters('okx', 'CNY', OKX_METHODS).minOrders).toBe(1_000);
    expect(bonziniFilters('binance', 'CNY', METHODS).minOrders).toBe(200);
  });

  it('l’ancien appel bonziniFilters(fiat, methods) reste valable et vaut Binance', () => {
    expect(bonziniFilters('CNY', METHODS)).toEqual(bonziniFilters('binance', 'CNY', METHODS));
  });

  it('convertit une annonce OKX au format commun', () => {
    const a = toAd({ price: '6.65', availableAmount: '33067.00', quoteMinAmountPerOrder: '99999.00', quoteMaxAmountPerOrder: '219895.55',
      completedOrderQuantity: 2559, completedRate: '0.9770', paymentMethods: ['bank', 'wxPay'], paymentTimeoutMinutes: '20', creatorType: 'diamond', nickName: 'X' },
    ['aliPay', 'bank', 'wxPay']);
    expect(a).toEqual([6.65, 33067, 99999, 219896, 2559, 977, 0b110, 20, 2, 'X']);
    expect(toAd({ price: 'abc' }, [])).toBeNull();
  });

  // Annonces OKX factices : prix décroissants, limites [min, max] en CNY.
  const mk = (n: number, start: number, pm: string, idp: string, min = 100, max = 1_000_000) =>
    Array.from({ length: n }, (_, i) => ({ id: `${idp}${i}`, price: (start - i * 0.0001).toFixed(4), availableAmount: '100',
      quoteMinAmountPerOrder: String(min), quoteMaxAmountPerOrder: String(max), paymentMethods: [pm], completedRate: '1', creatorType: 'certified' }));
  const top = [...mk(150, 6.65, 'aliPay', 'a'), ...mk(50, 6.64, 'bank', 'b')]; // 200 = plein
  const query = (u: string) => {
    const p = new URL(u).searchParams;
    return { pm: p.get('paymentMethod')!, amount: Number(p.get('quoteMinAmountPerOrder') ?? 0) };
  };

  it('lit le bas du carnet : par mode de paiement, puis par montant pour les modes encore pleins', async () => {
    // bas du carnet Alipay (6,40) : n'entre dans les 200 qu'en cherchant un petit montant
    const low = mk(80, 6.40, 'aliPay', 'low', 10, 500);
    const calls: string[] = [];
    const book = await fetchOkxBook('CNY', async (u) => {
      const { pm, amount } = query(u);
      calls.push(amount ? `${pm}@${amount}` : pm);
      if (pm === 'all') return top;
      if (pm === 'bank') return mk(50, 6.64, 'bank', 'b'); // sous 200 : lu en entier
      return amount && amount <= 500 ? [...mk(120, 6.65, 'aliPay', 'a'), ...low] : [...mk(150, 6.65, 'aliPay', 'a'), ...mk(50, 6.60, 'aliPay', 'c')];
    });
    expect(calls.slice(0, 3)).toEqual(['all', 'aliPay', 'bank']);
    // seul le mode encore plein est redécoupé, par 4 montants (16 recherches au plus pour 3 modes)
    expect(calls.slice(3)).toEqual(['aliPay@150', 'aliPay@1500', 'aliPay@15000', 'aliPay@400000']);
    expect(book.total).toBe(150 + 50 + 50 + 80);
    expect(book.ads.filter((a) => a[0] < 6.5)).toHaveLength(80);
    expect(book.capped).toBe(true); // Alipay toujours plein : il peut en manquer
    expect(book.methods.map((m) => m.name)).toEqual(['Alipay', 'Virement bancaire']);
  });

  it('carnet complet quand chaque mode tient sous 200', async () => {
    const calls: string[] = [];
    const complete = await fetchOkxBook('CNY', async (u) => {
      const { pm } = query(u); calls.push(pm);
      return pm === 'all' ? top : pm === 'aliPay' ? mk(150, 6.65, 'aliPay', 'a') : mk(50, 6.64, 'bank', 'b');
    });
    expect([complete.total, complete.capped]).toEqual([200, false]);
    expect(calls).toEqual(['all', 'aliPay', 'bank']); // aucune recherche par montant
    // côté Cameroun, carnet court : une seule requête, rien de caché
    const small = await fetchOkxBook('XAF', async () => mk(30, 623, 'MTN Mobile Money', 'x'));
    expect([small.total, small.capped, small.side]).toEqual([30, false, 'BUY']);
  });

  // Les recherches perdues ont une seconde chance après 2 s : horloge simulée.
  const settle = async <T,>(p: Promise<T>) => {
    const out = p.then((v) => ({ v }), (e: Error) => ({ e }));
    await vi.advanceTimersByTimeAsync(120_000);
    return out;
  };

  it('une recherche perdue a une seconde chance ; un mode perdu est lu par montant', async () => {
    vi.useFakeTimers();
    try {
      const seen = new Map<string, number>();
      const r = await settle(fetchOkxBook('CNY', async (u) => {
        const { pm, amount } = query(u);
        const k = `${pm}@${amount}`, n = (seen.get(k) ?? 0) + 1;
        seen.set(k, n);
        if (pm === 'all') return top;
        if (pm === 'aliPay') return mk(150, 6.65, 'aliPay', 'a');
        if (n === 1) return null; // virement : chaque recherche échoue une première fois
        return amount ? mk(80, 6.50, 'bank', 'bb') : mk(50, 6.64, 'bank', 'b');
      }));
      expect('v' in r && r.v.total).toBe(150 + 50 + 80); // le bas du carnet « virement » est là
      expect(seen.get('bank@0')).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refuse le relevé si une recherche reste perdue après sa seconde chance', async () => {
    vi.useFakeTimers();
    try {
      const full = mk(200, 6.65, 'aliPay', 'a');
      const r = await settle(fetchOkxBook('CNY', async (u) => (query(u).amount === 15_000 ? null : full)));
      expect('e' in r && r.e.message).toBe('Carnet OKX incomplet (1 recherche refusée par OKX). Réessayez dans un instant.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('abandonne passé 45 s plutôt que de dépasser la limite de Supabase', async () => {
    vi.useFakeTimers();
    try {
      // 3 modes pleins, OKX met 20 s à répondre à chaque recherche
      const full = [...mk(70, 6.65, 'aliPay', 'a'), ...mk(70, 6.64, 'wxPay', 'w'), ...mk(60, 6.63, 'bank', 'b')];
      let calls = 0;
      const r = await settle(fetchOkxBook('CNY', async () => { calls++; await new Promise((ok) => setTimeout(ok, 20_000)); return full; }));
      expect('e' in r && r.e.message).toContain('OKX limite les demandes');
      expect(calls).toBeLessThan(1 + 3 + 12); // les 12 recherches par montant n'ont pas toutes été lancées
    } finally {
      vi.useRealTimers();
    }
  });

  it('OKX ne répond pas : erreur claire', async () => {
    await expect(fetchOkxBook('CNY', async () => null)).rejects.toThrow('OKX ne répond pas');
  });

  it('un 429 d’OKX suspend les requêtes au moins une seconde, puis réessaie', async () => {
    vi.useFakeTimers();
    const at: number[] = [];
    const fetchMock = vi.fn(async () => {
      at.push(Date.now());
      return at.length === 1
        ? new Response('{"msg":"Too many requests","code":"50011"}', { status: 429 })
        : new Response(JSON.stringify({ code: 0, data: { buy: [{ id: '1' }] } }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const p = okxFetcher('CNY')('https://www.okx.com/x');
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await p).toEqual([{ id: '1' }]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(at[1] - at[0]).toBeGreaterThanOrEqual(1_000);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe('axe du graphique', () => {
  it('graduations rondes : 29 % → 0-10-20-30, 18 % → pas de 5, 0,4 % → pas de 1', () => {
    expect(niceAxis(29.4)).toEqual({ max: 30, step: 10 });
    expect(niceAxis(18.4)).toEqual({ max: 20, step: 5 });
    expect(niceAxis(0.4)).toEqual({ max: 1, step: 1 });
    expect(niceAxis(50)).toEqual({ max: 60, step: 20 });
  });
});
