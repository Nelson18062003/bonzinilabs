// Supabase Edge Function — generate-flyer
// Pipeline : données → Satori (JSX → SVG) → Resvg (SVG → PNG) → réponse PNG téléchargeable.
// Le client reçoit un vrai fichier PNG — aucune conversion DOM côté navigateur.
//
// Design = maquette validée (langage Ofspace) : surface douce, cartes blanches,
// gros chiffres lisibles, VRAIS logos (Alipay/WeChat/WhatsApp), Cash = ¥ rouge,
// logo Bonzini. Aucun dégradé arc-en-ciel.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import satori from "npm:satori@0.10.11";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.0";
import { BONZINI_LOGO_B64 } from "./logo.ts";

// Initialise le WASM une seule fois par isolate Deno (cold start ~1s, warm = 0ms)
let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm")
    );
  }
  return wasmReady;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JSX helper minimal (pas de React) ─────────────────────────────────────
type Child = string | number | El | null | undefined;
type El = { type: string; key: null; props: Record<string, unknown> };

function h(
  type: string,
  props: Record<string, unknown> | null,
  ...children: (Child | Child[])[]
): El {
  const flat = children.flat().filter((c) => c != null) as (string | number | El)[];
  return {
    type,
    key: null,
    props: {
      ...(props ?? {}),
      ...(flat.length === 0 ? {} : flat.length === 1 ? { children: flat[0] } : { children: flat }),
    },
  };
}

// ── Chargement des polices (caché par isolate Deno) ────────────────────────
// Satori 0.10.x utilise opentype.js qui ne supporte PAS WOFF2 — utiliser WOFF.
const CDN = "https://cdn.jsdelivr.net/npm";
const FONT_URLS: Record<string, string> = {
  "dm-400": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-400-normal.woff`,
  "dm-600": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-600-normal.woff`,
  "dm-700": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-700-normal.woff`,
  "dm-800": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-800-normal.woff`,
  "dm-900": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-900-normal.woff`,
  "noto-400": `${CDN}/@fontsource/noto-sans-sc@5.0.12/files/noto-sans-sc-chinese-simplified-400-normal.woff`,
  "noto-700": `${CDN}/@fontsource/noto-sans-sc@5.0.12/files/noto-sans-sc-chinese-simplified-700-normal.woff`,
};

type FontDef = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let fontCache: FontDef[] | null = null;

async function getFonts(): Promise<FontDef[]> {
  if (fontCache) return fontCache;
  const entries = Object.entries(FONT_URLS);
  const buffers = await Promise.all(
    entries.map(([, url]) =>
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`Font fetch failed: ${url} (${r.status})`);
        return r.arrayBuffer();
      })
    )
  );
  const [d400, d600, d700, d800, d900, n400, n700] = buffers;
  fontCache = [
    { name: "DM Sans",      data: d400, weight: 400, style: "normal" },
    { name: "DM Sans",      data: d600, weight: 600, style: "normal" },
    { name: "DM Sans",      data: d700, weight: 700, style: "normal" },
    { name: "DM Sans",      data: d800, weight: 800, style: "normal" },
    { name: "DM Sans",      data: d900, weight: 900, style: "normal" },
    { name: "Noto Sans SC", data: n400, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: n700, weight: 700, style: "normal" },
  ];
  return fontCache;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Formatage : 11530 → "11 530" — espace ordinaire (U+0020), supporté par DM Sans.
function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// Logos officiels (simple-icons, viewBox 0 0 24 24).
const ALIPAY = "M19.695 15.07c3.426 1.158 4.203 1.22 4.203 1.22V3.846c0-2.124-1.705-3.845-3.81-3.845H3.914C1.808.001.102 1.722.102 3.846v16.31c0 2.123 1.706 3.845 3.813 3.845h16.173c2.105 0 3.81-1.722 3.81-3.845v-.157s-6.19-2.602-9.315-4.119c-2.096 2.602-4.8 4.181-7.607 4.181-4.75 0-6.361-4.19-4.112-6.949.49-.602 1.324-1.175 2.617-1.497 2.025-.502 5.247.313 8.266 1.317a16.796 16.796 0 0 0 1.341-3.302H5.781v-.952h4.799V6.975H4.77v-.953h5.81V3.591s0-.409.411-.409h2.347v2.84h5.744v.951h-5.744v1.704h4.69a19.453 19.453 0 0 1-1.986 5.06c1.424.52 2.702 1.011 3.654 1.333m-13.81-2.032c-.596.06-1.71.325-2.321.869-1.83 1.608-.735 4.55 2.968 4.55 2.151 0 4.301-1.388 5.99-3.61-2.403-1.182-4.438-2.028-6.637-1.809";
const WECHAT = "M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z";
const WHATSAPP = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z";

// ── Constructeur du layout Satori ──────────────────────────────────────────
interface Rates { alipay: number; wechat: number; bank: number; cash: number }

const FR_DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const FR_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const CN_DAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function svg(width: number, height: number, d: string, fill: string): El {
  return h("svg", { width, height, viewBox: "0 0 24 24" }, h("path", { d, fill }));
}

function buildElement(rates: Rates, isDark: boolean): El {
  const now = new Date();
  const gz  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const hh  = gz.getHours().toString().padStart(2, "0");
  const mm  = gz.getMinutes().toString().padStart(2, "0");
  const frDate = `${FR_DAYS[gz.getDay()]} ${gz.getDate()} ${FR_MONTHS[gz.getMonth()]} ${gz.getFullYear()}`;
  const cnDate = `${gz.getFullYear()}年${gz.getMonth() + 1}月${gz.getDate()}日 · ${CN_DAYS[gz.getDay()]}`;

  // Palette douce (langage Ofspace), variante claire / sombre.
  const bg     = isDark ? "#0D0C14" : "#F2F0F8";
  const card   = isDark ? "#19172A" : "#FFFFFF";
  const text   = isDark ? "#F1EEF8" : "#1A1726";
  const muted  = "#8B83A0";
  const ymark  = isDark ? "#5C5772" : "#C3BDD2";
  const holder = isDark ? "#2A2738" : "#ECE8F6";
  const hairline = isDark ? "rgba(255,255,255,0.10)" : "rgba(26,23,38,0.10)";
  const cardBorder = isDark ? "2px solid rgba(255,255,255,0.06)" : "none";
  const pillBg = isDark ? "#F1EEF8" : "#1A1726";
  const pillText = isDark ? "#1A1726" : "#FFFFFF";

  const rows = [
    { key: "alipay", name: "Alipay",     cn: "支付宝",  note: "Instantané",      rate: rates.alipay },
    { key: "wechat", name: "WeChat Pay", cn: "微信支付", note: "Instantané",      rate: rates.wechat },
    { key: "bank",   name: "Virement",   cn: "银行转账", note: "1–2 h",           rate: rates.bank },
    { key: "cash",   name: "Cash",       cn: "现金",    note: "En main propre",   rate: rates.cash },
  ];

  const tile = (key: string): El => {
    const box = (color: string, content: El): El =>
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 200, height: 200, borderRadius: 50, backgroundColor: color } }, content);
    if (key === "alipay") return box("#FFFFFF", svg(130, 130, ALIPAY, "#1677FF"));
    if (key === "wechat") return box("#07C160", svg(116, 116, WECHAT, "#FFFFFF"));
    if (key === "cash") return box("#E0322B", h("div", { style: { fontSize: 112, fontWeight: 900, color: "#FFFFFF" } }, "¥"));
    // Virement — icône banque (Landmark) monochrome
    return box(holder,
      h("svg", { width: 96, height: 96, viewBox: "0 0 24 24", fill: "none", stroke: text, strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" },
        h("line", { x1: "3", y1: "22", x2: "21", y2: "22" }),
        h("line", { x1: "6", y1: "18", x2: "6", y2: "11" }),
        h("line", { x1: "10", y1: "18", x2: "10", y2: "11" }),
        h("line", { x1: "14", y1: "18", x2: "14", y2: "11" }),
        h("line", { x1: "18", y1: "18", x2: "18", y2: "11" }),
        h("polygon", { points: "12 2 20 7 4 7" }),
      ),
    );
  };

  const contact = (color: string, label: string, phone: string, isCN: boolean): El =>
    h("div", { style: { display: "flex", alignItems: "center", gap: 26 } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: 48, backgroundColor: color } }, svg(58, 58, WHATSAPP, "#FFFFFF")),
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontSize: 36, color: muted, fontFamily: isCN ? "Noto Sans SC" : "DM Sans" } }, label),
        h("div", { style: { fontSize: 56, fontWeight: 800, color: text, letterSpacing: -1 } }, phone),
      ),
    );

  return h("div", { style: { width: 2150, height: 2560, backgroundColor: bg, display: "flex", flexDirection: "column", padding: "84px 90px", fontFamily: "DM Sans" } },

    // Header
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
      h("div", { style: { display: "flex", alignItems: "center", gap: 36 } },
        h("img", { src: BONZINI_LOGO_B64, style: { width: 188, height: 188, borderRadius: 46 } }),
        h("div", { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontSize: 122, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1 } }, "Bonzini"),
          h("div", { style: { fontSize: 36, fontWeight: 600, color: muted, letterSpacing: 8, marginTop: 8 } }, "PAIEMENTS VERS LA CHINE"),
        ),
      ),
      h("div", { style: { display: "flex", backgroundColor: pillBg, color: pillText, borderRadius: 80, padding: "28px 52px", fontSize: 50, fontWeight: 700 } }, "Taux du jour"),
    ),

    // Date + heure
    h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderTop: `3px solid ${hairline}`, paddingTop: 48, marginTop: 56 } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontSize: 72, fontWeight: 800, color: text, letterSpacing: -1, lineHeight: 1.1 } }, frDate),
        h("div", { style: { fontSize: 44, color: muted, marginTop: 10, fontFamily: "Noto Sans SC" } }, cnDate),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        h("div", { style: { fontSize: 118, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1 } }, `${hh}:${mm}`),
        h("div", { style: { fontSize: 40, color: muted, marginTop: 8 } }, "Guangzhou · UTC+8"),
      ),
    ),

    // Contexte
    h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 52 } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontSize: 50, fontWeight: 600, color: muted } }, "Pour"),
        h("div", { style: { display: "flex", alignItems: "flex-end", marginTop: 4 } },
          h("div", { style: { fontSize: 170, fontWeight: 900, color: text, letterSpacing: -3, lineHeight: 1 } }, "1 000 000"),
          h("div", { style: { fontSize: 84, fontWeight: 800, color: "#E8932A", marginBottom: 16, marginLeft: 18 } }, "XAF"),
        ),
      ),
      h("div", { style: { fontSize: 46, fontWeight: 500, color: muted, marginBottom: 12, maxWidth: 600, textAlign: "right", lineHeight: 1.25 } }, "vous payez votre fournisseur en ¥ :"),
    ),

    // Lignes de taux
    h("div", { style: { display: "flex", flexDirection: "column", gap: 36, marginTop: 48 } },
      ...rows.map((r) =>
        h("div", { style: { display: "flex", alignItems: "center", gap: 48, backgroundColor: card, border: cardBorder, borderRadius: 56, padding: "44px 56px" } },
          tile(r.key),
          h("div", { style: { display: "flex", flexDirection: "column", flex: 1 } },
            h("div", { style: { fontSize: 108, fontWeight: 800, color: text, letterSpacing: -1, lineHeight: 1 } }, r.name),
            h("div", { style: { fontSize: 50, color: muted, marginTop: 12, fontFamily: "Noto Sans SC" } }, `${r.cn} · ${r.note}`),
          ),
          h("div", { style: { display: "flex", alignItems: "flex-end" } },
            h("div", { style: { fontSize: 100, fontWeight: 700, color: ymark, marginBottom: 18, marginRight: 16 } }, "¥"),
            h("div", { style: { fontSize: 224, fontWeight: 900, color: text, lineHeight: 1 } }, fmt(r.rate)),
          ),
        )
      ),
    ),

    // Footer
    h("div", { style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-end", borderTop: `3px solid ${hairline}`, paddingTop: 44, marginTop: 52 } },
      h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h("div", { style: { fontSize: 84, fontWeight: 800, color: text, letterSpacing: -1 } }, "bonzinilabs.com"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 64 } },
          contact("#25D366", "Cameroun · WhatsApp", "+237 652 236 856", false),
          contact("#07C160", "中国 · WhatsApp / 微信", "+86 131 3849 5598", true),
        ),
      ),
      h("div", { style: { fontSize: 34, color: muted, marginTop: 40, lineHeight: 1.5 } }, "Taux indicatifs, susceptibles de varier sans préavis. · 显示汇率仅供参考，可能随时变动。"),
    ),
  );
}

// ── Handler HTTP ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json() as { rates: Rates; dark?: boolean; theme?: string };
    const { rates, dark, theme } = body;

    // Accepte dark (legacy) ou theme ('dark'|'light')
    const isDark = theme === "light" ? false : (dark !== false);

    if (
      !rates ||
      typeof rates.alipay !== "number" ||
      typeof rates.wechat !== "number" ||
      typeof rates.bank   !== "number" ||
      typeof rates.cash   !== "number"
    ) {
      return new Response(JSON.stringify({ error: "rates must be {alipay,wechat,bank,cash} numbers" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const fonts   = await getFonts();
    const element = buildElement(rates, isDark);

    // Étape 1 : Satori génère le SVG (texte converti en chemins vectoriels)
    const svgOut = await satori(element, { width: 2150, height: 2560, fonts });

    // Étape 2 : Resvg convertit le SVG en PNG (initWasm obligatoire)
    await ensureWasm();
    const resvg     = new Resvg(svgOut, { fitTo: { mode: "width", value: 2150 } });
    const pngBuffer = resvg.render().asPng();

    const date     = new Date().toISOString().slice(0, 10);
    const filename = `bonzini_taux_${date}.png`;

    return new Response(pngBuffer, {
      headers: {
        ...CORS,
        "Content-Type":        "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control":       "no-cache",
      },
    });
  } catch (err) {
    console.error("[generate-flyer]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
