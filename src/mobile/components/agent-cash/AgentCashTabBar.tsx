import { LiquidTabBar } from '@/components/navigation/LiquidTabBar';
import { Banknote, ScanLine } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TabItem } from '@/components/navigation/types';

export function AgentCashTabBar({ className }: { className?: string }) {
  const { t } = useLanguage();

  const items: TabItem[] = [
    { to: '/a', icon: Banknote, label: t('cash_payments'), end: true },
    { to: '/a/scan', icon: ScanLine, label: t('scanner') },
  ];

  return <LiquidTabBar items={items} className={className} />;
}
