/**
 * Le coût à quai — « combien va coûter la sortie de cette boîte ? »
 *
 * La plus petite version qui soit vraie (docs/strategy/manoeuvre-1, §9) :
 * six réponses en entrée, et un chiffre honnête en sortie. Honnête veut dire
 * trois couleurs, jamais un total unique :
 *   - CERTAIN   : ça s'additionne (timbre, cascade portuaire, TVA si exonérée)
 *   - ESTIMÉ    : une fourchette (fret, assurance, droits de port, taxes annexes)
 *   - RISQUE    : jamais un montant — une action (soumettre la proforma à la
 *                 SGS, faire porter le bon poids, sortir vite du port)
 *
 * Sources, ligne par ligne, dans docs/cargo :
 *   Couche A  valeur en douane = prix + fret + assurance (Code CEMAC art. 30, 31.1)
 *   Couche B  droit de douane par bande TEC 5/10/20/30 % ; TVA 17,5 % + 10 % CAC
 *             = 19,25 %, exonérable (CGI annexe 1) ; TCI·CCI·précompte·redevance
 *             ≈ 2 % [HYPO — relevé sur un RVC, à reconsigner avant la production]
 *   Couche C  passage portuaire = droits de port × 1,2930 (module 6, facture CMIM1091423)
 *   Couche D  droit de timbre 25 000 F hors TVA (module 6, facture CMIM1091424)
 *   Couche E  surestaries : 44 413 F TTC par jour au-delà du 21e jour (module 5)
 * Ce fichier ne lit ni base ni réseau : c'est une règle de calcul, testable.
 */

export type Incoterm = 'EXW' | 'FCA' | 'FOB' | 'CFR' | 'CIF' | 'DAP' | 'DDP';
export type DutyBand = 0 | 5 | 10 | 20 | 30;
export type Confidence = 'certain' | 'estime';

export interface LandedCostInput {
  /** Prix de la marchandise sur la proforma, dans sa devise. */
  goodsAmount: number;
  currency: 'USD' | 'CNY' | 'EUR' | 'XAF';
  /** XAF pour une unité de la devise (USD ≈ 575, CNY ≈ 80, EUR ≈ 655,957 fixe). */
  xafPerUnit: number;
  grossWeightKg: number | null;
  incoterm: Incoterm;
  /** Bande de droit de douane du code SH (TEC CEMAC). */
  dutyBand: DutyBand;
  /** Le code SH est à l'annexe 1 du CGI : la TVA tombe d'office. */
  vatExempt: boolean;
  /** Fret connu (devis du transitaire, cotation), en USD. Sinon fourchette par défaut. */
  freightUsd: number | null;
  /** Droits de port du terminal (77 000 à Douala, DIT). Sinon estimé. */
  portDuesXaf: number | null;
  /** Forfaits connus, en XAF : BESC, frais de dossier, transport final. Vides = non comptés. */
  bescXaf: number | null;
  fileFeesXaf: number | null;
  truckingXaf: number | null;
}

export interface CostLine {
  key: string;
  label: string;
  /** Ce qu'on sait de ce chiffre, en une phrase. */
  why: string;
  confidence: Confidence;
  low: number;
  high: number;
  /** Une ligne à zéro certain (« TVA exonérée », « fret inclus ») se dit quand même. */
  note?: string;
}

export interface LandedCost {
  goodsXaf: number;
  customsValue: { low: number; high: number };
  lines: CostLine[];
  /** Ce qui est dû quoi qu'il arrive : la somme des lignes, en fourchette. */
  total: { low: number; high: number };
  /** Ce qui dépend de la vitesse : jamais dans le total. */
  demurragePerDayXaf: number;
  freeDays: number;
  /** Les actions qui évitent de payer plus — le rouge, jamais un montant. */
  actions: string[];
  /** Les hypothèses non consignées, à relire avant de s'engager. */
  caveats: string[];
}

export const VAT_RATE = 0.1925;
export const OTHER_TAXES_RATE = 0.02;          // [HYPO] TCI · CCI · précompte · redevance informatique
export const PORT_CASCADE = 1.293;             // module 6 : × 1,2930 sur les droits de port
export const DEFAULT_PORT_DUES_XAF = 77_000;   // DIT Douala, facture CMIM1091423
export const STAMP_DUTY_XAF = 25_000;          // hors TVA
export const INSURANCE_RATE = 0.005;           // 0,5 % — estimation (module 7)
export const FREIGHT_RANGE_USD: [number, number] = [5_500, 7_000]; // 40' HC Chine → Cameroun, cotations 2026
export const DEMURRAGE_PER_DAY_XAF = 44_413;   // module 5, au-delà du 21e jour
export const FREE_DAYS = 21;
export const DEFAULT_XAF_PER = { USD: 575, CNY: 80, EUR: 655.957, XAF: 1 } as const;

/** Le fret et l'assurance sont-ils déjà dans le prix ? Dépend de l'incoterm (module 7). */
export function includedInPrice(incoterm: Incoterm): { freight: boolean; insurance: boolean } {
  switch (incoterm) {
    case 'CFR': return { freight: true, insurance: false };
    case 'CIF': case 'DAP': case 'DDP': return { freight: true, insurance: true };
    default: return { freight: false, insurance: false };
  }
}

const r = (n: number) => Math.round(n);

export function landedCost(i: LandedCostInput): LandedCost {
  const goodsXaf = r(i.goodsAmount * i.xafPerUnit);
  const inc = includedInPrice(i.incoterm);
  const lines: CostLine[] = [];
  const caveats: string[] = [];
  const actions: string[] = [];

  lines.push({ key: 'goods', label: 'La marchandise', why: 'Le prix de la proforma, converti.', confidence: 'certain', low: goodsXaf, high: goodsXaf });

  // Couche A — le fret et l'assurance entrent dans la valeur en douane.
  let freightLow = 0, freightHigh = 0;
  if (inc.freight) {
    lines.push({ key: 'freight', label: 'Le fret maritime', why: `Déjà dans le prix (${i.incoterm}).`, confidence: 'certain', low: 0, high: 0, note: 'inclus' });
  } else if (i.freightUsd != null && i.freightUsd > 0) {
    freightLow = freightHigh = r(i.freightUsd * (i.currency === 'USD' ? i.xafPerUnit : DEFAULT_XAF_PER.USD));
    lines.push({ key: 'freight', label: 'Le fret maritime', why: 'Le devis du transitaire.', confidence: 'certain', low: freightLow, high: freightHigh });
  } else {
    freightLow = r(FREIGHT_RANGE_USD[0] * DEFAULT_XAF_PER.USD);
    freightHigh = r(FREIGHT_RANGE_USD[1] * DEFAULT_XAF_PER.USD);
    lines.push({ key: 'freight', label: 'Le fret maritime', why: "Pas de devis : fourchette d'un 40 pieds Chine → Cameroun.", confidence: 'estime', low: freightLow, high: freightHigh });
  }

  let insLow = 0, insHigh = 0;
  if (inc.insurance) {
    lines.push({ key: 'insurance', label: "L'assurance", why: `Déjà dans le prix (${i.incoterm}).`, confidence: 'certain', low: 0, high: 0, note: 'incluse' });
  } else {
    insLow = r((goodsXaf + freightLow) * INSURANCE_RATE);
    insHigh = r((goodsXaf + freightHigh) * INSURANCE_RATE);
    lines.push({ key: 'insurance', label: "L'assurance", why: 'Environ 0,5 % de la marchandise et du fret.', confidence: 'estime', low: insLow, high: insHigh });
  }

  const cvLow = goodsXaf + freightLow + insLow;
  const cvHigh = goodsXaf + freightHigh + insHigh;

  // Couche B — droits et taxes, sur la valeur en douane.
  const dutyLow = r(cvLow * i.dutyBand / 100), dutyHigh = r(cvHigh * i.dutyBand / 100);
  lines.push({
    key: 'duty', label: `Le droit de douane, ${i.dutyBand} %`,
    why: i.dutyBand === 0 ? 'Le code SH est exempté de droit.' : 'Le taux vient du code SH ; la base est la valeur en douane, fret compris.',
    confidence: cvLow === cvHigh ? 'certain' : 'estime', low: dutyLow, high: dutyHigh,
  });
  if (i.vatExempt) {
    lines.push({ key: 'vat', label: 'La TVA', why: "Le code SH est à l'annexe 1 du CGI : la TVA tombe d'office.", confidence: 'certain', low: 0, high: 0, note: 'exonérée' });
  } else {
    const vLow = r((cvLow + dutyLow) * VAT_RATE), vHigh = r((cvHigh + dutyHigh) * VAT_RATE);
    lines.push({ key: 'vat', label: 'La TVA, 19,25 %', why: 'Sur la valeur en douane plus le droit de douane.', confidence: cvLow === cvHigh ? 'certain' : 'estime', low: vLow, high: vHigh });
  }
  lines.push({ key: 'other', label: 'Les taxes annexes, environ 2 %', why: 'TCI, CCI, précompte, redevance informatique.', confidence: 'estime', low: r(cvLow * OTHER_TAXES_RATE), high: r(cvHigh * OTHER_TAXES_RATE) });
  caveats.push('Les taxes annexes (environ 2 %) ont été relevées sur un RVC et ne sont pas encore reconsignées ligne à ligne.');

  // Couche C — le passage portuaire, une cascade sur les droits de port.
  if (i.portDuesXaf != null && i.portDuesXaf > 0) {
    const p = r(i.portDuesXaf * PORT_CASCADE);
    lines.push({ key: 'port', label: 'Le passage portuaire', why: 'Les droits de port du terminal, avec sûreté, informatique, frais administratifs et TVA (× 1,293).', confidence: 'certain', low: p, high: p });
  } else {
    const p = r(DEFAULT_PORT_DUES_XAF * PORT_CASCADE);
    lines.push({ key: 'port', label: 'Le passage portuaire', why: 'Sur la base des droits de port de Douala (77 000 F), × 1,293.', confidence: 'estime', low: r(p * 0.9), high: r(p * 1.2) });
  }

  // Couche D — les forfaits.
  lines.push({ key: 'stamp', label: 'Le droit de timbre', why: 'Forfait, hors TVA.', confidence: 'certain', low: STAMP_DUTY_XAF, high: STAMP_DUTY_XAF });
  if (i.bescXaf != null && i.bescXaf > 0) lines.push({ key: 'besc', label: 'Le BESC', why: 'Le montant saisi.', confidence: 'certain', low: r(i.bescXaf), high: r(i.bescXaf) });
  else caveats.push("Le BESC n'est pas compté : saisissez son montant quand vous l'avez.");
  if (i.fileFeesXaf != null && i.fileFeesXaf > 0) lines.push({ key: 'fees', label: 'Les frais de dossier et de documentation', why: 'Le montant saisi.', confidence: 'certain', low: r(i.fileFeesXaf), high: r(i.fileFeesXaf) });
  if (i.truckingXaf != null && i.truckingXaf > 0) lines.push({ key: 'trucking', label: 'Le transport final', why: 'Le montant saisi.', confidence: 'certain', low: r(i.truckingXaf), high: r(i.truckingXaf) });
  else caveats.push("Le transport final (camion jusqu'au client) n'est pas compté.");

  // Le rouge : des actions, pas des montants.
  actions.push('Soumettez la proforma à la SGS avant la visite : sans facture, la valeur peut être multipliée par trois (méthode 6.4).');
  if (i.grossWeightKg != null && i.grossWeightKg > 0) {
    actions.push(`Faites porter ${i.grossWeightKg.toLocaleString('fr-FR')} kg au rapport SGS : un poids faux gonfle le fret réparti, et chaque franc de fret est taxé 1,33 fois.`);
  } else {
    actions.push('Notez le poids brut de la proforma : sans lui, la SGS retient le sien, et chaque franc de fret est taxé 1,33 fois.');
  }
  actions.push(`Sortez la boîte avant le ${FREE_DAYS}e jour : au-delà, chaque jour coûte environ ${DEMURRAGE_PER_DAY_XAF.toLocaleString('fr-FR')} F.`);

  const total = { low: lines.reduce((n, l) => n + l.low, 0), high: lines.reduce((n, l) => n + l.high, 0) };
  return { goodsXaf, customsValue: { low: cvLow, high: cvHigh }, lines, total, demurragePerDayXaf: DEMURRAGE_PER_DAY_XAF, freeDays: FREE_DAYS, actions, caveats };
}

/** « 4 660 000 à 4 820 000 XAF » ou « 25 000 XAF ». */
export function rangeSentence(low: number, high: number): string {
  const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} XAF`;
  return low === high ? f(low) : `${Math.round(low).toLocaleString('fr-FR')} à ${f(high)}`;
}
