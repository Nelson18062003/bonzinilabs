// supabase/functions/binance-p2p-book/index.ts
// Carnet Binance P2P COMPLET d'un côté du marché, pour le sous-module
// « Marché Binance » (Taux de change). Le navigateur ne peut pas appeler
// Binance (CORS) : cette fonction relève le carnet et le renvoie compacté.
//
//   POST { fiat: "CNY" | "XAF", fresh?: boolean }
//   fresh = bouton « Actualiser » : on ignore le cache et on relit Binance.
//   CNY → tradeType SELL : annonceurs qui ACHÈTENT l'USDT (là où l'on vend en Chine)
//   XAF → tradeType BUY  : annonceurs qui VENDENT l'USDT (là où l'on achète au Cameroun)
//
// Aucun filtre côté Binance (paiement, montant…) : chaque annonce garde ses
// attributs et l'écran filtre localement, comme Binance — un seul relevé sert
// tous les filtres.
//
// Autorisation : JWT admin + admin_has_permission(uid, 'canManageRates')
// (jamais is_admin seul — .claude/rules/security.md).
//
// Cache mémoire 20 s par devise : plusieurs écrans ouverts en même temps ne
// multiplient pas les appels à Binance. Les relevés simultanés partagent la
// même promesse, et un échec est retenu 10 s (pas de rafale pendant que
// Binance limite). Un carnet troué (> 5 % de pages perdues) est refusé
// plutôt que montré avec un total et une médiane faux.
//
// Types : tenir en phase avec src/lib/p2pMarket.ts (P2PAd, P2PBook).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEARCH = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const FILTERS = "https://p2p.binance.com/bapi/c2c/v2/public/c2c/adv/filter-conditions";
const ROWS = 20;
const CONCURRENCY = 6;
const CACHE_MS = 20_000;
const FAIL_MS = 10_000;
const MAX_LOST_PAGES = 0.05;
const METHODS_CACHE_MS = 3_600_000;

type Fiat = "CNY" | "XAF";
const SIDE: Record<Fiat, "SELL" | "BUY"> = { CNY: "SELL", XAF: "BUY" };
// Garde-fou : le carnet CNY compte ~1 600 annonces (80 pages) ; XAF ~120.
const MAX_PAGES: Record<Fiat, number> = { CNY: 150, XAF: 40 };

/**
 * Annonce compactée (tuple, pour un poids ~4× moindre qu'un objet) :
 * [prix, usdtDisponible, minFiat, maxFiat, ordresMois, réussite‰,
 *  masquePaiement, délaiPaiementMin, type (0 particulier · 1 marchand · 2 pro), pseudo]
 */
type Ad = [number, number, number, number, number, number, number, number, 0 | 1 | 2, string];

interface Book {
  fiat: Fiat;
  side: "SELL" | "BUY";
  fetchedAt: string;
  total: number;
  methods: { id: string; name: string }[];
  ads: Ad[];
}

const bookCache = new Map<Fiat, { at: number; book: Book }>();
const inflight = new Map<Fiat, Promise<Book>>();
const failCache = new Map<Fiat, { at: number; error: string }>();
const methodsCache = new Map<Fiat, { at: number; methods: { id: string; name: string }[] }>();

async function binance(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  return await res.json();
}

async function methodsOf(fiat: Fiat) {
  const hit = methodsCache.get(fiat);
  if (hit && Date.now() - hit.at < METHODS_CACHE_MS) return hit.methods;
  // Liste des modes de paiement : utile aux filtres, pas indispensable au
  // carnet — si Binance ne la sert pas, on continue sans (ou avec l'ancienne).
  let json;
  try { json = await binance(FILTERS, { fiat }); } catch (e) {
    console.error("binance-p2p-book filter-conditions", fiat, e);
    return hit?.methods ?? [];
  }
  const methods = ((json?.data?.tradeMethods ?? []) as { identifier: string; tradeMethodName: string }[])
    .map((m) => ({ id: m.identifier, name: m.tradeMethodName }));
  methodsCache.set(fiat, { at: Date.now(), methods });
  return methods;
}

// deno-lint-ignore no-explicit-any
async function page(fiat: Fiat, p: number): Promise<{ total: number; data: any[]; ok: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = await binance(SEARCH, {
        asset: "USDT", fiat, tradeType: SIDE[fiat], page: p, rows: ROWS,
        payTypes: [], publisherType: null,
      });
      if (Array.isArray(json?.data)) return { total: Number(json.total) || 0, data: json.data, ok: true };
    } catch { /* nouvel essai */ }
    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return { total: 0, data: [], ok: false };
}

async function fetchBook(fiat: Fiat): Promise<Book> {
  const methods = await methodsOf(fiat);
  const ids = methods.map((m) => m.id);

  const first = await page(fiat, 1);
  if (!first.ok) throw new Error("Binance ne répond pas. Réessayez dans un instant.");
  const pages = Math.min(MAX_PAGES[fiat], Math.max(1, Math.ceil(first.total / ROWS)));
  const results = [first];
  // Pages 2..n en parallèle, par vagues de CONCURRENCY.
  for (let start = 2; start <= pages; start += CONCURRENCY) {
    const wave = [];
    for (let p = start; p < start + CONCURRENCY && p <= pages; p++) wave.push(page(fiat, p));
    results.push(...await Promise.all(wave));
  }

  const lost = results.filter((r) => !r.ok).length;
  if (lost > Math.max(1, pages * MAX_LOST_PAGES)) {
    throw new Error(`Carnet incomplet (${lost} pages sur ${pages} perdues). Réessayez dans un instant.`);
  }

  // Une annonce peut glisser d'une page à l'autre pendant le relevé : dédoublonnage.
  const seen = new Set<string>();
  const ads: Ad[] = [];
  for (const r of results) {
    for (const x of r.data) {
      const a = x.adv, u = x.advertiser;
      if (!a || !u || seen.has(a.advNo)) continue;
      seen.add(a.advNo);
      let mask = 0;
      for (const t of a.tradeMethods ?? []) {
        const i = ids.indexOf(t.identifier);
        if (i >= 0 && i < 31) mask |= 1 << i;
      }
      const price = Number(a.price);
      if (!Number.isFinite(price) || price <= 0) continue;
      ads.push([
        price,
        Math.round(Number(a.surplusAmount) || 0),
        Math.round(Number(a.minSingleTransAmount) || 0),
        Math.round(Number(a.dynamicMaxSingleTransAmount) || Number(a.maxSingleTransAmount) || 0),
        Number(u.monthOrderCount) | 0,
        Math.round((Number(u.monthFinishRate) || 0) * 1000),
        mask,
        Number(a.payTimeLimit) | 0,
        u.proMerchant ? 2 : u.userType === "merchant" ? 1 : 0,
        String(u.nickName ?? "?").slice(0, 60),
      ]);
    }
  }

  return { fiat, side: SIDE[fiat], fetchedAt: new Date().toISOString(), total: ads.length, methods, ads };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Non authentifié" }, 401);

    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Non authentifié" }, 401);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: allowed } = await admin.rpc("admin_has_permission", {
      _user_id: user.id, _permission: "canManageRates",
    });
    if (!allowed) return json({ success: false, error: "Accès réservé à la gestion des taux" }, 403);

    const body = await req.json().catch(() => ({}));
    const fiat = body?.fiat === "XAF" ? "XAF" : body?.fiat === "CNY" ? "CNY" : null;
    if (!fiat) return json({ success: false, error: "Devise inconnue (CNY ou XAF)" }, 400);

    // « Actualiser » saute les deux caches, mais rejoint un relevé déjà en
    // cours (pas de double rafale vers Binance).
    const fresh = body?.fresh === true;
    const hit = bookCache.get(fiat);
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return json({ success: true, book: hit.book });

    const failed = failCache.get(fiat);
    if (!fresh && failed && Date.now() - failed.at < FAIL_MS) return json({ success: false, error: failed.error }, 502);

    let pending = inflight.get(fiat);
    if (!pending) {
      pending = fetchBook(fiat).finally(() => inflight.delete(fiat));
      inflight.set(fiat, pending);
    }
    try {
      const book = await pending;
      if (book.ads.length === 0) throw new Error("Binance n'a renvoyé aucune annonce. Réessayez.");
      bookCache.set(fiat, { at: Date.now(), book });
      failCache.delete(fiat);
      return json({ success: true, book });
    } catch (e) {
      const error = e instanceof Error && e.message.length < 160 ? e.message : "Lecture du carnet impossible";
      console.error("binance-p2p-book", fiat, e);
      failCache.set(fiat, { at: Date.now(), error });
      return json({ success: false, error }, 502);
    }
  } catch (e) {
    console.error("binance-p2p-book", e);
    return json({ success: false, error: "Erreur interne" }, 500);
  }
});
