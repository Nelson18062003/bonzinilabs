// Liquidation de référence des 3 véhicules du conteneur MIEU3611115, figée le
// 16/10/2026 pour la comparer à celle de la déclarante (Cynthia AKAH).
// Sources : fiches CIVIC SGS 825193 à 825195 ; détail dans
// docs/cargo/dossiers/2026-10_CTR-MIEU3611115_BL-274428633/liquidation-vehicules.md.
// Si ce test casse, le moteur a changé : ne pas modifier les chiffres sans
// mettre à jour ce document et prévenir.
import { describe, expect, it } from 'vitest';
import { liquidate } from '@/lib/customs/engine';

const CARS = [
  { name: 'Yaris 2009', V: 2_567_652, exciseA: 25, exciseB: 12.5, totalA: 2_726_049, totalB: 2_203_972 },
  { name: 'RAV4 2014', V: 6_959_505, exciseA: 12.5, exciseB: 0, totalA: 5_956_660, totalB: 4_541_596 },
  { name: 'Haval H6 2016', V: 4_789_202, exciseA: 0, exciseB: 0, totalA: 3_128_429, totalB: 3_128_429 },
];

const run = (V: number, exciseRate: number) =>
  liquidate({ customsValue: V, dutyRate: 30, exciseRate, vatExempt: false, usedVehicle: true, vehicleCount: 1 });

describe('MIEU3611115 — liquidation de référence (16/10/2026)', () => {
  for (const c of CARS) {
    it(`${c.name} : pratique CAMCIS de septembre (accises ${c.exciseA} %)`, () => {
      expect(run(c.V, c.exciseA).total).toBe(c.totalA);
    });
    it(`${c.name} : Code des impôts 2026 (accises ${c.exciseB} %)`, () => {
      expect(run(c.V, c.exciseB).total).toBe(c.totalB);
    });
  }

  it('Yaris, scénario A, ligne par ligne', () => {
    const lines = Object.fromEntries(run(2_567_652, 25).lines.map((l) => [l.code, l.amount]));
    expect(lines).toEqual({
      DDI: 770_296, DAC: 834_487, DEA: 25_677, TVA: 734_670, CAC: 73_468,
      TCI: 15_406, CCI: 10_271, CIA: 5_135, PRO: 1_284, DEV: 245_355, VFX: 10_000,
    });
  });

  it('totaux des 3 véhicules', () => {
    expect(CARS.reduce((n, c) => n + run(c.V, c.exciseA).total, 0)).toBe(11_811_138);
    expect(CARS.reduce((n, c) => n + run(c.V, c.exciseB).total, 0)).toBe(9_873_997);
  });
});
