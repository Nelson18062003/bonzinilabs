// ============================================================
// Step 4 — Confirm (structure wizard validée, même langage que la
// fiche v7) : hero logo+label · « Votre bénéficiaire reçoit » · gros ¥
// · « Vous payez X XAF » · taux en bloc lilas « 1 000 000 XAF = … ¥ » ·
// récap (bénéficiaire, compte, débité maintenant, nouveau solde) ·
// note lilas de débit. Lecture seule ; createPayment vit dans la page.
// ============================================================
import { useTranslation } from 'react-i18next';
import { AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatXAF, formatNumber, formatYuan } from '@/lib/formatters';
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
  /** Ligne secondaire du bénéficiaire (identifiant / compte / téléphone). */
  beneficiarySub?: { label: string; value: string };
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
  beneficiarySub,
  hasBeneficiary,
}: Props) {
  const { t } = useTranslation('payments');

  return (
    <div className="animate-fade-in space-y-4">
      {/* Hero — même langage que la fiche v7 */}
      <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
        <div className="flex items-center gap-2">
          <PaymentMethodLogo method={selectedMethod} size={30} />
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>{methodLabel}</span>
        </div>
        <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>{t('form.supplierReceives')}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[30px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
          <span className={cn('text-[46px] font-black leading-none tracking-tight tabular-nums', TEXT.strong)}>
            {formatYuan(amountRMB)}
          </span>
        </div>
        <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>
          {t('form.youSend')} {formatXAF(amountXAF)} XAF
        </div>
        {showRate && (
          <div className="mt-4 rounded-2xl bg-[#EDEAFA] px-4 py-3.5 dark:bg-[#221F33]">
            <div className={cn('text-[11px] font-bold uppercase tracking-wide', TEXT.muted)}>
              Taux du jour appliqué
            </div>
            <div className={cn('mt-1 text-[17px] font-black tabular-nums', TEXT.strong)}>
              1 000 000 XAF = {formatNumber(Math.round(1_000_000 * rate))} ¥
            </div>
          </div>
        )}
      </div>

      {/* Récap — bénéficiaire + débit (la méthode et le taux vivent dans le hero) */}
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        {beneficiaryName && <Row label={t('form.confirm.beneficiary')} value={beneficiaryName} />}
        {beneficiarySub && <Row label={beneficiarySub.label} value={beneficiarySub.value} />}
        <div
          className={cn(
            'flex items-center justify-between gap-3',
            (beneficiaryName || beneficiarySub) && 'mt-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]',
          )}
        >
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

      <div className="flex items-start gap-2.5 rounded-2xl bg-[#EAE7FA] p-3.5 dark:bg-[#272252]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5B4CC4] dark:text-[#B5AAF0]" />
        <p className="text-[12.5px] text-[#5B4CC4] dark:text-[#B5AAF0]">{t('form.confirm.debitNotice')}</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={cn('text-[13px]', TEXT.muted)}>{label}</span>
      <span className={cn('truncate text-[13px] font-bold tabular-nums', TEXT.strong)}>{value}</span>
    </div>
  );
}
