/**
 * La liquidation d'un article de DAU, comme CAMCIS la calcule — puis le coût de
 * revient rendu Cameroun.
 *
 * Le modèle a été reproduit à ±4 F sur les articles 4 à 10 de la DAU
 * SDSD2-2026-IMP-020399-I du 17/09/2026 et sur la simulation RAV4
 * (docs/cargo/dossiers/…/articles-4-a-10_analyse.md,
 *  docs/cargo/simulations/2026-09_toyota-rav4_LVGE656F2MG032343.md) :
 *
 *   DDI  = V × taux TEC
 *   DAC  = (V + DDI) × taux d'accises
 *   DEA  = V × 1 %
 *   TVA  = (V + DDI + DAC + DEA) × 17,5 %
 *   CAC  = TVA × 10 %, ventilée 28 / 10 / 62
 *   TCI 0,6 · CCI 0,4 · CIA 0,2 · PRO 0,05 (% de V) — origine hors CEMAC
 *   DEV  = (V + DDI + DAC + TVA) × 5 %              véhicules d'occasion
 *   un code additionnel (A30) réduit DDI, DAC, DEA, TVA, CAC, TCI, CCI, PRO, DEV
 *   au prorata ; CIA, CIB, CCB, TIB restent pleins.
 *
 * Aucune lecture de base ni de réseau : c'est une règle de calcul, testable.
 */
import {
  CAC_RATE, CAC_SPLIT, CIVIC_XAF, COMMUNITY_PARTS, DEA_RATE, DEV_RATE, LEVIES, PRECOMPTE_RATE,
  PVI_RATE, PVI_THRESHOLD_FOB_XAF, VAT_RATE, VEHICLE_FLAT_XAF, franc, type Confidence, type LevyCode, type TaxRegime,
} from './levies';
import { exciseFor, type ExciseResult, type ExciseRule, type VehicleInfo } from './excise';
import { vatExemption, type VatExemptResult } from './vatExempt';
import { hsDigits, matchAny } from './hsCode';

// ─── 1. La liquidation d'un article ─────────────────────────────────────────

export interface LiquidationInput {
  /** Valeur en douane (CAF), en XAF. */
  customsValue: number;
  /** Taux du droit de douane (TEC), en %. */
  dutyRate: number;
  /** Taux d'accises, en %. */
  exciseRate: number;
  vatExempt: boolean;
  /** Véhicule d'occasion : droits d'enregistrement (DEV) et forfaits. */
  usedVehicle?: boolean;
  /** Nombre de véhicules, pour les forfaits. */
  vehicleCount?: number;
  /** Abattement d'un code additionnel, en % (A30 → 30). */
  abatementPct?: number;
  /** Origine hors CEMAC (Chine) : prélèvements communautaires dus. Vrai par défaut. */
  communityLevies?: boolean;
  /**
   * Exonération totale (code E00 sur la DAU) : seule la redevance informatique
   * survit — observé sur le tracteur, article 3 de SDSD2-2026-IMP-020399-I.
   */
  fullExemption?: boolean;
}

export interface LiquidationLine {
  code: LevyCode;
  label: string;
  /** Assiette, en XAF (0 pour un forfait). */
  base: number;
  /** Taux en %, ou null pour un forfait. */
  rate: number | null;
  amount: number;
  /** Le détail tel qu'imprimé sur la DAU (CAM/CAD/CAF, TCI/TIB…). */
  parts?: { part: string; amount: number }[];
}

export interface Liquidation {
  lines: LiquidationLine[];
  total: number;
}

export function liquidate(i: LiquidationInput): Liquidation {
  if (i.fullExemption) {
    const dea = franc((i.customsValue * DEA_RATE) / 100);
    return { lines: [{ code: 'DEA', label: LEVIES.DEA.label, base: i.customsValue, rate: DEA_RATE, amount: dea }], total: dea };
  }
  const V = i.customsValue;
  const keep = 1 - (i.abatementPct ?? 0) / 100;
  const cut = (x: number, abatable = true) => franc(abatable ? x * keep : x);

  // Les assiettes suivantes se construisent sur les montants nominaux arrondis.
  const ddiN = franc((V * i.dutyRate) / 100);
  const dacN = franc(((V + ddiN) * i.exciseRate) / 100);
  const deaN = franc((V * DEA_RATE) / 100);
  const vatBase = V + ddiN + dacN + deaN;
  const vatExact = i.vatExempt ? 0 : (vatBase * VAT_RATE) / 100;
  const vatN = franc(vatExact);

  const lines: LiquidationLine[] = [];
  const push = (code: LevyCode, base: number, rate: number | null, amount: number, parts?: LiquidationLine['parts']) =>
    lines.push({ code, label: LEVIES[code].label, base, rate, amount, parts });

  push('DDI', V, i.dutyRate, cut(ddiN));
  push('DAC', V + ddiN, i.exciseRate, cut(dacN));
  push('DEA', V, DEA_RATE, cut(deaN));
  push('TVA', vatBase, i.vatExempt ? 0 : VAT_RATE, cut(vatExact));

  const cacParts = CAC_SPLIT.map((share, k) => ({
    part: ['CAM', 'CAD', 'CAF'][k],
    amount: cut((vatExact * CAC_RATE * share) / 10_000),
  }));
  push('CAC', vatN, CAC_RATE, cacParts.reduce((n, p) => n + p.amount, 0), cacParts);

  if (i.communityLevies !== false) {
    for (const code of ['TCI', 'CCI', 'CIA', 'PRO'] as const) {
      const parts = COMMUNITY_PARTS.filter((p) => p.code === code).map((p) => ({
        part: p.part,
        amount: cut((V * p.rate) / 100, p.abatable),
      }));
      const rate = COMMUNITY_PARTS.filter((p) => p.code === code).reduce((n, p) => n + p.rate, 0);
      push(code, V, Math.round(rate * 1000) / 1000, parts.reduce((n, p) => n + p.amount, 0), parts.length > 1 ? parts : undefined);
    }
  }

  if (i.usedVehicle) {
    const devBase = V + ddiN + dacN + vatN;
    push('DEV', devBase, DEV_RATE, cut((devBase * DEV_RATE) / 100));
    push('VFX', 0, null, VEHICLE_FLAT_XAF * Math.max(1, i.vehicleCount ?? 1));
  }

  return { lines, total: lines.reduce((n, l) => n + l.amount, 0) };
}

// ─── 2. La simulation complète ──────────────────────────────────────────────

export type Incoterm = 'EXW' | 'FOB' | 'CFR' | 'CIF';
export type Currency = 'CNY' | 'USD' | 'EUR' | 'XAF';

/** Taux indicatifs, modifiables à l'écran. L'euro est fixe (parité du franc CFA). */
export const DEFAULT_XAF_PER: Record<Currency, number> = { CNY: 80, USD: 575, EUR: 655.957, XAF: 1 };
/** Assurance estimée quand le client n'a pas son certificat (usage : 0,5 % de marchandise + fret). */
export const INSURANCE_ESTIMATE_RATE = 0.5;

export interface SimulationInput {
  /** Le code SH (6 chiffres) ou CAMCIS (12). */
  code: string;
  /** Taux TEC retenu, en %. */
  dutyRate: number;
  goodsAmount: number;
  currency: Currency;
  /** XAF pour une unité de la devise. */
  xafPerUnit: number;
  incoterm: Incoterm;
  /** Fret jusqu'au port camerounais, en XAF — ignoré si l'incoterm l'inclut. */
  freightXaf?: number | null;
  /** Assurance, en XAF — ignorée en CIF ; estimée si vide. */
  insuranceXaf?: number | null;
  declarationYear: number;
  regime: TaxRegime;
  vehicle?: VehicleInfo | null;
  vehicleCount?: number;
  containsHydroquinone?: boolean;
  agriculturalUse?: boolean;
  exciseRule?: ExciseRule;
  abatementPct?: number;
  /** Poids net en kg — sert à la taxe environnementale au poids (LF2026). */
  netWeightKg?: number | null;
}

export type NoteKind = 'warning' | 'action' | 'info';
export interface SimNote {
  /** Identifiant stable (clé i18n `customs:notes.<id>`). */
  id: string;
  kind: NoteKind;
  /** Le texte français, qui sert aussi de valeur par défaut. */
  fr: string;
  params?: Record<string, string | number>;
}

export interface Simulation {
  goodsXaf: number;
  fobXaf: number;
  freightXaf: number;
  insuranceXaf: number;
  insuranceEstimated: boolean;
  customsValue: number;
  excise: ExciseResult;
  vat: VatExemptResult;
  /** Ce que porte la DAU : « droits et taxes ». */
  dau: Liquidation;
  /** Payé hors DAU : PVI (SGS), précompte, CIVIC. */
  outside: LiquidationLine[];
  /** Tout ce qui sort de la poche à la douane et à la SGS. */
  totalToPay: number;
  /** Dont le précompte, acompte d'impôt déductible pour un contribuable immatriculé. */
  creditable: number;
  /** Marchandise + fret + assurance + tout ce qui est payé à la douane. */
  landedXaf: number;
  /** Droits et taxes de la DAU rapportés à la valeur en douane. */
  effectiveRate: number;
  notes: SimNote[];
}

const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR').replace(/[\u202F\u00A0]/g, ' ');

/** Ce qui est compris dans le prix selon l'incoterm (Incoterms 2020). */
export function includedInPrice(incoterm: Incoterm): { freight: boolean; insurance: boolean } {
  if (incoterm === 'CIF') return { freight: true, insurance: true };
  if (incoterm === 'CFR') return { freight: true, insurance: false };
  return { freight: false, insurance: false };
}

/** Familles que le TEC CEEAC 2026 peut porter à 40 % (CNCC) — non encore vu sur une DAU. */
const TEC_40_WATCH = ['61', '62', '6703', '6704', '5208-5212', '5407', '5408', '5512-5516', '1805', '1806', '24', '2201', '2202'];

/** Taxe environnementale, LF2026 (projet de loi) : au poids, perçue par la douane. */
const ENV_TAX_PER_TONNE: { specs: string[]; xafPerTonne: number; label: string }[] = [
  { specs: ['2523'], xafPerTonne: 2_500, label: 'ciment' },
  { specs: ['7213', '7214'], xafPerTonne: 5_000, label: 'fers à béton' },
  { specs: ['6907', '6908'], xafPerTonne: 15_000, label: 'carreaux et céramiques' },
];

export function simulate(s: SimulationInput): Simulation {
  const notes: SimNote[] = [];
  const code = hsDigits(s.code);
  const goodsXaf = franc(s.goodsAmount * s.xafPerUnit);
  const inc = includedInPrice(s.incoterm);

  // Valeur en douane (art. 30, 31.1 e/g) : ce qui n'est pas dans le prix s'y ajoute.
  const freightXaf = inc.freight ? 0 : franc(s.freightXaf ?? 0);
  if (!inc.freight && !(s.freightXaf && s.freightXaf > 0)) {
    notes.push({ id: 'freight_missing', kind: 'warning', fr: "Le fret n'est pas compté. La douane l'ajoute à la valeur : chaque franc de fret est taxé comme la marchandise." });
  }
  let insuranceXaf = 0, insuranceEstimated = false;
  if (!inc.insurance) {
    if (s.insuranceXaf != null && s.insuranceXaf > 0) insuranceXaf = franc(s.insuranceXaf);
    else { insuranceXaf = franc(((goodsXaf + freightXaf) * INSURANCE_ESTIMATE_RATE) / 100); insuranceEstimated = true; }
  }
  const customsValue = goodsXaf + freightXaf + insuranceXaf;
  // Le FOB (base de la PVI) : le prix, moins ce qu'il contient au-delà du bord.
  const fobXaf = inc.freight ? Math.max(0, goodsXaf - franc(s.freightXaf ?? 0) - (inc.insurance ? franc(s.insuranceXaf ?? 0) : 0)) : goodsXaf;

  const excise = exciseFor({ code, declarationYear: s.declarationYear, vehicle: s.vehicle, containsHydroquinone: s.containsHydroquinone, rule: s.exciseRule });
  const vat = vatExemption(code, s.agriculturalUse);
  const usedVehicle = !!(s.vehicle?.used && (code.startsWith('8703') || code.startsWith('8704') || code.startsWith('8702')));

  const liq = (dutyRate: number, exciseRate = excise.rate) => liquidate({
    customsValue, dutyRate, exciseRate, vatExempt: vat.exempt === 'yes', usedVehicle, vehicleCount: s.vehicleCount, abatementPct: s.abatementPct,
  });
  const dau = liq(s.dutyRate);

  // Hors DAU.
  const outside: LiquidationLine[] = [];
  if (fobXaf >= PVI_THRESHOLD_FOB_XAF) {
    outside.push({ code: 'PVI', label: LEVIES.PVI.label, base: fobXaf, rate: PVI_RATE, amount: franc((fobXaf * PVI_RATE) / 100) });
  }
  const preRate = PRECOMPTE_RATE[s.regime];
  if (preRate > 0) outside.push({ code: 'PRE', label: LEVIES.PRE.label, base: customsValue, rate: preRate, amount: franc((customsValue * preRate) / 100) });
  if (usedVehicle) outside.push({ code: 'CIV', label: LEVIES.CIV.label, base: 0, rate: null, amount: CIVIC_XAF * Math.max(1, s.vehicleCount ?? 1) });

  const creditable = outside.filter((l) => l.code === 'PRE').reduce((n, l) => n + l.amount, 0);
  const totalToPay = dau.total + outside.reduce((n, l) => n + l.amount, 0);

  // ── Ce que le client doit savoir ──
  if (excise.certainty === 'depends' && excise.note) notes.push({ id: 'excise_depends', kind: 'warning', fr: excise.note });
  else if (excise.note) notes.push({ id: 'excise_note', kind: 'info', fr: excise.note });
  if (excise.otherRule) {
    const alt = liq(s.dutyRate, excise.otherRule.rate).total;
    notes.push({
      id: 'vehicle_other_rule', kind: 'warning',
      fr: excise.otherRule.rule === 'lf2026'
        ? `La loi de finances 2026 prévoit ${excise.otherRule.rate} % d'accises pour ce véhicule (CAMCIS applique encore ${excise.rate} %) : ${fmt(alt)} F de droits et taxes au lieu de ${fmt(dau.total)} F.`
        : `L'ancienne règle du CGI donnerait ${excise.otherRule.rate} % d'accises : ${fmt(alt)} F au lieu de ${fmt(dau.total)} F.`,
      params: { rate: excise.otherRule.rate, total: alt },
    });
  }
  if (vat.exempt === 'maybe' && vat.condition) notes.push({ id: 'vat_maybe', kind: 'warning', fr: `TVA : ${vat.condition}` });
  if (vat.exempt === 'yes') notes.push({ id: 'vat_exempt', kind: 'info', fr: `TVA exonérée d'office : ${vat.label?.toLowerCase()} (${vat.basis}).` });
  if (matchAny(code, TEC_40_WATCH) !== 'no' && s.dutyRate < 40) {
    const at40 = liq(40).total;
    notes.push({
      id: 'tec_40', kind: 'warning',
      fr: `Le TEC CEEAC en vigueur depuis le 1er janvier 2026 peut porter ce produit à 40 % : ce serait ${fmt(at40)} F au lieu de ${fmt(dau.total)} F. Faites confirmer le taux au tarif intégré CAMCIS.`,
      params: { total: at40 },
    });
  }
  if (/^85171[34]/.test(code)) {
    notes.push({ id: 'phones', kind: 'info', fr: "Téléphones : la loi de finances 2023 (art. 7) prévoit un abattement de 50 % sur la valeur, et CAMCIS rattache la taxe à l'IMEI depuis 2026. Non appliqué ici : à confirmer avec votre déclarant." });
  }
  for (const env of ENV_TAX_PER_TONNE) {
    if (matchAny(code, env.specs) === 'no') continue;
    const w = s.netWeightKg;
    notes.push({
      id: 'env_tax', kind: 'warning',
      fr: w && w > 0
        ? `Taxe environnementale (loi de finances 2026, ${env.label}) : ${fmt(env.xafPerTonne)} F la tonne, soit environ ${fmt((w / 1000) * env.xafPerTonne)} F. Non comptée dans le total, texte promulgué à vérifier.`
        : `Taxe environnementale (loi de finances 2026, ${env.label}) : ${fmt(env.xafPerTonne)} F la tonne. Donnez le poids net pour l'estimer.`,
    });
  }
  if (code.startsWith('39')) {
    notes.push({ id: 'env_tax_plastic', kind: 'info', fr: 'Taxe environnementale sur les articles en plastique (loi de finances 2026) : 5 % de la valeur, plafonnée à 1 000 F par unité. Non comptée ici.' });
  }
  if (insuranceEstimated) {
    notes.push({ id: 'insurance_estimated', kind: 'info', fr: "Assurance estimée à 0,5 % : l'assurance des marchandises importées est obligatoire au Cameroun, auprès d'un assureur agréé localement (loi n° 75-14)." });
  }
  if (s.regime === 'hors_fichier') {
    notes.push({ id: 'precompte_niu', kind: 'action', fr: "Sans NIU, le précompte est de 10 % au lieu de 2 % pour une entreprise au réel. Un numéro d'identifiant unique se demande gratuitement aux impôts." });
  }
  if (fobXaf >= PVI_THRESHOLD_FOB_XAF) {
    notes.push({ id: 'di_rvc', kind: 'action', fr: "Au-delà de 2 000 000 F FOB : déclaration d'importation (DI) sur e-GUCE avant l'embarquement, puis attestation de vérification (RVC) de la SGS. Sans elles, l'amende est de 25 % de la valeur (loi de finances 2026)." });
    notes.push({ id: 'sgs_invoice', kind: 'action', fr: "Demandez à votre fournisseur de déposer la facture définitive sur export-cm.sgs.com dès l'expédition. Sans elle, la SGS peut retenir une valeur trois fois plus élevée — c'est arrivé sur une Toyota Fortuner : 2 311 829 F de trop." });
  }
  if (goodsXaf > 5_000_000) {
    notes.push({ id: 'domiciliation', kind: 'action', fr: "Au-delà de 5 000 000 F, l'importation doit être domiciliée dans une banque. Payez votre fournisseur avec Bonzini : la preuve de paiement établit la valeur réellement payée (code des douanes CEMAC, art. 30)." });
  }
  notes.push({ id: 'code_check', kind: 'action', fr: "Vérifiez que le code de la DAU décrit votre marchandise, pas un mot qui lui ressemble : « régulateur » déclaré comme réfrigérateur a coûté 35 779 F de trop sur 150 000 F." });

  return {
    goodsXaf, fobXaf, freightXaf, insuranceXaf, insuranceEstimated, customsValue,
    excise, vat, dau, outside, totalToPay, creditable,
    landedXaf: customsValue + totalToPay,
    effectiveRate: customsValue > 0 ? dau.total / customsValue : 0,
    notes,
  };
}

/** La confiance globale d'une simulation : la plus faible des sources utilisées. */
export function weakestConfidence(list: Confidence[]): Confidence {
  const order: Confidence[] = ['a_verifier', 'marche', 'observe', 'officiel'];
  return order.find((c) => list.includes(c)) ?? 'officiel';
}
