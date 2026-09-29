// ============================================================
// La liquidation CAMCIS, rejouée sur une vraie DAU : SDSD2-2026-IMP-020399-I
// du 17/09/2026 (docs/cargo/dossiers/2026-08_CTR-MRSU9909331_BL-271875389/
// articles-4-a-10_analyse.md) et sur la simulation RAV4
// (docs/cargo/simulations/2026-09_toyota-rav4_LVGE656F2MG032343.md).
// Tolérance : ±5 F par article — CAMCIS arrondit chaque sous-composante.
// ============================================================
import { describe, it, expect } from 'vitest';
import { liquidate, simulate, includedInPrice, type SimulationInput } from '@/lib/customs/engine';

const TOL = 5;
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOL);

describe('liquidate — les 7 articles non exonérés de la DAU, au franc près', () => {
  const cases = [
    { art: 4, what: 'téléviseurs', V: 800_000, duty: 30, excise: 0, dau: 459_740 },
    { art: 5, what: 'mouchoirs', V: 150_000, duty: 30, excise: 25, dau: 144_334 },
    { art: 6, what: 'fenêtres alu', V: 900_000, duty: 20, excise: 0, dau: 409_882 },
    { art: 7, what: 'portes alu', V: 200_000, duty: 20, excise: 0, dau: 91_086 },
    { art: 8, what: 'chaises', V: 500_000, duty: 30, excise: 25, dau: 481_120 },
    { art: 9, what: '« régulateur »', V: 150_000, duty: 30, excise: 0, dau: 86_202 },
    { art: 10, what: 'vêtements', V: 100_000, duty: 30, excise: 12.5, dau: 76_845 },
  ];
  for (const c of cases) {
    it(`article ${c.art}, ${c.what} : ${c.dau.toLocaleString('fr-FR')} F`, () => {
      near(liquidate({ customsValue: c.V, dutyRate: c.duty, exciseRate: c.excise, vatExempt: false }).total, c.dau);
    });
  }

  it('article 9 corrigé en 85.04 (10 %) : 50 423 F, soit 35 779 F de trop', () => {
    near(liquidate({ customsValue: 150_000, dutyRate: 10, exciseRate: 0, vatExempt: false }).total, 50_423);
  });

  it('article 8, le détail : DDI 150 000, DAC 162 500, DEA 5 000, TVA 143 063, CAC 14 307, petites taxes 6 250', () => {
    const l = liquidate({ customsValue: 500_000, dutyRate: 30, exciseRate: 25, vatExempt: false });
    const by = Object.fromEntries(l.lines.map((x) => [x.code, x.amount]));
    expect(by.DDI).toBe(150_000);
    expect(by.DAC).toBe(162_500);
    expect(by.DEA).toBe(5_000);
    expect(by.TVA).toBe(143_063);
    near(by.CAC, 14_306);
    expect(by.TCI + by.CCI + by.CIA + by.PRO).toBe(6_250);
  });

  it('la CAC est ventilée CAM / CAD / CAF, les petites taxes TCI/TIB, CCI/CCB, CIA/CIB', () => {
    const l = liquidate({ customsValue: 500_000, dutyRate: 30, exciseRate: 25, vatExempt: false });
    expect(l.lines.find((x) => x.code === 'CAC')!.parts!.map((p) => p.part)).toEqual(['CAM', 'CAD', 'CAF']);
    expect(l.lines.find((x) => x.code === 'TCI')!.parts!.map((p) => p.part)).toEqual(['TCI', 'TIB']);
    expect(l.lines.find((x) => x.code === 'TCI')!.rate).toBe(0.6);
  });

  it('article 3, le tracteur sous E00 : seule la redevance informatique, 92 658 F', () => {
    const l = liquidate({ customsValue: 9_265_805, dutyRate: 10, exciseRate: 0, vatExempt: true, fullExemption: true });
    expect(l.total).toBe(92_658);
    expect(l.lines.map((x) => x.code)).toEqual(['DEA']);
  });

  it('TVA exonérée : zéro, mais la ligne est dite', () => {
    const l = liquidate({ customsValue: 1_000_000, dutyRate: 10, exciseRate: 0, vatExempt: true });
    const vat = l.lines.find((x) => x.code === 'TVA')!;
    expect(vat.amount).toBe(0);
    expect(vat.rate).toBe(0);
    expect(l.lines.find((x) => x.code === 'CAC')!.amount).toBe(0);
  });

  it("exemple générique : 10 M de biens de consommation à 30 % → 5 746 750 F (57,5 %)", () => {
    near(liquidate({ customsValue: 10_000_000, dutyRate: 30, exciseRate: 0, vatExempt: false }).total, 5_746_750);
  });
});

describe('liquidate — véhicule d’occasion (simulation RAV4, V = 7 437 000)', () => {
  const base = { customsValue: 7_437_000, dutyRate: 30, vatExempt: false, usedVehicle: true };
  it('2.0 L, 1 987 cm³, pas d’accises : 4 852 510 F', () => {
    near(liquidate({ ...base, exciseRate: 0 }).total, 4_852_510);
  });
  it('2.5 L, 2 487 cm³, accises 25 % : 7 876 812 F — trois millions pour 500 cm³', () => {
    near(liquidate({ ...base, exciseRate: 25 }).total, 7_876_812);
  });
  it('DEV 5 % sur V + DDI + DAC + TVA : 568 652 F', () => {
    const dev = liquidate({ ...base, exciseRate: 0 }).lines.find((x) => x.code === 'DEV')!;
    expect(dev.base).toBe(11_373_032);
    near(dev.amount, 568_652);
  });
  it('code additionnel A30 : 3 411 358 / 5 528 370 F — CIA, CIB, CCB, TIB non abattus', () => {
    near(liquidate({ ...base, exciseRate: 0, abatementPct: 30 }).total, 3_411_358);
    near(liquidate({ ...base, exciseRate: 25, abatementPct: 30 }).total, 5_528_370);
  });
});

describe('includedInPrice', () => {
  it('FOB : rien ; CFR : le fret ; CIF : fret et assurance', () => {
    expect(includedInPrice('FOB')).toEqual({ freight: false, insurance: false });
    expect(includedInPrice('CFR')).toEqual({ freight: true, insurance: false });
    expect(includedInPrice('CIF')).toEqual({ freight: true, insurance: true });
  });
});

describe('simulate — le coût de revient rendu', () => {
  const base: SimulationInput = {
    code: '610910', dutyRate: 30, goodsAmount: 100_000, currency: 'CNY', xafPerUnit: 80, incoterm: 'FOB',
    freightXaf: 900_000, insuranceXaf: null, declarationYear: 2026, regime: 'reel',
  };

  it('valeur en douane = marchandise + fret + assurance estimée à 0,5 %', () => {
    const s = simulate(base);
    expect(s.goodsXaf).toBe(8_000_000);
    expect(s.insuranceXaf).toBe(Math.round(8_900_000 * 0.005));
    expect(s.insuranceEstimated).toBe(true);
    expect(s.customsValue).toBe(8_000_000 + 900_000 + 44_500);
  });

  it('PVI 0,95 % du FOB dès 2 000 000 F, précompte 2 % au réel', () => {
    const s = simulate(base);
    expect(s.outside.find((l) => l.code === 'PVI')!.amount).toBe(76_000);
    expect(s.outside.find((l) => l.code === 'PRE')!.amount).toBe(Math.round(s.customsValue * 0.02));
    expect(s.creditable).toBe(s.outside.find((l) => l.code === 'PRE')!.amount);
    expect(s.totalToPay).toBe(s.dau.total + s.outside.reduce((n, l) => n + l.amount, 0));
  });

  it('sans NIU : précompte 10 %, et on dit comment l’éviter', () => {
    const s = simulate({ ...base, regime: 'hors_fichier' });
    expect(s.outside.find((l) => l.code === 'PRE')!.rate).toBe(10);
    expect(s.notes.some((n) => n.id === 'precompte_niu')).toBe(true);
  });

  it('sous 2 000 000 F FOB : ni PVI, ni DI/RVC', () => {
    const s = simulate({ ...base, goodsAmount: 10_000 });
    expect(s.outside.some((l) => l.code === 'PVI')).toBe(false);
    expect(s.notes.some((n) => n.id === 'di_rvc')).toBe(false);
  });

  it('vêtements confectionnés : on prévient du TEC CEEAC à 40 %, chiffré', () => {
    const s = simulate(base);
    const n = s.notes.find((x) => x.id === 'tec_40')!;
    expect(n).toBeTruthy();
    expect(Number(n.params!.total)).toBeGreaterThan(s.dau.total);
  });

  it('FOB sans fret : on le dit', () => {
    expect(simulate({ ...base, freightXaf: null }).notes.some((n) => n.id === 'freight_missing')).toBe(true);
    expect(simulate({ ...base, incoterm: 'CIF' }).notes.some((n) => n.id === 'freight_missing')).toBe(false);
  });

  it('CIF : le fret et l’assurance sont dans le prix, rien n’est ajouté', () => {
    const s = simulate({ ...base, incoterm: 'CIF' });
    expect(s.customsValue).toBe(s.goodsXaf);
    expect(s.insuranceEstimated).toBe(false);
  });

  it('le tracteur de MRSU9909331 sous 870190.11.0000 : TVA exonérée, pas d’accises', () => {
    const s = simulate({
      code: '870190110000', dutyRate: 10, goodsAmount: 6_057.1, currency: 'USD', xafPerUnit: 573.2, incoterm: 'FOB',
      freightXaf: Math.round(1_125 * 573.2), insuranceXaf: null, declarationYear: 2026, regime: 'reel',
    });
    expect(s.vat.exempt).toBe('yes');
    expect(s.excise.rate).toBe(0);
    expect(s.dau.lines.find((l) => l.code === 'TVA')!.amount).toBe(0);
    expect(s.dau.lines.find((l) => l.code === 'DDI')!.amount).toBe(Math.round(s.customsValue * 0.1));
  });

  it('le même tracteur sous 8701.94 sans usage agricole déclaré : la TVA n’est plus acquise', () => {
    const s = simulate({
      code: '870194', dutyRate: 10, goodsAmount: 6_057.1, currency: 'USD', xafPerUnit: 573.2, incoterm: 'FOB',
      freightXaf: 644_850, declarationYear: 2026, regime: 'reel',
    });
    expect(s.vat.exempt).toBe('maybe');
    expect(s.dau.lines.find((l) => l.code === 'TVA')!.amount).toBeGreaterThan(0);
  });

  it('véhicule d’occasion : DEV, forfaits et CIVIC, et la règle LF2026 chiffrée à côté', () => {
    const s = simulate({
      code: '870323', dutyRate: 30, goodsAmount: 7_437_000, currency: 'XAF', xafPerUnit: 1, incoterm: 'CIF',
      declarationYear: 2026, regime: 'reel',
      vehicle: { kind: 'car', engineCc: 2487, firstRegistrationYear: 2021, used: true },
    });
    expect(s.excise.rate).toBe(25);
    near(s.dau.total, 7_876_812);
    expect(s.outside.find((l) => l.code === 'CIV')!.amount).toBe(29_813);
    const alt = s.notes.find((n) => n.id === 'vehicle_other_rule')!;
    expect(alt.params!.rate).toBe(0);
  });

  it('téléphones : on signale l’abattement de 50 % et l’IMEI, sans l’appliquer', () => {
    expect(simulate({ ...base, code: '851713', dutyRate: 10 }).notes.some((n) => n.id === 'phones')).toBe(true);
  });

  it('fers à béton : la taxe environnementale au poids est estimée si le poids est donné', () => {
    const n = simulate({ ...base, code: '721420', dutyRate: 20, netWeightKg: 25_000 }).notes.find((x) => x.id === 'env_tax')!;
    expect(n.fr).toContain('125 000');
  });

  it('taux effectif = droits et taxes de la DAU / valeur en douane', () => {
    const s = simulate(base);
    expect(s.effectiveRate).toBeCloseTo(s.dau.total / s.customsValue, 10);
  });
});
