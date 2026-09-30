/**
 * Les prélèvements à l'importation au Cameroun, tels que CAMCIS les liquide.
 *
 * Chaque taux porte sa source et sa confiance — un chiffre faux est pire qu'aucun
 * chiffre (docs/douane/00-plan.md §3) :
 *   officiel   — texte primaire lu (CGI, code des douanes CEMAC, loi de finances)
 *   observe    — reproduit sur une vraie DAU CAMCIS (SDSD2-2026-IMP-020399-I,
 *                17/09/2026, articles 4 à 10 à ±4 F)
 *   marche     — presse, agrégateurs, opérateurs
 *   a_verifier — sources contradictoires ou non trouvées
 *
 * Détail et liens : docs/douane/01-sources.md.
 */

export type Confidence = 'officiel' | 'observe' | 'marche' | 'a_verifier';

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  officiel: 'Officiel',
  observe: 'Observé sur une DAU',
  marche: 'Marché',
  a_verifier: 'À vérifier',
};

/** Les codes CAMCIS imprimés sur la DAU, plus ce qui se paie hors DAU. */
export type LevyCode =
  | 'DDI' // droit de douane (TEC)
  | 'DAC' // droit d'accises
  | 'DEA' // redevance informatique
  | 'TVA'
  | 'CAC' // centimes additionnels communaux
  | 'TCI' // taxe communautaire d'intégration (CEMAC) — TCI + TIB sur la DAU
  | 'CCI' // contribution communautaire d'intégration (CEEAC) — CCI + CCB
  | 'CIA' // prélèvement de l'Union africaine — CIA + CIB
  | 'PRO' // prélèvement OHADA (probable)
  | 'DEV' // droits d'enregistrement des véhicules d'occasion
  | 'VFX' // forfaits véhicule (DEW / DEX / DEY)
  | 'PRE' // précompte sur achats — hors total de la DAU observée
  | 'PVI' // programme de vérification des importations (SGS) — hors DAU
  | 'CIV'; // contrôle d'identification des véhicules d'occasion — hors DAU

export interface LevyMeta {
  label: string;
  /** Sur quoi porte le taux, en une phrase. */
  base: string;
  source: string;
  confidence: Confidence;
  /** Figure sur la DAU (et donc dans « droits et taxes ») ? */
  onDau: boolean;
}

export const LEVIES: Record<LevyCode, LevyMeta> = {
  DDI: { label: 'Droit de douane', base: 'la valeur en douane', source: 'TEC CEEAC-CEMAC ; valeur : code des douanes CEMAC, art. 23 à 37', confidence: 'observe', onDau: true },
  DAC: { label: "Droit d'accises", base: 'la valeur en douane plus le droit de douane', source: 'CGI art. 138(2), 142 et annexe II ; LF2026 art. 10', confidence: 'officiel', onDau: true },
  DEA: { label: 'Redevance informatique', base: 'la valeur en douane', source: 'LF2023 art. 9 ; LF2026 art. 12', confidence: 'observe', onDau: true },
  TVA: { label: 'TVA', base: 'la valeur en douane, le droit de douane, les accises et la redevance informatique', source: 'CGI art. 138(1) et 142', confidence: 'officiel', onDau: true },
  CAC: { label: 'Centimes additionnels communaux', base: 'la TVA', source: 'CGI art. 142(2)', confidence: 'officiel', onDau: true },
  TCI: { label: "Taxe communautaire d'intégration (CEMAC)", base: 'la valeur en douane', source: 'Acte CEMAC — taux de 0,6 % observé sur la DAU', confidence: 'observe', onDau: true },
  CCI: { label: "Contribution communautaire d'intégration (CEEAC)", base: 'la valeur en douane', source: 'Acte CEEAC — 0,4 % observé sur la DAU', confidence: 'observe', onDau: true },
  CIA: { label: "Prélèvement de l'Union africaine", base: 'la valeur en douane', source: 'Décision UA de Kigali (2016), LF2017 — 0,2 % observé', confidence: 'observe', onDau: true },
  PRO: { label: 'Prélèvement OHADA', base: 'la valeur en douane', source: '0,05 % observé sur la DAU ; rattachement à l’OHADA : marché', confidence: 'observe', onDau: true },
  DEV: { label: "Droits d'enregistrement du véhicule", base: 'la valeur en douane, les droits, les accises et la TVA', source: 'CGI (enregistrement), payés dans CAMCIS depuis le 10/01/2024 — base observée sur la DAU', confidence: 'observe', onDau: true },
  VFX: { label: 'Forfaits du véhicule (timbres)', base: 'forfait', source: 'DEW/DEX/DEY sur la DAU — environ 10 000 F, montant exact non établi', confidence: 'a_verifier', onDau: true },
  PRE: { label: 'Précompte sur achats', base: 'la valeur en douane, sans centimes additionnels', source: 'CGI art. 21(3)', confidence: 'officiel', onDau: false },
  PVI: { label: 'Inspection SGS (PVI)', base: 'la valeur FOB, dès 2 000 000 F', source: 'Instruction 000625/MINFI/CAB du 30/11/2016 ; guide SGS', confidence: 'officiel', onDau: false },
  CIV: { label: 'Contrôle du véhicule d’occasion (CIVIC)', base: 'forfait par véhicule', source: 'Mesure MINFI du 01/07/2025', confidence: 'marche', onDau: false },
};

/** Les taux, en pourcentage. */
export const VAT_RATE = 17.5;
export const CAC_RATE = 10; // % de la TVA → 19,25 % tout compris
/** La CAC est ventilée sur la DAU : commune 28 %, CAD 10 %, FEICOM 62 %. On arrondit chaque part, comme CAMCIS. */
export const CAC_SPLIT = [28, 10, 62] as const;
export const DEA_RATE = 1;
export const DEV_RATE = 5;

/**
 * Les « petites taxes » communautaires, telles qu'éclatées sur la DAU. Total 1,25 %.
 * `abatable` : réduites par un code additionnel (A30), ou non — observé sur la
 * Fortuner (docs/cargo/simulations/2026-09_toyota-rav4_LVGE656F2MG032343.md §6).
 */
export const COMMUNITY_PARTS = [
  { code: 'TCI', part: 'TCI', rate: 0.408, abatable: true },
  { code: 'TCI', part: 'TIB', rate: 0.192, abatable: false },
  { code: 'CCI', part: 'CCI', rate: 0.272, abatable: true },
  { code: 'CCI', part: 'CCB', rate: 0.128, abatable: false },
  { code: 'CIA', part: 'CIA', rate: 0.136, abatable: false },
  { code: 'CIA', part: 'CIB', rate: 0.064, abatable: false },
  { code: 'PRO', part: 'PRO', rate: 0.05, abatable: true },
] as const satisfies readonly { code: LevyCode; part: string; rate: number; abatable: boolean }[];

export const COMMUNITY_TOTAL_RATE = 1.25;

/** Hors DAU. */
export const PVI_RATE = 0.95;
export const PVI_THRESHOLD_FOB_XAF = 2_000_000;
export const CIVIC_XAF = 29_813;
export const VEHICLE_FLAT_XAF = 10_000;

/** Le précompte selon le régime fiscal de l'importateur (CGI art. 21(3)). */
export type TaxRegime = 'reel' | 'simplifie' | 'hors_fichier' | 'exonere';
export const PRECOMPTE_RATE: Record<TaxRegime, number> = {
  reel: 2, // régime du réel
  simplifie: 5, // impôt général synthétique, régime simplifié
  hors_fichier: 10, // hors fichier d'un centre des impôts, impôt libératoire, non-professionnels
  exonere: 0, // unités spécialisées de la DGI (DGE, CIME)
};
export const REGIME_LABEL: Record<TaxRegime, string> = {
  reel: 'Régime du réel',
  simplifie: 'Régime simplifié (IGS)',
  hors_fichier: "Pas de numéro d'identifiant unique (NIU)",
  exonere: 'Grande entreprise (DGE, CIME) — dispensée',
};

/** Arrondi au franc, comme CAMCIS le fait composante par composante. */
export const franc = (n: number) => Math.round(n);
