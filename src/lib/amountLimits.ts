/**
 * XAF amount guards — the SINGLE source of truth, shared by the client app
 * and the admin app.
 *
 * There is NO business ceiling on a deposit, a payment or an adjustment
 * (decision of 14/09/2026 : real deposits above 100 M XAF exist). What
 * remains is technical : a positive integer, a floor, and
 * `Number.isSafeInteger` so arithmetic never silently loses precision.
 */

/**
 * Floor for a payment. There is no business minimum any more (the historical
 * 10 000 XAF floor was removed in Aug 2026) — 1 simply means "a positive
 * integer amount", which `isValidXafAmount` already requires.
 */
export const MIN_PAYMENT_XAF = 1;

/** Floor for an admin-created deposit. */
export const MIN_DEPOSIT_XAF = 1_000;

/** Group thousands with a narrow no-break space so the figure never wraps. */
function groupXaf(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/[\u202f\u00a0\s]/g, '\u202f');
}

/**
 * `true` when `amount` is safe to send to a financial RPC.
 *
 * Rejects `NaN`/`Infinity`, non-integers, negatives, anything under the floor
 * and anything beyond `Number.MAX_SAFE_INTEGER` where arithmetic silently
 * loses precision. Call this before any balance maths, never after.
 */
export function isValidXafAmount(amount: number, min = 0): boolean {
  return Number.isSafeInteger(amount) && amount >= min && amount > 0;
}

/**
 * Why an amount was refused, in French, or `null` when it is fine.
 * Keeps the wording identical across the deposit and payment wizards.
 */
export function xafAmountError(amount: number, min: number, label = 'Le montant'): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return `${label} est invalide.`;
  if (amount < min) return `${label} minimum est de ${groupXaf(min)} XAF.`;
  return null;
}
