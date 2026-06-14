// supabase/functions/predict-rate/index.ts
// Prédiction du taux Bonzini à 24h via Claude API, en combinant :
// - historique du taux suggéré (7 jours)
// - historique macro (Brent, DXY, EUR/USD, BTC, USD/CNY) sur 7 jours
// - posts Trump récents (Iran)
// - news par source
//
// Retourne : predicted_rate, confidence (0-1), direction, reasoning, scenarios

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: "ANTHROPIC_API_KEY non configurée" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    // 1. Historique des suggestions de taux (sur 7 jours)
    const { data: rateHistory } = await supabase
      .from("rate_suggestions")
      .select("computed_at, suggested_rate, cmr_rate_max, chn_rate_avg")
      .gte("computed_at", sevenDaysAgo)
      .order("computed_at", { ascending: true });

    // 2. Historique macro (1 snapshot par jour pour la condensation)
    const { data: macroHistory } = await supabase
      .from("macro_snapshots")
      .select("captured_at, oil_brent, dxy, eur_usd, cny_usd, btc_usd")
      .gte("captured_at", sevenDaysAgo)
      .order("captured_at", { ascending: true });

    // 3. Dernier snapshot complet avec news + Trump
    const { data: latestMacro } = await supabase
      .from("macro_snapshots")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rateHistory || rateHistory.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Pas assez d'historique de taux" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lastRate = rateHistory[rateHistory.length - 1];

    // Condense l'historique macro (1 par jour, dernier de chaque journée)
    const macroDaily: Record<string, any> = {};
    for (const m of (macroHistory || [])) {
      const day = m.captured_at.slice(0, 10);
      macroDaily[day] = m;
    }
    const macroSeries = Object.entries(macroDaily).map(([day, m]) => ({
      jour: day,
      brent: m.oil_brent,
      dxy: m.dxy,
      eur_usd: m.eur_usd,
      cny_usd: m.cny_usd,
      btc: m.btc_usd,
    }));

    const ctx = {
      taux_actuel: lastRate.suggested_rate,
      cout_xaf_actuel: lastRate.cmr_rate_max + 3,
      marche_chn_actuel: lastRate.chn_rate_avg,
      historique_taux_7j: rateHistory.map((r) => ({
        moment: r.computed_at,
        taux: r.suggested_rate,
      })),
      historique_macro_7j: macroSeries,
      news_recents: latestMacro?.news_by_source ?? {},
      trump_posts_recents: latestMacro?.trump_posts_recent ?? [],
    };

    const systemPrompt = `Tu es l'analyste prédictif de Bonzini, fintech qui aide les importateurs africains à payer leurs fournisseurs chinois (achat USDT en XAF au Cameroun → vente USDT en CNY en Chine).

Ta mission : prédire l'évolution du TAUX BONZINI (CNY par 1M XAF) dans les prochaines 24h, en utilisant l'historique 7 jours + les actualités Iran/pétrole/Trump.

Tu dois retourner UNIQUEMENT un JSON strict (pas de markdown, pas de prose autour), avec ce schéma exact :

{
  "predicted_rate": <nombre entier>,
  "current_rate": <nombre entier>,
  "delta": <prédicted - current>,
  "direction": "up" | "down" | "flat",
  "confidence": <0.0 à 1.0>,
  "horizon": "24h",
  "key_drivers": [<liste de 3 à 5 strings courts>],
  "reasoning": <string de 3-5 lignes en français>,
  "scenarios": {
    "bullish": { "rate": <nombre>, "probability": <0-1>, "trigger": <string> },
    "base": { "rate": <nombre>, "probability": <0-1>, "trigger": <string> },
    "bearish": { "rate": <nombre>, "probability": <0-1>, "trigger": <string> }
  },
  "action_recommended": <string courte: publier maintenant, attendre, élargir marge, etc.>
}

Règles métier :
- Pétrole haut + dollar fort → XAF s'affaiblit → cout XAF monte → taux baisse
- Marché chinois fort + Trump conciliant → taux monte
- Frappes US/Iran → risk-off → tout baisse
- Probabilités des scenarios doivent sommer à 1.0
- predicted_rate doit être réaliste (5-100 CNY de delta typique sur 24h)`;

    const userPrompt = `Contexte complet pour ta prédiction :

${JSON.stringify(ctx, null, 2)}

Retourne UNIQUEMENT le JSON, rien d'autre.`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const claudeJson = await claudeRes.json();
    const rawText = claudeJson?.content?.[0]?.text;

    if (!rawText) {
      return new Response(
        JSON.stringify({ success: false, error: "Pas de réponse Claude", raw: claudeJson }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extraire le JSON (au cas où Claude ajoute du texte autour)
    let prediction: any = null;
    try {
      const cleaned = rawText.trim().replace(/^```json\s*/, "").replace(/```\s*$/, "");
      prediction = JSON.parse(cleaned);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) prediction = JSON.parse(match[0]);
    }

    if (!prediction) {
      return new Response(
        JSON.stringify({ success: false, error: "JSON Claude invalide", raw_text: rawText.slice(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persister la prédiction
    await supabase.from("rate_predictions").insert({
      based_on_rate_id: null,
      current_rate: prediction.current_rate ?? lastRate.suggested_rate,
      predicted_rate: prediction.predicted_rate,
      direction: prediction.direction,
      confidence: prediction.confidence,
      key_drivers: prediction.key_drivers,
      reasoning: prediction.reasoning,
      scenarios: prediction.scenarios,
      action_recommended: prediction.action_recommended,
    });

    return new Response(
      JSON.stringify({ success: true, prediction }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("predict-rate error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
