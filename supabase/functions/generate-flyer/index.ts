// Supabase Edge Function — generate-flyer
// Le flyer « Taux du jour » côté serveur, pour Mola (generate_rate_flyer) et le
// bot Telegram (/flyer). MÊME design et MÊMES chiffres que le flyer de l'app
// (src/mobile/components/rates/RateFlyer.tsx + src/lib/rateFlyer.ts) : un
// flyer par pays, les petits paiements dans un bloc rouge ; depuis le
// 28/09/2026 signé BONZINI, le jour ET l'heure (Douala), le pays → la Chine
// avec les deux drapeaux, plus de phrase en bas, en français OU en anglais.
// Les mots (FLYER_TEXT) sont copiés de src/lib/rateFlyer.ts — le test
// src/tests/lib/rateFlyer.test.ts vérifie que chacun est présent ici.
//
// Entrée : { country_key?: "cameroun" | "gabon" | …, lang?: "fr" | "en" } — rien d'autre. La
// fonction lit ELLE-MÊME la publication active et rate_adjustments : on ne
// peut plus lui faire imprimer des taux inventés (elle acceptait des taux
// quelconques, sans authentification).
// Sortie : PNG 2160×2700 ; en-tête X-Flyer-Caption = le texte WhatsApp du jour
// (encodé URI).
// Pipeline : Satori (arbre → SVG) → Resvg (SVG → PNG).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import satori from "npm:satori@0.10.11";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.0";

const FLYER_BRAND = "BONZINI";
const W = 1080;
const H = 1350;

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm"));
  return wasmReady;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-flyer-caption, content-disposition",
};

// ── Arbre minimal pour Satori (pas de React) ──────────────────────────────
type Child = string | number | El | null | undefined | false;
type El = { type: string; key: null; props: Record<string, unknown> };
function h(type: string, props: Record<string, unknown> | null, ...children: (Child | Child[])[]): El {
  const flat = children.flat().filter((c) => c != null && c !== false) as (string | number | El)[];
  return { type, key: null, props: { ...(props ?? {}), ...(flat.length === 0 ? {} : flat.length === 1 ? { children: flat[0] } : { children: flat }) } };
}

// ── Polices : DM Sans (WOFF — Satori 0.10 ne lit pas le WOFF2) ─────────────
const CDN = "https://cdn.jsdelivr.net/npm";
const WEIGHTS = [500, 600, 700, 800, 900] as const;
type FontDef = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let fontCache: FontDef[] | null = null;
async function getFonts(): Promise<FontDef[]> {
  if (fontCache) return fontCache;
  const data = await Promise.all(WEIGHTS.map((w) =>
    fetch(`${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-${w}-normal.woff`).then((r) => {
      if (!r.ok) throw new Error(`Police ${w} : ${r.status}`);
      return r.arrayBuffer();
    })));
  fontCache = WEIGHTS.map((w, i) => ({ name: "DM Sans", data: data[i], weight: w, style: "normal" as const }));
  return fontCache;
}

/** Le drapeau (flag-icons, 4:3) en data URL, caché par isolate. */
const flagCache = new Map<string, string | null>();
async function flagDataUrl(iso: string): Promise<string | null> {
  const key = iso.toLowerCase();
  if (flagCache.has(key)) return flagCache.get(key)!;
  try {
    const r = await fetch(`${CDN}/flag-icons@7.2.3/flags/4x3/${key}.svg`);
    const svg = r.ok ? await r.text() : null;
    const url = svg ? `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}` : null;
    flagCache.set(key, url);
    return url;
  } catch { return null; }
}

// ── Les mots et les chiffres : copie fidèle de src/lib/rateFlyer.ts ────────
type Lang = "fr" | "en";
type MethodKey = "alipay" | "wechat" | "virement" | "cash";
const FLYER_TEXT = {
  fr: {
    title: "Taux du jour",
    forAmount: "Pour",
    supplierGets: ", votre fournisseur reçoit\u00a0:",
    china: "Chine",
    allAmounts: "Tous montants",
    andAbove: "XAF et plus",
    under: "Moins de",
    from: "De",
    to: "à",
    payment: "Paiement",
    paymentOf: "Paiement de",
    methods: { alipay: "Alipay", wechat: "WeChat Pay", virement: "Virement", cash: "Cash" },
    countries: { cameroun: "Cameroun", gabon: "Gabon", tchad: "Tchad", rca: "Centrafrique", congo: "Congo", guinee: "Guinée Équatoriale" },
    days: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
    months: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
    colon: " :",
  },
  en: {
    title: "Today's rate",
    forAmount: "For",
    supplierGets: ", your supplier receives:",
    china: "China",
    allAmounts: "All amounts",
    andAbove: "XAF and above",
    under: "Under",
    from: "From",
    to: "to",
    payment: "Payment",
    paymentOf: "Payment of",
    methods: { alipay: "Alipay", wechat: "WeChat Pay", virement: "Bank transfer", cash: "Cash" },
    countries: { cameroun: "Cameroon", gabon: "Gabon", tchad: "Chad", rca: "Central African Rep.", congo: "Congo", guinee: "Equatorial Guinea" },
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    colon: ":",
  },
} as const;
const METHODS: { key: MethodKey; col: string }[] = [
  { key: "alipay", col: "rate_alipay" },
  { key: "wechat", col: "rate_wechat" },
  { key: "virement", col: "rate_virement" },
  { key: "cash", col: "rate_cash" },
];
const COUNTRY_ISO: Record<string, string> = { cameroun: "CM", gabon: "GA", tchad: "TD", rca: "CF", congo: "CG", guinee: "GQ" };
type Adj = { type: string; key: string; percentage: number; is_reference: boolean };
type Bracket = { min: number; max: number | null; pct: number; label: string };
type Group = { keys: MethodKey[]; label: string; rates: number[] };

const fmtIn = (n: number, lang: Lang) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, lang === "en" ? "," : "\u00a0");

function brackets(adj: Adj[], lang: Lang): Bracket[] {
  const t = FLYER_TEXT[lang];
  const fmt = (n: number) => fmtIn(n, lang);
  const pctOf = (k: string) => { const t = adj.find((a) => a.type === "tier" && a.key === k); return t && !t.is_reference ? Number(t.percentage) || 0 : 0; };
  const asc = [{ min: 0, pct: pctOf("t1") }, { min: 400_000, pct: pctOf("t2") }, { min: 1_000_000, pct: pctOf("t3") }];
  const merged: { min: number; pct: number }[] = [];
  for (const t of asc) { const last = merged[merged.length - 1]; if (!last || last.pct !== t.pct) merged.push({ ...t }); }
  return merged.map((b, i) => {
    const next = merged[i + 1];
    const max = next ? next.min - 1 : null;
    const label = merged.length === 1 ? t.allAmounts
      : max === null ? `${fmt(b.min)} ${t.andAbove}`
      : b.min === 0 ? `${t.under} ${fmt(next!.min)} XAF`
      : `${t.from} ${fmt(b.min)} ${t.to} ${fmt(max)} XAF`;
    return { min: b.min, max, pct: b.pct, label };
  }).reverse();
}
/** Comme calculateFinalRate : arrondi à 2 décimales, puis à l'entier sur le flyer. */
const rateOf = (base: number, c: number, t: number) => base > 0 ? Math.round(Math.round(base * (1 + c / 100) * (1 + t / 100) * 100) / 100) : 0;
function groupsOf(rate: Record<string, number>, c: number, bs: Bracket[], lang: Lang): Group[] {
  const out: Group[] = [];
  for (const m of METHODS) {
    const rates = bs.map((b) => rateOf(Number(rate[m.col]), c, b.pct));
    const same = m.key === "cash" ? undefined : out.find((g) => !g.keys.includes("cash") && g.rates.every((r, i) => r === rates[i]));
    if (same) same.keys.push(m.key); else out.push({ keys: [m.key], label: "", rates });
  }
  for (const g of out) g.label = g.keys.map((k) => FLYER_TEXT[lang].methods[k]).join(" · ");
  return out;
}
function doualaDay(now: Date, lang: Lang): { label: string; iso: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Douala", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const y = Number(g("year")), m = Number(g("month")), d = Number(g("day"));
  const t = FLYER_TEXT[lang];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    label: `${t.days[wd]} ${d} ${t.months[m - 1]} ${y}`,
    iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    time: `${g("hour")}${lang === "en" ? ":" : "h"}${g("minute")}`,
  };
}
function smallTitle(b: Bracket, lang: Lang): string {
  const t = FLYER_TEXT[lang];
  const l = b.label.charAt(0).toLowerCase() + b.label.slice(1);
  if (lang === "en") return b.min === 0 ? `${t.payment} ${l}` : `${t.paymentOf} ${l.replace(/^from /, "")}`;
  return l.startsWith("de ") ? `${t.payment} ${l}` : `${t.paymentOf} ${l}`;
}
function caption(lang: Lang, country: string, day: { label: string; time: string }, bs: Bracket[], gs: Group[]): string {
  const t = FLYER_TEXT[lang];
  const fmt = (n: number) => fmtIn(n, lang);
  const date = lang === "fr" ? `${day.label.charAt(0).toLowerCase()}${day.label.slice(1)}` : day.label;
  const line = (g: Group, r: number) => `• ${g.label.replace(/ · /g, ", ")}${t.colon} ${fmt(r)} ¥`;
  const lines = [`${t.title} · ${country} → ${t.china} · ${date} · ${day.time}`, `${t.forAmount} ${fmt(1_000_000)} XAF${t.supplierGets}`];
  for (const g of gs) lines.push(line(g, g.rates[0]));
  bs.slice(1).forEach((b, i) => { lines.push("", `${smallTitle(b, lang)}${t.colon}`); for (const g of gs) lines.push(line(g, g.rates[i + 1])); });
  lines.push("", FLYER_BRAND);
  return lines.join("\n").replace(/\u00a0/g, " ");
}
/** Taille d'un libellé sur une ligne : réduite quand il est long (anglais) — comme RateFlyer. */
const fit = (text: string, base: number, room: number, min = 18) => text.length <= room ? base : Math.max(min, Math.floor((base * room) / text.length));

// ── Le dessin : même mise en page que RateFlyer.tsx ───────────────────────
const INK = "#1a1028", MUTED = "#5f5775", SOFT = "#d6d0e0", LINE = "#e6e1ee", SHEET = "#f5f3f8", GOLD = "#f3a745", ALERT = "#D7261E";
const ALIPAY = "M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809";
const WECHAT = "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z";

function tile(method: MethodKey, size: number): El {
  const box = (bg: string, child: El, ring = false) => h("div", { style: { width: size, height: size, borderRadius: Math.round(size * 0.26), background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...(ring ? { border: `2px solid ${LINE}` } : {}) } }, child);
  if (method === "alipay") return box("#FFFFFF", h("svg", { viewBox: "0 0 24 24", width: size * 0.64, height: size * 0.64, fill: "#1677FF" }, h("path", { d: ALIPAY })), true);
  if (method === "wechat") return box("#07C160", h("svg", { viewBox: "0 0 24 24", width: size * 0.58, height: size * 0.58, fill: "#FFFFFF" }, h("path", { d: WECHAT })));
  if (method === "cash") return box("#E0322B", h("div", { style: { fontSize: size * 0.58, fontWeight: 900, color: "#fff", lineHeight: 1 } }, "¥"));
  return box("#ECE8F6", h("svg", { viewBox: "0 0 24 24", width: size * 0.5, height: size * 0.5, fill: "none", stroke: INK, strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" },
    ...["M10 18v-7", "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z", "M14 18v-7", "M18 18v-7", "M3 22h18", "M6 18v-7"].map((d) => h("path", { d }))));
}
const num = (value: number, size: number, lang: Lang, color = INK) => h("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } },
  h("div", { style: { fontSize: size, fontWeight: 900, letterSpacing: -3, lineHeight: 1, color } }, fmtIn(value, lang)),
  h("div", { style: { fontSize: Math.round(size * 0.44), fontWeight: 800, color } }, "¥"));

function row(g: Group, rate: number, size: number, onRed: boolean, lang: Lang): El {
  return h("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
    ...(onRed ? [] : g.keys.map((k) => tile(k, 40))),
    h("div", { style: { display: "flex", flex: 1, fontSize: fit(g.label, onRed ? 26 : 30, 30), fontWeight: 800, marginLeft: onRed ? 0 : 6, color: onRed ? "#fff" : INK } }, g.label),
    num(rate, size, lang, onRed ? "#fff" : INK));
}

const flagImg = (src: string) => h("img", { src, width: 116, height: 87, style: { borderRadius: 14, border: `2px solid ${LINE}` } });

function flyer(lang: Lang, country: { label: string }, flag: string | null, china: string | null, day: { label: string; time: string }, bs: Bracket[], gs: Group[]): El {
  const t = FLYER_TEXT[lang];
  const small = bs.slice(1);
  const many = gs.length > 2;
  const compact = (many && small.length > 0) || small.length > 1;
  const stacked = small.length === 0 && !many;
  const bigSize = stacked ? 156 : many ? 76 : 100;
  const bang = (s: number) => h("div", { style: { width: s, height: s, borderRadius: s / 2, background: "#fff", color: ALERT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(s * 0.72), fontWeight: 900, flexShrink: 0 } }, "!");

  const cards = compact
    ? [
      h("div", { style: { display: "flex", flexDirection: "column", gap: 10, margin: "18px 40px 0", background: SHEET, borderRadius: 32, padding: "16px 28px" } }, ...gs.map((g) => row(g, g.rates[0], 60, false, lang))),
      ...small.map((b, bi) => h("div", { style: { display: "flex", flexDirection: "column", margin: "12px 40px 0", background: ALERT, borderRadius: 32, padding: "14px 28px 16px" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, bang(40), h("div", { style: { fontSize: 32, fontWeight: 900, color: "#fff" } }, smallTitle(b, lang))),
        h("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 10 } }, ...gs.map((g) => row(g, g.rates[bi + 1], 44, true, lang))))),
    ]
    : [
      h("div", { style: { display: "flex", flexDirection: stacked ? "column" : "row", flexWrap: "wrap", gap: many ? 14 : 20, margin: "22px 40px 0" } },
        ...gs.map((g) => h("div", { style: { display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: many ? 480 : stacked ? "auto" : 0, background: SHEET, borderRadius: 36, padding: many ? "16px 24px 18px" : "24px 26px 26px" } },
          h("div", { style: { display: "flex", alignItems: "center", gap: 8 } }, ...g.keys.map((k) => tile(k, many ? 40 : stacked ? 64 : 52)),
            stacked ? h("div", { style: { marginLeft: 12, fontSize: g.keys.length > 1 ? fit(g.label, 36, 32) : 44, fontWeight: 800, color: INK } }, g.label) : null),
          stacked ? null : h("div", { style: { fontSize: fit(g.label, 27, many ? 22 : 30), fontWeight: 800, marginTop: many ? 8 : 12, color: INK } }, g.label),
          h("div", { style: { display: "flex", marginTop: many ? 4 : 8 } }, num(g.rates[0], bigSize, lang))))),
      ...small.map((b, bi) => h("div", { style: { display: "flex", flexDirection: "column", margin: "24px 40px 0", background: ALERT, borderRadius: 36, padding: "26px 34px 30px" } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 16 } }, bang(52), h("div", { style: { fontSize: 40, fontWeight: 900, color: "#fff" } }, smallTitle(b, lang))),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 14, marginTop: 20 } },
          ...gs.map((g) => h("div", { style: { display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: many ? 440 : 0, background: "rgba(255,255,255,0.14)", borderRadius: 26, padding: many ? "10px 20px 12px" : "16px 22px 18px" } },
            h("div", { style: { fontSize: fit(g.label, 24, many ? 22 : 30), fontWeight: 800, color: "#fff" } }, g.label),
            h("div", { style: { display: "flex", marginTop: 4 } }, num(g.rates[bi + 1], many ? 56 : 84, lang, "#fff"))))))),
    ];

  return h("div", { style: { width: W, height: H, background: "#ffffff", display: "flex", flexDirection: "column", fontFamily: "DM Sans", color: INK } },
    h("div", { style: { display: "flex", flexDirection: "column", background: INK, padding: "40px 64px 38px" } },
      h("div", { style: { fontSize: 30, fontWeight: 800, letterSpacing: 7, color: SOFT } }, FLYER_BRAND),
      h("div", { style: { fontSize: 88, fontWeight: 900, letterSpacing: -2, color: "#fff", lineHeight: 1, marginTop: 16 } }, t.title),
      h("div", { style: { display: "flex", alignItems: "baseline", fontSize: 34, fontWeight: 700, color: GOLD, marginTop: 14 } },
        day.label, h("div", { style: { color: SOFT, margin: "0 14px" } }, "·"), h("div", { style: { color: "#fff" } }, day.time))),
    h("div", { style: { display: "flex", alignItems: "center", gap: 26, padding: "36px 64px 0" } },
      flag ? flagImg(flag) : null,
      h("div", { style: { fontSize: country.label.length <= 12 ? 84 : country.label.length <= 18 ? 54 : 48, fontWeight: 900, letterSpacing: -2, lineHeight: 1 } }, country.label),
      h("svg", { viewBox: "0 0 24 24", width: 52, height: 52, fill: "none", stroke: MUTED, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M4 12h15M13 6l6 6-6 6" })),
      china ? flagImg(china) : null),
    h("div", { style: { display: "flex", padding: "22px 64px 0", fontSize: 36, fontWeight: 600, color: MUTED } },
      `${t.forAmount}\u00a0`, h("span", { style: { color: INK, fontWeight: 900 } }, `${fmtIn(1_000_000, lang)}\u00a0XAF`), t.supplierGets),
    ...cards,
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  try {
    // country_slug : nom envoyé par l'ancienne version de Mola, tant qu'elle n'est pas redéployée.
    const body = await req.json().catch(() => ({})) as { country_key?: string; country_slug?: string; lang?: string };
    const lang: Lang = body.lang === "en" ? "en" : "fr";
    const raw = typeof body.country_key === "string" ? body.country_key : typeof body.country_slug === "string" ? body.country_slug : "cameroun";
    const wanted = raw.trim().toLowerCase();
    const key = COUNTRY_ISO[wanted] ? wanted : "cameroun";
    const country = { label: (FLYER_TEXT[lang].countries as Record<string, string>)[key], iso: COUNTRY_ISO[key] };

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: rate, error: rErr }, { data: adj, error: aErr }] = await Promise.all([
      db.from("daily_rates").select("rate_cash, rate_alipay, rate_wechat, rate_virement").eq("is_active", true).order("effective_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("rate_adjustments").select("type, key, percentage, is_reference"),
    ]);
    if (rErr || aErr) return json(500, { error: (rErr ?? aErr)!.message });
    if (!rate) return json(404, { error: "Aucun taux du jour publié." });

    const adjs = (adj ?? []) as Adj[];
    const cAdj = adjs.find((a) => a.type === "country" && a.key === key);
    const c = cAdj && !cAdj.is_reference ? Number(cAdj.percentage) || 0 : 0;
    const bs = brackets(adjs, lang);
    const gs = groupsOf(rate as Record<string, number>, c, bs, lang);
    const day = doualaDay(new Date(), lang);

    const [fonts, flag, china] = await Promise.all([getFonts(), flagDataUrl(country.iso), flagDataUrl("CN")]);
    const svg = await satori(flyer(lang, country, flag, china, day, bs, gs) as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts });
    await ensureWasm();
    const png = new Resvg(svg, { fitTo: { mode: "width", value: W * 2 } }).render().asPng();

    return new Response(png, {
      headers: {
        ...CORS,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${lang === "en" ? "todays_rate" : "taux_du_jour"}_${key}_${day.iso}.png"`,
        "X-Flyer-Caption": encodeURIComponent(caption(lang, country.label, day, bs, gs)),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[generate-flyer]", err);
    return json(500, { error: String(err) });
  }
});
