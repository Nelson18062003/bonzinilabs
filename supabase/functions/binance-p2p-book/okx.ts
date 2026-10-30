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
// `capped` dit qu'un mode n'a pas pu être lu en entier : il peut manquer
// quelques annonces, celles qu'aucune recherche ne classe dans ses 200
// meilleures — ~2 % à l'essai (1 493 avec 24 montants, 1 521 avec 48),
// surtout des prix bas ou des limites trop étroites pour contenir un des
// montants essayés. La médiane n'en bouge pas (6,55 dès 12 montants).
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
// 24 montants par mode : 3 modes pleins → 76 recherches, ~8 s (~30 s quand
// OKX limite le débit).
const AMOUNT_STEPS = 24;
// OKX répond 429 au-delà d'une quinzaine de requêtes par seconde : 4 à la
// fois, une nouvelle toutes les 100 ms au plus, et pause générale sur un 429.
const CONCURRENCY = 4;
const GAP_MS = 100;
// Au-delà de 10 % de recherches perdues sur un mode, on refuse le carnet
// (comme Binance) ; au-delà de 45 s, on abandonne (Supabase coupe à 150 s).
const MAX_FAILED = 0.1;
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

/** Montants à essayer : progression géométrique (2 chiffres significatifs)
 *  de la plus petite limite basse à la plus grande limite haute vues. */
export function amountGrid(ads: Raw[], steps = AMOUNT_STEPS): number[] {
  let lo = Infinity, hi = 0;
  for (const x of ads) {
    const a = Number(x.quoteMinAmountPerOrder), b = Number(x.quoteMaxAmountPerOrder);
    if (a > 0 && a < lo) lo = a;
    if (b > hi) hi = b;
  }
  if (!(lo < hi)) return [];
  const r = hi / lo;
  return [...new Set(Array.from({ length: steps }, (_, i) => Number((lo * r ** (i / (steps - 1))).toPrecision(2))))];
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
    for (const l of byMethod) if (l) lists.push(l);

    // Modes encore pleins, ou dont la recherche a échoué : on les redécoupe
    // par montant.
    const sweep = queried.filter((m) => (base.get(m)?.length ?? PAGE_CAP) >= PAGE_CAP);
    if (sweep.length) {
      const amounts = amountGrid(lists.flat());
      const jobs = sweep.flatMap((m) => amounts.map((a) => ({ m, a })));
      // Pertes comptées PAR MODE (recherche du mode seul comprise) : le bas
      // d'un mode ne se voit que par ses propres recherches. Dès qu'un mode
      // dépasse 10 %, ou passé DEADLINE_MS, on arrête de solliciter OKX.
      const lost = new Map(sweep.map((m) => [m, base.get(m) ? 0 : 1]));
      const budget = Math.floor(amounts.length * MAX_FAILED);
      let stop = [...lost.values()].some((n) => n > budget) ? "Carnet OKX incomplet. Réessayez dans un instant." : "";
      const extra = await pool(jobs, CONCURRENCY, async ({ m, a }) => {
        const l = await get(url(fiat, m, a));
        if (!l) {
          const n = (lost.get(m) ?? 0) + 1;
          lost.set(m, n);
          if (n > budget) stop ||= `Carnet OKX incomplet (${n} recherches ${METHOD_NAMES[m] ?? m} perdues). Réessayez dans un instant.`;
        }
        return l;
      }, () => {
        if (!stop && Date.now() - t0 > DEADLINE_MS) stop = "OKX limite les demandes en ce moment. Réessayez dans une minute.";
        return stop !== "";
      });
      if (stop) throw new Error(stop);
      for (const l of extra) if (l) lists.push(l);
    }
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
