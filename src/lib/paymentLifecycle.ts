// ============================================================
// Cycle de vie d'un paiement (client) — source unique pour la
// liste + la fiche refondues. Mappe le statut métier vers :
//   · step  : avancement 0→3 (créé · coordonnées · traitement · payé)
//   · kind  : 'todo' (action requise, ROUGE) · 'progress' (LILAS) ·
//             'done' (VERT) · 'failed' (ROUGE terminal)
// Sémantique 3 tons validée : rouge = à toi d'agir · lilas = Bonzini
// travaille · vert = payé.
// ============================================================
export type LifecycleKind = 'todo' | 'progress' | 'done' | 'failed';

export interface PaymentLifecycle {
  step: number; // 0..3
  kind: LifecycleKind;
}

export const LIFECYCLE_COLOR: Record<LifecycleKind, string> = {
  todo: '#C0504D', // rouge — action requise
  progress: '#8B5CF6', // lilas — en cours côté Bonzini
  done: '#2E7D52', // vert — payé
  failed: '#C0504D', // rouge — refusé / annulé
};

/** Filtre statut de la liste. */
export type PaymentFilterTab = 'all' | 'todo' | 'progress' | 'done';

export function paymentLifecycle(status: string): PaymentLifecycle {
  switch (status) {
    case 'waiting_beneficiary_info': // coordonnées manquantes
    case 'cash_pending': // QR cash à présenter
      return { step: 1, kind: 'todo' };
    case 'created':
      return { step: 1, kind: 'progress' };
    case 'ready_for_payment':
      return { step: 2, kind: 'progress' };
    case 'cash_scanned':
    case 'processing':
      return { step: 2, kind: 'progress' };
    case 'completed':
      return { step: 3, kind: 'done' };
    case 'rejected':
    case 'cancelled_by_admin':
      return { step: 3, kind: 'failed' };
    default:
      return { step: 0, kind: 'progress' };
  }
}

/** Le paiement entre-t-il dans l'onglet de filtre demandé ? */
export function matchesFilterTab(status: string, tab: PaymentFilterTab): boolean {
  if (tab === 'all') return true;
  const { kind } = paymentLifecycle(status);
  if (tab === 'todo') return kind === 'todo';
  if (tab === 'progress') return kind === 'progress';
  if (tab === 'done') return kind === 'done' || kind === 'failed';
  return true;
}
