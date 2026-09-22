import { Home, PackageCheck, ScanLine } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import type { TabItem } from '@/components/navigation/types';
import { useWarehouseDay } from '@/hooks/useWarehouse';

/** Trois onglets : la journée, pointer une arrivée, remettre à un client. Le badge : ce qui reste à pointer. */
export function WarehouseTabBar() {
  const { data } = useWarehouseDay();
  const items: TabItem[] = [
    { to: '/w', icon: Home, label: 'Journée', end: true },
    { to: '/w/arrivees', icon: PackageCheck, label: 'Pointer', badgeCount: data?.stats.to_checkin ?? 0 },
    { to: '/w/remise', icon: ScanLine, label: 'Remettre', badgeCount: data?.waiting_by_client.length ?? 0 },
  ];
  return <LiquidTabBar items={items} />;
}
