import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { Wallet, ArrowDownToLine, Send, History, User, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { useMyChatConversations } from '@/hooks/useClientChat';
import { cn } from '@/lib/utils';
import type { TabItem } from '@/components/navigation/types';

interface BottomNavProps {
  className?: string;
}

export const BottomNav = ({ className }: BottomNavProps) => {
  const { t } = useTranslation('client');
  const { t: tSupport } = useTranslation('support');
  const { data: unreadCount } = useUnreadNotificationCount();
  const { data: chatConvs } = useMyChatConversations();
  const supportUnread = (chatConvs ?? []).reduce(
    (sum, c) => sum + (c.unread_count_client ?? 0),
    0
  );

  const navItems: TabItem[] = [
    { to: '/wallet', icon: Wallet, label: t('nav.wallet'), end: true },
    { to: '/deposits', icon: ArrowDownToLine, label: t('nav.deposits') },
    { to: '/payments', icon: Send, label: t('nav.payments') },
    { to: '/history', icon: History, label: t('nav.history'), badgeCount: unreadCount ?? 0 },
    { to: '/support', icon: MessageCircle, label: tSupport('nav.support'), badgeCount: supportUnread },
    { to: '/profile', icon: User, label: t('nav.profile') },
  ];

  return <LiquidTabBar items={navItems} className={cn('lg:hidden', className)} />;
};
