/**
 * Ce qu'on peut encore faire à un paiement — miroir des gardes SQL
 * (`cancel_payment`, `admin_correct_payment`, `admin_update_payment_beneficiary`
 * dans 20260918110000_payment_cancel_reason_and_edit.sql). L'UI ne cache
 * jamais un bouton que le serveur accepterait, et n'en montre jamais un
 * qu'il refuserait.
 */
import type { PaymentStatus } from '@/types/payment';

/** Statuts qui ont DÉJÀ recrédité le portefeuille : rien à annuler, rien à rembourser. */
export const REFUNDED_PAYMENT_STATUSES: readonly PaymentStatus[] = ['rejected', 'cancelled_by_admin'];

/** Statuts clos : effectué, refusé, annulé. */
export const CLOSED_PAYMENT_STATUSES: readonly PaymentStatus[] = ['completed', 'rejected', 'cancelled_by_admin'];


export function isRefundedPayment(status: string): boolean {
  return (REFUNDED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function isClosedPayment(status: string): boolean {
  return (CLOSED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/** Annulable = pas déjà remboursé. Un paiement EFFECTUÉ s'annule (super admin, avec motif). */
export function canCancelPayment(status: string, isSuperAdmin: boolean): boolean {
  return isSuperAdmin && !isRefundedPayment(status);
}

/** Le serveur exige un motif pour annuler un paiement déjà effectué. */
export function cancelRequiresReason(status: string): boolean {
  return status === 'completed';
}

/**
 * Montants / taux : tout agent habilité tant que le paiement est en cours ;
 * super admin seul une fois le paiement clos.
 */
export function canEditPaymentAmounts(status: string, canProcess: boolean, isSuperAdmin: boolean): boolean {
  if (isClosedPayment(status)) return isSuperAdmin;
  return canProcess;
}

/**
 * Bénéficiaire : tant que le paiement n'est pas clos (miroir de
 * `admin_update_payment_beneficiary`, qui ne refuse que effectué / refusé /
 * annulé). Un compte bancaire faux se corrige aussi pendant « en cours ».
 * Jamais en cash : le bénéficiaire est celui qui signe.
 */
export function canEditPaymentBeneficiary(status: string, method: string, canProcess: boolean): boolean {
  if (method === 'cash') return false;
  return canProcess && !isClosedPayment(status);
}

/**
 * Rétro-compat taux : les anciens paiements stockent un décimal (0.01153),
 * les récents un entier « ¥ pour 1 000 000 XAF » (11 530).
 */
export function normalizeRateInt(rate: number | null | undefined): number {
  if (!rate) return 0;
  return rate < 1 ? Math.round(rate * 1_000_000) : Math.round(rate);
}

/** ¥ attendus pour un montant XAF à un taux « ¥ / 1 M XAF ». */
export function rmbForXaf(xaf: number, rateInt: number): number {
  return Math.round(((xaf * rateInt) / 1_000_000) * 100) / 100;
}

/**
 * Les trois valeurs se tiennent-elles ? Tolérance de 2 % : les arrondis de
 * saisie ne doivent pas déclencher l'alerte, une erreur de frappe (un zéro
 * de trop) doit.
 */
export function amountsCoherent(xaf: number, rmb: number, rateInt: number): boolean {
  if (xaf <= 0 || rmb <= 0 || rateInt <= 0) return true;
  const expected = rmbForXaf(xaf, rateInt);
  return Math.abs(expected - rmb) / expected <= 0.02;
}

export type WalletDelta =
  | { kind: 'none' }
  | { kind: 'debit'; amount: number }
  | { kind: 'credit'; amount: number }
  | { kind: 'refunded' };

/**
 * Effet d'une correction du montant XAF sur le portefeuille : le débit est
 * encore « détenu » sauf si le paiement a déjà été remboursé.
 */
export function walletDeltaForCorrection(status: string, oldXaf: number, newXaf: number): WalletDelta {
  if (newXaf === oldXaf) return { kind: 'none' };
  if (isRefundedPayment(status)) return { kind: 'refunded' };
  const delta = newXaf - oldXaf;
  return delta > 0 ? { kind: 'debit', amount: delta } : { kind: 'credit', amount: -delta };
}
