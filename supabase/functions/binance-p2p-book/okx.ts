// Carnet OKX P2P, converti au MÊME format que le carnet Binance (type Ad),
// pour que l'écran « Marché P2P » affiche l'un ou l'autre sans rien changer.
//
// Source : l'API publique du site OKX P2P (non documentée, comme celle de
// Binance) — GET /v3/c2c/tradingOrders/books.
//   CNY → side=buy  : annonceurs qui ACHÈTENT l'USDT (là où l'on vend en Chine)
//   XAF → side=sell : annonceurs qui VENDENT l'USDT (là où l'on achète au Cameroun)
//
// OKX ne renvoie que les 200 meilleures annonces par requête, sans pagination.
// On interroge donc « tous modes » PUIS chaque mode de paiement vu, et on
// fusionne par identifiant d'annonce : ~550 annonces côté Chine au lieu de 200.
// Le carnet reste incomplet dans le bas des prix : `capped` le signale.
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
const MAX_METHOD_QUERIES = 8;
// côté OKX de la requête et nom de la liste dans la réponse
const SIDE: Record<Fiat, "buy" | "sell"> = { CNY: "buy", XAF: "sell" };
const METHOD_NAMES: Record<string, string> = { aliPay: "Alipay", wxPay: "WeChat", bank: "Virement bancaire" };

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;
type Fetcher = (url: string) => Promise<Raw[] | null>;

function url(fiat: Fiat, paymentMethod: string): string {
  const q = new URLSearchParams({
    quoteCurrency: fiat, baseCurrency: "usdt", side: SIDE[fiat], paymentMethod, userType: "all",
    showTrade: "false", showFollow: "false", showAlreadyTraded: "false", isAbleFilter: "false", receivingAds: "false",
    t: String(Date.now()),
  });
  return `${BOOKS}?${q}`;
}

/** Une requête OKX, 3 essais ; null si toutes échouent. */
export const okxFetcher = (fiat: Fiat): Fetcher => async (u) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      if (res.ok) {
        const json = await res.json();
        const list = json?.data?.[SIDE[fiat]];
        if (json?.code === 0 && Array.isArray(list)) return list;
      }
    } catch { /* nouvel essai */ }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return null;
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

export async function fetchOkxBook(fiat: Fiat, get: Fetcher = okxFetcher(fiat)): Promise<OkxBook> {
  const first = await get(url(fiat, "all"));
  if (!first) throw new Error("OKX ne répond pas. Réessayez dans un instant.");

  // Modes de paiement vus dans le carnet, du plus fréquent au plus rare.
  const seen = new Map<string, number>();
  for (const x of first) for (const m of x.paymentMethods ?? []) seen.set(String(m), (seen.get(String(m)) ?? 0) + 1);
  const methodIds = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);

  // Le carnet « tous modes » est plein : on complète mode par mode.
  const lists: Raw[][] = [first];
  let capped = false;
  if (first.length >= PAGE_CAP) {
    const extra = await Promise.all(methodIds.slice(0, MAX_METHOD_QUERIES).map((m) => get(url(fiat, m))));
    for (const l of extra) if (l) lists.push(l);
    // Incomplet si une liste par mode est encore pleine, si une requête a
    // échoué, ou si des modes n'ont pas été interrogés (au-delà du 8ᵉ).
    capped = extra.some((l) => !l || l.length >= PAGE_CAP) || methodIds.length > MAX_METHOD_QUERIES;
  }

  // Les requêtes par mode peuvent faire apparaître des modes absents du premier lot.
  for (const l of lists) for (const x of l) for (const m of x.paymentMethods ?? []) if (!methodIds.includes(String(m))) methodIds.push(String(m));

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
