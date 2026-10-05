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
