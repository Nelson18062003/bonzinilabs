import { createClient } from "@supabase/supabase-js";

export interface Rates {
  alipay: number;
  wechat: number;
  virement: number;
  cash: number;
}

const FALLBACK_RATES: Rates = {
  alipay: 11610,
  wechat: 11610,
  virement: 11610,
  cash: 11575,
};

export async function fetchRates(): Promise<Rates> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return FALLBACK_RATES;

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from("daily_rates")
      .select("rate_alipay, rate_wechat, rate_virement, rate_cash")
      .eq("is_active", true)
      .single();

    if (error || !data) return FALLBACK_RATES;

    return {
      alipay: data.rate_alipay ?? FALLBACK_RATES.alipay,
      wechat: data.rate_wechat ?? FALLBACK_RATES.wechat,
      virement: data.rate_virement ?? FALLBACK_RATES.virement,
      cash: data.rate_cash ?? FALLBACK_RATES.cash,
    };
  } catch {
    return FALLBACK_RATES;
  }
}
