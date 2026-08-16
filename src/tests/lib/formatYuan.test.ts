/**
 * ¥ formatting is a financial-safety guard, not cosmetics.
 *
 * A supplier once overpaid because `¥ 10 000,00` was read as a comma-grouped
 * "1 000 000". These tests pin the two properties that prevent a repeat:
 * no decimals on a whole amount, and a DOT — never a comma — when a real
 * fraction exists.
 */
import { describe, it, expect } from 'vitest';
import { formatYuan, formatCurrencyRMB, formatRMB } from '@/lib/formatters';
import { formatRMB as formatRMBPdf } from '@/lib/pdf/helpers';

/** Grouping is U+202F on screen / U+00A0 in PDFs — compare on plain spaces. */
const flat = (s: string) => s.replace(/[\u202f\u00a0]/g, ' ');

describe('formatYuan (écran)', () => {
  it('drops the fraction entirely on a whole amount', () => {
    expect(flat(formatYuan(38500))).toBe('38 500');
    expect(flat(formatYuan(12))).toBe('12');
    expect(flat(formatYuan(0))).toBe('0');
  });

  it('groups thousands with a separator that cannot read as a decimal mark', () => {
    expect(formatYuan(38500)).not.toContain(',');
    expect(formatYuan(1234567)).not.toContain(',');
    expect(flat(formatYuan(1234567))).toBe('1 234 567');
  });

  it('uses a DOT for a genuine fraction — the mark a CNY reader expects', () => {
    expect(flat(formatYuan(38500.5))).toBe('38 500.50');
    expect(flat(formatYuan(0.25))).toBe('0.25');
  });

  it('absorbs float noise instead of surfacing it as a fake fraction', () => {
    expect(flat(formatYuan(38499.999999999))).toBe('38 500');
    expect(flat(formatYuan(0.1 + 0.2))).toBe('0.30');
  });

  it('never renders NaN/Infinity into a payment sheet', () => {
    expect(formatYuan(Number.NaN)).toBe('0');
    expect(formatYuan(Number.POSITIVE_INFINITY)).toBe('0');
  });

  it('formatCurrencyRMB is the same number behind the ¥ sign', () => {
    expect(flat(formatCurrencyRMB(38500))).toBe('¥ 38 500');
    expect(formatCurrencyRMB(38500)).not.toContain(',00');
  });

  it('formatRMB stays an alias so old call sites cannot drift', () => {
    expect(formatRMB(38500)).toBe(formatYuan(38500));
  });
});

describe('formatRMB (PDF)', () => {
  it('matches the on-screen rules the receipt is generated from', () => {
    expect(flat(formatRMBPdf(38500))).toBe('38 500');
    expect(flat(formatRMBPdf(38500.5))).toBe('38 500.50');
    expect(formatRMBPdf(38500)).not.toContain(',');
  });

  it('keeps the fen the previous rounding silently discarded', () => {
    expect(flat(formatRMBPdf(1234.56))).toBe('1 234.56');
  });

  it('keeps the sign on a refunded line', () => {
    expect(flat(formatRMBPdf(-1500))).toBe('-1 500');
  });
});
