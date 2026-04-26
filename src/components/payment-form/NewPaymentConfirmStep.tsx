// ============================================================
// Step 4 — Confirm.
// Read-only summary: amount + method + beneficiary + new balance.
// Triggers the actual createPayment mutation via the orchestrator.
// ============================================================
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import type { PaymentMethodType } from './types';

interface Props {
  selectedMethod: PaymentMethodType;
  methodLabel: string;
  amountXAF: number;
  amountRMB: number;
  rate: number;
  showRate: boolean;
  balanceAfter: number;
  beneficiaryName: string | undefined;
  hasBeneficiary: boolean;
}

export function NewPaymentConfirmStep({
  selectedMethod,
  methodLabel,
  amountXAF,
  amountRMB,
  rate,
  showRate,
  balanceAfter,
  beneficiaryName,
  hasBeneficiary,
}: Props) {
  const { t } = useTranslation('payments');

  return (
    <div className="animate-fade-in space-y-6">
      <div className="card-elevated p-6 text-center">
        <div className="flex justify-center mb-4">
          <PaymentMethodLogo method={selectedMethod} size={64} />
        </div>
        <p className="text-sm text-muted-foreground">{t('form.youSend')}</p>
        <p className="text-3xl font-bold text-foreground mb-1">¥{formatRMB(amountRMB)}</p>
        <p className="text-sm text-muted-foreground">({formatXAF(amountXAF)} XAF)</p>
      </div>

      <div className="card-elevated p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('form.confirm.method')}</span>
          <span className="font-medium">{methodLabel}</span>
        </div>
        {showRate && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('form.rate')}</span>
            <span className="font-medium">1M XAF = ¥{formatRMB(1_000_000 * rate)}</span>
          </div>
        )}
        {beneficiaryName && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('form.confirm.beneficiary')}</span>
            <span className="font-medium">{beneficiaryName}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="font-semibold">{t('form.confirm.amountDebited')}</span>
          <span className="font-bold">{formatXAF(amountXAF)} XAF</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('form.confirm.newBalance')}</span>
          <span className="font-medium">{formatXAF(balanceAfter)} XAF</span>
        </div>
      </div>

      {!hasBeneficiary && selectedMethod !== 'cash' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 text-yellow-600 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{t('form.confirm.beneficiaryLater')}</span>
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        {t('form.confirm.debitNotice', { amount: `${formatXAF(amountXAF)} XAF` })}
      </p>
    </div>
  );
}
