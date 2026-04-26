// ============================================================
// Hero card sitting at the top of the client payment-detail page.
// Shows the method logo, the RMB / XAF amounts, the applied rate
// and the creation date with a download-receipt button.
// ============================================================
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileDown, Loader2, TrendingUp } from 'lucide-react';
import {
  formatCurrency,
  formatCurrencyRMB,
  formatNumber,
  formatRelativeDate,
} from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import type { Payment } from '@/hooks/usePayments';
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
    <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
      {/* Method logo + label + download button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <PaymentMethodLogo method={payment.method} size={48} />
          <span className="text-lg font-semibold">{methodLabel}</span>
        </div>
        <button
          onClick={onDownloadReceipt}
          disabled={isGeneratingPDF}
          className="w-10 h-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground active:scale-95 transition-transform disabled:opacity-50"
          aria-label={t('detail.downloadReceipt')}
        >
          {isGeneratingPDF ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Primary amount: RMB */}
      <p className="text-[32px] sm:text-[36px] font-bold tracking-tight leading-none">
        {formatCurrencyRMB(payment.amount_rmb)}
      </p>

      {/* Secondary amount: XAF */}
      <p className="text-xl sm:text-2xl font-semibold text-muted-foreground mt-1">
        {formatCurrency(payment.amount_xaf)}
      </p>

      {/* Exchange rate */}
      <div className="mt-4 bg-muted/50 rounded-xl p-3 border border-border/50">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              {t('detail.rateApplied')} : 1M XAF = ¥{formatNumber(rateInt)}
            </p>
            <p className="text-muted-foreground mt-0.5">
              ¥{formatNumber(payment.amount_rmb, 2)} = {formatNumber(payment.amount_xaf)} XAF
            </p>
          </div>
        </div>
      </div>

      {/* Date info */}
      <p className="text-xs text-muted-foreground mt-3">
        {t('detail.createdAt')} {formatRelativeDate(payment.created_at)} ·{' '}
        {format(new Date(payment.created_at), 'dd MMM yyyy, HH:mm', { locale: fr })}
        {locked && ` · ${t('detail.locked')}`}
      </p>
    </div>
  );
}
