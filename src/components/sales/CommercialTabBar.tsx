import { Gauge, Handshake, UserSearch } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import type { TabItem } from '@/components/navigation/types';
import { useCommercialDashboard } from '@/hooks/useSales';
import { currentMonth } from '@/lib/sales';

/**
 * Trois onglets : le mois, les prospects (pastille = relances échues), les
 * clients. Le tableau de bord du mois en cours est déjà en cache (accueil) :
 * la pastille ne coûte pas de requête de plus.
 */
export function CommercialTabBar() {
  const { data } = useCommercialDashboard(currentMonth());
  const due = data?.metrics.prospects_due ?? 0;
  const items: TabItem[] = [
    { to: '/v', icon: Gauge, label: 'Mon mois', end: true },
    { to: '/v/prospects', icon: UserSearch, label: 'Prospects', badgeCount: due },
    { to: '/v/clients', icon: Handshake, label: 'Mes clients' },
  ];
  // Sur grand écran, la barre reste à la largeur de la colonne au lieu de traverser l'écran.
  return <LiquidTabBar items={items} className="md:mx-auto md:max-w-md" />;
}
