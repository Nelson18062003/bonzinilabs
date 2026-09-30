// ============================================================
// Vérifier une DAU : le moteur rejoué sur la vraie déclaration
// SDSD2-2026-IMP-020399-I (articles 4 à 10) — 307 078 F identifiés à la main
// dans docs/cargo/dossiers/2026-08_CTR-MRSU9909331_BL-271875389/
// articles-4-a-10_analyse.md. Le moteur doit retrouver les quatre erreurs, les
// chiffrer, et les ranger dans la bonne voie de droit.
// Les montants sont attendus à quelques francs près : le moteur rejoue CAMCIS
// au franc (86 202 F sur l'article 9), l'analyse manuelle arrondissait
// autrement (86 198 F) ; le reclassement y valait donc 4 F de plus.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNomenclature, type RawNomenclature } from '@/lib/customs/nomenclature';
import { liquidate } from '@/lib/customs/engine';
import { addYears, auditDau, cleanExtraction, daysUntil, type DauArticle, type DauExtraction, type DauTax } from '@/lib/customs/audit';

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/data/customs/nomenclature-cm.v1.json'), 'utf8')) as RawNomenclature;
const nom = parseNomenclature(raw);

/** Un article tel que la DAU l'imprime : les lignes CAMCIS, le total réel de la DAU. */
function art(n: number, code: string, description: string, V: number, duty: number, excise: number, dauTotal: number): DauArticle {
  const l = liquidate({ customsValue: V, dutyRate: duty, exciseRate: excise, vatExempt: false });
  const taxes = l.lines.flatMap((x): DauTax[] =>
    x.parts?.length
      ? x.parts.map((p) => ({ code: p.part, base_xaf: x.base, rate_pct: null, amount_xaf: p.amount }))
      : [{ code: x.code, base_xaf: x.base, rate_pct: x.rate, amount_xaf: x.amount }]);
  // CAMCIS arrondit chaque sous-composante : l'écart de 1 à 4 F tombe sur la CAF.
  taxes.find((t) => t.code === 'CAF')!.amount_xaf += dauTotal - l.total;
  return { n, code, description, origin: 'CN', quantity: 1, gross_kg: null, net_kg: null, customs_value_xaf: V, additional_code: null, taxes };
}

const dau: DauExtraction = {
  dau_number: 'SDSD2-2026-IMP-020399-I', office: 'SDSD2', regime: 'IM4', registered_on: '2026-09-17', paid_on: '2026-09-17',
  released: true, importer_name: 'Awa Import SARL', importer_niu: null, declarant: 'BNG TRANS SARL', total_taxes_xaf: null,
  unreadable: [],
  articles: [
    art(4, '852872000000', 'TELEVISEURS', 800_000, 30, 0, 459_740),
    art(5, '481820000000', 'MOUCHOIRS', 150_000, 30, 25, 144_334),
    art(6, '761010000000', 'FENETRES ALU', 900_000, 20, 0, 409_882),
    art(7, '761010000000', 'PORTES ALU', 200_000, 20, 0, 91_086),
    art(8, '940370000000', 'CHAISE DE SALLE A MANGER', 500_000, 30, 25, 481_120),
    art(9, '841821000000', 'REGULATEUR', 150_000, 30, 0, 86_202),
    art(10, '630900000000', 'VETEMENTS', 100_000, 30, 12.5, 76_845),
  ],
};

const near = (actual: number, expected: number, tol = 8) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);

describe('audit — la DAU SDSD2-2026-IMP-020399-I, articles 4 à 10', () => {
  const r = auditDau(dau, nom);
  const of = (n: number) => r.articles.find((a) => a.n === n)!;

  it('ce qui a été payé : 1 749 209 F, et chaque article se recalcule (aucune alerte de lecture)', () => {
    expect(r.totals.paid).toBe(459_740 + 144_334 + 409_882 + 91_086 + 481_120 + 86_202 + 76_845);
    expect(r.findings.filter((f) => f.kind === 'reading')).toEqual([]);
  });

  it('les téléviseurs, les fenêtres et les portes : rien à redire', () => {
    for (const n of [4, 6, 7]) expect(of(n).findings).toEqual([]);
  });

  it('article 9 : « RÉGULATEUR » en 8418.21 → 8504.40, 35 779 F — gain par reclassement, pas une réclamation', () => {
    const f = of(9).findings.find((x) => x.kind === 'classification')!;
    expect(f.proposed_code).toBe('850440');
    expect(f.route).toBe('reclassify');
    near(f.amount_xaf, 35_779);
    expect(f.fr).toMatch(/réfrigérateur/);
    expect(of(9).claimable).toBe(0);
  });

  it('article 8 : une chaise est un siège (94.01) — 193 784 F, l’accise des meubles tombe avec le code', () => {
    const f = of(8).findings.find((x) => x.kind === 'classification')!;
    expect(f.proposed_code!.slice(0, 4)).toBe('9401');
    near(f.amount_xaf, 193_784);
    // 9403.70 est bien à l'annexe II : pas de constat d'accise sur le code déclaré.
    expect(of(8).findings.some((x) => x.kind === 'excise_charged')).toBe(false);
  });

  it('article 5 : l’accise sur les mouchoirs (4818.20) n’est pas dans l’annexe II — 58 136 F réclamables, à confirmer', () => {
    const f = of(5).findings.find((x) => x.kind === 'excise_charged')!;
    expect(f.route).toBe('claim');
    expect(f.confidence).toBe('a_verifier');
    near(f.amount_xaf, 58_136);
    near(of(5).claimable, 58_136);
  });

  it('article 10 : « VETEMENTS » en friperie — 19 379 F si les vêtements sont neufs', () => {
    const f = of(10).findings.find((x) => x.kind === 'used_goods')!;
    expect(f.route).toBe('reclassify');
    expect(f.fr).toMatch(/Si la marchandise est neuve/);
    near(f.amount_xaf, 19_379);
  });

  it('les totaux : 58 136 F réclamables + 248 942 F par reclassement = 307 078 F, aucun risque', () => {
    near(r.totals.claimable, 58_136);
    near(r.totals.reclassify, 193_784 + 35_779 + 19_379, 15);
    near(r.totals.claimable + r.totals.reclassify, 307_078, 15);
    expect(r.totals.risk).toBe(0);
  });

  it('le délai de réclamation : 3 ans après le paiement', () => {
    expect(r.deadline).toBe('2029-09-17');
    expect(daysUntil('2029-09-17', new Date('2029-09-10T12:00:00Z'))).toBe(7);
  });
});

describe('audit — les autres constats', () => {
  const one = (a: DauArticle, extra: Partial<DauExtraction> = {}) => auditDau({ ...dau, articles: [a], ...extra }, nom).articles[0];

  it('des vêtements déclarés « friperie » avec le mot : aucun doute', () => {
    expect(one(art(1, '630900000000', 'FRIPERIE BALLES 45 KG', 100_000, 30, 12.5, 76_845)).findings).toEqual([]);
  });

  it('un droit de douane plus haut que le tarif : réclamable, à confirmer sur le tarif intégré', () => {
    // Téléviseurs à 30 % au tarif, liquidés comme si c'était 40 %.
    const a = art(1, '852872000000', 'TELEVISEURS', 800_000, 40, 0, liquidate({ customsValue: 800_000, dutyRate: 40, exciseRate: 0, vatExempt: false }).total);
    const f = one(a).findings.find((x) => x.kind === 'duty_rate')!;
    expect(f.route).toBe('claim');
    expect(f.amount_xaf).toBeGreaterThan(80_000);
    expect(f.fr).toMatch(/CAMCIS/);
  });

  it('une accise due et non liquidée : un risque, compté à part', () => {
    // Mèches (67.04) : 12,5 % d'accise au CGI, 0 sur la DAU.
    const a = art(1, '670420000000', 'MECHES SYNTHETIQUES', 300_000, 30, 0, liquidate({ customsValue: 300_000, dutyRate: 30, exciseRate: 0, vatExempt: false }).total);
    const x = one(a);
    const f = x.findings.find((y) => y.kind === 'excise_missing')!;
    expect(f.route).toBe('risk');
    expect(f.amount_xaf).toBeLessThan(0);
    expect(x.risk).toBe(-f.amount_xaf);
    expect(x.claimable).toBe(0);
  });

  it('un code moins cher que le bon : risque de redressement, pas une économie', () => {
    // « Réfrigérateur » (30 %) déclaré en 8504.40 (10 %).
    const a = art(1, '850440000000', 'REFRIGERATEUR', 200_000, 10, 0, liquidate({ customsValue: 200_000, dutyRate: 10, exciseRate: 0, vatExempt: false }).total);
    const x = one(a);
    const f = x.findings.find((y) => y.kind === 'classification')!;
    expect(f.proposed_code!.slice(0, 4)).toBe('8418');
    expect(f.route).toBe('risk');
    expect(f.amount_xaf).toBeLessThan(0);
    expect(x.reclassify).toBe(0);
    expect(x.risk).toBe(-f.amount_xaf);
  });

  it('des montants lus qui ne se recalculent pas : on le dit, et on ne compte pas l’écart comme un trop-perçu', () => {
    const a = art(1, '852872000000', 'TELEVISEURS', 800_000, 30, 0, 459_740);
    a.taxes.find((t) => t.code === 'TVA')!.amount_xaf += 90_000; // un 9 lu à la place d'un 0
    const x = one(a);
    expect(x.findings.map((f) => f.kind)).toEqual(['reading']);
    expect(x.claimable).toBe(0);
  });

  it('une valeur illisible : l’article est signalé, pas deviné', () => {
    const a: DauArticle = { ...art(1, '852872000000', 'TELEVISEURS', 800_000, 30, 0, 459_740), customs_value_xaf: null, taxes: [] };
    expect(one(a).findings.map((f) => f.kind)).toEqual(['unreadable']);
  });

  it('une exonération totale (E00, seule la DEA) : pas de constat de taux', () => {
    const a: DauArticle = {
      n: 3, code: '870190110000', description: 'TRACTEUR AGRICOLE', origin: 'CN', quantity: 1, gross_kg: null, net_kg: null,
      customs_value_xaf: 9_265_805, additional_code: 'E00', taxes: [{ code: 'DEA', base_xaf: 9_265_805, rate_pct: 1, amount_xaf: 92_658 }],
    };
    expect(one(a).findings).toEqual([]);
  });

  it('un abattement A30 : les taux déduits des montants restent les taux nominaux', () => {
    const l = liquidate({ customsValue: 1_000_000, dutyRate: 30, exciseRate: 0, vatExempt: false, abatementPct: 30 });
    const a: DauArticle = {
      ...art(1, '852872000000', 'TELEVISEURS', 1_000_000, 30, 0, 0),
      additional_code: 'A30',
      taxes: l.lines.map((x) => ({ code: x.code, base_xaf: x.base, rate_pct: null, amount_xaf: x.amount })),
    };
    expect(one(a).findings).toEqual([]);
  });
});

describe('lecture nettoyée', () => {
  it('types forcés, montants positifs, dates ISO seulement', () => {
    const e = cleanExtraction({
      dau_number: ' SDSD2-2026-IMP-020399-I ', registered_on: '17/09/2026', paid_on: '2026-09-17', released: 'oui',
      articles: [{ n: '9', code: '8418.21.00.0000', description: 'REGULATEUR', customs_value_xaf: '150 000', taxes: [{ code: 'ddi', amount_xaf: -5, rate_pct: '30' }, { code: '', amount_xaf: 3 }] }],
    });
    expect(e.dau_number).toBe('SDSD2-2026-IMP-020399-I');
    expect(e.registered_on).toBeNull();
    expect(e.paid_on).toBe('2026-09-17');
    expect(e.released).toBeNull();
    expect(e.articles[0]).toMatchObject({ n: 9, code: '841821000000', customs_value_xaf: 150_000 });
    expect(e.articles[0].taxes).toEqual([{ code: 'DDI', base_xaf: null, rate_pct: 30, amount_xaf: 0 }]);
  });

  it('un 29 février + 3 ans : le 28 février', () => {
    expect(addYears('2028-02-29', 3)).toBe('2031-02-28');
  });
});
