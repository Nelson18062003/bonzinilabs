// ============================================================
// Cycle de vie d'un DÉPÔT (client) — source unique pour la liste +
// la fiche refondues (jumeau de paymentLifecycle). Mappe le statut
// métier vers :
//   · step  : avancement 0→3 (déclaré · preuve · vérification · crédité)
//   · kind  : 'todo' (action requise, ROUGE : ajouter/corriger la preuve) ·
//             'progress' (LILAS : Bonzini vérifie) · 'done' (VERT : crédité) ·
//             'failed' (ROUGE terminal : rejeté/annulé)
// Sémantique 3 tons validée : rouge = à toi d'agir · lilas = Bonzini
// travaille · vert = crédité.
// ============================================================
import type { DepositStatus } from '@/types/deposit';

export type LifecycleKind = 'todo' | 'progress' | 'done' | 'failed';

export interface DepositLifecycle {
  step: number; // 0..3
  kind: LifecycleKind;
}

export const LIFECYCLE_COLOR: Record<LifecycleKind, string> = {
  todo: '#C0504D', // rouge — action requise (preuve à ajouter / corriger)
  progress: '#8B5CF6', // lilas — en cours côté Bonzini
  done: '#2E7D52', // vert — crédité
  failed: '#C0504D', // rouge — rejeté / annulé
};

/** Filtre statut de la liste. */
export type DepositFilterTab = 'all' | 'todo' | 'progress' | 'done';

export function depositLifecycle(status: string): DepositLifecycle {
  switch (status) {
    case 'created': // déclaré, preuve pas encore envoyée
    case 'awaiting_proof': // preuve attendue
      return { step: 0, kind: 'todo' };
    case 'pending_correction': // preuve à corriger
      return { step: 1, kind: 'todo' };
    case 'proof_submitted':
      return { step: 1, kind: 'progress' };
    case 'admin_review':
      return { step: 2, kind: 'progress' };
    case 'validated':
      return { step: 3, kind: 'done' };
    case 'rejected':
    case 'cancelled':
    case 'cancelled_by_admin':
      return { step: 3, kind: 'failed' };
    default:
      return { step: 0, kind: 'progress' };
  }
}

/** Libellé court de la pastille — UNIQUE pour la liste ET la fiche. */
export function depositStatusLabel(status: string): string {
  switch (status) {
    case 'created':
    case 'awaiting_proof':
      return 'Preuve en attente';
    case 'pending_correction':
      return 'À corriger';
    case 'proof_submitted':
    case 'admin_review':
      return 'En vérification';
    case 'validated':
      return 'Crédité';
    case 'rejected':
      return 'Rejeté';
    case 'cancelled':
    case 'cancelled_by_admin':
      return 'Annulé';
    default:
      return 'En cours';
  }
}

/** Le dépôt entre-t-il dans l'onglet de filtre demandé ? */
export function matchesDepositFilterTab(status: string, tab: DepositFilterTab): boolean {
  if (tab === 'all') return true;
  const { kind } = depositLifecycle(status);
  if (tab === 'todo') return kind === 'todo';
  if (tab === 'progress') return kind === 'progress';
  if (tab === 'done') return kind === 'done' || kind === 'failed';
  return true;
}

/** Le client peut-il (et doit-il) ajouter une preuve ? */
export function depositNeedsProof(status: DepositStatus): boolean {
  return status === 'created' || status === 'awaiting_proof' || status === 'pending_correction';
}
