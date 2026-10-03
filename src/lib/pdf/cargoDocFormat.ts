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

/**
 * Coupe un texte pour une colonne de `width` points en corps `size` : un
 * idéogramme compte 1 em, une lettre ≈ 0,56 em. Les mots latins ne sont
 * jamais coupés, sauf s'ils dépassent seuls la colonne (une référence de
 * virement sans espace, une adresse e-mail) : ils le sont alors en tronçons.
 * Les sauts de ligne existants sont gardés ; aucun caractère n'est perdu.
 */
export function wrapText(text: string | null | undefined, width: number, size: number): string {
  if (!text) return '';
  const maxChars = Math.max(4, Math.floor(width / (size * 0.6)));
  // Par caractère complet (Array.from) : une paire de substitution — un émoji, un idéogramme rare — ne se coupe jamais en deux.
  const len = (w: string) => Array.from(w).length;
  const long = (w: string) => len(w) > maxChars && !CJK_BREAK.test(w);
  const chunks = (w: string) => { const cp = Array.from(w); const out: string[] = []; for (let i = 0; i < cp.length; i += maxChars) out.push(cp.slice(i, i + maxChars).join('')); return out; };
  return text.split('\n').map((para) => {
    if (!CJK_BREAK.test(para) && !para.split(/[ \t]+/).some(long)) return para;
    const tokens = (para.match(TOKENS) ?? []).flatMap((tok) => (long(tok) ? chunks(tok) : [tok]));
    const lines: string[] = [];
    let line = '';
    let w = 0;
    for (const tok of tokens) {
      const space = /^[ \t]+$/.test(tok);
      const tw = CJK_BREAK.test(tok) ? size : space ? size * 0.28 : len(tok) * size * 0.56;
      if (!space && line.trim() && w + tw > width) {
        lines.push(line.trimEnd());
        line = tok;
        w = tw;
      } else if (!(space && !line)) {
        line += tok;
        w += tw;
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
    return lines.join('\n');
  }).join('\n');
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
  const extra = [c.wechat && !same(c.wechat) ? `WeChat ${c.wechat}` : null, c.whatsapp && !same(c.whatsapp) ? `WhatsApp ${cnPhone(c.whatsapp)}` : null];
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
