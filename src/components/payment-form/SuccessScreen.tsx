import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { SURFACE, TEXT, PrimaryPill, SoftPill } from '@/mobile/designKit';

type PaymentMethod = 'alipay' | 'wechat' | 'bank_transfer' | 'cash';

interface SuccessScreenProps {
  variant: 'admin' | 'client';
  amountXAF: number;
  amountRMB: number;
  method: PaymentMethod;
  clientName?: string;
  onNewPayment: () => void;
  onViewPayment: () => void;
  onGoBack?: () => void;
}

export function SuccessScreen({
  variant,
  amountXAF,
  amountRMB,
  method,
  clientName,
  onNewPayment,
  onViewPayment,
  onGoBack,
}: SuccessScreenProps) {
  const { t } = useTranslation('payments');

  const METHOD_LABELS: Record<PaymentMethod, string> = {
    alipay: t('method.alipay'),
    wechat: t('method.wechat'),
    bank_transfer: t('method.bank_transfer_full'),
    cash: t('method.cash'),
  };

  if (variant === 'admin') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        {/* Animated checkmark */}
        <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mb-6 animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-2">{t('success.paymentCreated')}</h1>

        <div className="flex items-center gap-2 mb-2">
          <PaymentMethodLogo method={method} size={28} />
          <span className="text-sm text-muted-foreground">{METHOD_LABELS[method]}</span>
        </div>

        <p className="text-3xl font-bold text-primary mb-1">¥{formatRMB(amountRMB)}</p>
        <p className="text-sm text-muted-foreground mb-1">{formatXAF(amountXAF)} XAF</p>
        {clientName && (
          <p className="text-sm text-muted-foreground">{t('success.forClient', { name: clientName })}</p>
        )}

        <div className="w-full max-w-xs mt-8 space-y-3">
          <button
            onClick={onNewPayment}
            className="w-full h-12 rounded-xl border border-border font-medium transition-colors hover:bg-muted"
          >
            {t('success.newPayment')}
          </button>
          <button
            onClick={onViewPayment}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium"
          >
            {t('success.viewSheet')}
          </button>
        </div>
      </div>
    );
  }

  // Client variant
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
        <span className="text-[24px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
        <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>{formatRMB(amountRMB)}</span>
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
