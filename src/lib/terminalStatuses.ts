import type { DepositStatus } from '@/types/deposit';
import type { PaymentStatus } from '@/types/payment';

/**
 * Les statuts où il n'y a PLUS rien à faire — LA liste, partagée par les
 * fiches, le collage de preuve, le QR cash et l'urgence (SLA).
 *
 * `rejected` et `cancelled_by_admin` ont déjà recrédité le client : rouvrir
 * la ligne (nouvelle preuve, « refuser » à nouveau) lui laisserait le
 * remboursement ET l'opération. Refuser seulement `completed` ne suffit pas
 * (.claude/rules/security.md, « Statuts terminaux »).
 */
export const TERMINAL_DEPOSIT_STATUSES: DepositStatus[] = ['validated', 'rejected', 'cancelled', 'cancelled_by_admin'];
export const TERMINAL_PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'rejected', 'cancelled_by_admin'];

/** Un dépôt « à corriger » attend le client, pas nous : pas d'urgence à afficher. */
export const DEPOSIT_WAITING_ON_CLIENT: DepositStatus[] = ['pending_correction'];

export const isTerminalDeposit = (s: string) => (TERMINAL_DEPOSIT_STATUSES as string[]).includes(s);
export const isTerminalPayment = (s: string) => (TERMINAL_PAYMENT_STATUSES as string[]).includes(s);
