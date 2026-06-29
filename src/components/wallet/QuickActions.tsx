import { ArrowDownToLine, Send, Users, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SURFACE, TEXT } from '@/mobile/designKit';

export const QuickActions = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('client');

  const actions = [
    { icon: ArrowDownToLine, label: t('quickActions.deposit'), to: '/deposits/new' },
    { icon: Send, label: t('quickActions.pay'), to: '/payments/new' },
    { icon: Users, label: t('quickActions.beneficiaries'), to: '/beneficiaries' },
    { icon: History, label: t('quickActions.activity'), to: '/history' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2.5">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => navigate(action.to)}
          className={cn('flex flex-col items-center gap-2 rounded-[20px] p-3 transition active:scale-95', SURFACE.card, SURFACE.shadow)}
        >
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-full', SURFACE.holder)}>
            <action.icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <span className={cn('text-[11px] font-semibold', TEXT.strong)}>{action.label}</span>
        </button>
      ))}
    </div>
  );
};
