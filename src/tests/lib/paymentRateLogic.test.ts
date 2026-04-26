import { describe, it, expect } from 'vitest';
import {
  clientCountryToRateKey,
  computePaymentValues,
  toRateKey,
} from '@/components/payment-form/paymentRateLogic';
import type { DailyRate } from '@/types/rates';

// Minimal active-rate object that satisfies getBaseRate.
const baseRate: DailyRate = {
  id: 'test-rate',
  rate_alipay: 11_500,
  rate_wechat: 11_500,
  rate_cash: 11_300,
  rate_virement: 11_400,
  effective_at: '2026-04-01T00:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
  created_by: null,
  is_active: true,
};

const ratesData = {
  activeRate: baseRate,
  adjustments: [],
};

describe('clientCountryToRateKey', () => {
  it('maps known countries to lowercase keys', () => {
    expect(clientCountryToRateKey('Cameroun')).toBe('cameroun');
    expect(clientCountryToRateKey('Gabon')).toBe('gabon');
    expect(clientCountryToRateKey('Tchad')).toBe('tchad');
    expect(clientCountryToRateKey('Centrafrique')).toBe('rca');
    expect(clientCountryToRateKey('RCA')).toBe('rca');
    expect(clientCountryToRateKey('Congo')).toBe('congo');
    expect(clientCountryToRateKey('Guinée Équatoriale')).toBe('guinee');
  });

  it('falls back to cameroun for unknown / nullish input', () => {
    expect(clientCountryToRateKey(undefined)).toBe('cameroun');
    expect(clientCountryToRateKey(null)).toBe('cameroun');
    expect(clientCountryToRateKey('')).toBe('cameroun');
    expect(clientCountryToRateKey('Mars')).toBe('cameroun');
  });
});

describe('toRateKey', () => {
  it('translates payment methods to rate keys', () => {
    expect(toRateKey('alipay')).toBe('alipay');
    expect(toRateKey('wechat')).toBe('wechat');
    expect(toRateKey('cash')).toBe('cash');
    expect(toRateKey('bank_transfer')).toBe('virement');
    expect(toRateKey(null)).toBe('cash');
  });
});

describe('computePaymentValues', () => {
  it('returns the fallback rate when no rates data is provided', () => {
    const result = computePaymentValues({
      inputAmount: '1000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 5_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.rate).toBeCloseTo(0.01167, 5);
    expect(result.amountXAF).toBe(1_000_000);
    expect(result.amountRMB).toBeCloseTo(11_670, 0);
  });

  it('flags amounts below 10 000 XAF as invalid', () => {
    const result = computePaymentValues({
      inputAmount: '5000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 5_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.isValidAmount).toBe(false);
    expect(result.showRate).toBe(false);
  });

  it('flags amounts above 50M XAF as invalid', () => {
    const result = computePaymentValues({
      inputAmount: '60000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 100_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.isValidAmount).toBe(false);
  });

  it('treats amounts in [10K, 50M] as valid integers', () => {
    const result = computePaymentValues({
      inputAmount: '1000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 5_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.isValidAmount).toBe(true);
    expect(result.showRate).toBe(true);
  });

  it('flags amounts above the wallet balance as not having enough funds', () => {
    const result = computePaymentValues({
      inputAmount: '5000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 1_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.hasEnoughBalance).toBe(false);
    // Even when balance is short, the amount can still be a valid number.
    expect(result.isValidAmount).toBe(true);
  });

  it('computes balanceAfter as wallet - amountXAF', () => {
    const result = computePaymentValues({
      inputAmount: '500000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 2_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.balanceAfter).toBe(1_500_000);
  });

  it('falls back to a 1M XAF amount when input is empty (preliminary rate calc)', () => {
    const result = computePaymentValues({
      inputAmount: '',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 0,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    // Empty input → amountXAF = 0, but rate stays usable.
    expect(result.amountXAF).toBe(0);
    expect(result.rate).toBeGreaterThan(0);
  });

  it('handles RMB-side input by deriving the XAF amount', () => {
    const result = computePaymentValues({
      inputAmount: '11670',
      currency: 'RMB',
      selectedMethod: 'alipay',
      walletBalanceXaf: 10_000_000,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    // 11670 / 0.01167 ≈ 1_000_000
    expect(result.amountXAF).toBe(1_000_000);
    expect(result.amountRMB).toBe(11_670);
  });

  it('treats unsafe-int amounts as invalid', () => {
    // Number.MAX_SAFE_INTEGER + 1 — extreme but stays defensive.
    const result = computePaymentValues({
      inputAmount: String(Number.MAX_SAFE_INTEGER + 1),
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 0,
      clientRatesData: undefined,
      clientCountryKey: 'cameroun',
    });
    expect(result.isValidAmount).toBe(false);
  });

  it('uses the alipay base rate for alipay method when ratesData is provided', () => {
    const result = computePaymentValues({
      inputAmount: '1000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 5_000_000,
      clientRatesData: ratesData,
      clientCountryKey: 'cameroun',
    });
    // No country adjustment, no tier adjustment → final rate ≈ alipay base / 1M
    expect(result.rate).toBeCloseTo(0.0115, 4);
  });

  it('applies country-level adjustment when present', () => {
    const result = computePaymentValues({
      inputAmount: '1000000',
      currency: 'XAF',
      selectedMethod: 'alipay',
      walletBalanceXaf: 5_000_000,
      clientRatesData: {
        ...ratesData,
        adjustments: [{ type: 'country', key: 'cameroun', percentage: 1 }],
      },
      clientCountryKey: 'cameroun',
    });
    // +1% country adjustment → rate slightly higher than the no-adjustment baseline
    expect(result.rate).toBeGreaterThan(0.0115);
  });
});
