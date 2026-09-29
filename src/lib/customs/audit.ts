/**
 * Vérifier une déclaration (DAU) — le « compliance audit » de Flexport, pour CAMCIS.
 *
 * L'IA LIT la DAU (edge function customs-ai, action read_dau) ; ce module JUGE,
 * sans réseau ni modèle, avec les règles des étapes 1 et 2 :
 *   1. relecture   — les montants lus se recalculent-ils (engine.liquidate) ?
 *   2. même code   — le droit de douane, l'accise et la TVA liquidés sont-ils ceux
 *                    du tarif et du CGI pour le code DÉCLARÉ ?
 *   3. classement  — la désignation (« RÉGULATEUR ») correspond-elle au code
 *                    (« 8418.21 réfrigérateurs ») ? vocabulaire du marché.
 *
 * Deux sommes, parce que deux voies de droit (code des douanes CEMAC 2019) :
 *   - réclamable   — une erreur de LIQUIDATION sur le code déclaré : droits
 *                    indûment perçus, réclamation dans les 3 ans (art. 396) ;
 *   - classement   — l'ESPÈCE ne se rectifie pas après coup (art. 162.2) : retrait
 *                    avant mainlevée (162.3), sinon c'est un gain pour les
 *                    conteneurs suivants.
 * Et un risque : ce que la douane pourrait redresser (un code moins cher que le bon).
 *
 * Validé sur SDSD2-2026-IMP-020399-I, articles 4 à 10 : 307 078 F, dont
 * 58 136 F réclamables (accise des mouchoirs) — docs/cargo/dossiers/
 * 2026-08_CTR-MRSU9909331_BL-271875389/articles-4-a-10_analyse.md.
 * Rien ici n'est une décision : le commissionnaire agréé relit et signe.
 */
import { liquidate, type LiquidationInput } from './engine';
import { exciseFor } from './excise';
import { vatExemption } from './vatExempt';
import { formatHs, hsDigits } from './hsCode';
import { defaultRate, matchTerms, type Nomenclature } from './nomenclature';
import { VEHICLE_FLAT_XAF, type Confidence, type LevyCode } from './levies';

// ─── Ce que l'IA a lu ───────────────────────────────────────────────────────

export interface DauTax {
  /** Le code imprimé sur la DAU : DDI, DAC, DEA, TVA, CAM, CAD, CAF, TCI, TIB… */
  code: string;
  base_xaf: number | null;
  rate_pct: number | null;
  amount_xaf: number;
}

export interface DauArticle {
  n: number;
  /** Le code SH déclaré, chiffres seuls (6 à 12). */
  code: string;
  /** La désignation commerciale saisie par le déclarant. */
  description: string;
  origin: string | null;
  quantity: number | null;
  gross_kg: number | null;
  net_kg: number | null;
  customs_value_xaf: number | null;
  /** Code additionnel (A30, E00…) : abattement ou exonération. */
  additional_code: string | null;
  taxes: DauTax[];
}

export interface DauExtraction {
  dau_number: string | null;
  office: string | null;
  regime: string | null;
  /** AAAA-MM-JJ */
  registered_on: string | null;
  paid_on: string | null;
  /** La mainlevée (bon à enlever) est-elle mentionnée ? null : on ne sait pas. */
  released: boolean | null;
  importer_name: string | null;
  importer_niu: string | null;
  declarant: string | null;
  total_taxes_xaf: number | null;
  articles: DauArticle[];
  /** Ce que la lecture n'a pas pu établir. */
  unreadable: string[];
}

// ─── Nettoyage (ce qui vient d'un modèle n'est jamais pris tel quel) ────────

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/[\s\u00A0\u202F]/g, '').replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown, max = 300): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null);

/** Une extraction propre : types vérifiés, montants >= 0, 200 articles au plus. */
export function cleanExtraction(raw: unknown): DauExtraction {
  const r = (raw ?? {}) as Record<string, unknown>;
  const articles = (Array.isArray(r.articles) ? r.articles : []).slice(0, 200).map((x, i) => {
    const a = (x ?? {}) as Record<string, unknown>;
    const taxes = (Array.isArray(a.taxes) ? a.taxes : []).slice(0, 40).map((t) => {
      const tx = (t ?? {}) as Record<string, unknown>;
      return {
        code: (str(tx.code, 8) ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
        base_xaf: num(tx.base_xaf),
        rate_pct: num(tx.rate_pct),
        amount_xaf: Math.max(0, Math.round(num(tx.amount_xaf) ?? 0)),
      };
    }).filter((t) => t.code);
    const value = num(a.customs_value_xaf);
    return {
      n: Math.round(num(a.n) ?? i + 1),
      code: hsDigits(String(a.code ?? '')).slice(0, 12),
      description: str(a.description, 400) ?? '',
      origin: str(a.origin, 40),
      quantity: num(a.quantity),
      gross_kg: num(a.gross_kg),
      net_kg: num(a.net_kg),
      customs_value_xaf: value != null && value > 0 ? Math.round(value) : null,
      additional_code: str(a.additional_code, 8)?.toUpperCase() ?? null,
      taxes,
    };
  });
  return {
    dau_number: str(r.dau_number, 80),
    office: str(r.office, 80),
    regime: str(r.regime, 40),
    registered_on: date(r.registered_on),
    paid_on: date(r.paid_on),
    released: typeof r.released === 'boolean' ? r.released : null,
    importer_name: str(r.importer_name, 160),
    importer_niu: str(r.importer_niu, 40),
    declarant: str(r.declarant, 160),
    total_taxes_xaf: (() => { const n = num(r.total_taxes_xaf); return n != null && n >= 0 ? Math.round(n) : null; })(),
    articles,
    unreadable: (Array.isArray(r.unreadable) ? r.unreadable : []).map((u) => str(u, 300)).filter((u): u is string => !!u).slice(0, 20),
  };
}

// ─── Les constats ───────────────────────────────────────────────────────────

export type FindingKind =
  | 'unreadable'          // la valeur de l'article n'a pas été lue
  | 'reading'             // les montants lus ne se recalculent pas
  | 'duty_rate'           // droit de douane ≠ tarif, pour le code déclaré
  | 'excise_charged'      // accise liquidée au-delà de ce que prévoit le CGI
  | 'excise_missing'      // accise due et non liquidée
  | 'vat_exempt'          // TVA liquidée sur un produit exonéré
  | 'vat_maybe'           // exonération possible, sous condition
  | 'classification'      // la désignation évoque un autre code
  | 'used_goods';         // friperie, pneus usagés… sans que la désignation le dise

/**
 * La voie :
 *   claim      — réclamation de droits indûment perçus (3 ans) ;
 *   reclassify — retrait avant mainlevée, sinon prochains conteneurs ;
 *   risk       — la douane pourrait redresser ;
 *   check      — à vérifier, sans montant compté.
 */
export type Route = 'claim' | 'reclassify' | 'risk' | 'check';

export interface Finding {
  id: string;
  kind: FindingKind;
  article: number | null;
  route: Route;
  /** > 0 : payé en trop ; < 0 : payé en moins (risque) ; 0 : sans montant. */
  amount_xaf: number;
  confidence: Confidence;
  declared_code: string | null;
  proposed_code: string | null;
  /** Le texte, en français ; `params` permet de le traduire. */
  fr: string;
  params: Record<string, string | number>;
}

export interface ArticleAudit {
  n: number;
  code: string;
  description: string;
  value: number | null;
  /** Ce que la DAU a liquidé, tel que lu. */
  paid: number;
  /** Le recalcul du moteur avec les taux appliqués. */
  recomputed: number | null;
  findings: Finding[];
  /** Réclamable sur cet article (même code), et gain d'un reclassement au-delà. */
  claimable: number;
  reclassify: number;
  risk: number;
}

export interface AuditResult {
  articles: ArticleAudit[];
  findings: Finding[];
  totals: { paid: number; claimable: number; reclassify: number; risk: number };
  /** Paiement (ou enregistrement) + 3 ans. */
  deadline: string | null;
  released: boolean | null;
}

// ─── Les taux réellement appliqués sur la DAU ───────────────────────────────

/** Les codes imprimés, regroupés comme le moteur les calcule. */
const GROUP: Record<string, LevyCode> = {
  DDI: 'DDI', DD: 'DDI', DAC: 'DAC', DA: 'DAC', DEA: 'DEA', RI: 'DEA', TVA: 'TVA',
  CAC: 'CAC', CAM: 'CAC', CAD: 'CAC', CAF: 'CAC',
  TCI: 'TCI', TIB: 'TCI', CCI: 'CCI', CCB: 'CCI', CIA: 'CIA', CIB: 'CIA', PRO: 'PRO',
  DEV: 'DEV', DEW: 'VFX', DEX: 'VFX', DEY: 'VFX',
};

const DUTY_STEPS = [0, 5, 10, 20, 30, 40];
const EXCISE_STEPS = [0, 5, 12.5, 25, 30, 50];
/** Un taux déduit d'un montant arrondi retombe sur le barème s'il en est à moins d'un demi-point. */
const snap = (x: number, steps: number[]) => steps.find((s) => Math.abs(s - x) <= 0.5) ?? Math.round(x * 10) / 10;

interface Applied {
  input: LiquidationInput;
  paid: number;
  byGroup: Partial<Record<LevyCode | 'OTHER', number>>;
}

function appliedOf(a: DauArticle): Applied | null {
  const byGroup: Applied['byGroup'] = {};
  for (const t of a.taxes) {
    const g = GROUP[t.code] ?? 'OTHER';
    byGroup[g] = (byGroup[g] ?? 0) + t.amount_xaf;
  }
  const paid = a.taxes.reduce((n, t) => n + t.amount_xaf, 0);
  const find = (codes: string[]) => a.taxes.find((t) => codes.includes(t.code));
  const ddiLine = find(['DDI', 'DD']);
  const deaLine = find(['DEA', 'RI']);
  const V = a.customs_value_xaf ?? ddiLine?.base_xaf ?? deaLine?.base_xaf ?? (deaLine?.amount_xaf ? deaLine.amount_xaf * 100 : null);
  if (!V || V <= 0) return null;

  // Code additionnel : A30 → 30 % d'abattement ; E00 → exonération (seule la DEA reste).
  const abatement = /^A(\d{2})$/.exec(a.additional_code ?? '');
  const abatementPct = abatement ? Number(abatement[1]) : 0;
  const keep = 1 - abatementPct / 100;
  const onlyDea = (byGroup.DEA ?? 0) > 0 && Object.entries(byGroup).every(([g, v]) => g === 'DEA' || !v);
  // E00 : seule la redevance informatique survit (tracteur, article 3 de la DAU de référence).
  const fullExemption = onlyDea;

  const ddi = byGroup.DDI ?? 0;
  const dutyRate = ddiLine?.rate_pct ?? snap((ddi / keep / V) * 100, DUTY_STEPS);
  const ddiNominal = (V * dutyRate) / 100;
  const dacLine = find(['DAC', 'DA']);
  const dac = byGroup.DAC ?? 0;
  const exciseRate = dacLine?.rate_pct ?? (dac ? snap((dac / keep / (V + ddiNominal)) * 100, EXCISE_STEPS) : 0);

  return {
    paid,
    byGroup,
    input: {
      customsValue: V,
      dutyRate,
      exciseRate,
      vatExempt: !(byGroup.TVA ?? 0),
      usedVehicle: (byGroup.DEV ?? 0) > 0,
      vehicleCount: byGroup.VFX ? Math.max(1, Math.round(byGroup.VFX / VEHICLE_FLAT_XAF)) : undefined,
      abatementPct,
      communityLevies: ['TCI', 'CCI', 'CIA', 'PRO'].some((g) => (byGroup[g as LevyCode] ?? 0) > 0),
      fullExemption,
    },
  };
}

// ─── Le classement vu depuis la désignation ────────────────────────────────

/** Des codes qui supposent un fait que la désignation doit dire. */
const USED_ONLY: { spec: string; words: RegExp; fallback: string; fr: string }[] = [
  { spec: '630900', words: /fripe|friperie|usag|occasion|second[- ]?hand|used|旧/i, fallback: '610910', fr: 'des vêtements usagés (friperie)' },
  { spec: '401220', words: /occasion|usag|rechap|used|旧/i, fallback: '401110', fr: 'des pneus usagés' },
];

const isVehicle = (code: string) => /^(8701|8702|8703|8704|8716)/.test(code);

interface Alternative { code: string; kind: 'classification' | 'used_goods'; tip?: string; what?: string }

function alternativeFor(nom: Nomenclature, a: DauArticle): Alternative | null {
  const code6 = a.code.slice(0, 6);
  const trap = USED_ONLY.find((t) => code6.startsWith(t.spec));
  const terms = matchTerms(a.description);
  if (trap) {
    if (trap.words.test(a.description)) return null;
    const alt = terms.flatMap((t) => t.codes).find((c) => !c.startsWith(trap.spec) && nom.byCode.has(c)) ?? trap.fallback;
    return nom.byCode.has(alt) ? { code: alt, kind: 'used_goods', what: trap.fr } : null;
  }
  if (!terms.length) return null;
  const all = terms.flatMap((t) => t.codes);
  // Cohérent : un terme reconnu mène au code déclaré, ou à sa position.
  if (all.some((c) => c === code6 || c.slice(0, 4) === code6.slice(0, 4))) return null;
  const best = terms[0];
  const alt = best.codes.find((c) => nom.byCode.has(c));
  return alt ? { code: alt, kind: 'classification', tip: best.tip } : null;
}

// ─── L'audit ────────────────────────────────────────────────────────────────

/** « Meubles en matières plastiques (autres que pour la médecine…) » → « Meubles en matières plastiques ». */
const shortTitle = (s: string) => s.replace(/\s*\([^()]*\)/g, '').replace(/\s*\([^()]*\)/g, '').trim();

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ');
const pctText = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`;

export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  // 29 février + 3 ans → 28 février (le délai ne s'allonge pas).
  const last = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  return `${y + years}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function auditDau(ext: DauExtraction, nom: Nomenclature, opts: { declarationYear?: number } = {}): AuditResult {
  const year = opts.declarationYear ?? (Number((ext.registered_on ?? ext.paid_on ?? '').slice(0, 4)) || new Date().getFullYear());
  const articles: ArticleAudit[] = [];

  for (const a of ext.articles) {
    const findings: Finding[] = [];
    const add = (f: Omit<Finding, 'id' | 'article' | 'declared_code'>) =>
      findings.push({ id: `${a.n}-${f.kind}-${findings.length}`, article: a.n, declared_code: a.code || null, ...f });
    const ap = appliedOf(a);
    const paid = a.taxes.reduce((n, t) => n + t.amount_xaf, 0);

    if (!ap) {
      add({ kind: 'unreadable', route: 'check', amount_xaf: 0, confidence: 'a_verifier', proposed_code: null,
        fr: `Article ${a.n} : la valeur en douane n'a pas pu être lue.`, params: { n: a.n } });
      articles.push({ n: a.n, code: a.code, description: a.description, value: null, paid, recomputed: null, findings, claimable: 0, reclassify: 0, risk: 0 });
      continue;
    }

    const base = liquidate(ap.input).total;
    const tol = Math.max(50, paid * 0.001);
    // Le point de départ des économies : ce qui a été payé, si la lecture se recalcule ;
    // sinon le recalcul (un montant mal lu ne doit pas devenir un trop-perçu).
    const readOk = Math.abs(paid - base) <= tol;
    const ref = readOk ? paid : base;
    if (!readOk) {
      add({ kind: 'reading', route: 'check', amount_xaf: 0, confidence: 'a_verifier', proposed_code: null,
        fr: `Les montants lus (${fmt(paid)} F) ne se recalculent pas (${fmt(base)} F avec les taux appliqués) : vérifiez la lecture avant de conclure.`,
        params: { paid, recomputed: base } });
    }

    const code6 = a.code.slice(0, 6);
    const line = nom.byCode.get(code6) ?? null;
    let corrected: LiquidationInput = { ...ap.input };

    // 2. Même code : le tarif, le CGI. Pas pour une exonération totale ni un véhicule
    //    (l'âge et la cylindrée décident, la DAU ne les porte pas).
    if (!ap.input.fullExemption && line) {
      const official = line.rateMin === line.rateMax ? line.rateMax : null;
      if (official != null && Math.abs(official - ap.input.dutyRate) > 0.25) {
        const amount = ref - liquidate({ ...ap.input, dutyRate: official }).total;
        add({ kind: 'duty_rate', route: amount > 0 ? 'claim' : 'risk', amount_xaf: amount, confidence: 'a_verifier', proposed_code: null,
          fr: `Droit de douane appliqué : ${pctText(ap.input.dutyRate)}. Le tarif donne ${pctText(official)} pour le ${formatHs(code6)} — à confirmer sur le tarif intégré CAMCIS.`,
          params: { applied: ap.input.dutyRate, official, code: formatHs(code6) } });
        corrected = { ...corrected, dutyRate: official };
      }

      if (!isVehicle(code6)) {
        const ex = exciseFor({ code: a.code, declarationYear: year });
        if (ex.certainty === 'sure' && Math.abs(ex.rate - ap.input.exciseRate) > 0.25) {
          const amount = ref - liquidate({ ...ap.input, exciseRate: ex.rate }).total;
          const over = ex.rate < ap.input.exciseRate;
          add({
            kind: over ? 'excise_charged' : 'excise_missing', route: over ? 'claim' : 'risk', amount_xaf: amount,
            // L'accise « au niveau de la position » est une pratique CAMCIS possible : on ne tranche pas seul.
            confidence: over ? 'a_verifier' : 'officiel', proposed_code: null,
            fr: over
              ? ex.rate === 0
                ? `Accise de ${pctText(ap.input.exciseRate)} liquidée, alors que le ${formatHs(code6)} n'est pas dans l'annexe II du CGI.${ex.note ? ' ' + ex.note : ''}`
                : `Accise liquidée à ${pctText(ap.input.exciseRate)} ; le CGI fixe ${pctText(ex.rate)} pour ce code (${ex.basis}).`
              : `Aucune accise, ou trop peu, liquidée : le CGI prévoit ${pctText(ex.rate)} pour le ${formatHs(code6)} (${ex.basis}). La douane peut redresser.`,
            params: { applied: ap.input.exciseRate, official: ex.rate, code: formatHs(code6) },
          });
          corrected = { ...corrected, exciseRate: ex.rate };
        }
      }

      const vat = vatExemption(a.code, false);
      if (!ap.input.vatExempt && vat.exempt === 'yes') {
        const amount = ref - liquidate({ ...ap.input, vatExempt: true }).total;
        add({ kind: 'vat_exempt', route: 'claim', amount_xaf: amount, confidence: 'a_verifier', proposed_code: null,
          fr: `TVA liquidée alors que le ${formatHs(code6)} figure parmi les exonérations (${vat.label}). L'exonération se demande : vérifiez qu'elle pouvait l'être.`,
          params: { code: formatHs(code6), label: vat.label ?? '' } });
        corrected = { ...corrected, vatExempt: true };
      } else if (!ap.input.vatExempt && vat.exempt === 'maybe') {
        const amount = ref - liquidate({ ...ap.input, vatExempt: true }).total;
        add({ kind: 'vat_maybe', route: 'check', amount_xaf: amount, confidence: 'a_verifier', proposed_code: null,
          fr: `Exonération de TVA possible (${fmt(amount)} F) : ${vat.condition ?? vat.label}`,
          params: { amount, condition: vat.condition ?? '' } });
      }
    }
    const claimable = Math.max(0, ref - liquidate(corrected).total);

    // 3. Le classement.
    let reclassify = 0;
    let risk = findings.filter((f) => f.route === 'risk').reduce((n, f) => n - f.amount_xaf, 0);
    const alt = ap.input.fullExemption ? null : alternativeFor(nom, a);
    if (alt) {
      const altLine = nom.byCode.get(alt.code)!;
      const altDuty = defaultRate(altLine) ?? ap.input.dutyRate;
      const altEx = isVehicle(alt.code) ? ap.input.exciseRate : exciseFor({ code: alt.code, declarationYear: year });
      const altTotal = liquidate({
        ...ap.input,
        dutyRate: altDuty,
        exciseRate: typeof altEx === 'number' ? altEx : altEx.rate,
        vatExempt: ap.input.vatExempt || vatExemption(alt.code, false).exempt === 'yes',
      }).total;
      const amount = ref - altTotal;
      const declared = line ? shortTitle(line.fr) : '';
      const route: Route = amount > tol ? 'reclassify' : amount < -tol ? 'risk' : 'check';
      const tail = route === 'risk' ? ' Le bon code coûterait plus : la douane peut redresser.'
        : route === 'check' ? ' Même coût, mais un code faux expose à un contrôle.' : '';
      add({
        kind: alt.kind, route, amount_xaf: route === 'check' ? 0 : amount,
        confidence: alt.kind === 'used_goods' ? 'a_verifier' : 'marche', proposed_code: alt.code,
        fr: alt.kind === 'used_goods'
          ? `Le ${formatHs(code6)} vise ${alt.what}. Si la marchandise est neuve, elle relève d'un autre code, par exemple le ${formatHs(alt.code)} (${shortTitle(altLine.fr)}).${tail}`
          : `« ${a.description} » évoque le ${formatHs(alt.code)} (${shortTitle(altLine.fr)}), pas le ${formatHs(code6)}${declared ? ` (${declared})` : ''}.${alt.tip ? ' ' + alt.tip : ''}${tail}`,
        params: { designation: a.description, declared: formatHs(code6), proposed: formatHs(alt.code), what: alt.what ?? '' },
      });
      if (route === 'reclassify') reclassify = Math.max(0, amount - claimable);
      if (route === 'risk') risk += -amount;
    }

    articles.push({ n: a.n, code: a.code, description: a.description, value: ap.input.customsValue, paid, recomputed: base, findings, claimable, reclassify, risk });
  }

  const sum = (k: 'paid' | 'claimable' | 'reclassify' | 'risk') => articles.reduce((n, x) => n + x[k], 0);
  const start = ext.paid_on ?? ext.registered_on;
  return {
    articles,
    findings: articles.flatMap((x) => x.findings),
    totals: { paid: sum('paid'), claimable: sum('claimable'), reclassify: sum('reclassify'), risk: sum('risk') },
    deadline: start ? addYears(start, 3) : null,
    released: ext.released,
  };
}

/** Jours restants avant la date limite (négatif : dépassée). */
export function daysUntil(isoDate: string, today = new Date()): number {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((Date.parse(`${isoDate}T00:00:00Z`) - t) / 86_400_000);
}
