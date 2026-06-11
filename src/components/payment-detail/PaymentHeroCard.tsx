// ============================================================
// Hero card — détail paiement client. Refonte « Direction A » (designKit) :
// carte blanche ombre douce, gros ¥ + XAF, taux en bloc lilas, date.
// Bouton reçu = pastille neutre. Logique inchangée.
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileDown, Loader2, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  formatNumber,
  formatRelativeDate,
} from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import type { Payment } from '@/hooks/usePayments';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { isStatusLocked, normalizeRateToInt } from './types';

interface Props {
  payment: Payment;
  onDownloadReceipt: () => void;
  isGeneratingPDF: boolean;
}

export function PaymentHeroCard({ payment, onDownloadReceipt, isGeneratingPDF }: Props) {
  const { t } = useTranslation('payments');

  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;
  const rateInt = normalizeRateToInt(payment.exchange_rate);
  const locked = isStatusLocked(payment.status);

  return (
    <div className={cn('rounded-[24px] p-6', SURFACE.card, SURFACE.shadow)}>
      {/* Method logo + label + download button */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PaymentMethodLogo method={payment.method} size={48} />
          <span className={cn('text-[17px] font-bold', TEXT.strong)}>{methodLabel}</span>
        </div>
        <button
          onClick={onDownloadReceipt}
          disabled={isGeneratingPDF}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-50',
            SURFACE.holder,
          )}
          aria-label={t('detail.downloadReceipt')}
        >
          {isGeneratingPDF ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
        </button>
      </div>

      {/* Primary amount: RMB */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-[26px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
        <span className={cn('text-[40px] font-black leading-none tabular-nums', TEXT.strong)}>
          {formatNumber(payment.amount_rmb, 2)}
        </span>
      </div>

      {/* Secondary amount: XAF */}
      <p className={cn('mt-1.5 text-[18px] font-bold tabular-nums', TEXT.muted)}>
        {formatCurrency(payment.amount_xaf)}
      </p>

      {/* Exchange rate */}
      <div className="mt-4 rounded-2xl bg-[#EDEAFA] p-3.5 dark:bg-[#221F33]">
        <div className="flex items-start gap-2">
          <TrendingUp className={cn('mt-0.5 h-4 w-4 shrink-0', TEXT.muted)} />
          <div className="text-[13px]">
            <p className={cn('font-bold', TEXT.strong)}>
              {t('detail.rateApplied')} : 1M XAF = ¥{formatNumber(rateInt)}
            </p>
            <p className={cn('mt-0.5', TEXT.muted)}>
              ¥{formatNumber(payment.amount_rmb, 2)} = {formatNumber(payment.amount_xaf)} XAF
            </p>
          </div>
        </div>
      </div>

      {/* Date info */}
      <p className={cn('mt-3 text-[11px]', TEXT.muted)}>
        {t('detail.createdAt')} {formatRelativeDate(payment.created_at)} ·{' '}
        {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
        {locked && ` · ${t('detail.locked')}`}
      </p>
    </div>
  );
}
