import { describe, it, expect } from 'vitest';
import {
  EDITABLE_STATUSES,
  LOCKED_STATUSES,
  UPLOADABLE_STATUSES,
  isStatusEditable,
  isStatusLocked,
  isStatusUploadable,
  normalizeRateToInt,
} from '@/components/payment-detail/types';
import type { Payment } from '@/hooks/usePayments';

const allStatuses: Payment['status'][] = [
  'created',
  'waiting_beneficiary_info',
  'ready_for_payment',
  'processing',
  'completed',
  'rejected',
  'cash_pending',
  'cash_scanned',
];

describe('payment-detail status helpers', () => {
  it('isStatusEditable matches EDITABLE_STATUSES exactly', () => {
    for (const status of allStatuses) {
      const expected = (EDITABLE_STATUSES as readonly string[]).includes(status);
      expect(isStatusEditable(status)).toBe(expected);
    }
  });

  it('isStatusLocked matches LOCKED_STATUSES exactly', () => {
    for (const status of allStatuses) {
      const expected = (LOCKED_STATUSES as readonly string[]).includes(status);
      expect(isStatusLocked(status)).toBe(expected);
    }
  });

  it('isStatusUploadable matches UPLOADABLE_STATUSES exactly', () => {
    for (const status of allStatuses) {
      const expected = (UPLOADABLE_STATUSES as readonly string[]).includes(status);
      expect(isStatusUploadable(status)).toBe(expected);
    }
  });

  it('locked and editable are mutually exclusive', () => {
    for (const status of allStatuses) {
      // A status can be neither (e.g. cash_pending) but never both.
      expect(isStatusEditable(status) && isStatusLocked(status)).toBe(false);
    }
  });

  it('processing/completed/rejected are all locked', () => {
    expect(isStatusLocked('processing')).toBe(true);
    expect(isStatusLocked('completed')).toBe(true);
    expect(isStatusLocked('rejected')).toBe(true);
  });

  it('created/waiting/ready are all editable', () => {
    expect(isStatusEditable('created')).toBe(true);
    expect(isStatusEditable('waiting_beneficiary_info')).toBe(true);
    expect(isStatusEditable('ready_for_payment')).toBe(true);
  });
});

describe('normalizeRateToInt', () => {
  it('returns 0 for nullish input', () => {
    expect(normalizeRateToInt(null)).toBe(0);
    expect(normalizeRateToInt(undefined)).toBe(0);
    expect(normalizeRateToInt(0)).toBe(0);
  });

  it('multiplies legacy decimal rates by 1_000_000', () => {
    // Pre-refactor client payments stored 0.01153 meaning 1 XAF = 0.01153 RMB.
    expect(normalizeRateToInt(0.01153)).toBe(11_530);
    expect(normalizeRateToInt(0.012)).toBe(12_000);
    // Tiny edge case: rates close to but below 1 should still be scaled.
    expect(normalizeRateToInt(0.999)).toBe(999_000);
  });

  it('keeps integer-form rates as-is', () => {
    // Recent admin-created payments store the rate as an integer
    // (1M XAF → 11530 RMB).
    expect(normalizeRateToInt(11_530)).toBe(11_530);
    expect(normalizeRateToInt(11_400)).toBe(11_400);
    expect(normalizeRateToInt(1)).toBe(1);
  });

  it('rounds non-integer integer-form rates', () => {
    expect(normalizeRateToInt(11_530.4)).toBe(11_530);
    expect(normalizeRateToInt(11_530.6)).toBe(11_531);
  });
});
