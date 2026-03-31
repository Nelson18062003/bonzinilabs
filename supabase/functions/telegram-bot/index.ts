// supabase/functions/telegram-bot/index.ts
// Telegram bot for Bonzini rate monitoring — Phase 1+2+3

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────────────────────

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const ADMIN_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BINANCE_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

// ─── Model Parameters (all in %) — stored in DB, configurable via /config ────
// Defaults (used if DB read fails)
const DEFAULTS = { s: 0.006, b: 0.008, f: 0.002, k: 1.5 };

async function getConfig(): Promise<{ s: number; b: number; f: number; k: number }> {
  try {
    const sb = getSupabase();
    const { data } = await sb.from("bot_config").select("key, value");
    if (!data || data.length === 0) return { ...DEFAULTS };
    const cfg = { ...DEFAULTS };
    for (const row of data) {
      if (row.key in cfg) (cfg as any)[row.key] = Number(row.value);
    }
    return cfg;
  } catch {
    return { ...DEFAULTS };
  }
}

async function setConfig(key: string, value: number): Promise<void> {
  const sb = getSupabase();
  await sb.from("bot_config").upsert({ key, value, updated_at: new Date().toISOString() });
}

// ─── Supabase client ─────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ─── Binance P2P ─────────────────────────────────────────────────────────────

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

async function fetchAll(fiat: string, tradeType: string, pages = 5): Promise<BinanceItem[]> {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => fetchPage(fiat, tradeType, i + 1))
  );
  return results.flat();
}

interface Merchant {
  name: string;
  price: number;
  tradable: number;
  orders: number;
  completion: number;
}

function filterXaf(items: BinanceItem[]): Merchant[] {
  return items
    .filter((i) => {
      const a = i.advertiser;
      return parseFloat(i.adv.tradableQuantity) >= 5000
        && a.monthOrderCount >= 50
        && a.monthFinishRate >= 0.90
        && a.positiveRate >= 0.90;
    })
    .slice(0, 10)
    .map((i) => ({
      name: i.advertiser.nickName,
      price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity),
      orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));
}

function filterCny(items: BinanceItem[]): Merchant[] {
  return items
    .filter((i) => {
      const a = i.advertiser;
      return a.userType === "merchant"
        && a.monthOrderCount >= 200
        && a.monthFinishRate >= 0.95
        && a.positiveRate >= 0.97;
    })
    .slice(0, 10)
    .map((i) => ({
      name: i.advertiser.nickName,
      price: parseFloat(i.adv.price),
      tradable: parseFloat(i.adv.tradableQuantity),
      orders: i.advertiser.monthOrderCount,
      completion: i.advertiser.monthFinishRate,
    }));
}

function wAvg(ms: Merchant[]): number {
  let sw = 0, s = 0;
  for (const m of ms) { sw += m.price * m.orders; s += m.orders; }
  return sw / s;
}

function stdDev(values: number[]): number {
  const mu = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => (v - mu) ** 2).reduce((a, b) => a + b, 0) / values.length);
}

interface RateResult {
  xafAsk: number;
  cnyBidBinance: number;
  cnyBidAdj: number;
  usdtPer1M: number;
  marketRate: number;
  bonziniRate: number;
  gain: number;
  S: number; B: number; F: number; V: number; K: number;
  cvXaf: number; cvCny: number; cvTotal: number;
  mTotal: number;
  xafMerchants: Merchant[];
  cnyMerchants: Merchant[];
}

async function calculateRate(): Promise<RateResult> {
  const [xafRaw, cnyRaw, cfg] = await Promise.all([
    fetchAll("XAF", "BUY"),
    fetchAll("CNY", "SELL"),
    getConfig(),
  ]);
  const PARAM_S = cfg.s;
  const PARAM_B = cfg.b;
  const PARAM_F = cfg.f;
  const PARAM_K = cfg.k;

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

  // Volatility calculation
  const xPrices = xm.map(m => m.price);
  const cPrices = cm.map(m => m.price);
  const cvXaf = xPrices.length > 1 ? stdDev(xPrices) / xafAsk : 0;
  const cvCny = cPrices.length > 1 ? stdDev(cPrices) / cnyBidBinance : 0;
  const cvTotal = Math.sqrt(cvXaf ** 2 + cvCny ** 2);

  // V = K * CV_total (auto)
  const V = PARAM_K * cvTotal;

  // New model: all in %
  const cnyBidAdj = cnyBidBinance * (1 - PARAM_S);
  const usdtPer1M = 1_000_000 / xafAsk;
  const marketRate = usdtPer1M * cnyBidAdj;
  const bonziniRate = Math.round((marketRate * (1 - PARAM_B - PARAM_F - V)) / 10) * 10;
  const mTotal = (PARAM_S + PARAM_B + PARAM_F + V) * 100;

  return {
    xafAsk, cnyBidBinance, cnyBidAdj, usdtPer1M, marketRate,
    bonziniRate, gain: (usdtPer1M * cnyBidBinance) - bonziniRate,
    S: PARAM_S, B: PARAM_B, F: PARAM_F, V, K: PARAM_K,
    cvXaf, cvCny, cvTotal, mTotal,
    xafMerchants: xm, cnyMerchants: cm,
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

const f = (n: number, d = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fi = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

function now(): string {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Telegram API ────────────────────────────────────────────────────────────

async function sendMessage(chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function sendDocument(chatId: string | number, fileUrl: string, caption: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, document: fileUrl, caption, parse_mode: "HTML" }),
  });
}

async function sendPhoto(chatId: string | number, photoBuffer: Uint8Array, caption: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("photo", new Blob([photoBuffer], { type: "image/png" }), "flyer.png");
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });
}

// ─── Command: /taux ──────────────────────────────────────────────────────────

async function handleTaux(chatId: number) {
  await sendMessage(chatId, "\u23f3 Calcul en cours...");

  const r = await calculateRate();

  const fp = (n: number) => (n * 100).toFixed(3) + "%";

  // Taux brut = what Binance says (theoretical max)
  const tauxBrut = r.usdtPer1M * r.cnyBidBinance;
  // Taux de revient = after OTC spread (what it actually costs us)
  const tauxRevient = Math.round(r.marketRate / 10) * 10; // marketRate = after S
  // Taux securise = after S + F + V (cost + protection, before profit)
  const tauxSecurise = Math.round((r.marketRate * (1 - r.F - r.V)) / 10) * 10;
  // Taux client = after S + B + F + V (final)
  const tauxClient = r.bonziniRate;

  const msg = `
<b>\ud83d\udcca Taux Bonzini</b>
<i>\ud83d\udd52 ${now()} (Douala)</i>

<b>March\u00e9s</b>
XAF : ${f(r.xafAsk, 4)} XAF/USDT (${r.xafMerchants.length} marchands)
CNY : ${f(r.cnyBidBinance, 4)} \u00a5/USDT (${r.cnyMerchants.length} marchands)

<b>Param\u00e8tres</b>
S = ${fp(r.S)} | B = ${fp(r.B)} | F = ${fp(r.F)}
V = ${fp(r.V)} (auto, k=${f(r.K, 1)})

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
<b>\ud83d\udfe2 Taux brut Binance</b>
${fi(Math.round(tauxBrut / 10) * 10)} \u00a5 (th\u00e9orique, avant toute marge)

<b>\ud83d\udfe1 Taux de revient Bonzini</b>
${fi(tauxRevient)} \u00a5 (apr\u00e8s spread OTC de ${fp(r.S)})
<i>\u2192 C'est ce que \u00e7a nous co\u00fbte r\u00e9ellement</i>

<b>\ud83d\udfe0 Taux s\u00e9curis\u00e9</b>
${fi(tauxSecurise)} \u00a5 (apr\u00e8s buffer + volatilit\u00e9)
<i>\u2192 Notre prix plancher de s\u00e9curit\u00e9</i>

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
<b>\ud83d\udcb0 Taux client final</b>
<b>${fi(tauxClient)} \u00a5</b> (apr\u00e8s marge B = ${fp(r.B)})
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501

Gain : ${f(r.gain)} \u00a5 / million XAF
Marge totale : ${f(r.mTotal, 3)}%`;

  await sendMessage(chatId, msg);
}

// ─── Command: /marche ────────────────────────────────────────────────────────

async function handleMarche(chatId: number) {
  await sendMessage(chatId, "\u23f3 Analyse du march\u00e9...");

  const r = await calculateRate();

  let xafTable = `<b>\ud83c\udde8\ud83c\uddf2 March\u00e9 XAF (\u22655000 USDT)</b>\n<i>\ud83d\udd52 ${now()} (Douala)</i>\n\n`;
  for (const m of r.xafMerchants) {
    xafTable += `\u2022 <b>${m.name}</b>\n  ${f(m.price)} XAF | ${fi(m.tradable)} USDT | ${fi(m.orders)} orders | ${(m.completion * 100).toFixed(1)}%\n`;
  }

  let cnyTable = "\n<b>\ud83c\udde8\ud83c\uddf3 March\u00e9 CNY</b>\n\n";
  for (const m of r.cnyMerchants) {
    const displayName = m.name.length > 15 ? m.name.slice(0, 15) + "\u2026" : m.name;
    cnyTable += `\u2022 <b>${displayName}</b>\n  ${f(m.price)} \u00a5 | ${fi(m.tradable)} USDT | ${fi(m.orders)} orders | ${(m.completion * 100).toFixed(1)}%\n`;
  }

  await sendMessage(chatId, xafTable + cnyTable);
}

// ─── Command: /simule ────────────────────────────────────────────────────────

async function handleSimule(chatId: number, amountStr: string) {
  const amount = parseInt(amountStr.replace(/[.\s]/g, ""), 10);
  if (isNaN(amount) || amount <= 0) {
    await sendMessage(chatId, "\u274c Montant invalide. Ex: /simule 5000000");
    return;
  }

  const r = await calculateRate();
  const usdtAmount = amount / r.xafAsk;
  const cnyAmount = usdtAmount * r.cnyBidAdj;
  const afterMargin = Math.round((cnyAmount * (1 - r.B - r.F - r.V)) / 10) * 10;

  await sendMessage(chatId, `
<b>\ud83e\uddee Simulation</b>
<i>\ud83d\udd52 ${now()} (Douala)</i>

${fi(amount)} XAF
\u2192 ${f(usdtAmount, 2)} USDT
\u2192 ${f(cnyAmount)} \u00a5 (march\u00e9)
\u2192 <b>${fi(afterMargin)} \u00a5</b> (marge ${f(r.mTotal, 1)}%)`);
}

// ─── Command: /tendance ──────────────────────────────────────────────────────

async function handleTendance(chatId: number) {
  await sendMessage(chatId, "\u23f3 Analyse de tendance...");

  const supabase = getSupabase();

  // Last 24h snapshots
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: snapshots } = await supabase
    .from("rate_snapshots")
    .select("bonzini_rate, xaf_ask, cny_bid_adjusted, market_rate, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (!snapshots || snapshots.length < 2) {
    await sendMessage(chatId, "\u26a0\ufe0f Pas assez de donn\u00e9es. Le monitoring doit tourner quelques heures avant d'avoir une tendance.");
    return;
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const rates = snapshots.map((s: any) => s.bonzini_rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const changePct = ((last.bonzini_rate - first.bonzini_rate) / first.bonzini_rate) * 100;

  // XAF trend
  const xafFirst = first.xaf_ask;
  const xafLast = last.xaf_ask;
  const xafChange = ((xafLast - xafFirst) / xafFirst) * 100;

  // CNY trend
  const cnyFirst = first.cny_bid_adjusted;
  const cnyLast = last.cny_bid_adjusted;
  const cnyChange = ((cnyLast - cnyFirst) / cnyFirst) * 100;

  const arrow = (pct: number) => pct > 0.1 ? "\ud83d\udcc8" : pct < -0.1 ? "\ud83d\udcc9" : "\u2796";
  const sign = (pct: number) => pct > 0 ? "+" : "";

  await sendMessage(chatId, `
<b>\ud83d\udcc8 Tendance 24h</b>
<i>\ud83d\udd52 ${now()} (Douala)</i>
${snapshots.length} points de mesure

<b>Taux Bonzini</b>
${arrow(changePct)} ${fi(first.bonzini_rate)} \u2192 ${fi(last.bonzini_rate)} \u00a5 (${sign(changePct)}${f(changePct, 1)}%)
Min : ${fi(min)} \u00a5 | Max : ${fi(max)} \u00a5

<b>D\u00e9tail</b>
${arrow(xafChange)} XAF Ask : ${f(xafFirst, 2)} \u2192 ${f(xafLast, 2)} (${sign(xafChange)}${f(xafChange, 1)}%)
${arrow(cnyChange)} CNY Bid : ${f(cnyFirst, 4)} \u2192 ${f(cnyLast, 4)} (${sign(cnyChange)}${f(cnyChange, 1)}%)

<i>Depuis ${new Date(first.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit" })} \u00e0 ${new Date(last.created_at).toLocaleString("fr-FR", { timeZone: "Africa/Douala", hour: "2-digit", minute: "2-digit" })}</i>`);
}

// ─── Command: /publier ───────────────────────────────────────────────────────

async function handlePublier(chatId: number) {
  await sendMessage(chatId, "\u23f3 Publication du taux...");

  const r = await calculateRate();
  const supabase = getSupabase();

  // Deactivate previous rates
  await supabase
    .from("daily_rates")
    .update({ is_active: false })
    .eq("is_active", true);

  // Calculate individual method rates from bonzini base rate
  // bonziniRate is per 1M XAF — convert to rate per CNY per 1M XAF
  const baseRate = r.bonziniRate;

  const { error } = await supabase.from("daily_rates").insert({
    rate_cash: baseRate,
    rate_alipay: baseRate,
    rate_wechat: baseRate,
    rate_virement: baseRate - 20, // bank transfer slightly less
    is_active: true,
  });

  if (error) {
    await sendMessage(chatId, `\u274c Erreur: ${error.message}`);
    return;
  }

  await sendMessage(chatId, `
\u2705 <b>Taux publi\u00e9 !</b>
<i>\ud83d\udd52 ${now()} (Douala)</i>

Cash / Alipay / WeChat : <b>${fi(baseRate)} \u00a5</b>
Virement : <b>${fi(baseRate - 20)} \u00a5</b>

Pour 1 000 000 XAF.`);
}

// ─── Command: /flyer ─────────────────────────────────────────────────────────

async function handleFlyer(chatId: number) {
  await sendMessage(chatId, "\u23f3 G\u00e9n\u00e9ration du flyer...");

  try {
    // Get the currently published rates from daily_rates
    const supabase = getSupabase();
    const { data: activeRate, error } = await supabase
      .from("daily_rates")
      .select("rate_cash, rate_alipay, rate_wechat, rate_virement")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !activeRate) {
      await sendMessage(chatId, "\u274c Aucun taux publi\u00e9. Utilise /publier d'abord.");
      return;
    }

    // Call generate-flyer with published rates
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-flyer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        rates: {
          alipay: activeRate.rate_alipay,
          wechat: activeRate.rate_wechat,
          bank: activeRate.rate_virement,
          cash: activeRate.rate_cash,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await sendMessage(chatId, `\u274c Erreur flyer: ${errText}`);
      return;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("image")) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      await sendPhoto(chatId, buffer, `<b>\ud83d\udcc4 Flyer Bonzini</b>\nTaux publi\u00e9 : ${fi(activeRate.rate_cash)} \u00a5 / 1M XAF`);
    } else {
      await sendMessage(chatId, "\u274c Le service flyer n'a pas retourn\u00e9 une image.");
    }
  } catch (err) {
    await sendMessage(chatId, `\u274c Erreur: ${err.message}`);
  }
}

// ─── Command: /rapport ───────────────────────────────────────────────────────

async function handleRapport(chatId: number) {
  await sendMessage(chatId, "\u23f3 G\u00e9n\u00e9ration du rapport PDF...");

  try {
    // Call generate-report-pdf edge function
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-report-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ margin: PARAM_B * 100 }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await sendMessage(chatId, `\u274c Erreur: ${errText}`);
      return;
    }

    const pdfBuffer = new Uint8Array(await res.arrayBuffer());
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}`;

    // Send PDF as document via Telegram
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("caption", `\ud83d\udcdd Rapport de taux Bonzini - ${dateStr}`);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([pdfBuffer], { type: "application/pdf" }), `rapport-taux-bonzini-${dateStr}.pdf`);

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    await sendMessage(chatId, `\u274c Erreur: ${err.message}`);
  }
}

// ─── Command: /config ────────────────────────────────────────────────────────

async function handleConfig(chatId: number, args: string) {
  const parts = args.trim().split(/\s+/).filter(p => p.length > 0);

  if (parts.length >= 2) {
    const param = parts[0].toLowerCase();
    const value = parseFloat(parts[1]);

    if (isNaN(value)) {
      await sendMessage(chatId, `\u274c Valeur invalide : ${parts[1]}\nExemple : /config ${param} 0.6`);
      return;
    }
    if (param === "s" || param === "spread") {
      if (value < 0 || value > 5) { await sendMessage(chatId, "\u274c S doit \u00eatre entre 0 et 5%"); return; }
      await setConfig("s", value / 100);
      await sendMessage(chatId, `\u2705 S (Spread OTC) = ${value.toFixed(3)}%\n<i>\ud83d\udd52 ${now()}</i>`);
    } else if (param === "b" || param === "marge") {
      if (value < 0 || value > 10) { await sendMessage(chatId, "\u274c B doit \u00eatre entre 0 et 10%"); return; }
      await setConfig("b", value / 100);
      await sendMessage(chatId, `\u2705 B (Marge op\u00e9rationnelle) = ${value.toFixed(3)}%\n<i>\ud83d\udd52 ${now()}</i>`);
    } else if (param === "f" || param === "buffer") {
      if (value < 0 || value > 5) { await sendMessage(chatId, "\u274c F doit \u00eatre entre 0 et 5%"); return; }
      await setConfig("f", value / 100);
      await sendMessage(chatId, `\u2705 F (Buffer s\u00e9curit\u00e9) = ${value.toFixed(3)}%\n<i>\ud83d\udd52 ${now()}</i>`);
    } else if (param === "k" || param === "risque") {
      if (value < 0 || value > 10) { await sendMessage(chatId, "\u274c k doit \u00eatre entre 0 et 10"); return; }
      await setConfig("k", value);
      await sendMessage(chatId, `\u2705 k (facteur de risque) = ${value.toFixed(1)}\n<i>\ud83d\udd52 ${now()}</i>`);
    } else {
      await sendMessage(chatId, `\u274c Param\u00e8tre inconnu : ${param}\nUtilise : s, b, f, ou k`);
    }
  } else {
    const cfg = await getConfig();
    const fp = (n: number) => (n * 100).toFixed(3) + "%";
    await sendMessage(chatId, `
\u2699\ufe0f <b>Configuration du mod\u00e8le</b>
<i>\ud83d\udd52 ${now()}</i>

<b>Param\u00e8tres de marge (tout en %)</b>

S = ${fp(cfg.s)}  \u2190 Spread OTC
B = ${fp(cfg.b)}  \u2190 Marge op\u00e9rationnelle
F = ${fp(cfg.f)}  \u2190 Buffer de s\u00e9curit\u00e9
k = ${cfg.k.toFixed(1)}       \u2190 Facteur de risque
V = auto    \u2190 k \u00d7 CV_total

<b>Modifier :</b>
/config s 0.6    \u2190 Spread OTC \u00e0 0.6%
/config b 0.8    \u2190 Marge \u00e0 0.8%
/config f 0.2    \u2190 Buffer \u00e0 0.2%
/config k 1.5    \u2190 Facteur risque \u00e0 1.5

<b>Filtres march\u00e9</b>
XAF : \u22655000 USDT dispo, 50+ orders
CNY : merchant, 200+ orders, 95%+`);
  }
}

// ─── Command: /help ──────────────────────────────────────────────────────────

async function handleHelp(chatId: number) {
  await sendMessage(chatId, `
<b>\ud83e\udd16 Bot Bonzini Rates</b>

<b>Taux & March\u00e9</b>
/taux \u2014 Taux Bonzini actuel
/marche \u2014 D\u00e9tail des marchands
/simule 5000000 \u2014 Simuler une conversion
/tendance \u2014 Tendance 24h

<b>Actions</b>
/publier \u2014 Publier le taux du jour dans l'app
/flyer \u2014 G\u00e9n\u00e9rer le flyer du jour
/rapport \u2014 Rapport d\u00e9taill\u00e9

<b>Configuration</b>
/config \u2014 Voir tous les param\u00e8tres
/config s 0.6 \u2014 Spread OTC
/config b 0.8 \u2014 Marge op\u00e9rationnelle
/config f 0.2 \u2014 Buffer s\u00e9curit\u00e9
/config k 1.5 \u2014 Facteur de risque

<i>Le bot surveille le march\u00e9 automatiquement et t'alerte si le taux bouge de plus de 1%.</i>`);
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const update = await req.json();
    const message = update.message;

    if (!message?.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Only respond to admin
    if (String(chatId) !== ADMIN_CHAT_ID) {
      await sendMessage(chatId, "\u26d4 Acc\u00e8s non autoris\u00e9.");
      return new Response("OK", { status: 200 });
    }

    if (text === "/start" || text === "/help") {
      await handleHelp(chatId);
    } else if (text === "/taux") {
      await handleTaux(chatId);
    } else if (text === "/marche") {
      await handleMarche(chatId);
    } else if (text.startsWith("/simule")) {
      await handleSimule(chatId, text.replace("/simule", "").trim() || "1000000");
    } else if (text === "/tendance") {
      await handleTendance(chatId);
    } else if (text === "/publier") {
      await handlePublier(chatId);
    } else if (text === "/flyer") {
      await handleFlyer(chatId);
    } else if (text === "/rapport") {
      await handleRapport(chatId);
    } else if (text.startsWith("/config")) {
      // Remove /config or /config@botname
      const configArgs = text.replace(/^\/config(@\S+)?/, "").trim();
      await handleConfig(chatId, configArgs);
    } else {
      await sendMessage(chatId, "\u2753 Commande inconnue. Tape /help");
    }
  } catch (err) {
    console.error("Bot error:", err);
  }

  return new Response("OK", { status: 200 });
});
