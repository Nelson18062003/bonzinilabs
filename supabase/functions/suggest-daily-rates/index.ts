// supabase/functions/suggest-daily-rates/index.ts
// Computes a suggested daily rate by replicating Nelson's manual Binance P2P method.
//
// CMR (XAF → USDT, "I buy USDT with XAF"):
//   tradeType=BUY → returns SELL-side ads (merchants selling USDT)
//   payTypes: MTN Mobile Money + Orange Money
//   filters: tradableQuantity >= 5000, monthOrderCount >= 50, finishRate >= 0.90
//   pick MAX price among top 15 merchants sorted by monthOrderCount desc
//   add +3 XAF as Nelson's manual margin
//
// CHN (USDT → CNY, "I sell USDT for CNY"):
//   tradeType=SELL → returns BUY-side ads (merchants buying USDT)
//   payTypes: Alipay + WeChat
//   filters: userType=merchant, monthOrderCount >= 200, finishRate >= 0.95
//   simple average over top 100-200 merchants sorted by monthOrderCount desc
//
// suggested_rate = round(1_000_000 / (cmr_rate / chn_rate) / 10) * 10
//                = round(1_000_000 * chn_rate / cmr_rate / 10) * 10

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BINANCE_API = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const CMR_MARGIN_XAF = 3;
const CMR_TOP_N = 15;
const CHN_TOP_N = 150;

// Filters matching Nelson's manual screening on Binance P2P
const CMR_FILTERS = {
  minTradableUSDT: 5000,
  minMonthOrders: 50,
  minFinishRate: 0.90,
};
const CHN_FILTERS = {
  minMonthOrders: 200,
  minFinishRate: 0.95,
};

// Binance payTypes — must match Binance P2P naming exactly
const CMR_PAY_TYPES = ["MTNMobileMoney", "Orange"];
const CHN_PAY_TYPES = ["Alipay", "WeChat"];

interface BinanceAdv {
  price: string;
  tradableQuantity: string;
}

interface BinanceAdvertiser {
  nickName: string;
  monthOrderCount: number;
  monthFinishRate: number;
  positiveRate: number;
  userType: string;
}

interface BinanceItem {
  adv: BinanceAdv;
  advertiser: BinanceAdvertiser;
}

interface Merchant {
  name: string;
  price: number;
  tradable: number;
  orders: number;
  finishRate: number;
}

async function fetchPage(
  fiat: string,
  tradeType: "BUY" | "SELL",
  payTypes: string[],
  page: number,
  rows: number,
): Promise<BinanceItem[]> {
  const res = await fetch(BINANCE_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify({
      fiat,
      page,
      rows,
      tradeType,
      asset: "USDT",
      countries: [],
      proMerchantAds: false,
      publisherType: null,
      payTypes,
      classifies: ["mass", "profession", "fiat_merchant"],
    }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Binance ${fiat}/${tradeType}: ${json.message}`);
  return (json.data || []) as BinanceItem[];
}

async function fetchTop(
  fiat: string,
  tradeType: "BUY" | "SELL",
  payTypes: string[],
  pages: number,
): Promise<BinanceItem[]> {
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => fetchPage(fiat, tradeType, payTypes, i + 1, 20)),
  );
  return results.flat();
}

function toMerchant(item: BinanceItem): Merchant {
  return {
    name: item.advertiser.nickName,
    price: parseFloat(item.adv.price),
    tradable: parseFloat(item.adv.tradableQuantity),
    orders: item.advertiser.monthOrderCount,
    finishRate: item.advertiser.monthFinishRate,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin auth via the caller's session token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Non authentifie" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Non authentifie" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Acces reserve aux admins" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch both markets in parallel
    const [cmrRaw, chnRaw] = await Promise.all([
      fetchTop("XAF", "BUY", CMR_PAY_TYPES, 2),    // ~40 ads, plenty after filters
      fetchTop("CNY", "SELL", CHN_PAY_TYPES, 10),  // ~200 ads
    ]);

    // --- Cameroon: filter, sort by month orders desc, take top 15, take MAX price ---
    const cmrFiltered = cmrRaw
      .filter((i) =>
        parseFloat(i.adv.tradableQuantity) >= CMR_FILTERS.minTradableUSDT &&
        i.advertiser.monthOrderCount >= CMR_FILTERS.minMonthOrders &&
        i.advertiser.monthFinishRate >= CMR_FILTERS.minFinishRate
      )
      .map(toMerchant)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, CMR_TOP_N);

    if (cmrFiltered.length === 0) {
      throw new Error("Aucun ordre XAF ne passe les filtres (MTN/Orange, min trades, finish rate). Reessayez plus tard.");
    }

    const cmrMaxPrice = Math.max(...cmrFiltered.map((m) => m.price));
    const cmrRate = cmrMaxPrice + CMR_MARGIN_XAF;

    // --- China: filter, sort by month orders desc, take top 150, simple average ---
    const chnFiltered = chnRaw
      .filter((i) =>
        i.advertiser.userType === "merchant" &&
        i.advertiser.monthOrderCount >= CHN_FILTERS.minMonthOrders &&
        i.advertiser.monthFinishRate >= CHN_FILTERS.minFinishRate
      )
      .map(toMerchant)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, CHN_TOP_N);

    if (chnFiltered.length === 0) {
      throw new Error("Aucun ordre CNY ne passe les filtres (Alipay/WeChat, min trades, finish rate). Reessayez plus tard.");
    }

    const chnRate = chnFiltered.reduce((sum, m) => sum + m.price, 0) / chnFiltered.length;

    // --- Final: 1M XAF → CNY, rounded to nearest 10 ---
    const rawRate = (1_000_000 * chnRate) / cmrRate;
    const suggestedRate = Math.round(rawRate / 10) * 10;

    // Persist suggestion + audit trail
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("rate_suggestions")
      .insert({
        cmr_rate_max: cmrMaxPrice,
        cmr_margin_xaf: CMR_MARGIN_XAF,
        cmr_orders: cmrFiltered,
        chn_rate_avg: chnRate,
        chn_orders: chnFiltered,
        suggested_rate: suggestedRate,
        method: "nelson_v1",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        suggestion: inserted,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    console.error("suggest-daily-rates:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
