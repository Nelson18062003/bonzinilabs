// ============================================================
// La nomenclature générée (public/data/customs/nomenclature-cm.v1.json) et la
// recherche. Chaque code du vocabulaire du marché doit exister : une faute de
// frappe dans un code SH enverrait un client vers le mauvais taux.
// ============================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseNomenclature, searchTariff, matchTerms, normalize, defaultRate, lineContext, type RawNomenclature } from '@/lib/customs/nomenclature';
import { MARKET_TERMS } from '@/lib/customs/marketTerms';
import { matchSpec } from '@/lib/customs/hsCode';
import { HIGH, MEDIUM, REDUCED, GENERAL } from '@/lib/customs/excise';
import { ANNEX_I, AGRICULTURE } from '@/lib/customs/vatExempt';

const raw = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/data/customs/nomenclature-cm.v1.json'), 'utf8')) as RawNomenclature;
const nom = parseNomenclature(raw);
const first = (q: string) => searchTariff(nom, q)[0]?.line.code;
const codes = (q: string, n = 10) => searchTariff(nom, q, n).map((h) => h.line.code);

describe('nomenclature SH 2022', () => {
  it('21 sections, 96 chapitres, 1 228 positions, 5 612 sous-positions', () => {
    expect(nom.sections.size).toBe(21);
    expect(nom.chapters.size).toBe(96);
    expect(nom.headings.size).toBe(1228);
    expect(nom.lines.length).toBe(5612);
  });

  it('chaque sous-position a un libellé français', () => {
    expect(nom.lines.every((l) => l.fr.length > 2)).toBe(true);
    expect(nom.chapters.get('03')!.fr).toBe('Poissons et crustacés, mollusques et autres invertébrés aquatiques');
  });

  it('les taux sont ceux de la DAU CAMCIS de septembre 2026 sur les lignes qu’elle porte', () => {
    const rate = (c: string) => defaultRate(nom.byCode.get(c)!);
    expect(rate('841821')).toBe(30); // réfrigérateur
    expect(rate('850440')).toBe(10); // convertisseurs
    expect(rate('903289')).toBe(10); // régulateurs automatiques
    expect(rate('940370')).toBe(30); // meubles en plastique
    expect(rate('481820')).toBe(30); // mouchoirs
    expect(rate('852872')).toBe(30); // téléviseurs
    expect(rate('761010')).toBe(20); // fenêtres en aluminium
  });

  it('plus de 90 % des taux sont relevés exactement, les autres sont marqués déduits', () => {
    const exact = nom.lines.filter((l) => l.rateHow === 0).length;
    expect(exact / nom.lines.length).toBeGreaterThan(0.9);
    expect(nom.byCode.get('851713')!.rateHow).toBe(1); // SH 2022, absent du SH 2017
  });

  it('le contexte d’une ligne donne sa position et son chapitre', () => {
    const c = lineContext(nom, '851713');
    expect(c.heading!.fr).toMatch(/Postes téléphoniques/);
    expect(c.chapter!.section).toBe('XVI');
  });
});

describe('les listes du CGI pointent vers des codes SH 2022 qui existent', () => {
  // Une ligne nationale que CAMCIS garde ouverte hors SH 2022 (code-sh-tracteur.md §1).
  const LEGACY = new Set(['87019011']);
  /** Au moins une sous-position de la nomenclature relève de la spécification. */
  const resolves = (spec: string) => LEGACY.has(spec) || nom.lines.some((l) => matchSpec(l.code, spec) !== 'no');
  const all = (label: string, specs: string[]) => it(label, () => {
    expect(specs.filter((s) => !resolves(s))).toEqual([]);
  });
  all('accises (art. 142, annexe II)', [HIGH, MEDIUM, REDUCED, GENERAL].flat().flatMap((t) => [...t.specs, ...(t.except ?? [])]));
  all('TVA — annexe I', ANNEX_I.map(([s]) => s));
  all('TVA — liste agricole', AGRICULTURE.map(([s]) => s));
});

describe('vocabulaire du marché', () => {
  it('chaque code du vocabulaire existe dans la nomenclature', () => {
    const missing = MARKET_TERMS.flatMap((t) => t.codes).filter((c) => !nom.byCode.has(c));
    expect(missing).toEqual([]);
  });

  it('normalize : sans accents ni ponctuation, idéogrammes gardés', () => {
    expect(normalize('Mèches brésiliennes !')).toBe('meches bresiliennes');
    expect(normalize('手机')).toBe('手机');
  });

  it('« mèches », « okada », « friperie », « 手机 », « 假发 »', () => {
    expect(first('mèches')).toBe('670411');
    expect(first('okada')).toBe('871120');
    expect(first('friperie')).toBe('630900');
    expect(first('手机')).toBe('851713');
    expect(first('假发')).toBe('670411');
  });

  it('« régulateur » mène au 85.04, avec le piège du réfrigérateur', () => {
    const hit = searchTariff(nom, 'régulateur')[0];
    expect(hit.line.code).toBe('850440');
    expect(hit.via).toBe('term');
    expect(hit.term!.tip).toMatch(/35 779/);
  });

  it('« chaises plastiques » : un siège (94.01), jamais un meuble 94.03', () => {
    expect(first('chaises plastiques')).toBe('940180');
    expect(matchTerms('chaises plastiques')[0].tip).toMatch(/94\.01/);
  });
});

describe('recherche', () => {
  it('par numéro, quelle que soit l’écriture', () => {
    expect(codes('8517.13')).toEqual(['851713']);
    expect(codes('870193.00.1000')).toEqual(['870193']);
    expect(codes('8517', 50).every((c) => c.startsWith('8517'))).toBe(true);
  });

  it('par les mots du libellé, sans accents ni pluriels', () => {
    expect(codes('cellules photovoltaiques')).toContain('854143');
    expect(codes('pneumatiques rechapes')).toContain('401220');
    expect(codes('perruques synthetiques')).toContain('670411');
    expect(codes('smartphones')).toContain('851713');
  });

  it('une requête vide ne renvoie rien', () => {
    expect(searchTariff(nom, '   ')).toEqual([]);
  });
});
