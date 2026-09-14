import { describe, it, expect } from 'vitest';
import { ACTIONABLE_DEPOSIT_STATUSES, ACTIONABLE_PAYMENT_STATUSES } from '@/lib/actionable';
import { TO_PROCESS_STATUSES as DEPOSIT_TO_PROCESS } from '@/lib/depositsList';
import { TO_PROCESS_STATUSES as PAYMENT_TO_PROCESS } from '@/types/payment';

/** Le badge « Opérations », le hub et les segments des listes doivent
 *  compter les mêmes lignes — sinon l'opérateur voit 12 sur la barre et
 *  5 + 3 sur l'écran, et cherche les quatre qui manquent. */
describe('parité des compteurs « à traiter »', () => {
  it('dépôts : le badge compte exactement la file « À traiter » de la liste', () => {
    expect([...ACTIONABLE_DEPOSIT_STATUSES].sort()).toEqual([...DEPOSIT_TO_PROCESS].sort());
  });

  it('paiements : le badge compte « À traiter » + « En cours » (processing), rien d’autre', () => {
    expect([...ACTIONABLE_PAYMENT_STATUSES].sort()).toEqual([...PAYMENT_TO_PROCESS, 'processing'].sort());
  });
});
