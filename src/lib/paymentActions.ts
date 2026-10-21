import type { PaymentStatus } from '@/types/payment';

/**
 * Le geste principal que l'écran peut proposer sur un paiement — aligné sur
 * ce que la RPC `process_payment` ACCEPTE (migration 20260914093000) :
 *   - `start_processing` : seulement depuis `ready_for_payment` ;
 *   - `complete` : seulement depuis `processing`.
 * Un paiement CASH ne passe jamais par là (migration 20261021100000 :
 * process_payment le refuse) : il se remet au bureau contre le scan du QR
 * du client (`scan_cash_payment`) puis la signature du bénéficiaire
 * (`confirm_cash_payment`) — voir `cashHandoverStep`.
 */
export type PaymentMainAction = 'start_processing' | 'complete' | null;

export function paymentMainAction(
  status: PaymentStatus | string,
  canProcess: boolean,
  method?: string | null,
): PaymentMainAction {
  if (!canProcess) return null;
  if (method === 'cash') return null;
  if (status === 'ready_for_payment') return 'start_processing';
  if (status === 'processing') return 'complete';
  return null;
}

/**
 * Où en est la remise d'un paiement cash — miroir des RPC :
 *   - `scan` : le QR du client doit être scanné (`cash_pending` seulement ;
 *     les anciens cash en ready_for_payment / processing y ont été remis
 *     par la migration 20261021100000) ;
 *   - `sign` : QR scanné, le bénéficiaire signe à la remise (`cash_scanned`) ;
 *   - `null` : rien à faire (clos, ou pas encore prêt).
 */
export type CashHandoverStep = 'scan' | 'sign' | null;

export function cashHandoverStep(status: PaymentStatus | string): CashHandoverStep {
  if (status === 'cash_pending') return 'scan';
  if (status === 'cash_scanned') return 'sign';
  return null;
}
