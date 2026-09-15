/**
 * The 50 M XAF ceiling used to live only on the client-facing forms; the admin
 * wizards, which move far more money per session, had no upper bound. These
 * tests pin the shared guard both sides now call.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_PAYMENT_XAF,
  MIN_DEPOSIT_XAF,
  isValidXafAmount,
  xafAmountError,
} from '@/lib/amountLimits';
import { MIN_AMOUNT_XAF as SCHEMA_MIN } from '@/components/payment-form/paymentSchemas';

describe('isValidXafAmount', () => {
  it('accepts an ordinary amount', () => {
    expect(isValidXafAmount(3_500_000, MIN_PAYMENT_XAF)).toBe(true);
  });

  it('has no business ceiling: a 133 500 000 XAF deposit is valid', () => {
    expect(isValidXafAmount(133_500_000, MIN_DEPOSIT_XAF)).toBe(true);
    expect(isValidXafAmount(350_000_000, MIN_PAYMENT_XAF)).toBe(true);
  });

  it('rejects zero, negatives and fractions', () => {
    expect(isValidXafAmount(0)).toBe(false);
    expect(isValidXafAmount(-1000)).toBe(false);
    expect(isValidXafAmount(1000.5)).toBe(false);
  });

  it('rejects NaN and Infinity before they reach a balance calculation', () => {
    expect(isValidXafAmount(Number.NaN)).toBe(false);
    expect(isValidXafAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidXafAmount(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });

  it('enforces the caller-supplied floor', () => {
    expect(isValidXafAmount(500, MIN_DEPOSIT_XAF)).toBe(false);
    expect(isValidXafAmount(5_000, MIN_DEPOSIT_XAF)).toBe(true);
  });

  it('payments have no business minimum any more', () => {
    expect(isValidXafAmount(500, MIN_PAYMENT_XAF)).toBe(true);
    expect(isValidXafAmount(1, MIN_PAYMENT_XAF)).toBe(true);
  });
});

describe('xafAmountError', () => {
  it('is silent on a valid amount', () => {
    expect(xafAmountError(3_500_000, MIN_PAYMENT_XAF)).toBeNull();
  });

  it('explains an under-floor amount', () => {
    expect(xafAmountError(500, MIN_DEPOSIT_XAF)).toContain('minimum');
  });

  it('flags a NaN parse as invalid rather than as a range problem', () => {
    expect(xafAmountError(Number.NaN, MIN_PAYMENT_XAF)).toContain('invalide');
  });
});

describe('single source of truth', () => {
  it('the client-side zod schemas read the same constants as the admin wizards', () => {
    expect(SCHEMA_MIN).toBe(MIN_PAYMENT_XAF);
  });
});
