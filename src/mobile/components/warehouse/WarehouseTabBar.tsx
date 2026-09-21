import { Home, PackageCheck, ScanLine } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import type { TabItem } from '@/components/navigation/types';

/** Trois onglets : la journée, pointer une arrivée, remettre à un client. */
export function WarehouseTabBar({ toCheckin = 0 }: { toCheckin?: number }) {
  const items: TabItem[] = [
    { to: '/w', icon: Home, label: 'Journée', end: true },
    { to: '/w/arrivees', icon: PackageCheck, label: 'Pointer', badgeCount: toCheckin },
    { to: '/w/remise', icon: ScanLine, label: 'Remettre' },
  ];
  return <LiquidTabBar items={items} />;
}
