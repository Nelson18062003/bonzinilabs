// ============================================================
// ACHAT D'USDT — le calcul des montants, sans React.
//
// Cinq valeurs se tiennent : ce que chaque compte a payé (XAF), le total
// payé, le taux (XAF par USDT) et les USDT reçus.
//
//     total = somme des comptes          total = USDT × taux
//
// L'opérateur tape ce qu'il SAIT, dans l'ordre où il le sait ; le reste se
// calcule. Les cas de la vraie vie :
//
//   · un seul compte : deux des trois montants (total, taux, USDT) ; le
//     troisième se calcule. Le compte paie le total.
//   · plusieurs comptes, chacun avec son montant : le total EST la somme
//     (calculé, verrouillé). Le taux donne les USDT ; les USDT donnent le
//     taux.
//   · plusieurs comptes, un seul sans montant : le total vient d'ailleurs
//     (tapé, ou USDT × taux) et ce compte prend le RESTE.
//   · plusieurs comptes, plusieurs sans montant : il reste « à répartir ».
//
// Quand l'opérateur a tapé les trois montants, c'est le plus ANCIEN qui se
// recalcule (taper dans un champ calculé le reprend en main). Vider un champ
// le rend de nouveau calculable.
//
// Arrondis : XAF entier, USDT à 2 décimales ; le taux n'est jamais arrondi
// dans le calcul (seulement à l'affichage).
// ============================================================

export type LinkedKey = 'total' | 'rate' | 'usdt';
export type Source = 'typed' | 'computed' | 'sum' | null;

export interface PurchaseInputs {
  /** Les montants TAPÉS (null = vide). */
  total: number | null;
  rate: number | null;
  usdt: number | null;
  /** L'ordre de frappe des montants tapés, du plus ancien au plus récent. */
  order: LinkedKey[];
  /** Le montant TAPÉ de chaque compte (null = vide). Un seul compte : ignoré, il paie le total. */
  splits: (number | null)[];
}

export interface SplitLine {
  amount: number | null;
  /** Déduit (le reste), pas tapé. */
  computed: boolean;
}

export interface PurchaseResolution {
  total: number | null;
  rate: number | null;
  usdt: number | null;
  source: Record<LinkedKey, Source>;
  /** Plusieurs comptes, tous chiffrés : le total est leur somme et ne se tape pas. */
  totalLocked: boolean;
  splits: SplitLine[];
  /** Total − somme des comptes : 0 = la répartition tombe juste ; null = total inconnu. */
  remaining: number | null;
}

export const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const has = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

/** Trois montants liés : le plus ancien des trois (ou celui qui manque) se calcule. */
function linked(t: number | null, r: number | null, u: number | null, order: LinkedKey[]) {
  const typed = order.filter((k) => has({ total: t, rate: r, usdt: u }[k]));
  const lastTwo = typed.slice(-2);
  // Personne n'a rien tapé, ou un seul : par défaut c'est le total qui se calcule.
  const computed = (['total', 'usdt', 'rate'] as const).find((k) => !lastTwo.includes(k)) ?? 'total';
  const out = { total: has(t) ? t : null, rate: has(r) ? r : null, usdt: has(u) ? u : null };
  if (computed === 'total') out.total = out.usdt && out.rate ? round(out.usdt * out.rate, 0) : null;
  else if (computed === 'usdt') out.usdt = out.total && out.rate ? round(out.total / out.rate, 2) : null;
  else out.rate = out.total && out.usdt ? out.total / out.usdt : null;
  const src = (k: LinkedKey): Source => (out[k] === null ? null : k === computed ? 'computed' : 'typed');
  return { ...out, computed, source: { total: src('total'), rate: src('rate'), usdt: src('usdt') } };
}

export function resolvePurchase(input: PurchaseInputs): PurchaseResolution {
  const n = input.splits.length;

  // ── Un seul compte : il paie le total ────────────────────────────────
  if (n <= 1) {
    const r = linked(input.total, input.rate, input.usdt, input.order);
    return {
      total: r.total,
      rate: r.rate,
      usdt: r.usdt,
      source: r.source,
      totalLocked: false,
      splits: [{ amount: r.total, computed: true }],
      remaining: r.total === null ? null : 0,
    };
  }

  const typedSplits = input.splits.map((v) => (has(v) ? v : null));
  const empty = typedSplits.filter((v) => v === null).length;
  const typedSum = typedSplits.reduce<number>((s, v) => s + (v ?? 0), 0);

  // ── Plusieurs comptes, tous chiffrés : le total est la somme ─────────
  if (empty === 0) {
    const total = typedSum;
    // Le taux et les USDT : celui qui est tapé reste ; s'ils le sont tous
    // deux, le plus ancien se recalcule sur le nouveau total.
    const ru = input.order.filter((k): k is 'rate' | 'usdt' => (k === 'rate' || k === 'usdt') && has(input[k]));
    let rate = has(input.rate) ? input.rate : null;
    let usdt = has(input.usdt) ? input.usdt : null;
    let computed: 'rate' | 'usdt' | null = null;
    if (ru.length === 2) computed = ru[0];
    else if (ru.length === 1) computed = ru[0] === 'rate' ? 'usdt' : 'rate';
    if (computed === 'usdt') usdt = rate ? round(total / rate, 2) : null;
    if (computed === 'rate') rate = usdt ? total / usdt : null;
    return {
      total,
      rate,
      usdt,
      source: {
        total: 'sum',
        rate: rate === null ? null : computed === 'rate' ? 'computed' : 'typed',
        usdt: usdt === null ? null : computed === 'usdt' ? 'computed' : 'typed',
      },
      totalLocked: true,
      splits: typedSplits.map((amount) => ({ amount, computed: false })),
      remaining: 0,
    };
  }

  // ── Au moins un compte sans montant : le total vient des montants ────
  const r = linked(input.total, input.rate, input.usdt, input.order);
  let remaining = r.total === null ? null : r.total - typedSum;
  const splits: SplitLine[] = typedSplits.map((amount) => ({ amount, computed: false }));
  if (empty === 1 && remaining !== null && remaining > 0) {
    const i = typedSplits.indexOf(null);
    splits[i] = { amount: remaining, computed: true };
    remaining = 0;
  }
  return { total: r.total, rate: r.rate, usdt: r.usdt, source: r.source, totalLocked: false, splits, remaining };
}

/**
 * Un montant tapé (ou vidé) : la nouvelle frappe passe en dernier, un champ
 * vidé sort de l'ordre et redevient calculable.
 */
export function typeAmount(input: PurchaseInputs, key: LinkedKey, value: number | null): PurchaseInputs {
  const order = input.order.filter((k) => k !== key);
  return { ...input, [key]: value, order: has(value) ? [...order, key] : order };
}

/**
 * Passer d'un compte à plusieurs : le total déjà connu reste ce qu'il était
 * (tapé, ou USDT × taux), et les deux comptes partent VIDES — le premier
 * montant tapé laisse le reste au second. Pré-remplir le premier avec tout
 * le total ferait faux : la frappe du second ajouterait au lieu de répartir.
 */
export function splitAccounts(input: PurchaseInputs): PurchaseInputs {
  return { ...input, splits: [null, null] };
}

/** Ajouter un compte à une répartition existante (vide). */
export function addAccount(input: PurchaseInputs): PurchaseInputs {
  return { ...input, splits: [...input.splits, null] };
}

/**
 * Retirer un compte. S'il n'en reste qu'un, il paie tout :
 *   · il avait son montant → c'est désormais le total payé ;
 *   · il n'en avait pas → le total reste ce qu'il était (tapé, ou USDT × taux).
 */
export function removeAccount(input: PurchaseInputs, index: number): PurchaseInputs {
  const splits = input.splits.filter((_, i) => i !== index);
  if (splits.length > 1) return { ...input, splits };
  const kept = splits[0] ?? null;
  const base: PurchaseInputs = { ...input, splits: [null] };
  return has(kept) ? typeAmount(base, 'total', kept) : base;
}

/** Un montant de compte tapé (ou vidé). */
export function typeSplit(input: PurchaseInputs, index: number, value: number | null): PurchaseInputs {
  return { ...input, splits: input.splits.map((v, i) => (i === index ? value : v)) };
}

export const EMPTY_PURCHASE: PurchaseInputs = { total: null, rate: null, usdt: null, order: [], splits: [null] };

/**
 * L'écart du taux à une référence (coût moyen du stock, dernier achat) :
 * au-delà de `threshold` (8 % par défaut), c'est sans doute une faute de
 * frappe (655 tapé 6 550, ou 65,5). Renvoie l'écart signé, ou null.
 */
export function rateDeviation(rate: number | null, reference: number | null | undefined, threshold = 0.08): number | null {
  if (!has(rate) || !reference || !Number.isFinite(reference) || reference <= 0) return null;
  const d = rate / reference - 1;
  return Math.abs(d) > threshold ? d : null;
}
