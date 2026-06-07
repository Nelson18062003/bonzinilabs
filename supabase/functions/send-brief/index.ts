// supabase/functions/send-brief/index.ts
// Compose et envoie un brief Telegram (matin/soir/urgence).
//
// Usage :
//   POST /functions/v1/send-brief    body: { type: "morning" | "evening" | "alert", alert?: {...} }
//
// Sources :
// - macro_snapshots : dernier snapshot + snapshot d'il y a 24h pour les deltas
// - rate_suggestions : dernière suggestion Bonzini
// - rate_snapshots : delta du taux Bonzini sur 24h
//
// Lecture par Claude API (ANTHROPIC_API_KEY) si configurée ; fallback heuristique sinon.
// Format texte brut Telegram (pas de markdown pour éviter l'escaping).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const XAF_PER_EUR = 655.957;

// ─── Helpers de formatage ────────────────────────────────────────────────
const f = (n: number | null, d = 2) =>
  n === null || !Number.isFinite(n) ? "n/a" : n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fi = (n: number | null) =>
  n === null || !Number.isFinite(n) ? "n/a" : n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
const delta = (cur: number | null, prev: number | null, suffix = "", decimals = 2) => {
  if (cur === null || prev === null) return "";
  const diff = cur - prev;
  const sign = diff >= 0 ? "+" : "";
  return ` (${sign}${diff.toFixed(decimals)}${suffix})`;
};
const pct = (cur: number | null, prev: number | null) => {
  if (cur === null || prev === null || prev === 0) return "";
  const p = ((cur - prev) / prev) * 100;
  const sign = p >= 0 ? "+" : "";
  return ` (${sign}${p.toFixed(1)}%)`;
};
const arrow = (cur: number | null, prev: number | null) => {
  if (cur === null || prev === null) return "";
  if (cur > prev) return "📈";
  if (cur < prev) return "📉";
  return "➡️";
};

// ─── Lecture des données ────────────────────────────────────────────────
async function getMacro(s: SupabaseClient) {
  const [{ data: latest }, { data: prev }] = await Promise.all([
    s.from("macro_snapshots").select("*").order("captured_at", { ascending: false }).limit(1).maybeSingle(),
    s.from("macro_snapshots")
      .select("*")
      .lte("captured_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { latest, prev };
}

async function getBonziniRate(s: SupabaseClient) {
  const [{ data: latest }, { data: prev }] = await Promise.all([
    s.from("rate_suggestions").select("*").order("computed_at", { ascending: false }).limit(1).maybeSingle(),
    s.from("rate_suggestions")
      .select("*")
      .lte("computed_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { latest, prev };
}

// ─── AI Interpretation via Claude API ────────────────────────────────────
// Génère une lecture courte (4-6 lignes) qui croise macro + taux Bonzini + news.
// Retourne null si la clé API n'est pas configurée ou si l'appel échoue.
async function getAIInterpretation(
  type: "morning" | "evening",
  macro: { latest: any; prev: any },
  rate: { latest: any; prev: any },
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;

  const m = macro.latest;
  const p = macro.prev;
  const r = rate.latest;
  const rp = rate.prev;

  if (!m) return null;

  // Préparer un contexte structuré pour Claude
  const ctx = {
    moment: type,
    bonzini: r ? {
      taux_actuel: r.suggested_rate,
      taux_24h_avant: rp?.suggested_rate ?? null,
      cout_xaf: r.cmr_rate_max + (r.cmr_margin_xaf ?? 3),
      cout_xaf_24h_avant: rp ? rp.cmr_rate_max + (rp.cmr_margin_xaf ?? 3) : null,
      marche_chn: r.chn_rate_avg,
      marche_chn_24h_avant: rp?.chn_rate_avg ?? null,
    } : null,
    macro: {
      brent: m.oil_brent,
      brent_24h: p?.oil_brent ?? null,
      dxy: m.dxy,
      dxy_24h: p?.dxy ?? null,
      eur_usd: m.eur_usd,
      eur_usd_24h: p?.eur_usd ?? null,
      cny_usd: m.cny_usd,
      cny_usd_24h: p?.cny_usd ?? null,
      btc: m.btc_usd,
      btc_24h: p?.btc_usd ?? null,
    },
    news: (m.news_headlines || []).slice(0, 5).map((h: any) => h.title),
  };

  const systemPrompt = `Tu es l'assistant de Nelson, qui dirige Bonzini : une fintech qui aide les importateurs africains (Cameroun, Gabon...) à payer leurs fournisseurs chinois. Il achète des USDT au Cameroun en XAF, puis les vend en Chine contre des CNY.

Tu interprètes les données macro et le marché Bonzini pour lui donner une lecture courte, actionnable, en français.

Format attendu : 4 à 6 bullets courts (1 ligne max chacun), commençant par un emoji pertinent. Sois CONCRET et lié à son business : que veut dire ce mouvement pour son taux, son coût XAF, sa marge ? Pas de phrases vagues type "marché incertain".

À la fin, termine par une seule ligne "🎯 Action : ..." avec un conseil tactique précis (publier maintenant, attendre, élargir marge, etc.).

Pas de markdown, pas de gras, pas de listes numérotées. Juste les bullets et l'action finale.`;

  const userPrompt = `Voici le contexte. Donne-moi ta lecture pour le brief ${type === "morning" ? "du matin" : "du soir"} :

${JSON.stringify(ctx, null, 2)}

Rappels :
- XAF est pegged à EUR (655,957 XAF/EUR), donc EUR faible = XAF faible = USDT plus cher au Cameroun
- USDT/CNY baisse quand la Chine vend des USDT (panique, intervention PBOC)
- Pétrole haut → inflation → Fed reste serrée → dollar fort → mauvais pour le XAF
- Bonzini gagne quand le coût XAF baisse OU quand le marché CHN monte`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const json = await res.json();
    const text = json?.content?.[0]?.text;
    return typeof text === "string" && text.length > 0 ? text.trim() : null;
  } catch (err) {
    console.error("Anthropic API error:", (err as Error).message);
    return null;
  }
}

// ─── Compose brief texte ─────────────────────────────────────────────────
async function composeBrief(
  type: "morning" | "evening",
  macro: { latest: any; prev: any },
  rate: { latest: any; prev: any },
): Promise<string> {
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Douala",
  });
  const timeStr = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala",
  });

  const header = type === "morning"
    ? `🌅 BRIEF DU MATIN\n${dateStr} · ${timeStr} (Douala)`
    : `🌆 BRIEF DU SOIR\n${dateStr} · ${timeStr} (Douala)`;

  // ─── Section Taux Bonzini
  let rateSection = "\n\n📊 TAUX BONZINI\n";
  if (rate.latest) {
    rateSection += `Suggéré : ${fi(rate.latest.suggested_rate)} CNY / 1M XAF${delta(rate.latest.suggested_rate, rate.prev?.suggested_rate ?? null, " CNY", 0)}\n`;
    rateSection += `Coût XAF (CMR) : ${f(rate.latest.cmr_rate_max + (rate.latest.cmr_margin_xaf ?? 3))}${delta(rate.latest.cmr_rate_max, rate.prev?.cmr_rate_max ?? null, " XAF")}\n`;
    rateSection += `Marché CHN : ${f(rate.latest.chn_rate_avg, 4)} CNY/USDT${delta(rate.latest.chn_rate_avg, rate.prev?.chn_rate_avg ?? null, "", 4)}\n`;
  } else {
    rateSection += "(aucune suggestion récente — lance suggest-daily-rates)\n";
  }

  // ─── Section Macro
  let macroSection = "\n🌍 MACRO 24H\n";
  if (macro.latest) {
    const m = macro.latest;
    const p = macro.prev;
    macroSection += `🛢 Brent : ${f(m.oil_brent)} $${pct(m.oil_brent, p?.oil_brent ?? null)} ${arrow(m.oil_brent, p?.oil_brent ?? null)}\n`;
    macroSection += `💵 DXY : ${f(m.dxy)}${delta(m.dxy, p?.dxy ?? null)} ${arrow(m.dxy, p?.dxy ?? null)}\n`;
    macroSection += `🇪🇺 EUR/USD : ${f(m.eur_usd, 4)}${pct(m.eur_usd, p?.eur_usd ?? null)} ${arrow(m.eur_usd, p?.eur_usd ?? null)}\n`;
    macroSection += `🇨🇳 USD/CNY : ${f(m.cny_usd, 4)}${delta(m.cny_usd, p?.cny_usd ?? null, "", 4)} ${arrow(m.cny_usd, p?.cny_usd ?? null)}\n`;
    macroSection += `₿ BTC : ${fi(m.btc_usd)} ${pct(m.btc_usd, p?.btc_usd ?? null)} ${arrow(m.btc_usd, p?.btc_usd ?? null)}\n`;
  } else {
    macroSection += "(pas de snapshot macro — fetch-macro pas exécuté ?)\n";
  }

  // ─── Section News
  let newsSection = "";
  if (macro.latest?.news_headlines && Array.isArray(macro.latest.news_headlines) && macro.latest.news_headlines.length > 0) {
    newsSection = "\n📰 NEWS\n";
    for (const h of macro.latest.news_headlines.slice(0, 3)) {
      const title = (h.title || "").slice(0, 120);
      newsSection += `• ${title}\n`;
    }
  }

  // ─── Section Lecture (IA Claude en primaire, heuristique en fallback)
  let lectureSection = "\n💡 LECTURE\n";
  const aiText = await getAIInterpretation(type, macro, rate);

  if (aiText) {
    lectureSection += aiText;
  } else {
    // Fallback : templates heuristiques (cas API absente ou erreur réseau)
    const points: string[] = [];
    if (macro.latest && macro.prev) {
      const m = macro.latest;
      const p = macro.prev;
      if (m.oil_brent && p.oil_brent) {
        const oilPct = ((m.oil_brent - p.oil_brent) / p.oil_brent) * 100;
        if (oilPct > 2) points.push("🛢 Pétrole en hausse → inflation, pression sur le XAF");
        else if (oilPct < -2) points.push("🛢 Pétrole en baisse → détente possible côté inflation");
      }
      if (m.eur_usd && p.eur_usd) {
        const eurPct = ((m.eur_usd - p.eur_usd) / p.eur_usd) * 100;
        if (eurPct > 0.3) points.push("🇪🇺 EUR remonte → XAF respire vs USD");
        else if (eurPct < -0.3) points.push("🇪🇺 EUR baisse → XAF sous pression mécanique");
      }
      if (m.dxy && p.dxy) {
        const dxyDelta = m.dxy - p.dxy;
        if (dxyDelta > 0.5) points.push("💵 Dollar plus fort → coût USDT en hausse");
        else if (dxyDelta < -0.5) points.push("💵 Dollar plus faible → coût USDT en baisse");
      }
      if (m.btc_usd && p.btc_usd) {
        const btcPct = ((m.btc_usd - p.btc_usd) / p.btc_usd) * 100;
        if (btcPct > 3) points.push("₿ BTC fort → sentiment risk-on, USDT/CNY peut remonter");
        else if (btcPct < -3) points.push("₿ BTC en chute → risk-off, vente d'USDT en P2P");
      }
    }
    if (rate.latest && rate.prev) {
      const diff = rate.latest.suggested_rate - rate.prev.suggested_rate;
      if (diff >= 20) points.push("📊 Marché favorable, taux remonte — publier maintenant");
      else if (diff <= -20) points.push("📊 Marché défavorable, taux baisse — élargir la marge");
    }
    if (points.length === 0) points.push("Marché stable, pas de signal directionnel fort");
    lectureSection += points.join("\n");
    lectureSection += type === "morning"
      ? "\n\n🎯 Action : la fenêtre matinale (avant 9h) est en général la plus favorable."
      : "\n\n🎯 Action : surveille la nuit asiatique pour signal de demain.";
  }

  return header + rateSection + macroSection + newsSection + lectureSection;
}

// ─── Compose alerte urgente ──────────────────────────────────────────────
function composeAlert(alert: { kind: string; details: string }): string {
  const dateStr = new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala",
  });
  return `🚨 ALERTE ${alert.kind.toUpperCase()}\n${dateStr} (Douala)\n\n${alert.details}`;
}

// ─── Send to Telegram ────────────────────────────────────────────────────
async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description || "Telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type: string = body.type ?? "morning";

    if (!["morning", "evening", "alert"].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: "type must be morning|evening|alert" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let message: string;
    let payload: Record<string, unknown> = {};

    if (type === "alert") {
      if (!body.alert?.kind || !body.alert?.details) {
        return new Response(
          JSON.stringify({ success: false, error: "alert requires {kind, details}" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      message = composeAlert(body.alert);
      payload = body.alert;
    } else {
      const [macro, rate] = await Promise.all([getMacro(supabase), getBonziniRate(supabase)]);
      message = await composeBrief(type as "morning" | "evening", macro, rate);
      payload = { macro_snapshot_id: macro.latest?.id, rate_suggestion_id: rate.latest?.id };
    }

    // Envoi en texte brut (pas de markdown pour éviter les pièges d'escaping)
    const send = await sendTelegram(message);

    // Log
    await supabase.from("briefs_log").insert({
      brief_type: type,
      payload,
      message_text: message,
      telegram_sent: send.ok,
      telegram_error: send.error ?? null,
    });

    return new Response(
      JSON.stringify({ success: send.ok, error: send.error, message_preview: message.slice(0, 200) }),
      { status: send.ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-brief error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
