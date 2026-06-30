// ============================================================
// Hero card — fiche paiement client, structure v7 validée.
// Méthode + pastille cycle de vie en tête, « Votre bénéficiaire
// reçoit » puis gros ¥ RMB (focal), « Vous avez payé X XAF », taux
// en bloc lilas au format verrouillé « 1 000 000 XAF = 11 350 ¥ ».
// Le reçu n'est plus ici : il vit tout en haut de la fiche.
// ============================================================
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatNumber, formatYuan } from '@/lib/formatters';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';
import { PAYMENT_METHOD_LABELS } from '@/types/payment';
import type { PaymentMethod } from '@/types/payment';
import type { Payment } from '@/hooks/usePayments';
import { SURFACE, TEXT } from '@/mobile/designKit';
import {
  paymentLifecycle,
  lifecycleStatusLabel,
  LIFECYCLE_COLOR,
} from '@/lib/paymentLifecycle';
import { normalizeRateToInt } from './types';

interface Props {
  payment: Payment;
}

export function PaymentHeroCard({ payment }: Props) {
  const { t } = useTranslation('payments');
  const methodLabel = PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method;
  const { kind } = paymentLifecycle(payment.status);
  const color = LIFECYCLE_COLOR[kind];
  const rateInt = normalizeRateToInt(payment.exchange_rate);
  // ¥ sans décimales quand le montant est entier — le focal reste lisible.
  const rmb = formatYuan(payment.amount_rmb);

  return (
    <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PaymentMethodLogo method={payment.method} size={30} />
          <span className={cn('text-[13px] font-bold', TEXT.strong)}>{methodLabel}</span>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
          style={{ color, background: `${color}1F` }}
        >
          {lifecycleStatusLabel(payment.status)}
        </span>
      </div>

      <div className={cn('mt-5 text-[13px] font-semibold', TEXT.muted)}>
        {kind === 'failed' ? t('detail.hero.settlementAmount') : t('detail.hero.supplierReceives')}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-[34px] font-black text-[#E8932A]">¥</span>
        <span
          className={cn(
            'font-black leading-none tracking-tight tabular-nums',
            rmb.length > 9 ? 'text-[44px]' : 'text-[58px]',
            TEXT.strong,
          )}
        >
          {rmb}
        </span>
      </div>
      <div className={cn('mt-2.5 text-[15px] font-bold tabular-nums', TEXT.muted)}>
        {kind === 'failed'
          ? t('detail.hero.amountRecredited', { amount: formatNumber(payment.amount_xaf) })
          : t('detail.hero.youPaid', { amount: formatNumber(payment.amount_xaf) })}
      </div>

      {rateInt > 0 && (
        <div className="mt-4 rounded-2xl bg-[#EDEAFA] px-4 py-3.5 dark:bg-[#2F2C3D]">
          <div className={cn('text-[11px] font-bold uppercase tracking-wide', TEXT.muted)}>
            {t('detail.hero.rateApplied')}
          </div>
          <div className={cn('mt-1 text-[17px] font-black tabular-nums', TEXT.strong)}>
            1 000 000 XAF = ¥{formatNumber(rateInt)}
          </div>
        </div>
      )}
    </div>
  );
}
