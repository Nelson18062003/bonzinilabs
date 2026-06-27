// ============================================================
// Step 1 — Choose payment method (structure wizard validée).
// 4 cartes (Alipay / WeChat / Virement / Cash) avec le TAUX DU JOUR
// de chaque mode. La page possède `selectedMethod` ; ce composant ne
// fait que rendre les cartes.
// ============================================================
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { PaymentMethodCard } from './PaymentMethodCard';
import { PAYMENT_METHOD_IDS, type PaymentMethodType } from './types';
import { TEXT } from '@/mobile/designKit';

interface Props {
  selectedMethod: PaymentMethodType | null;
  onSelect: (method: PaymentMethodType) => void;
  /** Taux du jour par mode (¥ / 1 000 000 XAF), si chargés. */
  methodRates?: Partial<Record<PaymentMethodType, number>>;
}

export function NewPaymentMethodStep({ selectedMethod, onSelect, methodRates }: Props) {
  const { t } = useTranslation('payments');

  return (
    <div className="animate-fade-in space-y-3">
      <div className="mb-1 px-1">
        <h2 className={cn('text-[18px] font-black', TEXT.strong)}>{t('form.howToReceive')}</h2>
        <p className={cn('mt-0.5 text-[13px]', TEXT.muted)}>{t('form.rateDependsOnMethod')}</p>
      </div>
      {PAYMENT_METHOD_IDS.map((id) => (
        <PaymentMethodCard
          key={id}
          method={id}
          label={t(`form.methods.${id}.label`)}
          description={t(`form.methods.${id}.desc`)}
          rate={methodRates?.[id]}
          isSelected={selectedMethod === id}
          onSelect={() => onSelect(id)}
        />
      ))}
    </div>
  );
}
