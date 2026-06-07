// supabase/functions/fetch-macro/index.ts
// Collecte les indicateurs macro (pétrole, forex, crypto, news) et les stocke
// dans macro_snapshots. À appeler par cron toutes les 15-30 minutes.
//
// APIs utilisées (toutes gratuites, sans clé) :
// - Frankfurter.app    : EUR/USD, CNY/USD (données ECB)
// - Yahoo Finance      : pétrole Brent (BZ=F), WTI (CL=F), DXY (DX-Y.NYB), BTC, ETH
// - CoinGecko          : fallback crypto si Yahoo échoue
// - Google News RSS    : headlines Iran / Hormuz / Fed
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

// ─── Headlines via Google News RSS ───────────────────────────────────────
async function fetchHeadlines(): Promise<NewsItem[]> {
  const queries = [
    "Iran+US+strikes",
    "Strait+of+Hormuz",
    "oil+price+Iran",
  ];
  const items: NewsItem[] = [];

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = await res.text();
      const entries = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const e of entries.slice(0, 2)) {
        const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]
          ?.replace(/<!\[CDATA\[/g, "")
          .replace(/\]\]>/g, "")
          .trim() || "";
        const source = (e.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]?.trim() || "Google News";
        const link = (e.match(/<link>([\s\S]*?)<\/link>/) || [])[1]?.trim() || "";
        const pub = (e.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || "";
        if (title) items.push({ title, source, published_at: pub, link });
      }
    } catch { /* ignore */ }
  }

  // Dedupe par titre, garder les 5 plus récents
  const seen = new Set<string>();
  const deduped: NewsItem[] = [];
  for (const it of items) {
    const key = it.title.slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
    if (deduped.length >= 5) break;
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

  // Fetch en parallèle
  const results = await Promise.allSettled([
    fetchForex(),
    fetchCrypto(),
    fetchYahoo("BZ=F"),       // Brent Crude future
    fetchYahoo("CL=F"),       // WTI Crude future
    fetchYahoo("DX-Y.NYB"),   // Dollar Index
    fetchHeadlines(),
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

  // News
  if (results[5].status === "fulfilled") {
    data.news_headlines = results[5].value;
  } else {
    errors.news = String((results[5] as PromiseRejectedResult).reason);
  }

  data.errors = errors;

  // Save to DB
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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

  return new Response(
    JSON.stringify({ success: true, snapshot: inserted }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
