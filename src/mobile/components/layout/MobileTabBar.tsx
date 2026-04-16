import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
  const { data: counts } = useAdminActionableCounts();

  const adminNavItems: TabItem[] = [
    { to: '/m', icon: LayoutDashboard, label: t('home', { defaultValue: 'Accueil' }), end: true },
    { to: '/m/deposits', icon: ArrowDownToLine, label: t('deposits', { defaultValue: 'Dépôts' }), badgeCount: counts?.deposits ?? 0 },
    { to: '/m/payments', icon: ArrowUpFromLine, label: t('payments', { defaultValue: 'Paiements' }), badgeCount: counts?.payments ?? 0 },
    { to: '/m/clients', icon: Users, label: t('clients', { defaultValue: 'Clients' }) },
    { to: '/m/more', icon: MoreHorizontal, label: t('more', { defaultValue: 'Plus' }) },
  ];

  return <LiquidTabBar items={adminNavItems} className={className} />;
}
