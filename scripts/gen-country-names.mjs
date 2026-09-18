#!/usr/bin/env node
/**
 * gen-country-names.mjs — génère src/data/countryNames.generated.ts
 *
 * Source : la liste des pays que libphonenumber-js sait numéroter (245 codes
 * ISO 3166-1 alpha-2) et les libellés CLDR de Node (Intl.DisplayNames) en
 * français, anglais et chinois. On fige le résultat dans un fichier TS :
 * l'application ne dépend ainsi ni de la version ICU du navigateur, ni de
 * l'ordre dans lequel un vieux Safari sait — ou non — nommer une région.
 *
 * Relancer après une montée de version de libphonenumber-js :
 *   node scripts/gen-country-names.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getCountries } = require('libphonenumber-js');

const LANGS = ['fr', 'en', 'zh'];
const names = Object.fromEntries(LANGS.map((l) => [l, new Intl.DisplayNames([l], { type: 'region', style: 'short' })]));

/** Libellés CLDR trop administratifs pour un opérateur : on les raccourcit. */
const OVERRIDES = {
  HK: ['Hong Kong', 'Hong Kong', '香港'],
  MO: ['Macao', 'Macau', '澳门'],
  CD: ['RD Congo', 'DR Congo', '刚果（金）'],
  CG: ['Congo-Brazzaville', 'Congo-Brazzaville', '刚果（布）'],
  CF: ['République centrafricaine', 'Central African Republic', '中非共和国'],
  US: ['États-Unis', 'United States', '美国'],
  GB: ['Royaume-Uni', 'United Kingdom', '英国'],
  AE: ['Émirats arabes unis', 'United Arab Emirates', '阿拉伯联合酋长国'],
  VA: ['Vatican', 'Vatican City', '梵蒂冈'],
  PS: ['Palestine', 'Palestine', '巴勒斯坦'],
  MM: ['Myanmar (Birmanie)', 'Myanmar (Burma)', '缅甸'],
  TA: ['Tristan da Cunha', 'Tristan da Cunha', '特里斯坦-达库尼亚'],
  AC: ["Île de l'Ascension", 'Ascension Island', '阿森松岛'],
};

const isos = [...getCountries()].sort();
const rows = isos.map((iso) => {
  const ov = OVERRIDES[iso];
  const vals = ov ?? LANGS.map((l) => names[l].of(iso) ?? iso);
  // Apostrophe typographique → droite : les libellés stockés en base
  // (« Côte d'Ivoire ») utilisent l'apostrophe droite.
  const clean = vals.map((v) => v.replace(/’/g, "'"));
  return `  ${iso}: [${clean.map((v) => JSON.stringify(v)).join(', ')}],`;
});

const out = `// GÉNÉRÉ par scripts/gen-country-names.mjs — ne pas éditer à la main.
// ${isos.length} pays (ceux que libphonenumber-js sait numéroter), libellés
// CLDR en [fr, en, zh]. Relancer le script après une montée de version.

export type CountryNameTriple = readonly [fr: string, en: string, zh: string];

export const COUNTRY_NAMES: Readonly<Record<string, CountryNameTriple>> = {
${rows.join('\n')}
};
`;

const target = resolve(process.cwd(), 'src/data/countryNames.generated.ts');
writeFileSync(target, out);
console.log(`${isos.length} pays → ${target}`);
