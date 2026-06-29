import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatXAF, formatYuan } from '@/lib/formatters';
import { SURFACE, TEXT, PrimaryPill, SoftPill } from '@/mobile/designKit';

interface SuccessScreenProps {
  amountXAF: number;
  amountRMB: number;
  onNewPayment: () => void;
  onViewPayment: () => void;
  onGoBack?: () => void;
}

export function SuccessScreen({
  amountXAF,
  amountRMB,
  onNewPayment,
  onViewPayment,
  onGoBack,
}: SuccessScreenProps) {
  const { t } = useTranslation('payments');

  return (
    <div className={cn('flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12', SURFACE.canvas)}>
      <div className="mb-6 flex h-20 w-20 animate-scale-in items-center justify-center rounded-full bg-[#DEEFE5] dark:bg-[#1E3A2C]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2E7D52]">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </div>
      </div>

      <h2 className={cn('text-center text-[24px] font-black', TEXT.strong)}>{t('success.paymentCreatedClient')}</h2>
      <p className={cn('mt-1 text-center text-[14px]', TEXT.muted)}>{t('success.requestRecorded')}</p>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[24px] font-black text-[#E8932A]">¥</span>
        <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>{formatYuan(amountRMB)}</span>
      </div>
      <p className={cn('mb-8 mt-1.5 text-[13px] tabular-nums', TEXT.muted)}>
        {t('success.xafDebited', { amount: formatXAF(amountXAF) })}
      </p>

      <div className="w-full max-w-sm space-y-2.5">
        <PrimaryPill onClick={onViewPayment} className="w-full py-[15px] text-[15px]">
          {t('success.viewPayment')}
        </PrimaryPill>
        <SoftPill onClick={onNewPayment} className="w-full py-[15px] text-[15px]">
          {t('success.myPayments')}
        </SoftPill>
        {onGoBack && (
          <button onClick={onGoBack} className={cn('w-full py-3 text-[14px] font-semibold', TEXT.muted)}>
            {t('success.backToHome')}
          </button>
        )}
      </div>
    </div>
  );
}
