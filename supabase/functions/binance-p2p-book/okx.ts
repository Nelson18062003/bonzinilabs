// Carnet OKX P2P, converti au MÊME format que le carnet Binance (type Ad),
// pour que l'écran « Marché P2P » affiche l'un ou l'autre sans rien changer.
//
// Source : l'API publique du site OKX P2P (non documentée, comme celle de
// Binance) — GET /v3/c2c/tradingOrders/books.
//   CNY → side=buy  : annonceurs qui ACHÈTENT l'USDT (là où l'on vend en Chine)
//   XAF → side=sell : annonceurs qui VENDENT l'USDT (là où l'on achète au Cameroun)
//
// OKX ne renvoie jamais plus de 200 annonces par recherche (les 200 meilleurs
// prix), sans pagination — son propre site non plus. Côté Chine, le carnet en
// compte ~1 500 : s'arrêter à 200, ou même aux 200 de chaque mode de paiement
// (~520), cachait tout le bas du carnet et remontait la médiane de 6,55 à
// 6,62 (relevé du 30/10/2026). On découpe donc :
//   1. une recherche « tous modes » ; sous 200, le carnet est complet ;
//   2. une par mode de paiement ; un mode sous 200 est lu en entier ;
//   3. pour chaque mode encore plein, une recherche par MONTANT : OKX ne garde
//      que les annonces dont les limites acceptent ce montant, et d'autres
//      annonces entrent ainsi dans les 200. On fusionne par identifiant.
// Depuis Supabase, OKX refuse (429) au-delà d'une vingtaine de recherches
// rapprochées (journaux du 30/10/2026 : 24 montants par mode, soit 76
// recherches, échouaient à chaque relevé). On s'en tient donc à 4 montants
// par mode, 16 recherches : ~85 % du carnet (1 306 annonces sur 1 536 vues
// avec 48 montants), médiane juste à 0,01 près (6,56 contre 6,55).
// `capped` dit qu'un mode n'a pas pu être lu en entier.
//
// Différences avec Binance, assumées et affichées à l'écran :
//   · ordres = nombre TOTAL d'ordres réalisés (OKX ne publie pas le mois) ;
//   · type d'annonceur : diamond → 2, certified → 1, autres → 0.

export type Fiat = "CNY" | "XAF";
export type Ad = [number, number, number, number, number, number, number, number, 0 | 1 | 2, string];
export interface OkxBook {
  exchange: "okx";
  fiat: Fiat;
  side: "SELL" | "BUY";
  fetchedAt: string;
  total: number;
  capped: boolean;
  methods: { id: string; name: string }[];
  ads: Ad[];
}

const BOOKS = "https://www.okx.com/v3/c2c/tradingOrders/books";
const PAGE_CAP = 200;
const MAX_METHODS = 8;
// Montants essayés par mode (en devise locale). CNY : le meilleur jeu de 4
// sur les relevés du 30/10/2026 (petits tickets, ~1 500, ~15 000, gros
// tickets) ; XAF : le carnet tient sous 200, ces montants ne servent pas.
const AMOUNTS: Record<Fiat, number[]> = { CNY: [150, 1_500, 15_000, 400_000], XAF: [5_000, 50_000, 500_000, 5_000_000] };
// 4 requêtes à la fois, une nouvelle toutes les 250 ms au plus, pause
// générale sur un 429. Une recherche encore perdue a une seconde chance
// après 2 s ; ensuite, le relevé est refusé (16 recherches : chacune
// compte). Au-delà de 45 s, on abandonne (Supabase coupe à 150 s).
const CONCURRENCY = 4;
const GAP_MS = 250;
const RETRY_PAUSE_MS = 2_000;
const DEADLINE_MS = 45_000;
// côté OKX de la requête et nom de la liste dans la réponse
const SIDE: Record<Fiat, "buy" | "sell"> = { CNY: "buy", XAF: "sell" };
const METHOD_NAMES: Record<string, string> = { aliPay: "Alipay", wxPay: "WeChat", bank: "Virement bancaire" };

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
type Fetcher = (url: string) => Promise<Raw[] | null>;

function url(fiat: Fiat, paymentMethod: string, amount?: number): string {
  const q = new URLSearchParams({
    quoteCurrency: fiat, baseCurrency: "usdt", side: SIDE[fiat], paymentMethod, userType: "all",
    showTrade: "false", showFollow: "false", showAlreadyTraded: "false", isAbleFilter: "false", receivingAds: "false",
    t: String(Date.now()),
  });
  if (amount) q.set("quoteMinAmountPerOrder", String(amount));
  return `${BOOKS}?${q}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Requêtes OKX d'un relevé, cadencées (GAP_MS) ; 4 essais par requête, null
 *  si tous échouent. Un 429 retarde TOUTES les requêtes suivantes. */
export const okxFetcher = (fiat: Fiat): Fetcher => {
  let slot = 0; // heure de départ de la prochaine requête
  const turn = async () => {
    const now = Date.now(), at = Math.max(now, slot);
    slot = at + GAP_MS;
    if (at > now) await sleep(at - now);
  };
  return async (u) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await turn();
      try {
        const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
        if (res.ok) {
          const json = await res.json();
          const list = json?.data?.[SIDE[fiat]];
          if (json?.code === 0 && Array.isArray(list)) return list;
        } else {
          await res.body?.cancel();
          if (res.status === 429) slot = Math.max(slot, Date.now() + 1000 * (attempt + 1));
        }
      } catch { /* nouvel essai */ }
      await sleep(400 * (attempt + 1));
    }
    return null;
  };
};

/** Convertit une annonce OKX au format commun ; null si inutilisable. */
export function toAd(x: Raw, ids: string[]): Ad | null {
  const price = Number(x.price);
  if (!Number.isFinite(price) || price <= 0) return null;
  let mask = 0;
  for (const m of x.paymentMethods ?? []) {
    const i = ids.indexOf(String(m));
    if (i >= 0 && i < 31) mask |= 1 << i;
  }
  const kind: 0 | 1 | 2 = x.creatorType === "diamond" ? 2 : x.creatorType === "certified" ? 1 : 0;
  return [
    price,
    Math.round(Number(x.availableAmount) || 0),
    Math.round(Number(x.quoteMinAmountPerOrder) || 0),
    Math.round(Number(x.quoteMaxAmountPerOrder) || 0),
    Number(x.completedOrderQuantity) | 0,
    Math.round((Number(x.completedRate) || 0) * 1000),
    mask,
    Number(x.paymentTimeoutMinutes) | 0,
    kind,
    String(x.nickName ?? "?").slice(0, 60),
  ];
}

/** fn sur chaque élément, au plus n à la fois ; l'ordre des résultats suit
 *  celui des éléments. `stop()` vrai : plus aucun nouvel élément n'est lancé. */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>, stop = () => false): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length && !stop()) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const methodsOf = (l: Raw[]) => l.flatMap((x) => (x.paymentMethods ?? []).map(String) as string[]);

export async function fetchOkxBook(fiat: Fiat, get: Fetcher = okxFetcher(fiat)): Promise<OkxBook> {
  const t0 = Date.now();
  const late = () => Date.now() - t0 > DEADLINE_MS;
  const first = await get(url(fiat, "all"));
  if (!first) throw new Error("OKX ne répond pas. Réessayez dans un instant.");

  // Modes de paiement vus dans le carnet, du plus fréquent au plus rare.
  const freq = new Map<string, number>();
  for (const m of methodsOf(first)) freq.set(m, (freq.get(m) ?? 0) + 1);
  const methodIds = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  const lists: Raw[][] = [first];
  // liste « mode seul » de chaque mode interrogé (null = requête perdue)
  const base = new Map<string, Raw[] | null>();
  if (first.length >= PAGE_CAP) {
    const queried = methodIds.slice(0, MAX_METHODS);
    const byMethod = await pool(queried, CONCURRENCY, (m) => get(url(fiat, m)));
    queried.forEach((m, i) => base.set(m, byMethod[i]));

    // Modes encore pleins, ou dont la recherche a échoué : on les redécoupe
    // par montant.
    const sweep = queried.filter((m) => (base.get(m)?.length ?? PAGE_CAP) >= PAGE_CAP);
    const jobs = sweep.flatMap((m) => AMOUNTS[fiat].map((a) => url(fiat, m, a)));
    const res = await pool(jobs, CONCURRENCY, get, late);

    // Recherches perdues (OKX limite le débit) : une seconde chance, une à une,
    // après une pause ; s'il en reste, le relevé est refusé plutôt que montré
    // avec un total et une médiane faux.
    const lostIdx = res.flatMap((l, i) => (l ? [] : [i]));
    const lostBase = queried.filter((m) => !base.get(m));
    if ((lostIdx.length || lostBase.length) && !late()) {
      await sleep(RETRY_PAUSE_MS);
      for (const m of lostBase) if (!late()) base.set(m, await get(url(fiat, m)));
      for (const i of lostIdx) if (!late()) res[i] = await get(jobs[i]);
    }
    if (late()) throw new Error("OKX limite les demandes en ce moment. Réessayez dans une minute.");
    const lost = queried.filter((m) => !base.get(m)).length + res.filter((l) => !l).length;
    if (lost) throw new Error(`Carnet OKX incomplet (${lost} recherche${lost > 1 ? "s" : ""} refusée${lost > 1 ? "s" : ""} par OKX). Réessayez dans un instant.`);
    for (const l of [...base.values(), ...res]) if (l) lists.push(l);
  }

  // Les recherches par mode ou par montant peuvent faire apparaître des modes absents du premier lot.
  for (const m of methodsOf(lists.flat())) if (!methodIds.includes(m)) methodIds.push(m);

  // Complet si le premier lot tient sous 200, ou si CHAQUE mode a été lu en
  // entier (une annonce a toujours au moins un mode).
  const capped = first.length >= PAGE_CAP && methodIds.some((m) => {
    const l = base.get(m);
    return !l || l.length >= PAGE_CAP;
  });

  const byId = new Map<string, Ad>();
  for (const l of lists) {
    for (const x of l) {
      const key = String(x.id ?? `${x.merchantId}-${x.price}`);
      if (byId.has(key)) continue;
      const ad = toAd(x, methodIds);
      if (ad) byId.set(key, ad);
    }
  }
  const ads = [...byId.values()];
  return {
    exchange: "okx",
    fiat,
    side: fiat === "CNY" ? "SELL" : "BUY",
    fetchedAt: new Date().toISOString(),
    total: ads.length,
    capped,
    methods: methodIds.map((id) => ({ id, name: METHOD_NAMES[id] ?? id })),
    ads,
  };
}
