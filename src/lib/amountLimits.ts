/**
 * XAF amount caps — the SINGLE source of truth, shared by the client app and
 * the admin app.
 *
 * The 50 M XAF ceiling and the `Number.isSafeInteger` guard are the rule in
 * `.claude/rules/security.md`. They were enforced only on the client-facing
 * forms (`NewPaymentPage`, `NewDepositPage`) while the admin wizards — which
 * move far more money per session — had no upper bound at all: one stray zero
 * in the admin deposit form credited a wallet 10× over with nothing to stop it.
 * Both sides now read these constants.
 */

/** Hard ceiling on any single deposit or payment. */
export const MAX_AMOUNT_XAF = 50_000_000;

/** Floor for a payment — below this the ¥ conversion is not worth a transfer. */
export const MIN_PAYMENT_XAF = 10_000;

/** Floor for an admin-created deposit. */
export const MIN_DEPOSIT_XAF = 1_000;

/** Group thousands with a narrow no-break space so the figure never wraps. */
function groupXaf(amount: number): string {
  return amount.toLocaleString('fr-FR').replace(/[\u202f\u00a0\s]/g, '\u202f');
}

/** Formatted ceiling for user-facing messages: `50 000 000`. */
export const MAX_AMOUNT_XAF_LABEL = groupXaf(MAX_AMOUNT_XAF);

/**
 * `true` when `amount` is safe to send to a financial RPC.
 *
 * Rejects `NaN`/`Infinity`, non-integers, negatives, anything past the cap, and
 * anything beyond `Number.MAX_SAFE_INTEGER` where arithmetic silently loses
 * precision. Call this before any balance maths, never after.
 */
export function isValidXafAmount(amount: number, min = 0): boolean {
  return (
    Number.isSafeInteger(amount) &&
    amount >= min &&
    amount > 0 &&
    amount <= MAX_AMOUNT_XAF
  );
}

/**
 * Why an amount was refused, in French, or `null` when it is fine.
 * Keeps the wording identical across the deposit and payment wizards.
 */
export function xafAmountError(amount: number, min: number, label = 'Le montant'): string | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return `${label} est invalide.`;
  if (amount < min) return `${label} minimum est de ${groupXaf(min)} XAF.`;
  if (amount > MAX_AMOUNT_XAF) return `${label} maximum est de ${MAX_AMOUNT_XAF_LABEL} XAF.`;
  return null;
}
