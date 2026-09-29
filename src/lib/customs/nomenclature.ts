/**
 * La nomenclature du simulateur : lecture du fichier généré par
 * scripts/customs/build-nomenclature.mjs, et recherche.
 *
 * La recherche fait ce que fait un bon déclarant : un numéro → la ligne ; un mot
 * du marché (« mèches », « okada », « 手机 ») → les codes où on le range, avec le
 * piège à éviter ; sinon les mots du libellé officiel, sans accents ni pluriels.
 */
import { MARKET_TERMS, type MarketTerm } from './marketTerms';
import { hsDigits, isHsCode } from './hsCode';

export const NOMENCLATURE_URL = '/data/customs/nomenclature-cm.v1.json';

export interface RawNomenclature {
  v: number;
  ref: string;
  sources: Record<string, string>;
  sections: [string, string, string][];
  chapters: [string, string, string, string][];
  headings: [string, string, string][];
  lines: [string, string, string, number | null, number | null, 0 | 1 | 2 | null][];
}

export interface TariffLine {
  code: string;
  fr: string;
  en: string;
  /** Taux TEC appliqué, en %. Min ≠ max quand les lignes nationales diffèrent. */
  rateMin: number | null;
  rateMax: number | null;
  /** 0 : relevé exact · 1 : déduit des lignes voisines (5 chiffres) · 2 : déduit de la position · null : inconnu */
  rateHow: 0 | 1 | 2 | null;
}

export interface Nomenclature {
  ref: string;
  sources: Record<string, string>;
  sections: Map<string, { fr: string; en: string }>;
  chapters: Map<string, { fr: string; en: string; section: string }>;
  headings: Map<string, { fr: string; en: string }>;
  lines: TariffLine[];
  byCode: Map<string, TariffLine>;
}

export function parseNomenclature(raw: RawNomenclature): Nomenclature {
  const lines: TariffLine[] = raw.lines.map(([code, fr, en, rateMin, rateMax, rateHow]) => ({ code, fr, en, rateMin, rateMax, rateHow }));
  return {
    ref: raw.ref,
    sources: raw.sources,
    sections: new Map(raw.sections.map(([r, fr, en]) => [r, { fr, en }])),
    chapters: new Map(raw.chapters.map(([c, fr, en, section]) => [c, { fr, en, section }])),
    headings: new Map(raw.headings.map(([c, fr, en]) => [c, { fr, en }])),
    lines,
    byCode: new Map(lines.map((l) => [l.code, l])),
  };
}

/** Le contexte d'une ligne : chapitre et position, pour lire un libellé court (« Autres »). */
export function lineContext(nom: Nomenclature, code: string) {
  const d = hsDigits(code);
  return {
    chapter: nom.chapters.get(d.slice(0, 2)) ?? null,
    heading: nom.headings.get(d.slice(0, 4)) ?? null,
    line: nom.byCode.get(d.slice(0, 6)) ?? null,
  };
}

/** Le taux à retenir par défaut : le plus élevé quand il y a une fourchette (on ne promet pas le bas). */
export function defaultRate(line: TariffLine): number | null {
  return line.rateMax ?? line.rateMin;
}

// ─── Recherche ──────────────────────────────────────────────────────────────

const STOP = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'en', 'et', 'ou', 'pour', 'a', 'au', 'aux', 'un', 'une', 'd', 'l', 'the', 'of', 'for', 'and', 'with', 'avec', 'sans', 'sur', 'par', 'in', 'or', 'autres', 'autre', 'other', 'n', 'nda', 'a']);

/** minuscules, sans accents, ponctuation → espace ; les idéogrammes sont gardés. */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** Pluriels français et anglais simples : « chaises » → « chaise », « tuyaux » → « tuyau ». */
function stem(w: string): string {
  if (w.length > 4 && /aux$/.test(w)) return w.slice(0, -1);
  if (w.length > 3 && /[sx]$/.test(w)) return w.slice(0, -1);
  return w;
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

const hasCjk = (s: string) => /[㐀-鿿]/.test(s);

export interface SearchHit {
  line: TariffLine;
  score: number;
  via: 'code' | 'term' | 'text';
  /** L'entrée du vocabulaire du marché qui a mené ici. */
  term?: MarketTerm;
}

interface Index {
  words: Map<string, Set<number>>;
  vocab: string[];
}
const indexCache = new WeakMap<Nomenclature, Index>();

function buildIndex(nom: Nomenclature): Index {
  const words = new Map<string, Set<number>>();
  nom.lines.forEach((l, i) => {
    const heading = nom.headings.get(l.code.slice(0, 4));
    const text = `${l.fr} ${l.en} ${heading?.fr ?? ''} ${heading?.en ?? ''}`;
    for (const w of new Set(tokens(text))) {
      let set = words.get(w);
      if (!set) words.set(w, (set = new Set()));
      set.add(i);
    }
  });
  return { words, vocab: [...words.keys()] };
}

function index(nom: Nomenclature): Index {
  let ix = indexCache.get(nom);
  if (!ix) indexCache.set(nom, (ix = buildIndex(nom)));
  return ix;
}

/**
 * Qualité d'une correspondance avec le vocabulaire du marché :
 *   3 — la requête EST le terme (« moto », « sac à main ») ;
 *   2 — la requête contient le terme en mots entiers (« pneus rechapés » contient « pneus ») ;
 *   1 — la requête est le début du terme (on est en train de taper : « motop… »).
 * `full` : le terme couvre toute la requête — rien d'autre n'a été demandé.
 */
interface TermMatch { term: MarketTerm; quality: 1 | 2 | 3; full: boolean }

function rankTerms(query: string): TermMatch[] {
  const q = normalize(query);
  if (!q) return [];
  const qPadded = ` ${q} `;
  const qStems = new Set(tokens(q));
  const out: TermMatch[] = [];
  for (const t of MARKET_TERMS) {
    let best: TermMatch | null = null;
    for (const term of t.terms) {
      const n = normalize(term);
      if (!n) continue;
      let m: TermMatch | null = null;
      if (hasCjk(n)) {
        if (q === n) m = { term: t, quality: 3, full: true };
        else if (q.includes(n)) m = { term: t, quality: 2, full: false };
        else if (hasCjk(q) && n.includes(q)) m = { term: t, quality: 1, full: true };
      } else if (q === n || stem(q) === stem(n) || tokens(q).join(' ') === tokens(n).join(' ')) {
        m = { term: t, quality: 3, full: true };
      } else if (qPadded.includes(` ${n} `)) {
        const nStems = tokens(n);
        m = { term: t, quality: 2, full: [...qStems].every((w) => nStems.includes(w)) };
      } else if (q.length >= 4 && n.startsWith(q)) {
        m = { term: t, quality: 1, full: true };
      }
      if (m && (!best || m.quality > best.quality)) best = m;
    }
    if (best) out.push(best);
  }
  out.sort((a, b) => b.quality - a.quality);
  // Un terme exact rend inutiles les termes qu'on n'a fait qu'effleurer (« moto » ≠ « motopompe »).
  return out[0]?.quality === 3 ? out.filter((m) => m.quality > 1) : out;
}

/** Les termes du marché qui correspondent à la requête, du plus exact au plus lâche. */
export function matchTerms(query: string): MarketTerm[] {
  return rankTerms(query).map((m) => m.term);
}

export function searchTariff(nom: Nomenclature, query: string, limit = 20): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits = new Map<string, SearchHit>();
  const add = (h: SearchHit) => {
    const prev = hits.get(h.line.code);
    if (!prev || prev.score < h.score) hits.set(h.line.code, h);
  };

  // 1. Un numéro : les sous-positions qui commencent par lui.
  if (isHsCode(q)) {
    const d = hsDigits(q);
    const six = d.slice(0, 6);
    for (const l of nom.lines) {
      if (l.code.startsWith(six)) add({ line: l, score: 1000 - (l.code.length - six.length), via: 'code' });
    }
    return [...hits.values()].sort((a, b) => a.line.code.localeCompare(b.line.code)).slice(0, limit);
  }

  // 2. Le vocabulaire du marché : d'abord les termes exacts, dans l'ordre des codes proposés.
  const terms = rankTerms(q);
  for (const m of terms) {
    m.term.codes.forEach((c, k) => {
      const line = nom.byCode.get(c);
      if (line) add({ line, score: 300 + m.quality * 100 - k, via: 'term', term: m.term });
    });
  }
  const covered = terms.some((m) => m.full && m.quality >= 2);

  // 3. Le texte des libellés : on classe par nombre de mots trouvés, puis par rareté.
  // Si un terme du marché couvre toute la requête, le texte ne fait que compléter —
  // « groupe électrogène » ne doit pas tomber sur le 85.01, dont le libellé dit
  // « à l'exclusion des groupes électrogènes ». Si le terme n'en couvre qu'une
  // partie (« pneus rechapés »), le texte qui a TOUS les mots passe devant.
  const textHits: SearchHit[] = [];
  const ix = index(nom);
  const qTokens = [...new Set(tokens(q))];
  if (qTokens.length) {
    const n = nom.lines.length;
    const scores = new Map<number, { matched: number; weight: number }>();
    for (const t of qTokens) {
      const docs = new Set<number>();
      for (const w of t.length >= 3 ? ix.vocab.filter((v) => v.startsWith(t)) : [t]) {
        ix.words.get(w)?.forEach((i) => docs.add(i));
      }
      if (!docs.size) continue;
      const idf = Math.log(1 + n / docs.size);
      docs.forEach((i) => {
        const s = scores.get(i) ?? { matched: 0, weight: 0 };
        s.matched += 1; s.weight += idf;
        scores.set(i, s);
      });
    }
    const need = qTokens.length > 1 ? Math.max(1, qTokens.length - 1) : 1;
    for (const [i, s] of scores) {
      if (s.matched < need) continue;
      const all = qTokens.length > 1 && s.matched === qTokens.length;
      const score = (all ? 700 : s.matched * 20) + s.weight;
      textHits.push({ line: nom.lines[i], score, via: 'text' });
    }
  }
  const byScore = (a: SearchHit, b: SearchHit) => b.score - a.score || a.line.code.localeCompare(b.line.code);
  if (!covered) {
    const complete = textHits.filter((h) => h.score >= 700);
    const partial = textHits.filter((h) => h.score < 700);
    complete.sort(byScore).forEach(add);
    partial.sort(byScore).filter((h) => !hits.has(h.line.code)).slice(0, terms.length ? 3 : limit).forEach(add);
  }

  return [...hits.values()].sort((a, b) => b.score - a.score || a.line.code.localeCompare(b.line.code)).slice(0, limit);
}
