import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { Wallet, ArrowDownToLine, Send, History, User } from 'lucide-react';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { TabItem } from '@/components/navigation/types';

interface BottomNavProps {
  className?: string;
}

export const BottomNav = ({ className }: BottomNavProps) => {
  const { data: unreadCount } = useUnreadNotificationCount();

  const navItems: TabItem[] = [
    { to: '/', icon: Wallet, label: 'Wallet', end: true },
    { to: '/deposits', icon: ArrowDownToLine, label: 'Dépôts' },
    { to: '/payments', icon: Send, label: 'Paiements' },
    { to: '/history', icon: History, label: 'Historique', badgeCount: unreadCount ?? 0 },
    { to: '/profile', icon: User, label: 'Profil' },
  ];

  return <LiquidTabBar items={navItems} className={cn('lg:hidden', className)} />;
};
