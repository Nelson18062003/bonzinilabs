import { Home, Inbox, Package, ScanLine, Users } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReceptionDay } from '@/hooks/useReception';
import { usePackableCount } from '@/hooks/useAirPackages';
import { readStoredLocation } from '@/lib/reception';
import type { TabItem } from '@/components/navigation/types';

/**
 * Cinq onglets : la journée, un nouveau dépôt, les paquets avion, les clients
 * (étiquettes), les dépôts en attente d'attribution. Les pastilles : ce qui
 * attend un paquet (au bureau seulement : l'entrepôt part en bateau) et les
 * dépôts à attribuer. Mêmes onglets dans l'app BONZINI HQ (hq-app/src/tabs.ts).
 */
export function ReceptionTabBar() {
  const { t } = useLanguage();
  const { data: day } = useReceptionDay();
  const { data: toPack } = usePackableCount(readStoredLocation() === 'office');
  const items: TabItem[] = [
    { to: '/r', icon: Home, label: t('rc_today'), end: true },
    { to: '/r/new', icon: ScanLine, label: t('rc_tab_new') },
    { to: '/r/paquets', icon: Package, label: t('rc_tab_packages'), badgeCount: toPack ?? 0 },
    { to: '/r/clients', icon: Users, label: t('rc_tab_clients') },
    { to: '/r/pending', icon: Inbox, label: t('rc_tab_pending'), badgeCount: day?.pending ?? 0 },
  ];
  return <LiquidTabBar items={items} />;
}
