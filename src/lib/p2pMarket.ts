// ============================================================
// Marché Binance P2P — logique pure du sous-module « Marché Binance »
// (module Taux de change). Le carnet vient de l'edge function
// `binance-p2p-book` ; tout le reste (filtres, paliers, médiane, zoom) se
// calcule ici, côté écran, sur un seul relevé — exactement comme Binance.
//
//   CNY = vente en Chine : annonceurs qui achètent l'USDT → meilleur prix = le plus HAUT
//   XAF = achat au Cameroun : annonceurs qui vendent l'USDT → meilleur prix = le plus BAS
//
// Les pourcentages sont TOUJOURS calculés sur toutes les annonces qui passent
// les filtres ; le zoom ne change que ce que le graphique affiche.
// ============================================================

export type P2PFiat = 'CNY' | 'XAF';

/** Tenir en phase avec supabase/functions/binance-p2p-book (type Ad).
 *  [prix, usdtDispo, minFiat, maxFiat, ordresMois, réussite‰, masquePaiement, délaiMin, type, pseudo] */
export type P2PAd = [number, number, number, number, number, number, number, number, 0 | 1 | 2, string];

export interface P2PBook {
  fiat: P2PFiat;
  side: 'SELL' | 'BUY';
  fetchedAt: string;
  total: number;
  methods: { id: string; name: string }[];
  ads: P2PAd[];
}

export const AD = { price: 0, usdt: 1, min: 2, max: 3, orders: 4, finish: 5, pay: 6, time: 7, kind: 8, nick: 9 } as const;

export interface P2PFilters {
  /** identifiants Binance des modes de paiement (vide = tous). Des ids et
   *  non des positions : l'ordre des méthodes de Binance peut changer entre
   *  deux relevés, un masque mémorisé désignerait alors d'autres méthodes. */
  pay: string[];
  /** montant fiat à traiter (0 = tous) : l'annonce doit l'accepter dans ses limites */
  amount: number;
  /** 0 tous · 1 marchands (et pro) · 2 pro seulement */
  kind: 0 | 1 | 2;
  minOrders: number;
  /** réussite minimale en ‰ (950 = 95 %) */
  minFinish: number;
  /** délai de paiement maximal en minutes (0 = tous) */
  maxTime: number;
  /** zoom du graphique (null = automatique) */
  lo: number | null;
  hi: number | null;
}

export const MARKET: Record<P2PFiat, {
  label: string;
  short: string;
  best: 'max' | 'min';
  bins: number[];
  defaultBin: number;
  amounts: number[];
  bonziniPay: string[];
}> = {
  CNY: {
    label: 'Vente en Chine', short: 'CNY', best: 'max', bins: [0.01, 0.02, 0.05], defaultBin: 0.01,
    amounts: [5_000, 20_000, 100_000, 500_000], bonziniPay: ['ALIPAY', 'WECHAT'],
  },
  XAF: {
    label: 'Achat au Cameroun', short: 'XAF', best: 'min', bins: [0.5, 1, 2, 5], defaultBin: 1,
    amounts: [500_000, 1_000_000, 5_000_000, 20_000_000], bonziniPay: [],
  },
};

export const blankFilters = (): P2PFilters => ({ pay: [], amount: 0, kind: 0, minOrders: 0, minFinish: 0, maxTime: 0, lo: null, hi: null });

/** Bit d'une méthode dans le masque d'une annonce (le serveur s'arrête à 31). */
export const methodBit = (i: number) => (i >= 0 && i < 31 ? 1 << i : 0);

export function payMask(methods: P2PBook['methods'], ids: string[]): number {
  return ids.reduce((mask, id) => mask | methodBit(methods.findIndex((m) => m.id === id)), 0);
}

/** Filtre Bonzini : ≥ 200 ordres/mois, ≥ 95 % de réussite (+ Alipay/WeChat côté Chine). */
export function bonziniFilters(fiat: P2PFiat, methods: P2PBook['methods']): P2PFilters {
  return { ...blankFilters(), pay: MARKET[fiat].bonziniPay.filter((id) => methods.some((m) => m.id === id)), minOrders: 200, minFinish: 950 };
}

export const sameFilters = (a: P2PFilters, b: P2PFilters) =>
  a.pay.length === b.pay.length && a.pay.every((id) => b.pay.includes(id)) && a.amount === b.amount && a.kind === b.kind && a.minOrders === b.minOrders
  && a.minFinish === b.minFinish && a.maxTime === b.maxTime && a.lo === b.lo && a.hi === b.hi;

/** Prédicat d'un jeu de filtres pour un carnet (le masque est résolu une fois). */
export function matcher(f: P2PFilters, methods: P2PBook['methods']): (ad: P2PAd) => boolean {
  const mask = payMask(methods, f.pay);
  // ids absents du carnet (méthode retirée par Binance) : ignorés plutôt que de tout masquer
  return (ad) => passes(ad, f, mask);
}

export function passes(ad: P2PAd, f: P2PFilters, mask: number): boolean {
  return (!mask || (ad[AD.pay] & mask) !== 0)
    && (!f.amount || (ad[AD.min] <= f.amount && ad[AD.max] >= f.amount))
    && ad[AD.kind] >= f.kind
    && ad[AD.orders] >= f.minOrders
    && ad[AD.finish] >= f.minFinish
    && (!f.maxTime || ad[AD.time] <= f.maxTime);
}

/** Médiane par nombre d'annonces (pas pondérée par le volume). */
export function median(ads: P2PAd[]): number {
  if (!ads.length) return NaN;
  const p = ads.map((a) => a[AD.price]).sort((x, y) => x - y);
  const h = p.length >> 1;
  return p.length % 2 ? p[h] : (p[h - 1] + p[h]) / 2;
}

export function bestPrice(ads: P2PAd[], fiat: P2PFiat): number {
  if (!ads.length) return NaN;
  let best = ads[0][AD.price];
  for (const a of ads) best = MARKET[fiat].best === 'max' ? Math.max(best, a[AD.price]) : Math.min(best, a[AD.price]);
  return best;
}

/** Décimales d'affichage d'un prix de palier (6,64 · 614,5 · 611). */
export const priceDecimals = (fiat: P2PFiat, bin: number) => (bin < 0.1 ? 2 : bin < 1 ? 1 : fiat === 'XAF' ? 0 : 2);

/** Indice de palier : floor robuste aux erreurs flottantes (6.64 / 0.01 = 663.999…). */
export const binKey = (price: number, bin: number) => Math.floor(price / bin + 1e-6);
export const binLow = (key: number, bin: number) => Math.round(key * bin * 100) / 100;

export interface P2PLevel {
  key: number;
  /** borne basse du palier */
  price: number;
  count: number;
  usdt: number;
  /** % du nombre d'annonces filtrées */
  shareCount: number;
  /** % des USDT disponibles filtrés */
  shareUsdt: number;
  ads: P2PAd[];
}

/** Paliers non vides, triés par prix croissant. */
export function levels(ads: P2PAd[], bin: number): P2PLevel[] {
  const map = new Map<number, P2PLevel>();
  const totUsdt = ads.reduce((s, a) => s + a[AD.usdt], 0);
  for (const a of ads) {
    const key = binKey(a[AD.price], bin);
    let l = map.get(key);
    if (!l) { l = { key, price: binLow(key, bin), count: 0, usdt: 0, shareCount: 0, shareUsdt: 0, ads: [] }; map.set(key, l); }
    l.count++; l.usdt += a[AD.usdt]; l.ads.push(a);
  }
  const out = [...map.values()].sort((x, y) => x.key - y.key);
  for (const l of out) {
    l.shareCount = (l.count / ads.length) * 100;
    l.shareUsdt = totUsdt ? (l.usdt / totUsdt) * 100 : 0;
  }
  return out;
}

export interface P2PZoom {
  lo: number;
  hi: number;
  mode: 'auto' | 'full' | 'custom';
}

/**
 * Fenêtre du graphique. Auto : on écarte la longue traîne du MAUVAIS côté
 * (3 % des annonces), jamais le côté du meilleur prix — en Chine, 5 % des
 * annonces s'étalent de 6,03 à 6,49 et écrasent tout le reste.
 */
export function zoomOf(ads: P2PAd[], fiat: P2PFiat, f: P2PFilters, full: boolean): P2PZoom | null {
  if (!ads.length) return null;
  const p = ads.map((a) => a[AD.price]).sort((x, y) => x - y);
  let lo = p[0], hi = p[p.length - 1];
  let mode: P2PZoom['mode'] = 'full';
  if (f.lo != null || f.hi != null) {
    mode = 'custom';
    if (f.lo != null) lo = f.lo;
    if (f.hi != null) hi = f.hi;
    if (hi < lo) [lo, hi] = [hi, lo];
  } else if (!full && p.length >= 30) {
    if (MARKET[fiat].best === 'max') {
      const q = p[Math.floor(p.length * 0.03)];
      if (q > lo) { lo = q; mode = 'auto'; }
    } else {
      const q = p[Math.ceil(p.length * 0.97) - 1];
      if (q < hi) { hi = q; mode = 'auto'; }
    }
  }
  return { lo, hi, mode };
}

/**
 * Tous les paliers de la fenêtre, VIDES COMPRIS (c'est un histogramme : un
 * trou de prix doit se voir). Les parts restent celles de `levels`. Au-delà
 * de `maxBars`, on garde le côté du MEILLEUR prix (le haut pour le CNY).
 */
export function histogram(all: P2PLevel[], bin: number, zoom: P2PZoom, fiat: P2PFiat, maxBars = 400): P2PLevel[] {
  const byKey = new Map(all.map((l) => [l.key, l]));
  let k0 = binKey(zoom.lo, bin);
  let k1 = Math.max(k0, binKey(zoom.hi, bin));
  if (k1 - k0 + 1 > maxBars) {
    if (MARKET[fiat].best === 'max') k0 = k1 - maxBars + 1;
    else k1 = k0 + maxBars - 1;
  }
  const out: P2PLevel[] = [];
  for (let k = k0; k <= k1; k++) {
    out.push(byKey.get(k) ?? { key: k, price: binLow(k, bin), count: 0, usdt: 0, shareCount: 0, shareUsdt: 0, ads: [] });
  }
  return out;
}

/** Taux Bonzini : round(1e6 × CNY ÷ XAF / 10) × 10 — CNY pour 1 000 000 XAF. */
export function impliedRate(cny: number, xaf: number): number {
  if (!Number.isFinite(cny) || !Number.isFinite(xaf) || xaf <= 0) return NaN;
  return Math.round((1e6 * cny) / xaf / 10) * 10;
}
