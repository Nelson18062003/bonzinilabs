// ============================================================
// L'espace de départ de chaque rôle du personnel — une seule connexion,
// et chacun arrive chez lui :
//   · agent cash        → /a  (paiements cash)
//   · réceptionnaire    → /r  (réception des colis, Guangzhou)
//   · agent d'entrepôt  → /w  (arrivées et remises, Douala)
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
    default: return '/m';
  }
}
