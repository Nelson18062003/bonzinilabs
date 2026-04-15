import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { Wallet, ArrowDownToLine, Send, History, User } from 'lucide-react';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { TabItem } from '@/components/navigation/types';

interface BottomNavProps {
  className?: string;
}

export const BottomNav = ({ className }: BottomNavProps) => {
  const { data: unreadCount } = useUnreadNotificationCount();
  const { t } = useTranslation('common');

  const navItems: TabItem[] = [
    { to: '/wallet', icon: Wallet, label: t('nav.wallet'), end: true },
    { to: '/deposits', icon: ArrowDownToLine, label: t('nav.deposits') },
    { to: '/payments', icon: Send, label: t('nav.payments') },
    { to: '/history', icon: History, label: t('nav.history'), badgeCount: unreadCount ?? 0 },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return <LiquidTabBar items={navItems} className={cn('lg:hidden', className)} />;
};
