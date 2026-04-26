// ============================================================
// Pure calculation helpers for the new-payment form.
// No React, no i18n — just numbers in / numbers out so the
// logic is unit-testable and decoupled from the UI components.
// ============================================================
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, PaymentMethodKey } from '@/types/rates';
import type { Currency, PaymentMethodType } from './types';

/**
 * Subset of `useClientRates().data` we actually consume here. Defined
 * locally so paymentRateLogic stays unit-testable without pulling the
 * full hook.
 */
interface RatesInput {
  activeRate?: DailyRate;
  adjustments: Array<{
    type: string;
    key: string;
    percentage: number;
  }>;
}

const FALLBACK_RATE = 0.01167;
const COUNTRY_MAP: Record<string, string> = {
  Cameroun: 'cameroun', cameroun: 'cameroun',
  Gabon: 'gabon', gabon: 'gabon',
  Tchad: 'tchad', tchad: 'tchad',
  Centrafrique: 'rca', RCA: 'rca', rca: 'rca',
  Congo: 'congo', congo: 'congo',
  'Guinée Équatoriale': 'guinee', guinee: 'guinee',
};

export function clientCountryToRateKey(country: string | null | undefined): string {
  return COUNTRY_MAP[country || ''] ?? 'cameroun';
}

export function toRateKey(method: PaymentMethodType | null): PaymentMethodKey {
  if (method === 'bank_transfer') return 'virement';
  if (method === 'alipay' || method === 'wechat' || method === 'cash') return method;
  return 'cash';
}

export interface ComputedPaymentValues {
  /** Final rate as a decimal (e.g. 0.01167 means 1 XAF = 0.01167 RMB). */
  rate: number;
  amountXAF: number;
  amountRMB: number;
  /** Wallet balance after the payment is deducted. */
  balanceAfter: number;
  /** True when the wallet covers the XAF amount. */
  hasEnoughBalance: boolean;
  /** True when the amount is in [10 000 ; 50 000 000] XAF and is a safe int. */
  isValidAmount: boolean;
  /** True once the user has typed enough that we can show a rate hint. */
  showRate: boolean;
}

/**
 * Pure computation of every derived value the UI needs from the raw
 * inputs (amount string + currency + selected method + wallet + rates).
 *
 * Wrap with useMemo at the call site to keep referential equality.
 */
export function computePaymentValues(params: {
  inputAmount: string;
  currency: Currency;
  selectedMethod: PaymentMethodType | null;
  walletBalanceXaf: number;
  clientRatesData: RatesInput | undefined;
  clientCountryKey: string;
}): ComputedPaymentValues {
  const { inputAmount, currency, selectedMethod, walletBalanceXaf, clientRatesData, clientCountryKey } = params;

  let rate = FALLBACK_RATE;
  if (clientRatesData?.activeRate) {
    const rateKey = toRateKey(selectedMethod);
    const baseRate = getBaseRate(clientRatesData.activeRate, rateKey);
    const countryAdj = clientRatesData.adjustments.find(
      (a) => a.type === 'country' && a.key === clientCountryKey,
    );
    const countryPct = countryAdj?.percentage ?? 0;
    const tierAdjs = clientRatesData.adjustments
      .filter((a) => a.type === 'tier')
      .map((a) => ({ key: a.key, percentage: a.percentage }));

    let prelimXAF: number;
    if (currency === 'XAF') {
      prelimXAF = parseInt(inputAmount, 10) || 1_000_000;
    } else {
      const baseRateDecimal = (baseRate * (1 + countryPct / 100)) / 1_000_000;
      prelimXAF =
        baseRateDecimal > 0
          ? Math.round((parseFloat(inputAmount) || 0) / baseRateDecimal)
          : 1_000_000;
    }
    const result = calculateFinalRate(baseRate, countryPct, prelimXAF, tierAdjs);
    rate = result.finalRate / 1_000_000;
  }

  const amountXAF =
    currency === 'XAF'
      ? parseInt(inputAmount, 10) || 0
      : rate > 0
        ? Math.round((parseFloat(inputAmount) || 0) / rate)
        : 0;

  const amountRMB =
    currency === 'RMB'
      ? parseFloat(inputAmount) || 0
      : Math.round(amountXAF * rate * 100) / 100;

  const hasEnoughBalance = amountXAF <= walletBalanceXaf;
  const isValidAmount =
    amountXAF >= 10_000 && amountXAF <= 50_000_000 && Number.isSafeInteger(amountXAF);
  const showRate = amountXAF >= 10_000;
  const balanceAfter = walletBalanceXaf - amountXAF;

  return { rate, amountXAF, amountRMB, balanceAfter, hasEnoughBalance, isValidAmount, showRate };
}
