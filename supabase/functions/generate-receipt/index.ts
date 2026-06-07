// Supabase Edge Function — generate-receipt
// Rendu SERVEUR du reçu d'un paiement. Pipeline éprouvé (cf. generate-flyer / generate-report-pdf) :
//   données → Satori (JSX → SVG) → Resvg (SVG → PNG) → pdf-lib (PNG → PDF 1 page).
// Renvoie un JSON { png_b64, pdf_b64 } : l'image pour l'affichage inline dans le chat Mola,
// le PDF pour le téléchargement. Pur rendu : aucune requête DB (l'appelant fournit les données).
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.208.0/encoding/base64.ts";
import satori from "npm:satori@0.10.11";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.0";
import { PDFDocument } from "npm:pdf-lib@1.17.1";

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.0/index_bg.wasm"));
  return wasmReady;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── JSX helper minimal (pas de React) — identique à generate-flyer ──────────
type Child = string | number | El | null | undefined;
type El = { type: string; key: null; props: Record<string, unknown> };
function h(type: string, props: Record<string, unknown> | null, ...children: (Child | Child[])[]): El {
  const flat = children.flat().filter((c) => c != null) as (string | number | El)[];
  return { type, key: null, props: { ...(props ?? {}), ...(flat.length === 0 ? {} : flat.length === 1 ? { children: flat[0] } : { children: flat }) } };
}

// ── Polices (WOFF — Satori 0.10.x ne supporte pas WOFF2) ────────────────────
const CDN = "https://cdn.jsdelivr.net/npm";
const FONT_URLS: Record<string, string> = {
  "dm-400": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-400-normal.woff`,
  "dm-600": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-600-normal.woff`,
  "dm-700": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-700-normal.woff`,
  "dm-800": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-800-normal.woff`,
  "dm-900": `${CDN}/@fontsource/dm-sans@5.0.18/files/dm-sans-latin-900-normal.woff`,
};
type FontDef = { name: string; data: ArrayBuffer; weight: number; style: "normal" };
let fontCache: FontDef[] | null = null;
async function getFonts(): Promise<FontDef[]> {
  if (fontCache) return fontCache;
  const buffers = await Promise.all(Object.values(FONT_URLS).map((url) =>
    fetch(url).then((r) => { if (!r.ok) throw new Error(`Font fetch failed: ${url} (${r.status})`); return r.arrayBuffer(); })));
  const [d4, d6, d7, d8, d9] = buffers;
  fontCache = [
    { name: "DM Sans", data: d4, weight: 400, style: "normal" },
    { name: "DM Sans", data: d6, weight: 600, style: "normal" },
    { name: "DM Sans", data: d7, weight: 700, style: "normal" },
    { name: "DM Sans", data: d8, weight: 800, style: "normal" },
    { name: "DM Sans", data: d9, weight: 900, style: "normal" },
  ];
  return fontCache;
}

// ── Helpers de formatage (espaces ordinaires : DM Sans n'a pas l'espace fine) ─
function fmt(n: number): string { return Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
const FR_MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mm = d.getUTCMinutes().toString().padStart(2, "0");
  return `${d.getUTCDate()} ${FR_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} à ${hh}:${mm} UTC`;
}

interface ReceiptInput {
  reference: string;
  created_at?: string | null;
  processed_at?: string | null;
  amount_xaf: number;
  amount_rmb: number;
  exchange_rate: number;
  method: string;
  status: string;
  client_name?: string | null;
  client_phone?: string | null;
  beneficiary_name?: string | null;
  beneficiary_line1?: string | null; // libellé identifiant (ex. "Alipay : ...") déjà formaté par l'appelant
  beneficiary_line2?: string | null;
}

const METHOD_LABEL: Record<string, string> = { alipay: "Alipay", wechat: "WeChat Pay", bank_transfer: "Virement bancaire", cash: "Cash" };
const STATUS_LABEL: Record<string, string> = {
  completed: "Complété", processing: "En traitement", ready_for_payment: "Prêt à payer",
  waiting_beneficiary_info: "En attente bénéficiaire", created: "Créé", rejected: "Rejeté",
  cash_pending: "Cash en attente", cash_scanned: "Cash scanné", cancelled_by_admin: "Annulé",
};
function statusColor(status: string): string {
  if (status === "completed") return "#07C160";
  if (status === "rejected" || status === "cancelled_by_admin") return "#DC2626";
  if (status === "processing" || status === "ready_for_payment") return "#F3A745";
  return "#A947FE";
}

// Palette (claire) — cohérente avec le flyer.
const BG = "#F8F5FF", CARD = "#FFFFFF", TXT = "#1A0F33", SUB = "#8878A8", BORDER = "#DDD4F5";
const W = 1080, H = 1480;

function row(label: string, value: string): El {
  return h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, paddingTop: 14, paddingBottom: 14, borderBottom: `1px solid ${BORDER}` } },
    h("span", { style: { fontFamily: "DM Sans", fontSize: 26, color: SUB, flexShrink: 0 } }, label),
    h("span", { style: { fontFamily: "DM Sans", fontSize: 28, fontWeight: 700, color: TXT, textAlign: "right" } }, value || "—"),
  );
}
function section(title: string, ...rows: (El | null | undefined)[]): El {
  return h("div", { style: { display: "flex", flexDirection: "column", marginTop: 30 } },
    h("span", { style: { fontFamily: "DM Sans", fontSize: 22, fontWeight: 800, color: "#A947FE", letterSpacing: 3, marginBottom: 6 } }, title),
    ...rows.filter(Boolean) as El[],
  );
}

function buildReceipt(d: ReceiptInput): El {
  const sc = statusColor(d.status);
  const methodLabel = METHOD_LABEL[d.method] ?? d.method;
  const statusLabel = STATUS_LABEL[d.status] ?? d.status;

  return h("div", { style: { width: W, height: H, backgroundColor: BG, display: "flex", flexDirection: "column", fontFamily: "DM Sans" } },
    // Barre haut
    h("div", { style: { height: 12, background: "linear-gradient(90deg,#A947FE,#F3A745,#FE560D)", flexShrink: 0 } }),

    // Header
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "40px 70px 24px", flexShrink: 0 } },
      h("div", { style: { display: "flex", flexDirection: "column" } },
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 68, color: TXT, letterSpacing: -2, lineHeight: 1 } }, "Bonzini"),
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 600, fontSize: 24, color: SUB, letterSpacing: 4 } }, "REÇU DE PAIEMENT"),
      ),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        h("div", { style: { fontFamily: "DM Sans", fontSize: 22, color: SUB } }, "Référence"),
        h("div", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 34, color: TXT } }, d.reference),
      ),
    ),

    // Corps (carte)
    h("div", { style: { display: "flex", flexDirection: "column", margin: "0 70px", backgroundColor: CARD, border: `2px solid ${BORDER}`, borderRadius: 32, padding: 48, flex: 1 } },
      // Statut
      h("div", { style: { display: "flex", alignItems: "center", gap: 16, marginBottom: 20 } },
        h("div", { style: { width: 18, height: 18, borderRadius: 9, backgroundColor: sc, flexShrink: 0 } }),
        h("span", { style: { fontFamily: "DM Sans", fontWeight: 700, fontSize: 30, color: sc } }, statusLabel),
      ),

      // Montant
      h("div", { style: { display: "flex", flexDirection: "column", backgroundColor: "#F8F5FF", borderRadius: 24, padding: 36, marginBottom: 8 } },
        h("div", { style: { display: "flex", alignItems: "flex-end", gap: 12 } },
          h("span", { style: { fontFamily: "DM Sans", fontWeight: 900, fontSize: 92, color: TXT, letterSpacing: -2, lineHeight: 1 } }, fmt(d.amount_xaf)),
          h("span", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 40, color: "#F3A745", marginBottom: 10 } }, "XAF"),
        ),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
          h("span", { style: { fontFamily: "DM Sans", fontWeight: 700, fontSize: 34, color: "#A947FE" } }, `¥ ${fmt(d.amount_rmb)}`),
          h("span", { style: { fontFamily: "DM Sans", fontSize: 26, color: SUB } }, `· taux ${fmt(d.exchange_rate)} (¥ / 1 000 000 XAF)`),
        ),
      ),

      // Sections
      section("TRANSACTION",
        row("Mode de paiement", methodLabel),
        row("Date de création", fmtDate(d.created_at)),
        row("Date de traitement", fmtDate(d.processed_at)),
      ),
      section("CLIENT",
        row("Nom", d.client_name ?? "—"),
        d.client_phone ? row("Téléphone", d.client_phone) : null,
      ),
      section("BÉNÉFICIAIRE",
        row("Nom", d.beneficiary_name ?? "—"),
        d.beneficiary_line1 ? row("Détails", d.beneficiary_line1) : null,
        d.beneficiary_line2 ? row("Compte", d.beneficiary_line2) : null,
      ),
    ),

    // Footer
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 70px 30px", flexShrink: 0 } },
      h("span", { style: { fontFamily: "DM Sans", fontWeight: 800, fontSize: 34, color: "#A947FE" } }, "bonzinilabs.com"),
      h("span", { style: { fontFamily: "DM Sans", fontSize: 22, color: SUB } }, "Paiement fournisseur · XAF → CNY"),
    ),
    h("div", { style: { height: 12, background: "linear-gradient(90deg,#FE560D,#F3A745,#A947FE)", flexShrink: 0 } }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json() as { receipt?: ReceiptInput };
    const d = body?.receipt;
    if (!d || !d.reference || typeof d.amount_xaf !== "number") {
      return new Response(JSON.stringify({ error: "receipt {reference, amount_xaf, ...} requis" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const fonts = await getFonts();
    const svg = await satori(buildReceipt(d), { width: W, height: H, fonts });

    await ensureWasm();
    const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();

    // PDF : 1 page A4 portrait avec le PNG du reçu, ajusté à la largeur.
    const pdf = await PDFDocument.create();
    const img = await pdf.embedPng(png);
    const pageW = 595.28, pageH = pageW * (H / W);
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
    const pdfBytes = await pdf.save();

    return new Response(JSON.stringify({ png_b64: encodeBase64(png), pdf_b64: encodeBase64(pdfBytes) }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-receipt]", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
