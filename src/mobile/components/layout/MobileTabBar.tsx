import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import { useAdminActionableCounts } from '@/hooks/useAdminNotifications';
import type { TabItem } from '@/components/navigation/types';

interface MobileTabBarProps {
  className?: string;
}

export function MobileTabBar({ className }: MobileTabBarProps) {
  const { data: counts } = useAdminActionableCounts();

  const adminNavItems: TabItem[] = [
    { to: '/m', icon: LayoutDashboard, label: 'Accueil', end: true },
    { to: '/m/deposits', icon: ArrowDownToLine, label: 'Dépôts', badgeCount: counts?.deposits ?? 0 },
    { to: '/m/payments', icon: ArrowUpFromLine, label: 'Paiements', badgeCount: counts?.payments ?? 0 },
    { to: '/m/clients', icon: Users, label: 'Clients' },
    { to: '/m/more', icon: MoreHorizontal, label: 'Plus' },
  ];

  return <LiquidTabBar items={adminNavItems} className={className} />;
}
