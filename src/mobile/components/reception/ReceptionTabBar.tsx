import { Home, Inbox, ScanLine } from 'lucide-react';
import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TabItem } from '@/components/navigation/types';

/** Trois onglets, pas plus : la journée, un nouveau dépôt, les colis en attente. */
export function ReceptionTabBar({ pendingCount = 0 }: { pendingCount?: number }) {
  const { t } = useLanguage();
  const items: TabItem[] = [
    { to: '/r', icon: Home, label: t('rc_today'), end: true },
    { to: '/r/new', icon: ScanLine, label: t('rc_new_deposit') },
    { to: '/r/pending', icon: Inbox, label: t('rc_pending'), badgeCount: pendingCount },
  ];
  return <LiquidTabBar items={items} />;
}
