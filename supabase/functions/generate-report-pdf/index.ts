// supabase/functions/generate-report-pdf/index.ts
// Generates a beautiful PDF report using Satori (SVG) + Resvg (PNG) + pdf-lib (PDF assembly)
// Same rendering pipeline as generate-flyer — DM Sans, Noto Sans SC, Bonzini colors

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import satori from "npm:satori@0.10.11";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.0";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

// ─── WASM init ───────────────────────────────────────────────────────────────

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm"));
  }
  return wasmReady;
}

// ─── JSX helper (no React) ──────────────────────────────────────────────────

type Child = string | number | El | null | undefined;
type El = { type: string; key: null; props: Record<string, unknown> };

function h(type: string, props: Record<string, unknown> | null, ...children: (Child | Child[])[]): El {
  const flat = children.flat().filter((c) => c != null) as (string | number | El)[];
  return { type, key: null, props: { ...(props ?? {}), ...(flat.length === 0 ? {} : flat.length === 1 ? { children: flat[0] } : { children: flat }) } };
}

// ─── Fonts ───────────────────────────────────────────────────────────────────

const CDN = "https://cdn.jsdelivr.net/npm";
const FONT_URLS: Record<string, string> = {
  "dm-400": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-400-normal.woff`,
  "dm-700": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-700-normal.woff`,
  "noto-400": `${CDN}/@fontsource/noto-sans-sc@5.0.12/files/noto-sans-sc-chinese-simplified-400-normal.woff`,
};

type FontDef = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let fontCache: FontDef[] | null = null;

async function getFonts(): Promise<FontDef[]> {
  if (fontCache) return fontCache;
  const entries = Object.entries(FONT_URLS);
  const buffers = await Promise.all(entries.map(([, url]) => fetch(url).then((r) => r.arrayBuffer())));
  fontCache = [
    { name: "DM Sans", data: buffers[0], weight: 400, style: "normal" },
    { name: "DM Sans", data: buffers[1], weight: 700, style: "normal" },
    { name: "Noto Sans SC", data: buffers[2], weight: 400, style: "normal" },
  ];
  return fontCache;
}

// ─── Binance P2P ─────────────────────────────────────────────────────────────

const BINANCE_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const OTC_SPREAD = 0.04;

async function fetchPage(fiat: string, tradeType: string, page: number) {
  const res = await fetch(BINANCE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    body: JSON.stringify({ fiat, page, rows: 20, tradeType, asset: "USDT", countries: [], proMerchantAds: false, publisherType: null, payTypes: [], classifies: ["mass", "profession", "fiat_merchant"] }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Binance: ${json.message}`);
  return json.data;
}

async function fetchAll(fiat: string, tradeType: string) {
  const results = await Promise.all(Array.from({ length: 5 }, (_, i) => fetchPage(fiat, tradeType, i + 1)));
  return results.flat();
}

interface Merchant { name: string; price: number; tradable: number; orders: number; completion: number; }

function filterXaf(items: any[]): Merchant[] {
  return items.filter((i: any) => parseFloat(i.adv.tradableQuantity) >= 5000 && i.advertiser.monthOrderCount >= 50 && i.advertiser.monthFinishRate >= 0.90 && i.advertiser.positiveRate >= 0.90)
    .slice(0, 10).map((i: any) => ({ name: i.advertiser.nickName, price: parseFloat(i.adv.price), tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount, completion: i.advertiser.monthFinishRate }));
}

function filterCny(items: any[]): Merchant[] {
  return items.filter((i: any) => i.advertiser.userType === "merchant" && i.advertiser.monthOrderCount >= 200 && i.advertiser.monthFinishRate >= 0.95 && i.advertiser.positiveRate >= 0.97)
    .slice(0, 10).map((i: any) => ({ name: i.advertiser.nickName, price: parseFloat(i.adv.price), tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount, completion: i.advertiser.monthFinishRate }));
}

function wAvg(ms: Merchant[]): number { let sw = 0, s = 0; for (const m of ms) { sw += m.price * m.orders; s += m.orders; } return sw / s; }

// ─── Formatting ──────────────────────────────────────────────────────────────

function f(n: number, d = 2): string {
  const parts = n.toFixed(d).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return parts.join(",");
}
function fi(n: number): string { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
function pc(n: number): string { return (n * 100).toFixed(1) + "%"; }

// ─── Colors ──────────────────────────────────────────────────────────────────

const V = "#7C3AED"; // violet
const A = "#D97706"; // amber
const O = "#EA580C"; // orange

// ─── Shared styles ───────────────────────────────────────────────────────────

const page = { width: "595px", height: "842px", fontFamily: "DM Sans", fontSize: "10px", color: "#1E293B", padding: "40px 44px", display: "flex", flexDirection: "column" as const, backgroundColor: "#FFFFFF", position: "relative" as const };
const bar = { width: "507px", height: "5px", backgroundColor: V, borderRadius: "2px", marginBottom: "18px" };
const secStyle = (color: string) => ({ fontSize: "13px", fontWeight: 700, color, marginTop: "16px", marginBottom: "6px", borderBottom: "1px solid #E2E8F0", paddingBottom: "3px", display: "flex" as const });
const body = { fontSize: "9.5px", marginBottom: "5px", lineHeight: "1.6" };
const tHead = { display: "flex" as const, flexDirection: "row" as const, backgroundColor: "#F1F5F9", padding: "4px 6px", borderBottom: "1px solid #CBD5E1" };
const tRow = { display: "flex" as const, flexDirection: "row" as const, padding: "3.5px 6px", borderBottom: "0.5px solid #E2E8F0" };
const th = { fontSize: "8.5px", fontWeight: 700, color: "#475569" };
const td = { fontSize: "8.5px" };
const box = { backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "5px", padding: "10px", marginBottom: "7px", display: "flex" as const, flexDirection: "column" as const };
const boxTitle = { fontSize: "10px", fontWeight: 700, color: A, marginBottom: "2px" };
const formula = { fontSize: "9.5px", color: "#334155", marginBottom: "2px" };
const result = { fontSize: "9.5px", fontWeight: 700, color: "#0F172A" };
const footer = { position: "absolute" as const, bottom: "22px", left: "44px", right: "44px", display: "flex" as const, flexDirection: "row" as const, justifyContent: "space-between" as const, fontSize: "7.5px", color: "#94A3B8" };

// Column widths for tables
const c1 = "32%", c2 = "17%", c3 = "17%", c4 = "17%", c5 = "17%";

function merchantName(m: Merchant): El {
  const hasCJK = /[\u4e00-\u9fff]/.test(m.name);
  const display = hasCJK ? (m.name.length > 10 ? m.name.slice(0, 10) + "\u2026" : m.name) : m.name;
  const font = hasCJK ? "Noto Sans SC" : "DM Sans";
  return h("div", { style: { width: c1, ...td, fontFamily: font } }, display);
}

function bullet(text: string): El {
  return h("div", { style: { display: "flex", flexDirection: "row", marginBottom: "3px", paddingLeft: "4px" } },
    h("div", { style: { width: "12px", fontSize: "9.5px", color: A } }, "\u2022"),
    h("div", { style: { flex: 1, fontSize: "9.5px", lineHeight: "1.55" } }, text)
  );
}

// ─── Page Builders ───────────────────────────────────────────────────────────

function buildPage1(dateStr: string): El {
  return h("div", { style: page },
    h("div", { style: bar }),
    h("div", { style: { fontSize: "20px", fontWeight: 700, color: V, marginBottom: "3px" } }, "Calcul du Taux Bonzini"),
    h("div", { style: { fontSize: "11px", color: "#64748B", marginBottom: "16px" } }, `Rapport d\u00e9taill\u00e9 du ${dateStr} \u2014 Donn\u00e9es Binance P2P en temps r\u00e9el`),

    h("div", { style: secStyle(V) }, "1. M\u00e9thodologie"),
    h("div", { style: body }, "Le taux Bonzini est calcul\u00e9 \u00e0 partir des cours r\u00e9els du march\u00e9 P2P Binance via un calcul triangulaire : XAF \u2192 USDT \u2192 CNY. L\u2019USDT sert de pont car il n\u2019existe pas de march\u00e9 direct XAF/CNY."),
    h("div", { style: { ...body, fontWeight: 700 } }, "Pourquoi le P2P Binance ?"),
    bullet("Taux plus comp\u00e9titifs que les banques ou Western Union"),
    bullet("Seuls les marchands v\u00e9rifi\u00e9s avec historique solide sont retenus"),
    bullet("Donn\u00e9es en temps r\u00e9el, pas de cache"),

    h("div", { style: secStyle(V) }, "2. Sources de donn\u00e9es"),
    h("div", { style: body }, "API Binance P2P \u2014 deux requ\u00eates en parall\u00e8le :"),
    bullet("USDT/XAF tradeType \u00abBUY\u00bb \u2192 prix d\u2019achat USDT en XAF (cours Ask)"),
    bullet("USDT/CNY tradeType \u00abSELL\u00bb \u2192 prix de revente USDT en CNY (cours Bid)"),

    h("div", { style: secStyle(A) }, "3. Filtres de qualit\u00e9"),
    h("div", { style: { ...body, fontWeight: 700 } }, "C\u00f4t\u00e9 XAF (march\u00e9 camerounais) :"),
    bullet("USDT disponible > 5 000 USDT (filtre liquidit\u00e9)"),
    bullet("Minimum 50 transactions/mois, 90%+ compl\u00e9tion"),
    h("div", { style: { ...body, fontWeight: 700, marginTop: "4px" } }, "C\u00f4t\u00e9 CNY (march\u00e9 chinois) :"),
    bullet("Statut \u00abmerchant\u00bb v\u00e9rifi\u00e9, 200+ orders, 95%+, 97%+"),
    bullet("Ajustement OTC : \u22120,04 sur le cours Binance"),
    h("div", { style: body }, "On retient les 10 meilleurs marchands pour chaque paire."),

    h("div", { style: footer }, h("div", null, "Bonzini \u2014 Rapport de calcul de taux"), h("div", null, "Page 1/3"))
  );
}

function buildPage2(xm: Merchant[], cm: Merchant[], xafAvg: number, cnyBinance: number, cnyAdj: number): El {
  const xafRows = xm.map((m) =>
    h("div", { style: tRow }, merchantName(m), h("div", { style: { width: c2, ...td, textAlign: "right" } }, f(m.price)), h("div", { style: { width: c3, ...td, textAlign: "right" } }, fi(m.tradable)), h("div", { style: { width: c4, ...td, textAlign: "right" } }, fi(m.orders)), h("div", { style: { width: c5, ...td, textAlign: "right" } }, pc(m.completion)))
  );
  const cnyRows = cm.map((m) =>
    h("div", { style: tRow }, merchantName(m), h("div", { style: { width: c2, ...td, textAlign: "right" } }, f(m.price)), h("div", { style: { width: c3, ...td, textAlign: "right" } }, fi(m.tradable)), h("div", { style: { width: c4, ...td, textAlign: "right" } }, fi(m.orders)), h("div", { style: { width: c5, ...td, textAlign: "right" } }, pc(m.completion)))
  );

  return h("div", { style: page },
    h("div", { style: bar }),

    h("div", { style: secStyle(V) }, "4. Marchands USDT/XAF retenus"),
    h("div", { style: body }, "Prix d\u2019achat du USDT en XAF. Filtre : > 5 000 USDT disponibles."),
    h("div", { style: tHead }, h("div", { style: { width: c1, ...th } }, "Marchand"), h("div", { style: { width: c2, ...th, textAlign: "right" } }, "Prix (XAF)"), h("div", { style: { width: c3, ...th, textAlign: "right" } }, "USDT dispo"), h("div", { style: { width: c4, ...th, textAlign: "right" } }, "Orders/mois"), h("div", { style: { width: c5, ...th, textAlign: "right" } }, "Compl\u00e9tion")),
    ...xafRows,
    h("div", { style: { ...box, marginTop: "8px" } },
      h("div", { style: boxTitle }, "Moyenne pond\u00e9r\u00e9e par volume"),
      h("div", { style: result }, `R\u00e9sultat : 1 USDT = ${f(xafAvg, 4)} XAF`)
    ),

    h("div", { style: secStyle(A) }, "5. Marchands USDT/CNY retenus"),
    h("div", { style: body }, "Prix de revente du USDT en CNY. Ajustement OTC appliqu\u00e9 ensuite."),
    h("div", { style: tHead }, h("div", { style: { width: c1, ...th } }, "Marchand"), h("div", { style: { width: c2, ...th, textAlign: "right" } }, "Prix (CNY)"), h("div", { style: { width: c3, ...th, textAlign: "right" } }, "USDT dispo"), h("div", { style: { width: c4, ...th, textAlign: "right" } }, "Orders/mois"), h("div", { style: { width: c5, ...th, textAlign: "right" } }, "Compl\u00e9tion")),
    ...cnyRows,
    h("div", { style: { ...box, marginTop: "8px" } },
      h("div", { style: boxTitle }, "Moyenne pond\u00e9r\u00e9e Binance"),
      h("div", { style: formula }, `Cours Binance : 1 USDT = ${f(cnyBinance, 4)} \u00a5`),
      h("div", { style: formula }, `Ajustement OTC : ${f(cnyBinance, 4)} \u2212 ${f(OTC_SPREAD, 2)} = ${f(cnyAdj, 4)} \u00a5`),
      h("div", { style: result }, `Taux de vente r\u00e9el : 1 USDT = ${f(cnyAdj, 4)} \u00a5`)
    ),

    h("div", { style: footer }, h("div", null, "Bonzini \u2014 Rapport de calcul de taux"), h("div", null, "Page 2/3"))
  );
}

function buildPage3(data: { xafAsk: number; cnyBinance: number; cnyAdj: number; usdtPer1M: number; marketRate: number; margin: number; bonziniRate: number; gain: number }, dateStr: string): El {
  const d = data;
  const summaryRows = [
    ["Cours Ask USDT/XAF", `${f(d.xafAsk, 4)} XAF`],
    ["Cours Bid Binance USDT/CNY", `${f(d.cnyBinance, 4)} \u00a5`],
    ["Ajustement OTC", `\u2212${f(OTC_SPREAD, 2)}`],
    ["Cours Bid ajust\u00e9", `${f(d.cnyAdj, 4)} \u00a5`],
    ["USDT pour 1M XAF", `${f(d.usdtPer1M, 4)} USDT`],
    ["Taux march\u00e9", `${f(d.marketRate)} \u00a5`],
    ["Marge Bonzini", `${f(d.margin, 1)}%`],
    ["Taux Bonzini final", `${fi(d.bonziniRate)} \u00a5`],
  ].map(([label, value]) =>
    h("div", { style: { ...tRow } },
      h("div", { style: { width: "55%", fontSize: "9px" } }, label),
      h("div", { style: { width: "45%", fontSize: "9px", textAlign: "right", fontWeight: 500 } }, value)
    )
  );

  return h("div", { style: page },
    h("div", { style: bar }),

    h("div", { style: secStyle(O) }, `6. Calcul triangulaire \u00e9tape par \u00e9tape`),
    h("div", { style: body }, `Conversion de 1 000 000 XAF en yuan chinois (\u00a5).`),

    h("div", { style: box },
      h("div", { style: boxTitle }, `\u00c9tape 1 \u2014 Achat USDT avec XAF`),
      h("div", { style: body }, `On divise 1M XAF par le cours Ask.`),
      h("div", { style: formula }, `1 000 000 \u00f7 ${f(d.xafAsk, 4)}`),
      h("div", { style: result }, `= ${f(d.usdtPer1M, 4)} USDT`)
    ),
    h("div", { style: box },
      h("div", { style: boxTitle }, `\u00c9tape 2 \u2014 Cours CNY ajust\u00e9 (OTC)`),
      h("div", { style: body }, `Binance affiche ${f(d.cnyBinance, 4)} \u00a5, mais on vend sur le march\u00e9 OTC (\u22120,04).`),
      h("div", { style: formula }, `${f(d.cnyBinance, 4)} \u2212 ${f(OTC_SPREAD, 2)} = ${f(d.cnyAdj, 4)} \u00a5`),
      h("div", { style: result }, `Taux de vente r\u00e9el : ${f(d.cnyAdj, 4)} \u00a5 par USDT`)
    ),
    h("div", { style: box },
      h("div", { style: boxTitle }, `\u00c9tape 3 \u2014 Conversion en yuan`),
      h("div", { style: formula }, `${f(d.usdtPer1M, 4)} USDT \u00d7 ${f(d.cnyAdj, 4)} \u00a5`),
      h("div", { style: result }, `= ${f(d.marketRate)} \u00a5 (taux march\u00e9)`)
    ),
    h("div", { style: box },
      h("div", { style: boxTitle }, `\u00c9tape 4 \u2014 Marge Bonzini (${f(d.margin, 1)}%) + arrondi`),
      h("div", { style: formula }, `${f(d.marketRate)} \u00d7 ${f(1 - d.margin / 100, 4)} = ${f(d.marketRate * (1 - d.margin / 100))} \u00a5`),
      h("div", { style: formula }, `Arrondi \u00e0 la dizaine la plus proche`),
      h("div", { style: result }, `= ${fi(d.bonziniRate)} \u00a5`)
    ),

    // Result box
    h("div", { style: { backgroundColor: V, borderRadius: "8px", padding: "14px 20px", marginTop: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", alignItems: "center" } },
      h("div", { style: { fontSize: "18px", fontWeight: 700, color: "#FFF" } }, `1 000 000 XAF = ${fi(d.bonziniRate)} \u00a5`),
      h("div", { style: { fontSize: "9px", color: "#DDD6FE", marginTop: "3px" } }, `Taux Bonzini du ${dateStr} \u2014 Marge ${f(d.margin, 1)}%`)
    ),

    // Gain box
    h("div", { style: { backgroundColor: "#FFF7ED", border: "1px solid " + A, borderRadius: "5px", padding: "8px 10px", marginBottom: "8px", display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontWeight: 700, fontSize: "9.5px", color: A } }, "Gain Bonzini par million XAF"),
        h("div", { style: { fontSize: "8.5px", color: "#78716C", marginTop: "2px" } }, `${f(d.marketRate)} \u2212 ${fi(d.bonziniRate)} \u00a5`)
      ),
      h("div", { style: { fontSize: "15px", fontWeight: 700, color: O } }, `${f(d.gain)} \u00a5`)
    ),

    // Summary table
    h("div", { style: secStyle(V) }, "7. R\u00e9sum\u00e9"),
    h("div", { style: tHead },
      h("div", { style: { width: "55%", ...th } }, "Indicateur"),
      h("div", { style: { width: "45%", ...th, textAlign: "right" } }, "Valeur")
    ),
    ...summaryRows,

    h("div", { style: { borderBottom: "1px solid #E2E8F0", marginTop: "14px", marginBottom: "6px" } }),
    h("div", { style: { fontSize: "7.5px", color: "#94A3B8", textAlign: "center" } }, "G\u00e9n\u00e9r\u00e9 automatiquement \u00e0 partir des donn\u00e9es Binance P2P. Les taux varient d\u2019une minute \u00e0 l\u2019autre."),

    h("div", { style: footer }, h("div", null, "Bonzini \u2014 Rapport de calcul de taux"), h("div", null, "Page 3/3"))
  );
}

// ─── Render page to PNG ──────────────────────────────────────────────────────

async function renderPageToPng(element: El, fonts: FontDef[]): Promise<Uint8Array> {
  const svg = await satori(element as any, { width: 595, height: 842, fonts });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1190 } }); // 2x for sharpness
  return resvg.render().asPng();
}

// ─── Main ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  try {
    let margin = 1.0;
    try { const b = await req.json(); if (b.margin) margin = b.margin; } catch { /* default */ }

    await ensureWasm();
    const fonts = await getFonts();

    // Fetch rates
    const [xafRaw, cnyRaw] = await Promise.all([fetchAll("XAF", "BUY"), fetchAll("CNY", "SELL")]);

    let xm = filterXaf(xafRaw);
    let cm = filterCny(cnyRaw);
    if (xm.length === 0) xm = xafRaw.slice(0, 5).map((i: any) => ({ name: i.advertiser.nickName, price: parseFloat(i.adv.price), tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount, completion: i.advertiser.monthFinishRate }));
    if (cm.length === 0) cm = cnyRaw.slice(0, 5).map((i: any) => ({ name: i.advertiser.nickName, price: parseFloat(i.adv.price), tradable: parseFloat(i.adv.tradableQuantity), orders: i.advertiser.monthOrderCount, completion: i.advertiser.monthFinishRate }));

    const xafAsk = wAvg(xm);
    const cnyBinance = wAvg(cm);
    const cnyAdj = cnyBinance - OTC_SPREAD;
    const usdtPer1M = 1_000_000 / xafAsk;
    const marketRate = usdtPer1M * cnyAdj;
    const bonziniRate = Math.round((marketRate * (1 - margin / 100)) / 10) * 10;
    const gain = marketRate - bonziniRate;

    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    // Render 3 pages as PNG
    const [png1, png2, png3] = await Promise.all([
      renderPageToPng(buildPage1(dateStr), fonts),
      renderPageToPng(buildPage2(xm, cm, xafAsk, cnyBinance, cnyAdj), fonts),
      renderPageToPng(buildPage3({ xafAsk, cnyBinance, cnyAdj, usdtPer1M, marketRate, margin, bonziniRate, gain }, dateStr), fonts),
    ]);

    // Assemble into PDF
    const pdf = await PDFDocument.create();

    for (const pngBytes of [png1, png2, png3]) {
      const img = await pdf.embedPng(pngBytes);
      // A4 dimensions in points
      const page = pdf.addPage([595.28, 841.89]);
      page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
    }

    const pdfBytes = await pdf.save();
    const ds = `${now.getDate().toString().padStart(2, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getFullYear()}`;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-taux-bonzini-${ds}.pdf"`,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }
});
