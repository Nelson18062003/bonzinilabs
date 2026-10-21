import { Home, MoreHorizontal, Package, ScanLine, Users } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePackableCount } from '@/hooks/useAirPackages';
import { useReceptionLocation } from '@/mobile/screens/reception/useReceptionLocation';
import type { TabItem } from '@/components/navigation/types';

/**
 * Refonte v2 : Aujourd'hui · Paquets · Scanner (identifier le client d'un
 * nouveau dépôt) · Clients · Plus. « En attente » est rangé dans Plus et dans
 * Aujourd'hui. La pastille de Paquets : ce qui attend un paquet (au bureau
 * seulement : l'entrepôt part en bateau). Mêmes onglets dans l'app BONZINI HQ
 * (hq-app/src/tabs.ts).
 */
export function ReceptionTabBar() {
  const { t } = useLanguage();
  const { location } = useReceptionLocation();
  const { data: toPack } = usePackableCount(location === 'office');
  const items: TabItem[] = [
    { to: '/r', icon: Home, label: t('rc_today'), end: true },
    { to: '/r/paquets', icon: Package, label: t('rc_tab_packages'), badgeCount: location === 'office' ? toPack ?? 0 : 0 },
    { to: '/r/new', icon: ScanLine, label: 'Scanner' },
    { to: '/r/clients', icon: Users, label: t('rc_tab_clients') },
    { to: '/r/plus', icon: MoreHorizontal, label: 'Plus' },
  ];
  return <LiquidTabBar items={items} />;
}
