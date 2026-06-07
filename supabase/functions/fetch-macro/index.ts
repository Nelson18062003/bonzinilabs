// supabase/functions/fetch-macro/index.ts
// Collecte les indicateurs macro (pétrole, forex, crypto, news) et les stocke
// dans macro_snapshots. À appeler par cron toutes les 15-30 minutes.
//
// APIs utilisées (toutes gratuites, sans clé) :
// - Frankfurter.app       : EUR/USD, CNY/USD (données ECB)
// - Yahoo Finance         : pétrole Brent (BZ=F), WTI (CL=F), DXY (DX-Y.NYB), BTC, ETH
// - CoinGecko             : fallback crypto si Yahoo échoue
// - Google News RSS       : agrégation Iran / Hormuz / Oil / Fed
// - Al Jazeera / BBC RSS  : couverture directe Moyen-Orient
// - Bloomberg Markets RSS : analyses macroéconomiques
// - TrumpsTruth.org RSS   : posts Truth Social verbatim de Trump (filtrés Iran)
//
// Si une source échoue, on continue et on log dans la colonne `errors`.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MacroData {
  oil_brent: number | null;
  oil_wti: number | null;
  dxy: number | null;
  eur_usd: number | null;
  cny_usd: number | null;
  btc_usd: number | null;
  eth_usd: number | null;
  news_headlines: NewsItem[];
  errors: Record<string, string>;
}

interface NewsItem {
  title: string;
  source: string;
  published_at: string;
  link: string;
}

// ─── Forex via Frankfurter (ECB data, no key) ────────────────────────────
async function fetchForex(): Promise<{ eur_usd: number | null; cny_usd: number | null }> {
  const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,CNY", {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const json = await res.json();
  // Frankfurter returns rates from base USD. We want EUR/USD (how many USD per EUR).
  // rates.EUR = how many EUR per 1 USD, so EUR/USD = 1 / rates.EUR
  const eur_usd = json?.rates?.EUR ? 1 / Number(json.rates.EUR) : null;
  const cny_usd = json?.rates?.CNY ? Number(json.rates.CNY) : null; // CNY per USD
  return { eur_usd, cny_usd };
}

// ─── Yahoo Finance chart endpoint : prend regularMarketPrice ────────────
async function fetchYahoo(symbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return Number.isFinite(price) ? Number(price) : null;
  } catch {
    return null;
  }
}

// ─── CoinGecko fallback pour crypto ──────────────────────────────────────
async function fetchCoinGecko(): Promise<{ btc_usd: number | null; eth_usd: number | null }> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd",
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    const j = await res.json();
    return {
      btc_usd: j?.bitcoin?.usd ?? null,
      eth_usd: j?.ethereum?.usd ?? null,
    };
  } catch {
    return { btc_usd: null, eth_usd: null };
  }
}

// ─── Crypto : Yahoo en primaire, CoinGecko en fallback ──────────────────
async function fetchCrypto(): Promise<{ btc_usd: number | null; eth_usd: number | null }> {
  const [btcYahoo, ethYahoo] = await Promise.all([fetchYahoo("BTC-USD"), fetchYahoo("ETH-USD")]);
  if (btcYahoo !== null && ethYahoo !== null) {
    return { btc_usd: btcYahoo, eth_usd: ethYahoo };
  }
  const cg = await fetchCoinGecko();
  return {
    btc_usd: btcYahoo ?? cg.btc_usd,
    eth_usd: ethYahoo ?? cg.eth_usd,
  };
}

// ─── Helpers RSS parsing ────────────────────────────────────────────────
const cdata = (s: string) => s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim();

function parseRssItems(xml: string): Array<{ title: string; description: string; link: string; pubDate: string; guid: string }> {
  const entries = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return entries.map((e) => {
    const title = cdata((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const description = cdata((e.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "");
    const link = cdata((e.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "");
    const pubDate = cdata((e.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || "");
    const guid = cdata((e.match(/<guid[^>]*>([\s\S]*?)<\/guid>/) || [])[1] || link);
    return { title, description, link, pubDate, guid };
  });
}

// ─── Sources RSS — gratuites et fiables ─────────────────────────────────
const NEWS_SOURCES: Array<{ name: string; url: string }> = [
  // Google News searches (les agences Reuters/AP sont indexées via Google)
  { name: "Google News (Iran-Trump)", url: "https://news.google.com/rss/search?q=Iran+Trump+US&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News (Hormuz-oil)", url: "https://news.google.com/rss/search?q=Strait+of+Hormuz+oil&hl=en-US&gl=US&ceid=US:en" },
  { name: "Google News (Fed-inflation)", url: "https://news.google.com/rss/search?q=Federal+Reserve+inflation&hl=en-US&gl=US&ceid=US:en" },
  // Direct outlets
  { name: "Bloomberg Markets", url: "https://feeds.bloomberg.com/markets/news.rss" },
  { name: "Al Jazeera English", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "BBC World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
];

const RELEVANCE_KEYWORDS = /iran|hormuz|tehran|nuclear|hezbollah|israel|trump|opec|brent|crude|oil|fed|federal\s+reserve|inflation|powell|netanyahu|gaza|lebanon|saudi|riyadh|yemen|houthi/i;

async function fetchAllNews(): Promise<Record<string, NewsItem[]>> {
  const grouped: Record<string, NewsItem[]> = {};

  await Promise.all(
    NEWS_SOURCES.map(async (s) => {
      try {
        const res = await fetch(s.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BonziniMacro/1.0)" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const xml = await res.text();
        const items = parseRssItems(xml);
        // Filter: keep only Iran/oil/Fed-relevant items
        const filtered = items
          .filter((it) => RELEVANCE_KEYWORDS.test(it.title + " " + it.description))
          .slice(0, 6)
          .map((it) => ({
            title: stripHtml(it.title),
            source: s.name,
            published_at: it.pubDate,
            link: it.link,
          }));
        if (filtered.length > 0) grouped[s.name] = filtered;
      } catch { /* ignore failures */ }
    }),
  );

  return grouped;
}

// ─── Trump Truth Social posts (verbatim) ────────────────────────────────
interface TrumpPost {
  posted_at: string;
  content: string;
  external_id: string;
  link: string;
  is_iran_related: boolean;
}

async function fetchTrumpPosts(): Promise<TrumpPost[]> {
  try {
    const res = await fetch("https://trumpstruth.org/feed", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BonziniMacro/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = parseRssItems(xml);
    return items.map((it) => {
      const content = stripHtml(it.description || it.title);
      const isIran = RELEVANCE_KEYWORDS.test(content);
      return {
        posted_at: it.pubDate,
        content,
        external_id: it.guid,
        link: it.link,
        is_iran_related: isIran,
      };
    });
  } catch {
    return [];
  }
}

// ─── Flatten grouped news to top-N for the summary column ───────────────
function flattenNews(grouped: Record<string, NewsItem[]>, limit = 8): NewsItem[] {
  const all: NewsItem[] = [];
  for (const items of Object.values(grouped)) all.push(...items);
  // Dedupe par titre normalisé
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of all) {
    const key = it.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

// ─── Main handler ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const errors: Record<string, string> = {};
  const data: MacroData = {
    oil_brent: null,
    oil_wti: null,
    dxy: null,
    eur_usd: null,
    cny_usd: null,
    btc_usd: null,
    eth_usd: null,
    news_headlines: [],
    errors: {},
  };

  // Fetch en parallèle (data + news + Trump posts)
  const results = await Promise.allSettled([
    fetchForex(),
    fetchCrypto(),
    fetchYahoo("BZ=F"),       // Brent Crude future
    fetchYahoo("CL=F"),       // WTI Crude future
    fetchYahoo("DX-Y.NYB"),   // Dollar Index
    fetchAllNews(),
    fetchTrumpPosts(),
  ]);

  // Forex
  if (results[0].status === "fulfilled") {
    data.eur_usd = results[0].value.eur_usd;
    data.cny_usd = results[0].value.cny_usd;
  } else {
    errors.forex = String((results[0] as PromiseRejectedResult).reason);
  }

  // Crypto
  if (results[1].status === "fulfilled") {
    data.btc_usd = results[1].value.btc_usd;
    data.eth_usd = results[1].value.eth_usd;
  } else {
    errors.crypto = String((results[1] as PromiseRejectedResult).reason);
  }

  // Oil + DXY
  data.oil_brent = results[2].status === "fulfilled" ? results[2].value : null;
  data.oil_wti = results[3].status === "fulfilled" ? results[3].value : null;
  data.dxy = results[4].status === "fulfilled" ? results[4].value : null;

  if (!data.oil_brent) errors.oil_brent = "yahoo BZ=F failed or returned null";
  if (!data.oil_wti) errors.oil_wti = "yahoo CL=F failed or returned null";
  if (!data.dxy) errors.dxy = "yahoo DX-Y.NYB failed or returned null";

  // News (groupées + flat)
  let newsBySource: Record<string, NewsItem[]> = {};
  if (results[5].status === "fulfilled") {
    newsBySource = results[5].value;
    data.news_headlines = flattenNews(newsBySource, 8);
  } else {
    errors.news = String((results[5] as PromiseRejectedResult).reason);
  }

  // Trump posts
  let trumpAll: TrumpPost[] = [];
  if (results[6].status === "fulfilled") {
    trumpAll = results[6].value;
  } else {
    errors.trump = String((results[6] as PromiseRejectedResult).reason);
  }

  data.errors = errors;

  // Save to DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Posts Trump pour le brief :
  // 1. Priorité aux posts Iran-related des dernières 24h
  // 2. Si moins de 3, compléter avec les Iran-related plus anciens (jusqu'à 7 jours)
  const oneDayAgo = Date.now() - 24 * 3600 * 1000;
  const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const within24h = trumpAll.filter((p) => {
    const t = Date.parse(p.posted_at);
    return Number.isFinite(t) && t >= oneDayAgo && p.is_iran_related;
  });
  const within7d = trumpAll.filter((p) => {
    const t = Date.parse(p.posted_at);
    return Number.isFinite(t) && t >= sevenDaysAgo && p.is_iran_related;
  });
  const trumpRecent = within24h.length >= 3 ? within24h.slice(0, 10) : within7d.slice(0, 5);

  // Insert snapshot
  const { data: inserted, error: insertErr } = await supabase
    .from("macro_snapshots")
    .insert({
      oil_brent: data.oil_brent,
      oil_wti: data.oil_wti,
      dxy: data.dxy,
      eur_usd: data.eur_usd,
      cny_usd: data.cny_usd,
      btc_usd: data.btc_usd,
      eth_usd: data.eth_usd,
      news_headlines: data.news_headlines,
      news_by_source: newsBySource,
      trump_posts_recent: trumpRecent,
      errors: Object.keys(errors).length > 0 ? errors : null,
    })
    .select()
    .single();

  if (insertErr) {
    return new Response(
      JSON.stringify({ success: false, error: insertErr.message, data }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Persister les posts Trump dans la table dédiée (dedupe par external_id)
  if (trumpAll.length > 0) {
    const toInsert = trumpAll.slice(0, 30).map((p) => ({
      posted_at: p.posted_at,
      content: p.content.slice(0, 5000),
      external_id: p.external_id,
      is_iran_related: p.is_iran_related,
      raw_link: p.link,
    }));
    await supabase
      .from("trump_posts")
      .upsert(toInsert, { onConflict: "external_id", ignoreDuplicates: true });
  }

  return new Response(
    JSON.stringify({
      success: true,
      snapshot: inserted,
      counts: {
        news_total: data.news_headlines.length,
        news_sources: Object.keys(newsBySource).length,
        trump_all: trumpAll.length,
        trump_iran_24h: trumpRecent.length,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
