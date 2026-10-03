/**
 * L'état du simulateur, et son aller-retour avec l'URL.
 *
 * Comme le Tariff Simulator de Flexport, tout le scénario tient dans le lien :
 * un client le partage sur WhatsApp, le commissionnaire l'ouvre et voit la même
 * chose. Les noms de paramètres sont courts — le lien passe dans un SMS.
 */
import { DEFAULT_XAF_PER, type Currency, type Incoterm, type SimulationInput } from './engine';
import type { TaxRegime } from './levies';
import type { VehicleInfo } from './excise';
import { hsDigits } from './hsCode';

export interface SimState {
  /** Sous-position SH à 6 chiffres. */
  code: string | null;
  /** Taux TEC choisi quand la ligne a une fourchette ; null = le plus haut. */
  duty: number | null;
  amount: string;
  currency: Currency;
  /** XAF pour une unité de la devise. */
  xaf: string;
  incoterm: Incoterm;
  freight: string;
  insurance: string;
  regime: TaxRegime;
  used: boolean;
  year: string;
  cc: string;
  agricultural: boolean;
  hydroquinone: boolean;
  agriUse: boolean;
  weight: string;
  /** Un second code, pour comparer. */
  compare: string | null;
}

export const DEFAULT_STATE: SimState = {
  code: null, duty: null, amount: '', currency: 'CNY', xaf: String(DEFAULT_XAF_PER.CNY), incoterm: 'FOB',
  freight: '', insurance: '', regime: 'reel', used: false, year: '', cc: '', agricultural: false,
  hydroquinone: false, agriUse: false, weight: '', compare: null,
};

const CURRENCIES: Currency[] = ['CNY', 'USD', 'EUR', 'XAF'];
const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CFR', 'CIF'];
const REGIMES: TaxRegime[] = ['reel', 'simplifie', 'hors_fichier', 'exonere'];

const six = (v: string | null) => {
  const d = v ? hsDigits(v) : '';
  return d.length >= 6 ? d.slice(0, 6) : null;
};
const oneOf = <T extends string>(list: readonly T[], v: string | null, fallback: T): T =>
  (v && (list as readonly string[]).includes(v) ? v : fallback) as T;
const digits = (v: string | null) => (v ?? '').replace(/[^\d.,]/g, '');

export function parseSimState(p: URLSearchParams): SimState {
  const currency = oneOf(CURRENCIES, p.get('cur'), DEFAULT_STATE.currency);
  const duty = p.get('d');
  return {
    code: six(p.get('c')),
    duty: duty != null && duty !== '' && Number.isFinite(Number(duty)) ? Number(duty) : null,
    amount: digits(p.get('a')),
    currency,
    xaf: digits(p.get('x')) || String(DEFAULT_XAF_PER[currency]),
    incoterm: oneOf(INCOTERMS, p.get('inc'), DEFAULT_STATE.incoterm),
    freight: digits(p.get('f')),
    insurance: digits(p.get('i')),
    regime: oneOf(REGIMES, p.get('reg'), DEFAULT_STATE.regime),
    used: p.get('used') === '1',
    year: digits(p.get('y')).slice(0, 4),
    cc: digits(p.get('cc')),
    agricultural: p.get('agri') === '1',
    hydroquinone: p.get('hq') === '1',
    agriUse: p.get('au') === '1',
    weight: digits(p.get('w')),
    compare: six(p.get('vs')),
  };
}

/** Seules les valeurs différentes du défaut vont dans l'URL. */
export function serializeSimState(s: SimState): string {
  const p = new URLSearchParams();
  const put = (k: string, v: string | null | undefined) => { if (v) p.set(k, v); };
  put('c', s.code);
  if (s.duty != null) p.set('d', String(s.duty));
  put('a', s.amount);
  if (s.currency !== DEFAULT_STATE.currency) p.set('cur', s.currency);
  if (s.xaf && s.xaf !== String(DEFAULT_XAF_PER[s.currency])) p.set('x', s.xaf);
  if (s.incoterm !== DEFAULT_STATE.incoterm) p.set('inc', s.incoterm);
  put('f', s.freight);
  put('i', s.insurance);
  if (s.regime !== DEFAULT_STATE.regime) p.set('reg', s.regime);
  if (s.used) p.set('used', '1');
  put('y', s.year);
  put('cc', s.cc);
  if (s.agricultural) p.set('agri', '1');
  if (s.hydroquinone) p.set('hq', '1');
  if (s.agriUse) p.set('au', '1');
  put('w', s.weight);
  put('vs', s.compare);
  return p.toString();
}

/** « 1 250 000,5 » → 1250000.5 ; vide ou ≤ 0 → null. */
export function num(v: string): number | null {
  const n = Number(v.replace(/[\s\u202F\u00A0]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type VehicleKind = 'car' | 'utility' | 'tractor' | 'motorcycle' | null;

/** Le formulaire véhicule à montrer pour ce code. */
export function vehicleKindOf(code: string | null): VehicleKind {
  if (!code) return null;
  if (code.startsWith('8703')) return 'car';
  if (/^(870130|87019)/.test(code)) return 'tractor';
  if (/^(8702|8704|87012|871610|871631|871639|871640)/.test(code)) return 'utility';
  if (code.startsWith('8711')) return 'motorcycle';
  return null;
}

/** L'entrée du moteur, ou null tant que le montant ou le code manquent. */
export function toSimulationInput(s: SimState, code: string, dutyRate: number, declarationYear: number): SimulationInput | null {
  const amount = num(s.amount), xaf = num(s.xaf);
  if (amount == null || xaf == null) return null;
  const kind = vehicleKindOf(code);
  let vehicle: VehicleInfo | null = null;
  if (kind === 'car' || kind === 'utility' || kind === 'tractor') {
    const year = num(s.year), cc = num(s.cc);
    vehicle = {
      kind: kind === 'car' ? 'car' : 'utility',
      engineCc: cc,
      // Neuf : l'âge est zéro ; d'occasion : il faut l'année.
      firstRegistrationYear: s.used ? year : declarationYear,
      used: s.used,
      agricultural: kind === 'tractor' && s.agricultural,
    };
  }
  return {
    code, dutyRate, goodsAmount: amount, currency: s.currency, xafPerUnit: s.currency === 'XAF' ? 1 : xaf,
    incoterm: s.incoterm, freightXaf: num(s.freight), insuranceXaf: num(s.insurance),
    declarationYear, regime: s.regime, vehicle,
    containsHydroquinone: s.hydroquinone, agriculturalUse: s.agriUse || (kind === 'tractor' && s.agricultural),
    netWeightKg: num(s.weight),
  };
}

/** Les bandes TEC possibles entre deux bornes (quand la ligne nationale décide). */
export function bandsBetween(min: number | null, max: number | null): number[] {
  if (min == null || max == null) return [];
  return [0, 5, 10, 20, 30, 40].filter((b) => b >= min && b <= max);
}
