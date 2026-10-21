import { CalendarDays, HandHelping, MoreHorizontal, SquareCheckBig } from 'lucide-react';
import { RoleTabBar, type RoleTab } from '@/mobile/components/cargo/RoleTabBar';
import { useWarehouseDay } from '@/hooks/useWarehouse';

/** Refonte v2 : la journée, pointer une arrivée, remettre à un client, Plus. Le badge : ce qui reste à pointer. */
export function WarehouseTabBar() {
  const { data } = useWarehouseDay();
  const items: RoleTab[] = [
    { to: '/w', icon: CalendarDays, label: 'Journée', end: true },
    { to: '/w/arrivees', icon: SquareCheckBig, label: 'Pointer', badgeCount: data?.stats.to_checkin ?? 0 },
    { to: '/w/remise', icon: HandHelping, label: 'Remettre', also: ['/w/bon'], badgeCount: data?.waiting_by_client.length ?? 0 },
    { to: '/w/plus', icon: MoreHorizontal, label: 'Plus' },
  ];
  return <RoleTabBar items={items} ariaLabel="Entrepôt" />;
}
