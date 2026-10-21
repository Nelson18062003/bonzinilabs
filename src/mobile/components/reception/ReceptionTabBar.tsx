import { CalendarDays, MoreHorizontal, Package, ScanLine, Users } from 'lucide-react';
import { RoleTabBar, type RoleTab } from '@/mobile/components/cargo/RoleTabBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReceptionDay } from '@/hooks/useReception';
import { usePackableCount } from '@/hooks/useAirPackages';
import { useReceptionLocation } from '@/mobile/screens/reception/useReceptionLocation';

/**
 * Refonte v2 : Aujourd'hui · Paquets · Scanner (identifier le client d'un
 * nouveau dépôt) · Clients · Plus. « En attente » est rangé dans Plus ; sa
 * pastille passe sur Aujourd'hui. La pastille de Paquets : ce qui attend un paquet (au bureau
 * seulement : l'entrepôt part en bateau). Mêmes onglets dans l'app BONZINI HQ
 * (hq-app/src/tabs.ts).
 */
export function ReceptionTabBar() {
  const { t } = useLanguage();
  const { data: day } = useReceptionDay();
  const { location } = useReceptionLocation();
  const { data: toPack } = usePackableCount(location === 'office');
  const items: RoleTab[] = [
    { to: '/r', icon: CalendarDays, label: t('rc_today'), end: true, badgeCount: day?.pending ?? 0 },
    { to: '/r/paquets', icon: Package, label: t('rc_tab_packages'), badgeCount: location === 'office' ? toPack ?? 0 : 0 },
    { to: '/r/new', icon: ScanLine, label: 'Scanner' },
    { to: '/r/clients', icon: Users, label: t('rc_tab_clients') },
    { to: '/r/plus', icon: MoreHorizontal, label: 'Plus' },
  ];
  return <RoleTabBar items={items} ariaLabel={t('rc_today')} />;
}
