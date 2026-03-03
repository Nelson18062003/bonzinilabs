import type { DailyRate, PaymentMethodKey } from '@/types/rates';

/**
 * Pure frontend calculation — mirrors the SQL calculate_final_rate function.
 *
 * Formula:
 *   T_final = T_mode * (1 + c) * (1 + t_n)
 *   Amount_CNY = Amount_XAF * (T_final / 1_000_000)
 *
 * @param baseRate      - Base rate for the payment method (CNY per 1M XAF)
 * @param countryPct    - Country adjustment percentage (e.g. -1.50 for -1.5%)
 * @param amountXAF     - Amount in XAF
 * @param tierAdjustments - Array of tier adjustments with key and percentage
 */
export function calculateFinalRate(
  baseRate: number,
  countryPct: number,
  amountXAF: number,
  tierAdjustments: { key: string; percentage: number }[]
): { finalRate: number; amountCNY: number; tierKey: string } {
  const c = countryPct / 100;

  let tierKey: string;
  if (amountXAF >= 1_000_000) tierKey = 't3';
  else if (amountXAF >= 400_000) tierKey = 't2';
  else tierKey = 't1';

  const tierAdj = tierAdjustments.find(t => t.key === tierKey);
  const t = (tierAdj?.percentage ?? 0) / 100;

  const finalRate = baseRate * (1 + c) * (1 + t);
  const amountCNY = amountXAF * (finalRate / 1_000_000);

  return {
    finalRate: Math.round(finalRate * 100) / 100,
    amountCNY: Math.round(amountCNY * 100) / 100,
    tierKey,
  };
}

/**
 * Get the base rate for a given payment method from a DailyRate record.
 */
export function getBaseRate(rates: DailyRate, method: PaymentMethodKey): number {
  switch (method) {
    case 'cash': return rates.rate_cash;
    case 'alipay': return rates.rate_alipay;
    case 'wechat': return rates.rate_wechat;
    case 'virement': return rates.rate_virement;
  }
}

/**
 * Get tier key from amount.
 */
export function getTierKey(amountXAF: number): 't1' | 't2' | 't3' {
  if (amountXAF >= 1_000_000) return 't3';
  if (amountXAF >= 400_000) return 't2';
  return 't1';
}
