/**
 * Le droit d'accises à l'importation — CGI 2024, art. 142 et annexe II.
 *
 * Le texte (lu dans l'édition 2024, p. 88-90 et 104-107) fixe six taux et dit qui
 * les porte :
 *   super élevé 50 %  hydroquinone et cosmétiques du ch. 33 qui en contiennent — 142(6)d
 *   élevé 30 %        tabacs du ch. 24, pipes — 142(6)e
 *   moyen 12,5 %      véhicules selon l'âge, motos > 250 cm³, parties de motos,
 *                     mèches et perruques, friperie, pneus d'occasion, viandes,
 *                     beurre et fèves de cacao, huiles raffinées, croquettes,
 *                     charbon de bois — 142(6)a
 *   réduit 5 %        sucreries, chocolats, motos ≤ 250 cm³, sauces, glaces,
 *                     gruaux de maïs, mayonnaise, corn flakes — 142(6)b
 *   général 25 %      tout le reste de l'annexe II — 142(5)
 * Les taux particuliers l'emportent sur le général (142(5) : « autres que ceux
 * soumis aux taux super élevé, élevé, moyen, réduit »).
 *
 * Les véhicules ont deux règles, parce que la loi de finances 2026 a réécrit la
 * table et que CAMCIS, en septembre 2026, appliquait encore l'ancienne (Yaris 2009,
 * 1,6 L, 17 ans : 25 % liquidés). On calcule avec la règle observée et on dit ce
 * que donnerait l'autre.
 */
import { matchAny, matchSpec, hsDigits, type CodeSpec } from './hsCode';
import type { Confidence } from './levies';

export type ExciseRule = 'cgi2024' | 'lf2026';

export interface VehicleInfo {
  /** car = tourisme (8703) · utility = utilitaire, car, remorque, tracteur routier · motorcycle = 8711 */
  kind: 'car' | 'utility' | 'motorcycle';
  /** Cylindrée, en cm³ (celle de la carte grise, pas celle du nom du modèle). */
  engineCc: number | null;
  /** Année de première mise en circulation — pas l'année-modèle du VIN. */
  firstRegistrationYear: number | null;
  used: boolean;
  /** Tracteur ou remorque agricole : hors accises (142(6)a, « à l'exclusion de ceux agricoles »). */
  agricultural?: boolean;
  /** Véhicule au gaz naturel (GNC/GNL) : 0 % selon la LF2026. */
  naturalGas?: boolean;
}

export interface ExciseResult {
  rate: number;
  /** Le texte qui fonde le taux, en une ligne. */
  basis: string;
  confidence: Confidence;
  /** 'sure' : le code suffit. 'depends' : la ligne nationale ou un fait (cylindrée, âge…) peut changer le taux. */
  certainty: 'sure' | 'depends';
  /** Ce qui ferait changer le taux, à dire au client. */
  note?: string;
  /** Le taux selon l'autre règle véhicule, quand il diffère. */
  otherRule?: { rule: ExciseRule; rate: number };
}

export interface Tier {
  rate: number;
  specs: CodeSpec[];
  basis: string;
  /** Spécifications à exclure, même si elles tombent dans `specs`. */
  except?: CodeSpec[];
  note?: string;
}

/** 142(6)e — taux élevé. */
export const HIGH: Tier[] = [
  { rate: 30, specs: ['2402', '2403', '9614'], basis: 'CGI art. 142(6)e — tabacs du chapitre 24, pipes' },
];

/** 142(6)a — taux moyen, hors véhicules (traités à part). */
export const MEDIUM: Tier[] = [
  { rate: 12.5, specs: ['871130', '871140', '871150'], basis: 'CGI art. 142(6)a — motocycles de plus de 250 cm³' },
  { rate: 12.5, specs: ['871410', '871491-871499'], basis: 'CGI art. 142(6)a — parties de motocycles' },
  { rate: 12.5, specs: ['6703', '6704'], basis: 'CGI art. 142(6)a — cheveux, perruques et mèches' },
  { rate: 12.5, specs: ['630900'], basis: 'CGI art. 142(6)a — articles de friperie', note: 'La friperie, ce sont des vêtements usagés. Des vêtements neufs relèvent des chapitres 61 ou 62, sans accises.' },
  { rate: 12.5, specs: ['401220'], basis: "CGI art. 142(6)a — pneumatiques d'occasion" },
  { rate: 12.5, specs: ['0201-0210'], basis: 'CGI art. 142(6)a — viandes et abats importés' },
  { rate: 12.5, specs: ['180400'], basis: 'CGI art. 142(6)a — beurre de cacao importé' },
  { rate: 12.5, specs: ['1801'], basis: 'CGI art. 142(6)a — cacao en fèves importé' },
  { rate: 12.5, specs: ['150790', '150890', '1509', '151090', '151190', '151219', '151229', '151319', '151329', '151419', '151499', '151519', '151529', '151530', '151550', '151590', '151620'], basis: 'CGI art. 142(6)a — huiles végétales raffinées importées' },
  { rate: 12.5, specs: ['230910'], basis: 'CGI art. 142(6)a — aliments pour chiens et chats' },
  { rate: 12.5, specs: ['4402'], basis: 'CGI art. 142(6)a — charbon de bois importé' },
];

/** 142(6)b — taux réduit. */
export const REDUCED: Tier[] = [
  { rate: 5, specs: ['1704'], basis: 'CGI art. 142(6)b — sucreries sans cacao' },
  { rate: 5, specs: ['180620-180690'], basis: 'CGI art. 142(6)b — chocolats et préparations riches en cacao' },
  { rate: 5, specs: ['871110', '871120'], basis: 'CGI art. 142(6)b — motocycles de 250 cm³ au plus' },
  { rate: 5, specs: ['2103', '2104'], basis: 'CGI art. 142(6)b — sauces, condiments, soupes' },
  { rate: 5, specs: ['2105'], basis: 'CGI art. 142(6)b — glaces de consommation' },
  { rate: 5, specs: ['110313'], basis: 'CGI art. 142(6)b — gruaux de maïs importés' },
  { rate: 5, specs: ['190410', '190420'], basis: 'CGI art. 142(6)b — corn flakes et flocons de céréales' },
];

/** 142(5) + annexe II — taux général, pour tout ce que les autres tiers ne prennent pas. */
export const GENERAL: Tier[] = [
  // Le CGI 2024 cite certains codes dans leur version SH 2017 (4418.10, 4418.20,
  // 1604.30) : on les écrit par leur préfixe, qui couvre leurs successeurs SH 2022.
  { rate: 25, specs: ['16022010', '16043', '160241', '160242'], basis: 'CGI annexe II — foie gras, caviar, jambons' },
  { rate: 25, specs: ['2009'], basis: 'CGI annexe II — jus de fruits' },
  { rate: 25, specs: ['2201', '2202'], basis: 'CGI annexe II — eaux minérales et boissons gazeuses importées', note: 'Les sodas portent en plus un droit spécifique de 2,5 F par centilitre (142(11)), non compté ici.' },
  { rate: 25, specs: ['2203', '2204', '2205', '2206', '220820-220890'], except: ['22089010'], basis: 'CGI annexe II — bières, vins, spiritueux', note: 'Les boissons alcoolisées portent en plus un droit spécifique par centilitre (142(8)), non compté ici.' },
  { rate: 25, specs: ['7101-7117'], basis: 'CGI annexe II — perles, pierres, métaux précieux, bijouterie' },
  { rate: 25, specs: ['3303', '3304', '3305', '3307'], basis: 'CGI annexe II — parfums et cosmétiques', note: "Le CGI écrit « parfums et cosmétiques » sans code : les positions 3303 à 3307 (sauf 3306, hygiène buccale) sont la lecture usuelle. Avec de l'hydroquinone, c'est 50 %." },
  { rate: 25, specs: ['44181', '44182', '441873', '441874', '940330', '940350', '940360'], basis: 'CGI annexe II — ouvrages et mobiliers en bois importés' },
  { rate: 25, specs: ['940310', '940340', '940370'], basis: 'CGI annexe II — meubles de bureau en métal, de cuisine en bois, en plastique' },
  { rate: 25, specs: ['340119-340290'], basis: 'CGI annexe II — savons et préparations de nettoyage importés' },
  { rate: 25, specs: ['481810'], basis: 'CGI annexe II — papiers hygiéniques importés', note: "Seul le papier hygiénique (4818.10) est visé : les mouchoirs (4818.20) n'y sont pas." },
  { rate: 25, specs: ['1905'], basis: 'CGI annexe II — produits de boulangerie et biscuiterie importés' },
  { rate: 25, specs: ['392310', '392321', '6305'], basis: 'CGI annexe II — articles et emballages en plastique importés' },
  { rate: 25, specs: ['5514-5516'], basis: 'CGI annexe II — tissus de fibres synthétiques ou artificielles discontinues' },
  { rate: 25, specs: ['0603', '6702'], basis: 'CGI annexe II — fleurs naturelles et artificielles' },
  { rate: 25, specs: ['39269090', '44219900'], basis: 'CGI annexe II — cure-dents' },
  { rate: 25, specs: ['442120', '442199009'], basis: 'CGI annexe II — cercueils et autres ouvrages en bois' },
  { rate: 25, specs: ['040900', '070190', '071010', '0801-0814', '0902', '0904', '091011', '091012'], basis: 'CGI annexe II — miel, pommes de terre, fruits, thé, poivre, gingembre importés' },
  { rate: 25, specs: ['09011112-09011119', '09011122-09011149', '09011152-090112', '090121', '090122', '2101'], basis: 'CGI annexe II — café importé' },
  { rate: 25, specs: ['9504'], basis: 'CGI annexe II — consoles et jeux vidéo, jeux de société, billards' },
];

function firstTier(code: string, tiers: Tier[]): { tier: Tier; match: 'yes' | 'maybe' } | null {
  let maybe: { tier: Tier; match: 'maybe' } | null = null;
  for (const tier of tiers) {
    if (tier.except && matchAny(code, tier.except) === 'yes') continue;
    const m = matchAny(code, tier.specs);
    if (m === 'yes') {
      // Une exception plus fine que le code connu rend le résultat incertain.
      if (tier.except && matchAny(code, tier.except) === 'maybe') return { tier, match: 'maybe' };
      return { tier, match: 'yes' };
    }
    if (m === 'maybe' && !maybe) maybe = { tier, match: 'maybe' };
  }
  return maybe;
}

/** L'âge du véhicule, en années pleines, à l'année de la déclaration. */
export function vehicleAge(info: VehicleInfo, declarationYear: number): number | null {
  if (info.firstRegistrationYear == null) return null;
  return Math.max(0, declarationYear - info.firstRegistrationYear);
}

/**
 * Accises véhicule. CGI 2024 (appliqué par CAMCIS en septembre 2026) :
 *   tourisme ≤ 2 500 cm³ : ≤ 10 ans 0 % (25 % si ≥ 2 000 cm³, annexe II) · 10–15 ans 12,5 % · > 15 ans 25 %
 *   tourisme > 2 500 cm³ : 1–15 ans 12,5 % · > 15 ans 25 %
 *   utilitaires, cars, remorques, tracteurs routiers : ≤ 15 ans 0 % · 15–25 ans 12,5 % · > 25 ans 25 %
 * LF2026 art. 10 (projet de loi, tel que lu) :
 *   tourisme ≤ 2 500 cm³ : 0–12 ans 0 % · 12–20 ans 12,5 % · > 20 ans 25 %
 *   tourisme > 2 500 cm³ : 0–15 ans 12,5 % · > 15 ans 25 %
 *   utilitaires : 0–15 ans 0 % · 15–20 ans 12,5 % · > 20 ans 25 % · gaz naturel : 0 %
 */
export function vehicleExciseRate(info: VehicleInfo, age: number, rule: ExciseRule): number {
  if (info.kind === 'motorcycle') return 0; // traité par les tiers moto
  if (info.agricultural) return 0;
  const cc = info.engineCc ?? 0;
  if (rule === 'lf2026') {
    if (info.naturalGas) return 0;
    if (info.kind === 'utility') return age > 20 ? 25 : age > 15 ? 12.5 : 0;
    if (cc > 2500) return age > 15 ? 25 : 12.5;
    return age > 20 ? 25 : age > 12 ? 12.5 : 0;
  }
  if (info.kind === 'utility') return age > 25 ? 25 : age > 15 ? 12.5 : 0;
  if (cc > 2500) return age > 15 ? 25 : 12.5;
  if (age > 15) return 25;
  if (age > 10) return 12.5;
  return cc >= 2000 ? 25 : 0;
}

const VEHICLE_BASIS: Record<ExciseRule, string> = {
  cgi2024: 'CGI art. 142(6)a et annexe II — âge et cylindrée (règle appliquée par CAMCIS en 2026)',
  lf2026: 'Loi de finances 2026, art. 10 — nouvelle table par âge et cylindrée',
};

export interface ExciseQuery {
  code: string;
  declarationYear: number;
  vehicle?: VehicleInfo | null;
  containsHydroquinone?: boolean;
  /** Règle véhicule pour le calcul. Par défaut : celle que CAMCIS applique. */
  rule?: ExciseRule;
}

export function exciseFor(q: ExciseQuery): ExciseResult {
  const code = hsDigits(q.code);
  const rule = q.rule ?? 'cgi2024';

  // 142(6)d — super élevé.
  if (matchSpec(code, '290722') === 'yes') {
    return { rate: 50, basis: 'CGI art. 142(6)d — hydroquinone', confidence: 'officiel', certainty: 'sure' };
  }
  if (code.startsWith('33') && q.containsHydroquinone) {
    return { rate: 50, basis: "CGI art. 142(6)d — cosmétique contenant de l'hydroquinone", confidence: 'officiel', certainty: 'sure' };
  }

  // Le matériel agricole est expressément exclu (142(6)a, « à l'exclusion de ceux
  // agricoles ») : motoculteurs, remorques agricoles, la ligne « tracteurs agric. »
  // 870190.11 que CAMCIS garde ouverte, et tout tracteur déclaré agricole.
  const AGRICULTURAL = 'CGI art. 142(6)a — les tracteurs et remorques agricoles sont exclus des accises';
  const isTractor = /^(870130|87019)/.test(code);
  if (/^(870110|871620|87019011)/.test(code) || (isTractor && q.vehicle?.agricultural)) {
    return { rate: 0, basis: AGRICULTURAL, confidence: 'officiel', certainty: 'sure' };
  }

  // Véhicules : l'âge et la cylindrée décident, pas seulement le code.
  const isCar = code.startsWith('8703');
  const isUtility = isTractor || /^(8702|8704|87012|871610|871631|871639|871640)/.test(code);
  if (isCar || isUtility) {
    const tractorNote = isTractor ? ' Un tracteur agricole est exonéré : dites-le si c’est le cas.' : '';
    const v = q.vehicle;
    const age = v ? vehicleAge(v, q.declarationYear) : null;
    if (!v || age == null || (isCar && v.engineCc == null)) {
      return {
        rate: 0, basis: VEHICLE_BASIS[rule], confidence: 'officiel', certainty: 'depends',
        note: (isCar
          ? "Pour un véhicule de tourisme, l'accise dépend de la cylindrée et de l'année de première mise en circulation : de 0 % à 25 %."
          : "Pour un utilitaire, un tracteur ou une remorque, l'accise dépend de l'âge : 0 % jusqu'à 15 ans, puis 12,5 % ou 25 %.") + tractorNote,
      };
    }
    const kind = isCar ? 'car' : 'utility';
    const rate = vehicleExciseRate({ ...v, kind }, age, rule);
    const other: ExciseRule = rule === 'cgi2024' ? 'lf2026' : 'cgi2024';
    const otherRate = vehicleExciseRate({ ...v, kind }, age, other);
    return {
      rate, basis: VEHICLE_BASIS[rule], confidence: rule === 'cgi2024' ? 'observe' : 'a_verifier', certainty: 'sure',
      note: `${age} an${age > 1 ? 's' : ''}${isCar ? `, ${v.engineCc} cm³` : ''}.${tractorNote}`,
      otherRule: otherRate !== rate ? { rule: other, rate: otherRate } : undefined,
    };
  }

  for (const [tiers, conf] of [[HIGH, 'officiel'], [MEDIUM, 'officiel'], [REDUCED, 'officiel'], [GENERAL, 'officiel']] as const) {
    const hit = firstTier(code, tiers);
    if (hit) {
      return {
        rate: hit.tier.rate, basis: hit.tier.basis, confidence: conf,
        certainty: hit.match === 'yes' ? 'sure' : 'depends',
        note: hit.match === 'maybe'
          ? `Le texte vise une ligne nationale plus précise : à confirmer sur le code à 12 chiffres.${hit.tier.note ? ' ' + hit.tier.note : ''}`
          : hit.tier.note,
      };
    }
  }

  const note = code.startsWith('33') && !code.startsWith('3306')
    ? "Avec de l'hydroquinone, l'accise passe à 50 %."
    : undefined;
  return { rate: 0, basis: "Hors de l'annexe II du CGI : pas d'accises", confidence: 'officiel', certainty: 'sure', note };
}
