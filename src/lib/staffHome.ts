// ============================================================
// L'espace de départ de chaque rôle du personnel — une seule connexion,
// et chacun arrive chez lui :
//   · agent cash        → /a  (paiements cash)
//   · réceptionnaire    → /r  (réception des colis, Guangzhou)
//   · agent d'entrepôt  → /w  (arrivées et remises, Douala)
//   · commissionnaire   → /m/douane (la file des classements à signer)
//   · commercial        → /v  (ses prospects, ses clients, ses chiffres)
//   · tous les autres   → /m  (administration : super admin, opérations,
//                               support, chargé de clientèle, trésorier)
// Chaque espace accepte le rôle qu'on y envoie : pas de boucle possible.
// ============================================================
import type { AppRole } from '@/contexts/AdminAuthContext';

export function staffHomeFor(role: AppRole | null | undefined): string {
  switch (role) {
    case 'cash_agent': return '/a';
    case 'receptionist': return '/r';
    case 'warehouse_agent': return '/w';
    case 'customs_broker': return '/m/douane';
    case 'commercial': return '/v';
    default: return '/m';
  }
}

/**
 * La page de connexion À DONNER à un membre du personnel (message d'accès,
 * redirection sans session). Les espaces de terrain ont chacun la leur, avec
 * email + mot de passe — leurs adresses sont souvent inventées
 * (« prenom@bonzini.com ») et ne reçoivent pas de code :
 *   /a/login · /r/login · /w/login · /v/login (commercial, 06/10).
 * Les autres passent par /m/login, qui sur le site propose le code email,
 * la clé d'accès et Google — le mot de passe n'y est que dans l'app HQ.
 */
export function staffLoginFor(role: AppRole | null | undefined): string {
  switch (role) {
    case 'cash_agent': return '/a/login';
    case 'receptionist': return '/r/login';
    case 'warehouse_agent': return '/w/login';
    case 'commercial': return '/v/login';
    default: return '/m/login';
  }
}

/** Sa page de connexion accepte-t-elle le mot de passe dans un navigateur ? */
export function staffLoginTakesPassword(role: AppRole | null | undefined): boolean {
  return staffLoginFor(role) !== '/m/login';
}
