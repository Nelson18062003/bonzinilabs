// supabase/functions/monitor-rates/index.ts
// Called periodically to snapshot rates and alert on significant changes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BINANCE_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const OTC_SPREAD = 0.04;
const MARGIN = 1.0;
const ALERT_THRESHOLD_PCT = 1.0;

interface BinanceItem {
  adv: { price: string; tradableQuantity: string };
  advertiser: {
    nickName: string;
    monthOrderCount: number;
    monthFinishRate: number;
    positiveRate: number;
    userType: string;
  };
}

async function fetchPage(fiat: string, tradeType: string, page: number): Promise<BinanceItem[]> {
  const res = await fetch(BINANCE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({
      fiat, page, rows: 20, tradeType, asset: "USDT",
      countries: [], proMerchantAds: false, publisherType: null,
      payTypes: [], classifies: ["mass", "profession", "fiat_merchant"],
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Binance: ${json.message}`);
  return json.data;
}

async function fetchAll(fiat: string, tradeType: string): Promise<BinanceItem[]> {
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) => fetchPage(fiat, tradeType, i + 1))
  );
  return results.flat();
}

interface Merchant {
  price: number; orders: number; tradable: number; completion: number; name: string;
}

function filterXaf(items: BinanceItem[]): Merchant[] {
  return items
    .filter((i) => parseFloat(i.adv.tradableQuantity) >= 5000
      && i.advertiser.monthOrderCount >= 50
      && i.advertiser.monthFinishRate >= 0.90
      && i.advertiser.positiveRate >= 0.90)
    .slice(0, 10)
    .map((i) => ({
      name: i.advertiser.nickName, price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));
}

function filterCny(items: BinanceItem[]): Merchant[] {
  return items
    .filter((i) => i.advertiser.userType === "merchant"
      && i.advertiser.monthOrderCount >= 200
      && i.advertiser.monthFinishRate >= 0.95
      && i.advertiser.positiveRate >= 0.97)
    .slice(0, 10)
    .map((i) => ({
      name: i.advertiser.nickName, price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));
}

function wAvg(ms: Merchant[]): number {
  let sw = 0, s = 0;
  for (const m of ms) { sw += m.price * m.orders; s += m.orders; }
  return sw / s;
}

const f = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fi = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
  });
}

serve(async (_req: Request) => {
  try {
    const [xafRaw, cnyRaw] = await Promise.all([
      fetchAll("XAF", "BUY"),
      fetchAll("CNY", "SELL"),
    ]);

    let xm = filterXaf(xafRaw);
    let cm = filterCny(cnyRaw);
    if (xm.length === 0) xm = xafRaw.slice(0, 5).map((i) => ({
      name: i.advertiser.nickName, price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));
    if (cm.length === 0) cm = cnyRaw.slice(0, 5).map((i) => ({
      name: i.advertiser.nickName, price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));

    const xafAsk = wAvg(xm);
    const cnyBidBinance = wAvg(cm);
    const cnyBidAdj = cnyBidBinance - OTC_SPREAD;
    const usdtPer1M = 1_000_000 / xafAsk;
    const marketRate = usdtPer1M * cnyBidAdj;
    const bonziniRate = Math.round((marketRate * (1 - MARGIN / 100)) / 10) * 10;
    const gain = marketRate - bonziniRate;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Save snapshot
    await supabase.from("rate_snapshots").insert({
      xaf_ask: xafAsk,
      cny_bid_binance: cnyBidBinance,
      cny_bid_adjusted: cnyBidAdj,
      otc_spread: OTC_SPREAD,
      usdt_per_1m_xaf: usdtPer1M,
      market_rate: marketRate,
      margin_pct: MARGIN,
      bonzini_rate: bonziniRate,
      gain_per_million: gain,
      xaf_merchants_count: xm.length,
      cny_merchants_count: cm.length,
    });

    // Compare with previous snapshot
    const { data: prevSnapshots } = await supabase
      .from("rate_snapshots")
      .select("bonzini_rate, xaf_ask, cny_bid_adjusted, created_at")
      .order("created_at", { ascending: false })
      .limit(2);

    if (prevSnapshots && prevSnapshots.length >= 2) {
      const prev = prevSnapshots[1];
      const prevRate = prev.bonzini_rate;
      const changePct = ((bonziniRate - prevRate) / prevRate) * 100;

      if (Math.abs(changePct) >= ALERT_THRESHOLD_PCT) {
        const direction = changePct > 0 ? "\ud83d\udcc8 HAUSSE" : "\ud83d\udcc9 BAISSE";
        const emoji = changePct > 0 ? "\ud83d\udfe2" : "\ud83d\udd34";

        await sendTelegram(`
${emoji} <b>${direction} du taux !</b>

Ancien : ${fi(prevRate)} \u00a5
Nouveau : ${fi(bonziniRate)} \u00a5
Variation : ${changePct > 0 ? "+" : ""}${f(changePct, 1)}%

<b>XAF Ask</b> : ${f(xafAsk)} XAF/USDT
<b>CNY Bid</b> : ${f(cnyBidAdj, 4)} \u00a5/USDT (OTC)

\u26a0\ufe0f V\u00e9rifiez si le taux publi\u00e9 est toujours comp\u00e9titif.`);
      }
    }

    // Daily summary at ~8h Douala time (7h UTC)
    const now = new Date();
    const hour = (now.getUTCHours() + 1) % 24; // UTC+1 for Douala
    if (hour === 8 && now.getMinutes() < 10) {
      // Get yesterday's data for comparison
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: daySnapshots } = await supabase
        .from("rate_snapshots")
        .select("bonzini_rate")
        .gte("created_at", yesterday)
        .order("created_at", { ascending: true });

      if (daySnapshots && daySnapshots.length > 0) {
        const rates = daySnapshots.map((s: any) => s.bonzini_rate);
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const first = rates[0];
        const dayChange = ((bonziniRate - first) / first) * 100;

        await sendTelegram(`
\u2600\ufe0f <b>R\u00e9sum\u00e9 du matin</b>

Taux actuel : <b>${fi(bonziniRate)} \u00a5</b>
Min 24h : ${fi(min)} \u00a5
Max 24h : ${fi(max)} \u00a5
Variation : ${dayChange > 0 ? "+" : ""}${f(dayChange, 1)}%

\ud83d\udcca ${daySnapshots.length} mesures en 24h
Tape /tendance pour plus de d\u00e9tails.`);
      }
    }

    return new Response(JSON.stringify({ ok: true, bonzini_rate: bonziniRate }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Monitor error:", err);
    await sendTelegram(`\u274c <b>Erreur monitoring</b>\n\n${err.message}`);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
});
