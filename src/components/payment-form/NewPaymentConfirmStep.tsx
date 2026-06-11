// ============================================================
// Step 4 — Confirm. Refonte « Direction A » (designKit) :
// hero ¥ reçu + carte récap (méthode, taux, bénéficiaire, débité,
// nouveau solde) + avertissement + mention de débit.
// Lecture seule ; déclenche createPayment via l'orchestrateur.
// Logique 100% PRÉSERVÉE : props inchangés.
// ============================================================
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatXAF, formatRMB } from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { SURFACE, TEXT } from '@/mobile/designKit';
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
    <div className="animate-fade-in space-y-4">
      {/* Hero — ce que le fournisseur reçoit */}
      <div className={cn('rounded-[24px] p-6 text-center', SURFACE.card, SURFACE.shadow)}>
        <div className="mb-3 flex justify-center">
          <PaymentMethodLogo method={selectedMethod} size={60} />
        </div>
        <p className={cn('text-[12px] font-medium', TEXT.muted)}>{t('form.supplierReceives')}</p>
        <div className="mt-1 flex items-baseline justify-center gap-1.5">
          <span className="text-[22px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
          <span className={cn('text-[38px] font-black leading-none tabular-nums', TEXT.strong)}>{formatRMB(amountRMB)}</span>
        </div>
        <p className={cn('mt-1.5 text-[13px] tabular-nums', TEXT.muted)}>{formatXAF(amountXAF)} XAF</p>
      </div>

      {/* Récap */}
      <div className={cn('space-y-3 rounded-[22px] p-4', SURFACE.card, SURFACE.shadow)}>
        <Row label={t('form.confirm.method')} value={methodLabel} />
        {showRate && <Row label={t('form.rate')} value={`1M XAF = ¥${formatRMB(1_000_000 * rate)}`} />}
        {beneficiaryName && <Row label={t('form.confirm.beneficiary')} value={beneficiaryName} />}
        <div className="flex items-center justify-between border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <span className={cn('text-[14px] font-semibold', TEXT.strong)}>{t('form.confirm.amountDebited')}</span>
          <span className={cn('text-[15px] font-black tabular-nums', TEXT.strong)}>{formatXAF(amountXAF)} XAF</span>
        </div>
        <Row label={t('form.confirm.newBalance')} value={`${formatXAF(balanceAfter)} XAF`} />
      </div>

      {!hasBeneficiary && selectedMethod !== 'cash' && (
        <div className="flex items-center gap-2 rounded-2xl bg-[#FDF1DD] p-3.5 text-[13px] text-[#9A6B12] dark:bg-[#3A2F1A] dark:text-[#E0B978]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{t('form.confirm.beneficiaryLater')}</span>
        </div>
      )}

      <p className={cn('px-2 text-center text-[11px]', TEXT.muted)}>
        {t('form.confirm.debitNotice', { amount: `${formatXAF(amountXAF)} XAF` })}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[14px]', TEXT.muted)}>{label}</span>
      <span className={cn('truncate text-[14px] font-bold tabular-nums', TEXT.strong)}>{value}</span>
    </div>
  );
}
