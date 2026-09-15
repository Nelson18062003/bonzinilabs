import type { PaymentStatus } from '@/types/payment';

/**
 * Le geste principal que l'écran peut proposer sur un paiement — aligné sur
 * ce que la RPC `process_payment` ACCEPTE (migration 20260914093000) :
 *   - `start_processing` : seulement depuis `ready_for_payment` ;
 *   - `complete` : seulement depuis `processing`.
 * Un paiement cash (`cash_pending` → `cash_scanned`) ne passe jamais par là :
 * il se termine par la signature (`confirm_cash_payment`). Proposer
 * « Commencer le paiement » sur un `cash_scanned` menait à un bouton qui
 * échouait toujours (« Le paiement ne peut pas être traité »).
 */
export type PaymentMainAction = 'start_processing' | 'complete' | null;

export function paymentMainAction(status: PaymentStatus | string, canProcess: boolean): PaymentMainAction {
  if (!canProcess) return null;
  if (status === 'ready_for_payment') return 'start_processing';
  if (status === 'processing') return 'complete';
  return null;
}
