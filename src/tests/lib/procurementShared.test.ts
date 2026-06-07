import { describe, it, expect } from 'vitest';
import {
  isValidAmount, formatByCurrency, MAX_PROC_AMOUNT,
  PO_STATUS_LABEL, MISSION_STATUS_LABEL, PROD_STATUS_LABEL,
  PROD_STATUS_OPTIONS, SUPPLIER_KIND_OPTIONS, VERIF_OPTIONS,
} from '@/mobile/screens/procurement/shared';

describe('isValidAmount', () => {
  it('accepte les montants finis, positifs, sous le plafond', () => {
    expect(isValidAmount(1)).toBe(true);
    expect(isValidAmount(1000.5)).toBe(true);
    expect(isValidAmount(MAX_PROC_AMOUNT - 1)).toBe(true);
  });
  it('rejette 0, négatif, NaN, Infinity, et le plafond', () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-5)).toBe(false);
    expect(isValidAmount(Number.NaN)).toBe(false);
    expect(isValidAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidAmount(MAX_PROC_AMOUNT)).toBe(false);
  });
});

describe('formatByCurrency', () => {
  it('vide → tiret', () => {
    expect(formatByCurrency({})).toBe('—');
    expect(formatByCurrency({ CNY: 0 })).toBe('—');
  });
  it('formate une devise', () => {
    expect(formatByCurrency({ CNY: 1000 })).toContain('CNY');
  });
  it('joint plusieurs devises avec le séparateur', () => {
    const s = formatByCurrency({ CNY: 1000, XAF: 500 });
    expect(s).toContain('CNY');
    expect(s).toContain('XAF');
    expect(s).toContain(' · ');
  });
  it('accepte un séparateur personnalisé', () => {
    expect(formatByCurrency({ CNY: 1000, XAF: 500 }, ' / ')).toContain(' / ');
  });
});

describe('libellés & options — couverture des enums', () => {
  it('PO_STATUS_LABEL couvre open/closed/cancelled', () => {
    expect(Object.keys(PO_STATUS_LABEL).sort()).toEqual(['cancelled', 'closed', 'open']);
  });
  it('MISSION_STATUS_LABEL couvre active/closed/archived', () => {
    expect(Object.keys(MISSION_STATUS_LABEL).sort()).toEqual(['active', 'archived', 'closed']);
  });
  it('PROD_STATUS_OPTIONS dérive de PROD_STATUS_LABEL (value+label non vides)', () => {
    expect(PROD_STATUS_OPTIONS).toHaveLength(Object.keys(PROD_STATUS_LABEL).length);
    expect(PROD_STATUS_OPTIONS.every((o) => Boolean(o.value) && Boolean(o.label))).toBe(true);
  });
  it('options fournisseur (3) et vérification (4)', () => {
    expect(SUPPLIER_KIND_OPTIONS).toHaveLength(3);
    expect(VERIF_OPTIONS).toHaveLength(4);
  });
});
