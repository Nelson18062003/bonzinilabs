// ============================================================
// APP CLIENT — PaymentsPage (liste des paiements)
// Refonte « Direction A » : réutilise le designKit unifié de l'admin
// (canvas lilas, carte blanche ombre douce, gros tabular-nums,
// StatusPill sémantique — UN ton par sens). Fini la soupe de badges
// bg-* et le FAB violet à halo.
// Logique 100% PRÉSERVÉE : useMyPayments, navigation, états
// loading/vide/liste, libellés i18n, montants XAF + ¥ reçu.
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Plus, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { useMyPayments } from '@/hooks/usePayments';
import { formatXAF, formatCurrencyRMB } from '@/lib/formatters';
import { SURFACE, TEXT, PRIMARY_PILL, StatusPill, PrimaryPill, paymentStatusTone } from '@/mobile/designKit';

const PaymentsPage = () => {
  const { t } = useTranslation('payments');
  const navigate = useNavigate();
  const { data: payments, isLoading } = useMyPayments();

  return (
    <MobileLayout>
      <div className={cn('min-h-[100dvh] px-4 pb-6 pt-5', SURFACE.canvas)}>
        {/* En-tête */}
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className={cn('text-[26px] font-black leading-tight', TEXT.strong)}>{t('title')}</h1>
            <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('subtitle')}</p>
          </div>
          <button
            onClick={() => navigate('/payments/new')}
            aria-label={t('newPayment')}
            className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full', PRIMARY_PILL)}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('h-[76px] animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
            ))}
          </div>
        ) : payments && payments.length > 0 ? (
          <div className={cn('rounded-[24px] px-4', SURFACE.card, SURFACE.shadow)}>
            {payments.map((payment, i) => (
              <button
                key={payment.id}
                onClick={() => navigate(`/payments/${payment.id}`)}
                className={cn(
                  'flex w-full items-center gap-3 py-3.5 text-left transition active:scale-[0.99]',
                  i < payments.length - 1 && 'border-b border-black/[0.05] dark:border-white/[0.06]',
                )}
              >
                <PaymentMethodLogo method={payment.method as 'alipay' | 'wechat' | 'bank_transfer' | 'cash'} size={46} />
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[15px] font-bold', TEXT.strong)}>{payment.reference}</div>
                  <div className={cn('mt-0.5 truncate text-[12px] tabular-nums', TEXT.muted)}>
                    {format(new Date(payment.created_at), 'dd MMM yyyy', { locale: fr })} · {formatCurrencyRMB(payment.amount_rmb)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('text-[15px] font-extrabold tabular-nums', TEXT.strong)}>
                    {formatXAF(payment.amount_xaf)} <span className="text-[11px] font-bold text-[#AAA7BD] dark:text-[#6F6C82]">XAF</span>
                  </span>
                  <StatusPill tone={paymentStatusTone(payment.status)} label={t(`status.${payment.status}`)} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={cn('mt-6 rounded-[24px] p-10 text-center', SURFACE.card, SURFACE.shadow)}>
            <div className={cn('mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full', SURFACE.holder)}>
              <Send className="h-7 w-7" />
            </div>
            <p className={cn('text-[15px]', TEXT.muted)}>{t('noPayments')}</p>
            <div className="mt-5 flex justify-center">
              <PrimaryPill onClick={() => navigate('/payments/new')}>
                <Plus className="h-[17px] w-[17px]" /> {t('newPayment')}
              </PrimaryPill>
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
};

export default PaymentsPage;
