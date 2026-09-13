// ============================================================
// Le coût à quai — un chiffre faux est pire qu'aucun chiffre. On rejoue le
// dossier MRSU9909331 (docs/strategy/manoeuvre-1, §5) et les règles
// sourcées des modules 5, 6 et 7.
// ============================================================
import { describe, it, expect } from 'vitest';
import { landedCost, includedInPrice, rangeSentence, PORT_CASCADE, STAMP_DUTY_XAF, type LandedCostInput } from '@/lib/cargo/landedCost';

const flat = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

const tracteur: LandedCostInput = {
  goodsAmount: 6057.1, currency: 'USD', xafPerUnit: 573.2, grossWeightKg: 1750, incoterm: 'FOB',
  dutyBand: 10, vatExempt: true, freightUsd: 1125, portDuesXaf: 77_000, bescXaf: null, fileFeesXaf: null, truckingXaf: null,
};

describe('includedInPrice', () => {
  it('FOB : ni fret ni assurance ; CFR : fret ; CIF : les deux', () => {
    expect(includedInPrice('FOB')).toEqual({ freight: false, insurance: false });
    expect(includedInPrice('CFR')).toEqual({ freight: true, insurance: false });
    expect(includedInPrice('CIF')).toEqual({ freight: true, insurance: true });
  });
});

describe('landedCost — le tracteur de MRSU9909331', () => {
  const c = landedCost(tracteur);
  it('la marchandise vaut ~3 472 000 XAF', () => { expect(c.goodsXaf).toBeCloseTo(3_471_930, -2); });
  it('le fret taxé : la valeur en douane dépasse la marchandise', () => {
    expect(c.customsValue.low).toBeGreaterThan(c.goodsXaf);
    expect(c.customsValue.low).toBe(c.customsValue.high); // fret connu → certain
  });
  it('droit de douane 10 % de la valeur en douane', () => {
    const duty = c.lines.find((l) => l.key === 'duty')!;
    expect(duty.low).toBe(Math.round(c.customsValue.low * 0.1));
  });
  it('TVA exonérée : zéro, mais la ligne est dite', () => {
    const vat = c.lines.find((l) => l.key === 'vat')!;
    expect(vat.low).toBe(0); expect(vat.note).toBe('exonérée'); expect(vat.confidence).toBe('certain');
  });
  it('cascade portuaire × 1,293 sur 77 000 → 99 559', () => {
    const port = c.lines.find((l) => l.key === 'port')!;
    expect(port.low).toBe(Math.round(77_000 * PORT_CASCADE)); expect(port.low).toBe(99_561);
  });
  it('timbre 25 000, certain', () => {
    const stamp = c.lines.find((l) => l.key === 'stamp')!;
    expect(stamp.low).toBe(STAMP_DUTY_XAF); expect(stamp.confidence).toBe('certain');
  });
  it('le total est du même ordre que le dossier (~4,7 M)', () => {
    expect(c.total.low).toBeGreaterThan(4_000_000); expect(c.total.high).toBeLessThan(5_500_000);
  });
  it('le rouge est une action, jamais un montant : SGS, poids, 21e jour', () => {
    expect(c.actions.some((a) => a.includes('SGS'))).toBe(true);
    expect(c.actions.some((a) => a.includes('1 750') || a.includes('1 750'))).toBe(true);
    expect(c.actions.some((a) => a.includes('21e jour'))).toBe(true);
    expect(c.demurragePerDayXaf).toBe(44_413);
  });
  it('sans BESC ni camion : dit ce qui manque', () => {
    expect(c.caveats.some((k) => k.includes('BESC'))).toBe(true);
    expect(c.caveats.some((k) => k.includes('transport final'))).toBe(true);
  });
});

describe('landedCost — fourchettes', () => {
  it('sans devis de fret : une fourchette, et le droit de douane suit', () => {
    const c = landedCost({ ...tracteur, freightUsd: null });
    const f = c.lines.find((l) => l.key === 'freight')!;
    expect(f.confidence).toBe('estime'); expect(f.high).toBeGreaterThan(f.low);
    expect(c.total.high).toBeGreaterThan(c.total.low);
    expect(c.lines.find((l) => l.key === 'duty')!.confidence).toBe('estime');
  });
  it('CIF : fret et assurance inclus, à zéro et dits', () => {
    const c = landedCost({ ...tracteur, incoterm: 'CIF', freightUsd: null });
    expect(c.lines.find((l) => l.key === 'freight')!.note).toBe('inclus');
    expect(c.lines.find((l) => l.key === 'insurance')!.note).toBe('incluse');
    expect(c.customsValue.low).toBe(c.goodsXaf);
  });
  it('TVA due : 19,25 % sur valeur + droit', () => {
    const c = landedCost({ ...tracteur, vatExempt: false });
    const vat = c.lines.find((l) => l.key === 'vat')!;
    const duty = c.lines.find((l) => l.key === 'duty')!;
    expect(vat.low).toBe(Math.round((c.customsValue.low + duty.low) * 0.1925));
  });
});

describe('rangeSentence', () => {
  it('égal → un montant ; sinon « de … à … »', () => {
    expect(flat(rangeSentence(25_000, 25_000))).toBe('25 000 XAF');
    expect(flat(rangeSentence(4_660_000, 4_820_000))).toBe('4 660 000 à 4 820 000 XAF');
  });
});
