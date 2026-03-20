// Supabase Edge Function — generate-flyer
// Pipeline : données → Satori (JSX → SVG) → Resvg (SVG → PNG) → réponse PNG téléchargeable.
// Le client reçoit un vrai fichier PNG — aucune conversion DOM côté navigateur.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import satori from "npm:satori@0.10.11";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.0";

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
// Formatage fr-FR : 11530 → "11 530", 1000000 → "1 000 000"
function fmt(n: number): string {
  return n.toLocaleString("fr-FR");
}

// ── Constructeur du layout Satori ──────────────────────────────────────────
interface Rates { alipay: number; wechat: number; bank: number; cash: number }

function buildElement(rates: Rates, isDark: boolean): El {
  const now = new Date();
  const gz  = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const hh  = gz.getHours().toString().padStart(2, "0");
  const mm  = gz.getMinutes().toString().padStart(2, "0");

  const cnWeekdays = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
  const enWeekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const enMonths   = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const cnDate = `${gz.getFullYear()}年${gz.getMonth()+1}月${gz.getDate()}日，${cnWeekdays[gz.getDay()]}`;
  const enDate = `${enWeekdays[gz.getDay()]}, ${gz.getDate()} ${enMonths[gz.getMonth()]} ${gz.getFullYear()}`;

  const bg         = isDark ? "#08060F" : "#F8F5FF";
  const textMain   = isDark ? "#F0EBF8" : "#1A0F33";
  const cardBg     = isDark ? "#100D1C" : "#FFFFFF";
  const cardBorder = isDark ? "#221B3A" : "#DDD4F5";
  const sub        = "#8878A8";
  const timeColor  = isDark ? "#FFFFFF" : "#A947FE";
  const urlColor   = isDark ? "#FFFFFF" : "#A947FE";

  const rateData = [
    { label: "Alipay",        cn: "支付宝",  rate: rates.alipay, barColor: "#1677FF", nameColor: "#1677FF", symColor: "#1677FF", badgeColor: "#1677FF", badge: "Instant\u00e9 \u00b7 \u5373\u65f6\u5230\u8d26",          iconBg: "#1677FF", iconColor: "#FFFFFF", iconText: "\u652f", iconFont: "Noto Sans SC", iconSize: 34 },
    { label: "WeChat Pay",    cn: "微信支付", rate: rates.wechat, barColor: "#07C160", nameColor: "#07C160", symColor: "#07C160", badgeColor: "#07C160", badge: "Instant\u00e9 \u00b7 \u5373\u65f6\u5230\u8d26",          iconBg: "#07C160", iconColor: "#FFFFFF", iconText: "\u5fae", iconFont: "Noto Sans SC", iconSize: 34 },
    { label: "Bank Transfer", cn: "银行转账", rate: rates.bank,   barColor: "#F3A745", nameColor: "#D4850A", symColor: "#D4850A", badgeColor: "#D4850A", badge: "Instant\u00e9 \u00b7 \u5373\u65f6\u5230\u8d26",          iconBg: "#F3A745", iconColor: "#1A0F33", iconText: null,    iconFont: "DM Sans",      iconSize: 48 },
    { label: "Cash",          cn: "现金",    rate: rates.cash,   barColor: "#DC2626", nameColor: "#DC2626", symColor: "#DC2626", badgeColor: "#DC2626", badge: "Remise en main propre \u00b7 \u73b0\u573a\u4ea4\u4ed8", iconBg: "#DC2626", iconColor: "#FFFFFF", iconText: "\u00a5", iconFont: "DM Sans",      iconSize: 58 },
  ];

  // Icône Bank Transfer (Landmark SVG)
  const bankSVG = h("svg", { width: 52, height: 52, viewBox: "0 0 24 24", fill: "none", stroke: "#1A0F33", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    h("line", { x1: "3",  y1: "22", x2: "21", y2: "22" }),
    h("line", { x1: "6",  y1: "18", x2: "6",  y2: "11" }),
    h("line", { x1: "10", y1: "18", x2: "10", y2: "11" }),
    h("line", { x1: "14", y1: "18", x2: "14", y2: "11" }),
    h("line", { x1: "18", y1: "18", x2: "18", y2: "11" }),
    h("polygon", { points: "12 2 20 7 4 7" }),
  );

  // Largeur de chaque carte : (2150 - 2×110 - 44) / 2 = 943px
  const CARD_W = 943;

  const rateCards = rateData.map((r) =>
    h("div", {
      style: {
        width: CARD_W,
        backgroundColor: cardBg,
        border: `2px solid ${cardBorder}`,
        borderRadius: 36,
        padding: 58,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      },
    },
      // Barre colorée en haut de la carte
      h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 10, backgroundColor: r.barColor, borderRadius: "36px 36px 0 0" } }),

      // Icône + nom
      h("div", { style: { display: "flex", alignItems: "center", gap: 28, marginBottom: 28, marginTop: 10 } },
        h("div", { style: { width: 88, height: 88, borderRadius: 18, backgroundColor: r.iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
          r.iconText
            ? h("span", { style: { fontFamily: r.iconFont, fontSize: r.iconSize, fontWeight: 700, color: r.iconColor, lineHeight: 1 } }, r.iconText)
            : bankSVG
        ),
        h("div", { style: { display: "flex", flexDirection: "column" } },
          h("div", { style: { fontFamily: "DM Sans", fontSize: 54, fontWeight: 700, color: r.nameColor, lineHeight: 1.1 } }, r.label),
          h("div", { style: { fontFamily: "Noto Sans SC", fontSize: 36, color: sub, marginTop: 6 } }, r.cn),
        ),
      ),

      // Montant — formatage fr-FR : 11530 → "11 530"
      h("div", { style: { display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 24 } },
        h("span", { style: { fontFamily: "DM Sans", fontSize: 96, fontWeight: 800, color: r.symColor, lineHeight: 1 } }, "\u00a5"),
        h("span", { style: { fontFamily: "DM Sans", fontSize: 188, fontWeight: 900, color: textMain, letterSpacing: -2, lineHeight: 1 } }, fmt(r.rate)),
      ),

      // Badge coloré
      h("div", { style: { display: "flex", alignItems: "center", gap: 14, backgroundColor: `${r.badgeColor}20`, border: `1.5px solid ${r.badgeColor}80`, borderRadius: 44, padding: "14px 34px" } },
        h("div", { style: { width: 18, height: 18, borderRadius: 9, backgroundColor: r.barColor, flexShrink: 0 } }),
        h("span", { style: { fontFamily: "DM Sans", fontSize: 30, fontWeight: 600, color: r.nameColor } }, r.badge),
      ),
    )
  );

  return h("div", { style: { width: 2150, height: 2560, backgroundColor: bg, display: "flex", flexDirection: "column", fontFamily: "DM Sans" } },

    // Barre haut (violet → ambre → orange)
    h("div", { style: { height: 14, background: "linear-gradient(90deg,#A947FE,#F3A745,#FE560D)", flexShrink: 0 } }),

    // Header
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "60px 110px 44px", flexShrink: 0 } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 96, color: textMain, letterSpacing: -3, lineHeight: 1 } }, "Bonzini"),
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 400, fontSize: 32, color: sub, letterSpacing: 5 } }, "PAYMENT PLATFORM"),
      ),
      // Badge "Taux du Jour" — fond #DC2626, texte blanc
      h("div", { style: { backgroundColor: "#DC2626", borderRadius: 50, padding: "22px 58px", color: "#FFFFFF", fontFamily: "DM Sans", fontWeight: 700, fontSize: 40, letterSpacing: 2 } }, "Taux du Jour \u00b7 \u4eca\u65e5\u6c47\u7387"),
    ),

    // Séparateur
    h("div", { style: { height: 3, margin: "0 80px", background: "linear-gradient(90deg,transparent,rgba(169,71,254,.6) 25%,rgba(243,167,69,.6) 75%,transparent)", borderRadius: 2, flexShrink: 0 } }),

    // Zone date + heure Guangzhou
    h("div", { style: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "56px 110px 44px", gap: 60, flexShrink: 0 } },
      h("div", { style: { flex: 1, display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: "Noto Sans SC", fontWeight: 500, fontSize: 52, color: sub, lineHeight: 1.35 } }, cnDate),
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 700, fontSize: 72, color: textMain, letterSpacing: -1, lineHeight: 1.25 } }, enDate),
      ),
      // Heure Guangzhou → blanc (#FFFFFF) en dark
      h("div", { style: { borderRadius: 28, padding: "36px 60px", display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(169,71,254,0.07)", border: `2.5px solid ${isDark ? "rgba(255,255,255,0.3)" : "rgba(169,71,254,0.22)"}`, flexShrink: 0, minWidth: 540 } },
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 136, color: timeColor, letterSpacing: -4, lineHeight: 1 } }, `${hh}:${mm}`),
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 500, fontSize: 34, color: sub, marginTop: 12 } }, "Guangzhou \u00b7 UTC+8"),
        h("div", { style: { fontFamily: "Noto Sans SC", fontSize: 30, color: sub, marginTop: 6 } }, "\u4e2d\u56fd\u5e7f\u4e1c\u5e7f\u5dde\u65f6\u95f4"),
      ),
    ),

    // Héro 1 000 000 XAF
    h("div", { style: { padding: "6px 110px 44px", display: "flex", flexDirection: "column", flexShrink: 0 } },
      h("div", { style: { display: "flex", alignItems: "baseline", gap: 0, marginBottom: 8 } },
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 400, fontSize: 58, color: sub } }, "Pour\u00a0"),
        h("span", { style: { fontFamily: "Noto Sans SC", fontSize: 46, color: sub, opacity: 0.7 } }, "\u5151\u6362"),
      ),
      h("div", { style: { display: "flex", alignItems: "flex-end", gap: 0 } },
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain } }, "1"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 180, lineHeight: 0.9, color: textMain, opacity: 0.25 } }, "\u00a0"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain } }, "000"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 180, lineHeight: 0.9, color: textMain, opacity: 0.25 } }, "\u00a0"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 240, letterSpacing: -4, lineHeight: 0.9, color: textMain } }, "000"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 88, color: "#F3A745", alignSelf: "flex-end", marginBottom: 22, letterSpacing: 2, marginLeft: 24 } }, "XAF"),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 300, fontSize: 170, color: "#A947FE", opacity: 0.5, lineHeight: 1, marginBottom: 6, marginLeft: 16 } }, "\u2192"),
      ),
    ),

    // Grille 2×2 des taux (flex wrap)
    h("div", { style: { display: "flex", flexWrap: "wrap", gap: 44, padding: "6px 110px 50px", flexShrink: 0 } },
      ...rateCards,
    ),

    // Séparateur footer
    h("div", { style: { height: 3, margin: "0 80px", background: "linear-gradient(90deg,transparent,rgba(169,71,254,.4) 50%,transparent)", borderRadius: 2, flexShrink: 0 } }),

    // Footer
    h("div", { style: { padding: "40px 110px 54px", display: "flex", flexDirection: "column", flex: 1 } },
      // bonzinilabs.com → blanc (#FFFFFF) en dark
      h("div", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 78, color: urlColor, letterSpacing: -1, marginBottom: 36 } }, "bonzinilabs.com"),

      // Contacts
      h("div", { style: { display: "flex", alignItems: "center", gap: 56, marginBottom: 36 } },
        h("div", { style: { display: "flex", alignItems: "center", gap: 24 } },
          h("div", { style: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
            h("span", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 28, color: "#FFFFFF" } }, "W"),
          ),
          h("div", { style: { display: "flex", flexDirection: "column" } },
            h("div", { style: { fontFamily: "DM Sans", fontSize: 32, color: sub } }, "Cameroun \u00b7 WhatsApp"),
            h("div", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 54, color: textMain, letterSpacing: -1 } }, "+237 652 236 856"),
          ),
        ),
        h("div", { style: { width: 2, height: 96, backgroundColor: cardBorder, flexShrink: 0 } }),
        h("div", { style: { display: "flex", alignItems: "center", gap: 24 } },
          h("div", { style: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#07C160", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } },
            h("span", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 28, color: "#FFFFFF" } }, "W"),
          ),
          h("div", { style: { display: "flex", flexDirection: "column" } },
            h("div", { style: { fontFamily: "Noto Sans SC", fontSize: 32, color: sub } }, "\u4e2d\u56fd \u00b7 WhatsApp / \u5fae\u4fe1"),
            h("div", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 54, color: textMain, letterSpacing: -1 } }, "+86 131 3849 5598"),
          ),
        ),
      ),

      // Disclaimer
      h("div", { style: { fontFamily: "DM Sans", fontSize: 27, color: sub, opacity: 0.65, lineHeight: 1.6 } },
        "Les taux affich\u00e9s sont indicatifs et peuvent varier sans pr\u00e9avis. Bonzini n\u2019est pas responsable des pertes li\u00e9es aux fluctuations de change.",
      ),
      h("div", { style: { fontFamily: "Noto Sans SC", fontSize: 25, color: sub, opacity: 0.65, lineHeight: 1.6, marginTop: 4 } },
        "\u663e\u793a\u6c47\u7387\u4ec5\u4f9b\u53c2\u8003\uff0c\u53ef\u80fd\u968f\u65f6\u53d8\u52a8\u3002",
      ),
    ),

    // Barre bas (orange → ambre → violet)
    h("div", { style: { height: 14, background: "linear-gradient(90deg,#FE560D,#F3A745,#A947FE)", flexShrink: 0 } }),
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
    const svg = await satori(element, { width: 2150, height: 2560, fonts });

    // Étape 2 : Resvg convertit le SVG en PNG (initWasm obligatoire)
    await ensureWasm();
    const resvg     = new Resvg(svg, { fitTo: { mode: "width", value: 2150 } });
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
