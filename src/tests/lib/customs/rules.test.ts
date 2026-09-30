// ============================================================
// Les règles lues dans le CGI 2024 : codes, accises (art. 142 + annexe II),
// exonérations de TVA (annexe I + liste agricole).
// ============================================================
import { describe, it, expect } from 'vitest';
import { formatHs, hs6, hsDigits, isHsCode, matchSpec, pad12 } from '@/lib/customs/hsCode';
import { exciseFor, vehicleAge, vehicleExciseRate } from '@/lib/customs/excise';
import { vatExemption } from '@/lib/customs/vatExempt';

describe('hsCode', () => {
  it('lit toutes les écritures', () => {
    expect(hsDigits('870190.11.0000')).toBe('870190110000');
    expect(hsDigits('870190 11 000')).toBe('87019011000');
    expect(pad12('87019011000')).toBe('870190110000');
    expect(hs6('8701.93.00.1000')).toBe('870193');
    expect(hs6('8701')).toBeNull();
    expect(isHsCode('8517.13')).toBe(true);
    expect(isHsCode('téléphone')).toBe(false);
  });
  it('affiche comme le document d’origine', () => {
    expect(formatHs('8517')).toBe('85.17');
    expect(formatHs('851713')).toBe('8517.13');
    expect(formatHs('870190110000')).toBe('870190.11.0000');
    expect(formatHs('87019011000')).toBe('870190 11 000');
  });
  it('compare au niveau de précision du texte', () => {
    expect(matchSpec('630900', '6309')).toBe('yes');
    expect(matchSpec('63', '6309')).toBe('maybe');
    expect(matchSpec('340120', '340119-340290')).toBe('yes');
    expect(matchSpec('340111', '340119-340290')).toBe('no');
    expect(matchSpec('870323', '8703239100-8703249001')).toBe('maybe');
    expect(matchSpec('870190110000', '87019011')).toBe('yes');
  });
});

describe('accises — CGI art. 142 et annexe II', () => {
  const rate = (code: string, extra: object = {}) => exciseFor({ code, declarationYear: 2026, ...extra }).rate;

  it('papier hygiénique 4818.10 : 25 % ; mouchoirs 4818.20 : rien', () => {
    expect(rate('481810')).toBe(25);
    expect(rate('481820')).toBe(0);
  });
  it('meubles en plastique 9403.70 : 25 % ; sièges 9401 : rien — le piège des chaises', () => {
    expect(rate('940370')).toBe(25);
    expect(rate('940180')).toBe(0);
    expect(rate('940330')).toBe(25);
  });
  it('friperie 6309 : 12,5 %, et la note dit que le neuf va au 61/62 ; T-shirts neufs : rien', () => {
    const f = exciseFor({ code: '630900', declarationYear: 2026 });
    expect(f.rate).toBe(12.5);
    expect(f.note).toMatch(/61 ou 62/);
    expect(rate('610910')).toBe(0);
  });
  it('mèches et perruques 12,5 % ; motos ≤ 250 cm³ 5 %, > 250 cm³ 12,5 % ; parties de motos 12,5 %', () => {
    expect(rate('670420')).toBe(12.5);
    expect(rate('871120')).toBe(5);
    expect(rate('871130')).toBe(12.5);
    expect(rate('871410')).toBe(12.5);
  });
  it('cosmétiques 25 %, 50 % avec hydroquinone ; dentifrice (3306) : rien', () => {
    expect(rate('330499')).toBe(25);
    expect(rate('330499', { containsHydroquinone: true })).toBe(50);
    expect(rate('290722')).toBe(50);
    expect(rate('330610')).toBe(0);
  });
  it('tabac 30 % ; sucreries 5 % (le taux réduit l’emporte sur le général) ; bière 25 %', () => {
    expect(rate('240220')).toBe(30);
    expect(rate('170490')).toBe(5);
    expect(rate('180690')).toBe(5);
    expect(rate('220300')).toBe(25);
  });
  it('spiritueux 2208.90 : 25 %, mais l’alcool éthylique 2208.90.10 est exclu → « ça dépend »', () => {
    const r = exciseFor({ code: '220890', declarationYear: 2026 });
    expect(r.rate).toBe(25);
    expect(r.certainty).toBe('depends');
  });
  it('téléphones, panneaux solaires, TV : pas d’accises', () => {
    expect(rate('851713')).toBe(0);
    expect(rate('854143')).toBe(0);
    expect(rate('852872')).toBe(0);
  });
});

describe('accises — véhicules', () => {
  const car = (engineCc: number, year: number) => ({ kind: 'car' as const, engineCc, firstRegistrationYear: year, used: true });

  it("l'âge compte en années pleines depuis la première mise en circulation", () => {
    expect(vehicleAge(car(1600, 2009), 2026)).toBe(17);
  });
  it('Yaris 2009, 1,6 L : 25 % (règle CGI 2024, celle que CAMCIS a appliquée)', () => {
    const r = exciseFor({ code: '870322', declarationYear: 2026, vehicle: car(1598, 2009) });
    expect(r.rate).toBe(25);
    expect(r.otherRule).toEqual({ rule: 'lf2026', rate: 12.5 });
  });
  it('Fortuner 2016, 2,7 L : 12,5 % (plus de 2 500 cm³, 1 à 15 ans)', () => {
    expect(exciseFor({ code: '870333', declarationYear: 2026, vehicle: car(2694, 2016) }).rate).toBe(12.5);
  });
  it('RAV4 2021 : 1 987 cm³ → 0 % ; 2 487 cm³ → 25 % (annexe II, ≥ 2 000 cm³)', () => {
    expect(exciseFor({ code: '870323', declarationYear: 2026, vehicle: car(1987, 2021) }).rate).toBe(0);
    expect(exciseFor({ code: '870323', declarationYear: 2026, vehicle: car(2487, 2021) }).rate).toBe(25);
  });
  it('sans cylindrée ni âge : « ça dépend », jamais un faux zéro silencieux', () => {
    const r = exciseFor({ code: '870323', declarationYear: 2026 });
    expect(r.certainty).toBe('depends');
    expect(r.note).toMatch(/cylindrée/);
  });
  it('utilitaire : 0 % jusqu’à 15 ans, 12,5 % de 15 à 25, 25 % au-delà', () => {
    const u = (year: number) => ({ kind: 'utility' as const, engineCc: null, firstRegistrationYear: year, used: true });
    expect(vehicleExciseRate(u(2015), 11, 'cgi2024')).toBe(0);
    expect(exciseFor({ code: '870421', declarationYear: 2026, vehicle: u(2006) }).rate).toBe(12.5);
    expect(exciseFor({ code: '870421', declarationYear: 2026, vehicle: u(1998) }).rate).toBe(25);
  });
  it('tracteur agricole : exclu des accises ; motoculteur, remorque agricole aussi', () => {
    expect(exciseFor({ code: '870190110000', declarationYear: 2026 }).rate).toBe(0);
    expect(exciseFor({ code: '870193', declarationYear: 2026, vehicle: { kind: 'utility', engineCc: null, firstRegistrationYear: 2000, used: true, agricultural: true } }).rate).toBe(0);
    expect(exciseFor({ code: '870110', declarationYear: 2026 }).rate).toBe(0);
    expect(exciseFor({ code: '871620', declarationYear: 2026 }).rate).toBe(0);
  });
  it('LF2026 : véhicule au gaz naturel, 0 %', () => {
    expect(vehicleExciseRate({ ...car(3000, 2000), naturalGas: true }, 26, 'lf2026')).toBe(0);
  });
});

describe('TVA — CGI annexe I et liste agricole', () => {
  it('riz, lait en poudre, médicaments, engrais, livres : exonérés d’office', () => {
    for (const c of ['100630', '040221', '300490', '310520', '490199']) expect(vatExemption(c).exempt).toBe('yes');
  });
  it('tracteur : 870190.11.0000 exonéré d’office ; 8701.94 seulement si agricole', () => {
    expect(vatExemption('870190110000').exempt).toBe('yes');
    expect(vatExemption('870194').exempt).toBe('maybe');
    expect(vatExemption('870194', true).exempt).toBe('yes');
  });
  it('motopompe : exonérée si l’usage est agricole', () => {
    expect(vatExemption('841381').exempt).toBe('maybe');
    expect(vatExemption('841381', true).exempt).toBe('yes');
  });
  it('moustiquaires : seule la ligne nationale « moustiquaires » de 6304.93 → « ça dépend »', () => {
    const r = vatExemption('630493');
    expect(r.exempt).toBe('maybe');
    expect(r.condition).toMatch(/12 chiffres/);
  });
  it('téléphones, vêtements, voitures : TVA due', () => {
    for (const c of ['851713', '610910', '870323']) expect(vatExemption(c).exempt).toBe('no');
  });
});
