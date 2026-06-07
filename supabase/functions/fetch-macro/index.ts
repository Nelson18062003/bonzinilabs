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

// Comptes d'experts à suivre (via Google News search, X étant inaccessible
// gratuitement). On cherche les articles qui les mentionnent + sujets Iran/oil.
const EXPERT_QUERIES = [
  { name: "Reuters Iran", query: "Reuters+Iran+nuclear" },
  { name: "FirstSquawk", query: "FirstSquawk+Iran+OR+oil+OR+Hormuz" },
  { name: "Mario Nawfal", query: "Mario+Nawfal+Iran" },
  { name: "Jeffrey Lewis (Natsecjeff)", query: "Jeffrey+Lewis+Iran+nuclear" },
  { name: "ZeroHedge", query: "ZeroHedge+Iran+OR+Hormuz+OR+oil" },
];

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

// ─── Expert mentions via Google News ────────────────────────────────────
// X/Twitter scraping fiable nécessite l'API payante. On approxime en cherchant
// les articles qui CITENT les experts sur les sujets Iran/oil.
async function fetchExpertMentions(): Promise<Record<string, NewsItem[]>> {
  const grouped: Record<string, NewsItem[]> = {};

  await Promise.all(
    EXPERT_QUERIES.map(async (eq) => {
      try {
        const url = `https://news.google.com/rss/search?q=${eq.query}&hl=en-US&gl=US&ceid=US:en`;
        const res = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; BonziniMacro/1.0)" },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const items = parseRssItems(await res.text());
        // On garde les 3 plus récents qui matchent les keywords
        const filtered = items
          .filter((it) => RELEVANCE_KEYWORDS.test(it.title + " " + it.description))
          .slice(0, 3)
          .map((it) => ({
            title: stripHtml(it.title),
            source: eq.name,
            published_at: it.pubDate,
            link: it.link,
          }));
        if (filtered.length > 0) grouped[eq.name] = filtered;
      } catch { /* ignore */ }
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

// ─── Trigger alerte Telegram via send-brief ──────────────────────────────
// Garde-fou anti-spam : on logge dans briefs_log côté send-brief; ici on
// vérifie qu'on n'a pas déjà envoyé la même alerte dans la dernière heure.
async function fireAlert(supabase: any, kind: string, details: string) {
  // Anti-spam : pas plus d'une alerte du même kind par heure
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("briefs_log")
    .select("id")
    .eq("brief_type", "alert")
    .gte("sent_at", oneHourAgo)
    .ilike("message_text", `%ALERTE ${kind}%`)
    .limit(1);

  if (recent && recent.length > 0) {
    console.log(`Alert ${kind} skipped (already sent in last hour)`);
    return;
  }

  // Appel send-brief en mode alert
  try {
    const url = Deno.env.get("SUPABASE_URL")! + "/functions/v1/send-brief";
    const token = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ type: "alert", alert: { kind, details } }),
    });
  } catch (err) {
    console.error("fireAlert failed:", (err as Error).message);
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

  // Fetch en parallèle (data + news + Trump posts + experts)
  const results = await Promise.allSettled([
    fetchForex(),
    fetchCrypto(),
    fetchYahoo("BZ=F"),       // Brent Crude future
    fetchYahoo("CL=F"),       // WTI Crude future
    fetchYahoo("DX-Y.NYB"),   // Dollar Index
    fetchAllNews(),
    fetchTrumpPosts(),
    fetchExpertMentions(),
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

  // Experts mentions
  let expertMentions: Record<string, NewsItem[]> = {};
  if (results[7].status === "fulfilled") {
    expertMentions = results[7].value;
  } else {
    errors.experts = String((results[7] as PromiseRejectedResult).reason);
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

  // Récupérer le snapshot précédent (~1h) pour calculer les alertes seuils
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { data: prevSnap } = await supabase
    .from("macro_snapshots")
    .select("*")
    .lte("captured_at", oneHourAgo)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
      expert_mentions: expertMentions,
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

  // ─── Détection d'alertes urgentes (seuils horaires) ────────────────────
  const alertsFired: string[] = [];
  if (prevSnap) {
    // Brent : +/- 3% en 1h
    if (data.oil_brent && prevSnap.oil_brent) {
      const pct = ((data.oil_brent - prevSnap.oil_brent) / prevSnap.oil_brent) * 100;
      if (Math.abs(pct) >= 3) {
        const dir = pct > 0 ? "📈 HAUSSE" : "📉 BAISSE";
        await fireAlert(supabase, "PETROLE", `${dir} brutale du Brent : ${pct.toFixed(1)}% en 1h\nDe ${prevSnap.oil_brent.toFixed(2)} $ → ${data.oil_brent.toFixed(2)} $\n\n${pct > 0 ? "Impact attendu : pression hausse coût XAF" : "Impact attendu : détente possible coût XAF"}`);
        alertsFired.push("oil_brent");
      }
    }
    // DXY : +/- 0.5 point en 1h
    if (data.dxy && prevSnap.dxy) {
      const diff = data.dxy - prevSnap.dxy;
      if (Math.abs(diff) >= 0.5) {
        const dir = diff > 0 ? "📈 RENFORCEMENT" : "📉 AFFAIBLISSEMENT";
        await fireAlert(supabase, "DOLLAR", `${dir} du dollar : ${diff > 0 ? "+" : ""}${diff.toFixed(2)} pts DXY en 1h\nDe ${prevSnap.dxy.toFixed(2)} → ${data.dxy.toFixed(2)}\n\n${diff > 0 ? "→ XAF sous pression, USDT plus cher" : "→ XAF respire, USDT moins cher"}`);
        alertsFired.push("dxy");
      }
    }
    // BTC : +/- 5% en 1h (signal sentiment risk-on/off)
    if (data.btc_usd && prevSnap.btc_usd) {
      const pct = ((data.btc_usd - prevSnap.btc_usd) / prevSnap.btc_usd) * 100;
      if (Math.abs(pct) >= 5) {
        const dir = pct > 0 ? "📈 PUMP" : "📉 DUMP";
        await fireAlert(supabase, "BTC", `${dir} BTC : ${pct.toFixed(1)}% en 1h → ${Math.round(data.btc_usd)} $\nSignal sentiment ${pct > 0 ? "risk-on (positif marchés)" : "risk-off (négatif marchés)"}`);
        alertsFired.push("btc");
      }
    }
    // Nouveau post Trump Iran-related dans les dernières 2h
    const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
    const freshIranPosts = trumpAll.filter((p) => {
      const t = Date.parse(p.posted_at);
      return p.is_iran_related && Number.isFinite(t) && t >= twoHoursAgo;
    });
    if (freshIranPosts.length > 0) {
      const post = freshIranPosts[0];
      await fireAlert(
        supabase,
        "TRUMP IRAN",
        `Trump vient de poster sur Truth Social (Iran) :\n\n"${post.content.slice(0, 350)}${post.content.length > 350 ? "..." : ""}"\n\nSurveille l'impact sur les marchés dans les prochaines heures.`,
      );
      alertsFired.push("trump_iran");
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      snapshot: inserted,
      counts: {
        news_total: data.news_headlines.length,
        news_sources: Object.keys(newsBySource).length,
        experts: Object.keys(expertMentions).length,
        trump_all: trumpAll.length,
        trump_iran_24h: trumpRecent.length,
        alerts_fired: alertsFired,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
