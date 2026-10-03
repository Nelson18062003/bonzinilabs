// ============================================================
// LA MISE EN FORME DES DOCUMENTS CARGO (devis, reçu, facture) — les
// fonctions pures, testées (src/tests/lib/cargoDocFormat.test.ts), que le
// gabarit react-pdf appelle. Rien ici ne dessine.
//
// Trois contraintes du moteur PDF expliquent ces fonctions :
//   · les polices embarquées n'ont pas toutes les espaces ni tous les signes
//     d'Unicode : on écrit nos propres séparateurs (espace insécable U+00A0,
//     tiret ASCII), jamais l'espace fine de toLocaleString ni le « − » ;
//   · la césure est coupée (elle écrivait « Nko-lo ») : un mot trop long pour
//     sa colonne doit être coupé ici, à la main ;
//   · le chinois n'a pas d'espaces : sans aide, il ne revient jamais à la ligne.
// ============================================================

export type DocLang = 'fr' | 'en';

export const NBSP = '\u00a0';

/**
 * Les idéogrammes (CJK unifiés, extension A, compatibilité) — écrits en
 * échappements : un éditeur qui normalise en NFC transforme U+F900 en U+8C48,
 * et la plage avalait alors le coréen, les émojis et la zone privée.
 */
const CJK_RANGES = '\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff';
/** … plus la ponctuation chinoise et les formes pleine chasse, pour couper la ligne. */
const CJK_BREAK_RANGES = `${CJK_RANGES}\u3000-\u303f\uff00-\uffef`;
export const CJK = new RegExp(`[${CJK_RANGES}]`);
const CJK_BREAK = new RegExp(`[${CJK_BREAK_RANGES}]`);
// Les espaces où l'on peut couper : l'espace ordinaire et la tabulation — jamais l'insécable (U+00A0), qui lie un nombre à son unité.
const TOKENS = new RegExp(`[${CJK_BREAK_RANGES}]|[ \\t]+|[^ \\t${CJK_BREAK_RANGES}]+`, 'g');
const ZH_RUN = new RegExp(`[${CJK_BREAK_RANGES}]+`, 'g');

/** La police d'un texte : Noto Sans SC dès qu'il contient du chinois. */
export const fontFor = (s: string | null | undefined): 'Noto Sans SC' | 'DM Sans' => (s && CJK.test(s) ? 'Noto Sans SC' : 'DM Sans');

/** La largeur estimée d'un caractère, en em : idéogramme 1, M/W 1, capitale ou chiffre 0,7, minuscule 0,56, espace 0,28. */
const em = (c: string): number => (CJK_BREAK.test(c) ? 1 : c === ' ' || c === '\t' ? 0.28 : /[MW]/.test(c) ? 1 : /[A-Z0-9@]/.test(c) ? 0.7 : 0.56);
/** La largeur estimée d'un texte en points, en corps `size`. */
export const estimateWidth = (w: string, size: number): number => Array.from(w).reduce((sum, c) => sum + em(c), 0) * size;
/** La ponctuation chinoise fermante ne commence jamais une ligne (kinsoku) : elle reste avec le caractère qui la précède. */
const NO_LINE_START = /^[、。，．：；？！）］｝》」』】〕〉〗〙〞]+$/;

/**
 * Coupe un texte pour une colonne de `width` points en corps `size`, selon une
 * estimation de largeur par classe de caractère. Les mots latins ne sont
 * jamais coupés, sauf s'ils dépassent seuls la colonne (une référence de
 * virement sans espace) : ils le sont alors en tronçons, chacun sur sa ligne.
 * Les sauts de ligne existants sont gardés ; aucun caractère n'est perdu ; une
 * paire de substitution (émoji, idéogramme rare) n'est jamais coupée en deux.
 */
export function wrapText(text: string | null | undefined, width: number, size: number): string {
  if (!text) return '';
  const est = (w: string) => estimateWidth(w, size);
  const long = (w: string) => !CJK_BREAK.test(w) && est(w) > width;
  // Tronçons gloutons, à la largeur : deux tronçons du même mot ne se retrouvent jamais sur une ligne.
  const chunks = (w: string) => {
    const out: string[] = [];
    let cur = '';
    for (const c of Array.from(w)) {
      if (cur && est(cur + c) > width) { out.push(cur); cur = ''; }
      cur += c;
    }
    if (cur) out.push(cur);
    return out;
  };
  return text.split('\n').map((para) => {
    if (!CJK_BREAK.test(para) && !para.split(/[ \t]+/).some(long)) return para;
    const tokens: string[] = [];
    for (const tok of (para.match(TOKENS) ?? []).flatMap((t) => (long(t) ? chunks(t).map((c) => `${c}\u0000`) : [t]))) {
      const last = tokens[tokens.length - 1];
      // (avant la marque d'un tronçon forcé, s'il y en a une)
      if (NO_LINE_START.test(tok) && last && !/^[ \t]+$/.test(last)) tokens[tokens.length - 1] = last.endsWith('\u0000') ? `${last.slice(0, -1)}${tok}\u0000` : last + tok;
      else tokens.push(tok);
    }
    const lines: string[] = [];
    let line = '';
    let w = 0;
    for (const raw of tokens) {
      // Un tronçon de mot trop long (marqué ci-dessus) occupe toujours sa propre ligne.
      const forced = raw.endsWith('\u0000');
      const tok = forced ? raw.slice(0, -1) : raw;
      const space = /^[ \t]+$/.test(tok);
      const tw = est(tok);
      if (!space && line.trim() && (forced || w + tw > width)) {
        lines.push(line.trimEnd());
        line = tok;
        w = tw;
      } else if (!(space && !line)) {
        line += tok;
        w += tw;
      }
      if (forced) { lines.push(line.trimEnd()); line = ''; w = 0; }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.join('\n');
  }).join('\n');
}

/**
 * Au plus `maxLines` lignes estimées, « … » en fin. Un texte libre (note, motif,
 * libellé de frais) vit dans un bloc insécable : sans plafond, un bloc plus haut
 * qu'une page serait écrasé par le moteur et se recouvrirait.
 */
export function clampLines(text: string | null | undefined, width: number, size: number, maxLines: number): string {
  const wrapped = wrapText(text, width, size);
  if (!wrapped) return '';
  const out: string[] = [];
  let used = 0;
  for (const line of wrapped.split('\n')) {
    const n = Math.max(1, Math.ceil(estimateWidth(line, size) / width));
    if (used + n > maxLines) {
      const room = Math.max(0, maxLines - used);
      if (room > 0) {
        let cut = '';
        for (const c of Array.from(line)) { if (estimateWidth(`${cut}${c}…`, size) > width * room) break; cut += c; }
        out.push(`${cut.trimEnd()}…`);
      } else if (out.length) out[out.length - 1] = `${out[out.length - 1].replace(/…$/, '')}…`;
      return out.join('\n');
    }
    out.push(line);
    used += n;
  }
  return out.join('\n');
}

/**
 * Les caractères que les polices embarquées savent dessiner : la couverture
 * réelle de DM Sans (latin, 3 graisses — relevée sur les fichiers .woff) et le
 * chinois (Noto Sans SC). Un caractère absent part en Helvetica et se dessine
 * par-dessus le mot voisin : le texte TAPÉ par l'équipe passe donc par
 * pdfSafe (accents du pinyin ramenés à la lettre, flèches en ASCII, émojis ôtés).
 */
const FONT_OK = new RegExp(`^[\n\t\u0020-\u007e\u00a0-\u00ac\u00ae-\u00ff\u0102\u0131\u0152\u0153\u2013\u2014\u2018-\u201a\u201c-\u201e\u2022\u2026\u2039\u203a\u20ac\u2122\u2212${CJK_BREAK_RANGES}]$`);
const SYMBOLS: Record<string, string> = { '\u2192': '->', '\u21d2': '=>', '\u2190': '<-', '\u2194': '<->', '\u2248': '~', '\u2264': '<=', '\u2265': '>=', '\u202f': '\u00a0', '\u2009': ' ', '\u00ad': '' };
export function pdfSafe(text: string | null | undefined): string {
  if (!text) return '';
  return Array.from(text).map((c) => {
    if (FONT_OK.test(c)) return c;
    if (c in SYMBOLS) return SYMBOLS[c];
    const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return base && Array.from(base).every((x) => FONT_OK.test(x)) ? base : '';
  }).join('');
}

/** « 广州鞋业有限公司 Guangzhou Shoes Co. » → { main: 'Guangzhou Shoes Co.', zh: '广州鞋业有限公司' } : le latin en gras, le chinois en ligne grise. */
export function splitZh(v: string): { main: string; zh: string } {
  const zh = (v.match(ZH_RUN) ?? []).join(' ');
  const main = v.replace(ZH_RUN, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  return main ? { main, zh } : { main: zh, zh: '' };
}

/** Un nombre : « 1 234,5 » (fr, espace insécable) ou « 1,234.5 » (en) ; décimales coupées à `maxDec`, au moins `minDec`. */
export function num(v: number | null | undefined, lang: DocLang, maxDec = 0, minDec = 0): string {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  let s = Math.abs(n).toFixed(maxDec);
  if (maxDec > minDec && s.includes('.')) {
    const [i, f] = s.split('.');
    const kept = f.replace(/0+$/, '').padEnd(minDec, '0');
    s = kept ? `${i}.${kept}` : i;
  }
  const [int, frac] = s.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : NBSP);
  const negative = n < 0 && Number(s) !== 0;
  return `${negative ? '-' : ''}${grouped}${frac ? (lang === 'en' ? '.' : ',') + frac : ''}`;
}

/** Un montant entier, sans devise (la colonne dit « XAF »). */
export const money = (v: number | null | undefined, lang: DocLang): string => num(Math.round(Number(v ?? 0)), lang);
export const xaf = (v: number | null | undefined, lang: DocLang): string => `${money(v, lang)}${NBSP}XAF`;
/** Le poids à la précision de la base (NUMERIC(10,2)) : « 8,4 », « 12,35 ». */
export const kg = (v: number | null | undefined, lang: DocLang): string => num(v, lang, 2);
/** Le volume à la précision de la base (NUMERIC(10,4)), au moins deux décimales : « 0,096 », « 2,14 », « 0,0864 ». */
export const m3 = (v: number | null | undefined, lang: DocLang): string => (v == null ? '—' : num(v, lang, 4, 2));

// ── Les dates : dans le fuseau du lieu, jamais celui de l'appareil qui fabrique le PDF ──
export const DOC_TZ = 'Africa/Douala';
export const PLACE_TZ = { guangzhou: 'Asia/Shanghai', douala: 'Africa/Douala', other: 'Africa/Douala' } as const;
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(d: string | Date, tz: string): { y: number; m: number; d: number; hh: string; mm: string } {
  // Une date seule (« 2026-11-05 », colonnes DATE) n'a pas d'heure : on la lit telle quelle, sans décalage.
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return { y, m, d: day, hh: '00', mm: '00' };
  }
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(typeof d === 'string' ? new Date(d) : d).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour, mm: p.minute };
}

/** « 20/09/2026 » (fr) ou « 20 Sep 2026 » (en, insécable) — dans le fuseau `tz` (Douala par défaut). */
export function docDay(d: string | Date | null | undefined, lang: DocLang, tz: string = DOC_TZ): string {
  if (!d) return '';
  const x = parts(d, tz);
  return lang === 'en' ? `${x.d}${NBSP}${EN_MONTHS[x.m - 1]}${NBSP}${x.y}` : `${String(x.d).padStart(2, '0')}/${String(x.m).padStart(2, '0')}/${x.y}`;
}

/** « 20/09/2026 à 14:58 » / « 20 Sep 2026 at 14:58 » — l'heure du lieu de paiement. */
export function docDateTime(d: string | Date, lang: DocLang, tz: string = DOC_TZ): string {
  const x = parts(d, tz);
  return `${docDay(d, lang, tz)} ${lang === 'en' ? 'at' : 'à'}${NBSP}${x.hh}:${x.mm}`;
}

/** Ajoute des jours à une date (la validité du devis), en ISO. */
export const addDays = (d: string | Date, days: number): string => new Date(new Date(d).getTime() + days * 86_400_000).toISOString();

/** Un numéro chinois lisible : « 18667439286 » → « (+86) 186 6743 9286 » ; autre chose reste tel quel. */
export function cnPhone(s: string | null | undefined): string {
  const raw = (s ?? '').trim();
  const d = raw.replace(/\D/g, '').replace(/^86(?=1\d{10}$)/, '');
  return /^1\d{10}$/.test(d) ? `(+86)${NBSP}${d.slice(0, 3)}${NBSP}${d.slice(3, 7)}${NBSP}${d.slice(7)}` : raw;
}

/** « Tina · (+86) 186 6743 9286 (WeChat / WhatsApp) » : un numéro répété n'est écrit qu'une fois. */
export function contactLine(c: { recipient?: string | null; phone?: string | null; wechat?: string | null; whatsapp?: string | null }): string {
  const ph = cnPhone(c.phone);
  const same = (x: string | null | undefined) => !!x && !!ph && cnPhone(x) === ph;
  const apps = [same(c.wechat) ? 'WeChat' : null, same(c.whatsapp) ? 'WhatsApp' : null].filter(Boolean);
  // Un identifiant WeChat ou WhatsApp ne se coupe pas en fin de ligne (« WeChat 138 2229 » / « 7518 »).
  const glue = (x: string) => x.replace(/ /g, NBSP);
  const extra = [c.wechat && !same(c.wechat) ? `WeChat ${glue(cnPhone(c.wechat))}` : null, c.whatsapp && !same(c.whatsapp) ? `WhatsApp ${glue(cnPhone(c.whatsapp))}` : null];
  return [c.recipient || null, ph ? (apps.length ? `${ph} (${apps.join(' / ')})` : ph) : null, ...extra].filter(Boolean).join(' · ');
}

// ── Les lignes de colis ──
export interface ParcelLineLike {
  basis: 'per_kg' | 'per_cbm' | 'fixed';
  unit_price_xaf: number | null;
}

/** L'unité du tarif si TOUS les colis tarifés au poids ou au volume ont la même base ; sinon null (l'unité va sous chaque prix). */
export function rateUnit(parcels: ReadonlyArray<ParcelLineLike>): 'kg' | 'm³' | null {
  const bases = new Set(parcels.filter((l) => l.basis !== 'fixed').map((l) => l.basis));
  if (bases.size !== 1) return null;
  return [...bases][0] === 'per_kg' ? 'kg' : 'm³';
}

/** Le tarif de la ligne de total : commun à tous les colis, « Forfait » s'ils sont tous au forfait, sinon rien. */
export function commonRate(parcels: ReadonlyArray<ParcelLineLike>, lang: DocLang, flatLabel: string): string {
  if (parcels.length === 0) return '';
  if (parcels.every((l) => l.basis === 'fixed')) return flatLabel;
  if (parcels.some((l) => l.basis === 'fixed')) return '';
  const rates = new Set(parcels.map((l) => `${l.basis}:${l.unit_price_xaf}`));
  return rates.size === 1 ? money(parcels[0].unit_price_xaf, lang) : '';
}

/** « 10 cartons » si tous les colis sont du même type, sinon « 10 colis » ; le singulier pour 1 seulement (« 0 parcels »). */
export function countLabel(kinds: ReadonlyArray<string | null | undefined>, names: Record<string, readonly [string, string]>): string {
  const n = kinds.length;
  const set = new Set(kinds.map((k) => k ?? 'other'));
  const [one, many] = names[set.size === 1 ? [...set][0] : 'other'] ?? names.other;
  return `${n}${NBSP}${n === 1 ? one : many}`;
}
