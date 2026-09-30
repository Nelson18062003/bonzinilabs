#!/usr/bin/env node
/**
 * build-nomenclature.mjs — génère public/data/customs/nomenclature-cm.v1.json
 *
 * La nomenclature du simulateur de droits (docs/douane/00-plan.md) : le Système
 * harmonisé 2022 aux niveaux chapitre (2), position (4) et sous-position (6), avec
 * libellés français et anglais, et le taux de droit de douane (TEC) que le Cameroun
 * applique à chaque sous-position.
 *
 * Sources ouvertes, téléchargées puis mises en cache :
 *   - libellés FR : Nomenclature combinée de l'UE (Eurostat Comext, CN.txt, FRENCH).
 *     Les 6 premiers chiffres de la NC sont ceux du SH de l'OMD : on ne garde que
 *     les niveaux 2/4/6, valides au 01/01/2026 (SH 2022).
 *   - libellés EN + sections : github.com/datasets/harmonized-system (SH 2022, OMD).
 *   - taux : OMC/CNUCED TRAINS via WITS (Banque mondiale), Cameroun (code 120),
 *     tarif NPF appliqué 2019, en SH 2017 — la dernière année publiée. Vérifié égal
 *     aux taux de la DAU CAMCIS du 17/09/2026 sur les 8 lignes qu'elle porte
 *     (docs/cargo/dossiers/2026-08_CTR-MRSU9909331_BL-271875389/articles-4-a-10_analyse.md).
 *
 * Une sous-position SH 2022 absente du SH 2017 prend la fourchette des lignes
 * TRAINS de même préfixe à 5, puis 4 chiffres : son taux est marqué « déduit ».
 *
 * Relancer à chaque changement de source :
 *   node scripts/customs/build-nomenclature.mjs
 * Cache : $CUSTOMS_CACHE_DIR, sinon le dossier temporaire du système.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(new URL('../..', import.meta.url).pathname);
const OUT = join(ROOT, 'public/data/customs/nomenclature-cm.v1.json');
const CACHE = process.env.CUSTOMS_CACHE_DIR ?? join(tmpdir(), 'bonzini-customs-cache');
const REF_DATE = '2026-01-01';

const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/files/?file=comext%2FCOMEXT_METADATA%2FCLASSIFICATIONS_AND_RELATIONS%2FCLASSIFICATIONS%2FFRENCH%2F';
const SOURCES = {
  cnFr: { url: `${EUROSTAT}CN.txt`, file: 'CN_FR.txt' },
  sectionsFr: { url: `${EUROSTAT}CN_SECTIONS.txt`, file: 'CN_SECTIONS_FR.txt' },
  hsEn: { url: 'https://raw.githubusercontent.com/datasets/harmonized-system/master/data/harmonized-system.csv', file: 'harmonized-system.csv' },
  sectionsEn: { url: 'https://raw.githubusercontent.com/datasets/harmonized-system/master/data/sections.csv', file: 'sections.csv' },
  trains: { url: 'https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/120/partner/000/product/all/year/2019/datatype/reported', file: 'TRN_CMR_2019.xml' },
};

async function fetchCached({ url, file }) {
  mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, file);
  if (!existsSync(path)) {
    process.stdout.write(`↓ ${file} … `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    console.log('ok');
  }
  return readFileSync(path, 'utf8').replace(/^﻿/, '');
}

/** CSV minimal (guillemets doublés, virgules dans les champs). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** « 31/12/2500 » → « 2500-12-31 » */
const isoDate = (d) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];

/** « ANIMAUX VIVANTS » → « Animaux vivants » ; le reste tel quel. */
function sentenceCase(s) {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t !== t.toUpperCase()) return t;
  const low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/** Les libellés EN du jeu OMD commencent souvent par « Horses; live, … » : on garde tel quel, nettoyé. */
const clean = (s) => s.trim().replace(/\s+/g, ' ').replace(/[,;]$/, '');

/**
 * Intitulés officiels des chapitres du SH, en français. La NC d'Eurostat ne les
 * donne qu'en capitales sans accents (« POISSONS ET CRUSTACES ») : on les écrit.
 * Le chapitre 77 est réservé par l'OMD ; le 99 du jeu anglais n'est qu'un
 * « non spécifié » statistique, sans objet pour un tarif.
 */
const CHAPTERS_FR = {
  '01': 'Animaux vivants',
  '02': 'Viandes et abats comestibles',
  '03': 'Poissons et crustacés, mollusques et autres invertébrés aquatiques',
  '04': "Lait et produits de la laiterie ; œufs d'oiseaux ; miel naturel ; produits comestibles d'origine animale, non dénommés ni compris ailleurs",
  '05': "Autres produits d'origine animale, non dénommés ni compris ailleurs",
  '06': 'Plantes vivantes et produits de la floriculture',
  '07': 'Légumes, plantes, racines et tubercules alimentaires',
  '08': "Fruits comestibles ; écorces d'agrumes ou de melons",
  '09': 'Café, thé, maté et épices',
  '10': 'Céréales',
  '11': 'Produits de la minoterie ; malt ; amidons et fécules ; inuline ; gluten de froment',
  '12': 'Graines et fruits oléagineux ; graines, semences et fruits divers ; plantes industrielles ou médicinales ; pailles et fourrages',
  '13': 'Gommes, résines et autres sucs et extraits végétaux',
  '14': "Matières à tresser et autres produits d'origine végétale, non dénommés ni compris ailleurs",
  '15': "Graisses et huiles animales, végétales ou d'origine microbienne et produits de leur dissociation ; graisses alimentaires élaborées ; cires d'origine animale ou végétale",
  '16': "Préparations de viande, de poissons, de crustacés, de mollusques ou d'autres invertébrés aquatiques, ou d'insectes",
  '17': 'Sucres et sucreries',
  '18': 'Cacao et ses préparations',
  '19': "Préparations à base de céréales, de farines, d'amidons, de fécules ou de lait ; pâtisseries",
  '20': "Préparations de légumes, de fruits ou d'autres parties de plantes",
  '21': 'Préparations alimentaires diverses',
  '22': 'Boissons, liquides alcooliques et vinaigres',
  '23': 'Résidus et déchets des industries alimentaires ; aliments préparés pour animaux',
  '24': "Tabacs et succédanés de tabac fabriqués ; produits contenant de la nicotine destinés à l'inhalation sans combustion ou à l'absorption",
  '25': 'Sel ; soufre ; terres et pierres ; plâtres, chaux et ciments',
  '26': 'Minerais, scories et cendres',
  '27': 'Combustibles minéraux, huiles minérales et produits de leur distillation ; matières bitumineuses ; cires minérales',
  '28': "Produits chimiques inorganiques ; composés inorganiques ou organiques de métaux précieux, d'éléments radioactifs, de métaux des terres rares ou d'isotopes",
  '29': 'Produits chimiques organiques',
  '30': 'Produits pharmaceutiques',
  '31': 'Engrais',
  '32': 'Extraits tannants ou tinctoriaux ; pigments et autres matières colorantes ; peintures et vernis ; mastics ; encres',
  '33': 'Huiles essentielles et résinoïdes ; produits de parfumerie ou de toilette préparés et préparations cosmétiques',
  '34': "Savons, agents de surface organiques, préparations pour lessives, préparations lubrifiantes, cires, produits d'entretien, bougies, pâtes à modeler",
  '35': "Matières albuminoïdes ; produits à base d'amidons ou de fécules modifiés ; colles ; enzymes",
  '36': 'Poudres et explosifs ; articles de pyrotechnie ; allumettes ; alliages pyrophoriques ; matières inflammables',
  '37': 'Produits photographiques ou cinématographiques',
  '38': 'Produits divers des industries chimiques',
  '39': 'Matières plastiques et ouvrages en ces matières',
  '40': 'Caoutchouc et ouvrages en caoutchouc',
  '41': 'Peaux (autres que les pelleteries) et cuirs',
  '42': 'Ouvrages en cuir ; articles de bourrellerie ou de sellerie ; articles de voyage, sacs à main et contenants similaires ; ouvrages en boyaux',
  '43': 'Pelleteries et fourrures ; pelleteries factices',
  '44': 'Bois, charbon de bois et ouvrages en bois',
  '45': 'Liège et ouvrages en liège',
  '46': 'Ouvrages de sparterie ou de vannerie',
  '47': "Pâtes de bois ou d'autres matières fibreuses cellulosiques ; papier ou carton à recycler",
  '48': 'Papiers et cartons ; ouvrages en pâte de cellulose, en papier ou en carton',
  '49': "Produits de l'édition, de la presse ou des autres industries graphiques ; textes manuscrits ou dactylographiés et plans",
  '50': 'Soie',
  '51': 'Laine, poils fins ou grossiers ; fils et tissus de crin',
  '52': 'Coton',
  '53': 'Autres fibres textiles végétales ; fils de papier et tissus de fils de papier',
  '54': 'Filaments synthétiques ou artificiels ; lames et formes similaires en matières textiles synthétiques ou artificielles',
  '55': 'Fibres synthétiques ou artificielles discontinues',
  '56': 'Ouates, feutres et nontissés ; fils spéciaux ; ficelles, cordes et cordages ; articles de corderie',
  '57': 'Tapis et autres revêtements de sol en matières textiles',
  '58': 'Tissus spéciaux ; surfaces textiles touffetées ; dentelles ; tapisseries ; passementeries ; broderies',
  '59': 'Tissus imprégnés, enduits, recouverts ou stratifiés ; articles techniques en matières textiles',
  '60': 'Étoffes de bonneterie',
  '61': 'Vêtements et accessoires du vêtement, en bonneterie',
  '62': "Vêtements et accessoires du vêtement, autres qu'en bonneterie",
  '63': 'Autres articles textiles confectionnés ; assortiments ; friperie et chiffons',
  '64': 'Chaussures, guêtres et articles analogues ; parties de ces objets',
  '65': 'Coiffures et parties de coiffures',
  '66': 'Parapluies, ombrelles, parasols, cannes, fouets, cravaches et leurs parties',
  '67': 'Plumes et duvet apprêtés et articles en plumes ou en duvet ; fleurs artificielles ; ouvrages en cheveux',
  '68': 'Ouvrages en pierres, plâtre, ciment, amiante, mica ou matières analogues',
  '69': 'Produits céramiques',
  '70': 'Verre et ouvrages en verre',
  '71': 'Perles fines ou de culture, pierres gemmes, métaux précieux et ouvrages en ces matières ; bijouterie de fantaisie ; monnaies',
  '72': 'Fonte, fer et acier',
  '73': 'Ouvrages en fonte, fer ou acier',
  '74': 'Cuivre et ouvrages en cuivre',
  '75': 'Nickel et ouvrages en nickel',
  '76': 'Aluminium et ouvrages en aluminium',
  '78': 'Plomb et ouvrages en plomb',
  '79': 'Zinc et ouvrages en zinc',
  '80': 'Étain et ouvrages en étain',
  '81': 'Autres métaux communs ; cermets ; ouvrages en ces matières',
  '82': 'Outils et outillage, articles de coutellerie et couverts de table, en métaux communs',
  '83': 'Ouvrages divers en métaux communs',
  '84': 'Réacteurs nucléaires, chaudières, machines, appareils et engins mécaniques ; parties de ces machines ou appareils',
  '85': "Machines, appareils et matériels électriques et leurs parties ; appareils d'enregistrement ou de reproduction du son et des images",
  '86': 'Véhicules et matériel pour voies ferrées ou similaires et leurs parties ; appareils de signalisation',
  '87': 'Voitures automobiles, tracteurs, cycles et autres véhicules terrestres, leurs parties et accessoires',
  '88': 'Navigation aérienne ou spatiale',
  '89': 'Navigation maritime ou fluviale',
  '90': "Instruments et appareils d'optique, de photographie, de mesure, de contrôle ou de précision ; instruments médico-chirurgicaux",
  '91': 'Horlogerie',
  '92': 'Instruments de musique ; parties et accessoires de ces instruments',
  '93': 'Armes, munitions et leurs parties et accessoires',
  '94': "Meubles ; mobilier médico-chirurgical ; articles de literie ; luminaires et appareils d'éclairage ; enseignes lumineuses ; constructions préfabriquées",
  '95': 'Jouets, jeux, articles pour divertissements ou pour sports ; leurs parties et accessoires',
  '96': 'Ouvrages divers',
  '97': "Objets d'art, de collection ou d'antiquité",
};

async function main() {
  const [cnFr, sectionsFr, hsEn, sectionsEn, trains] = await Promise.all(
    Object.values(SOURCES).map(fetchCached),
  );

  // ── Libellés FR valides au REF_DATE, niveaux 2/4/6 ────────────────────────
  const fr = new Map();
  for (const line of cnFr.split(/\r?\n/)) {
    const [code, start, end, desc] = line.split('\t');
    if (!desc || !/^\d+$/.test(code) || ![2, 4, 6].includes(code.length)) continue;
    if (isoDate(start) <= REF_DATE && REF_DATE <= isoDate(end)) fr.set(code, clean(desc));
  }

  // ── Structure SH 2022 et libellés EN ──────────────────────────────────────
  const en = new Map();
  const sectionOfChapter = new Map();
  for (const r of parseCsv(hsEn)) {
    if (!/^\d+$/.test(r.hscode) || ![2, 4, 6].includes(r.hscode.length)) continue;
    en.set(r.hscode, clean(r.description));
    if (r.hscode.length === 2) sectionOfChapter.set(r.hscode, r.section);
  }

  const secFr = new Map(sectionsFr.split(/\r?\n/).filter(Boolean).map((l) => {
    const [n, name] = l.split('\t');
    return [ROMAN[Number(n) - 1], clean(name)];
  }));
  const secEn = new Map(parseCsv(sectionsEn).map((r) => [r.section, clean(r.name)]));

  // ── Taux TRAINS 2019 (SH 2017) ────────────────────────────────────────────
  const rates = new Map();
  const re = /PRODUCTCODE="(\d{6})"[^>]*>\s*<Obs[^>]*?MIN_RATE="([\d.]+)"\s+MAX_RATE="([\d.]+)"/g;
  for (const m of trains.matchAll(re)) rates.set(m[1], [Number(m[2]), Number(m[3])]);
  if (rates.size < 5000) throw new Error(`TRAINS : ${rates.size} lignes seulement — fichier tronqué ?`);

  const rangeOver = (prefix) => {
    let lo = Infinity, hi = -Infinity;
    for (const [code, [a, b]] of rates) if (code.startsWith(prefix)) { lo = Math.min(lo, a); hi = Math.max(hi, b); }
    return lo === Infinity ? null : [lo, hi];
  };

  // ── Assemblage ────────────────────────────────────────────────────────────
  const codes = [...en.keys()].sort();
  const sections = ROMAN.filter((r) => secEn.has(r)).map((r) => [r, secFr.get(r) ?? secEn.get(r), secEn.get(r)]);
  const chapters = [], headings = [], lines = [];
  const stats = { exact: 0, inferred5: 0, inferred4: 0, none: 0, frMissing: 0 };

  for (const code of codes) {
    if (!CHAPTERS_FR[code.slice(0, 2)]) continue; // 99 / 9999 / 999999 : « non spécifié »
    const f = fr.get(code);
    if (!f && code.length > 2) stats.frMissing++;
    const descFr = code.length === 2 ? CHAPTERS_FR[code] : sentenceCase(f ?? en.get(code));
    const descEn = en.get(code);
    if (code.length === 2) chapters.push([code, descFr, descEn, sectionOfChapter.get(code)]);
    else if (code.length === 4) headings.push([code, descFr, descEn]);
    else {
      // Taux : exact (0), déduit du préfixe à 5 (1) ou 4 chiffres (2), inconnu (null).
      let range = rates.get(code) ?? null, how = 0;
      if (!range) { range = rangeOver(code.slice(0, 5)); how = 1; }
      if (!range) { range = rangeOver(code.slice(0, 4)); how = 2; }
      if (!range) { stats.none++; lines.push([code, descFr, descEn, null, null, null]); continue; }
      stats[['exact', 'inferred5', 'inferred4'][how]]++;
      lines.push([code, descFr, descEn, range[0], range[1], how]);
    }
  }

  const out = {
    v: 1,
    ref: REF_DATE,
    sources: {
      fr: 'Eurostat Comext — Nomenclature combinée, libellés FR (niveaux SH 2/4/6)',
      en: 'OMD Système harmonisé 2022 — github.com/datasets/harmonized-system',
      rates: 'OMC/CNUCED TRAINS via WITS — Cameroun, tarif NPF appliqué 2019 (SH 2017)',
    },
    // Colonnes, pour lire les tableaux sans deviner.
    cols: {
      sections: ['roman', 'fr', 'en'],
      chapters: ['code', 'fr', 'en', 'section'],
      headings: ['code', 'fr', 'en'],
      lines: ['code', 'fr', 'en', 'rateMin', 'rateMax', 'rateHow (0 exact · 1 déduit à 5 chiffres · 2 déduit à 4)'],
    },
    sections, chapters, headings, lines,
  };

  mkdirSync(join(ROOT, 'public/data/customs'), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));
  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(`✓ ${OUT.replace(ROOT + '/', '')} — ${kb} Ko`);
  console.log(`  ${sections.length} sections · ${chapters.length} chapitres · ${headings.length} positions · ${lines.length} sous-positions`);
  console.log(`  taux : ${stats.exact} exacts · ${stats.inferred5} déduits (5) · ${stats.inferred4} déduits (4) · ${stats.none} inconnus`);
  console.log(`  libellés FR manquants (EN à la place) : ${stats.frMissing}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
