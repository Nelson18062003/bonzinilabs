// ============================================================
// Step 1 — Choose payment method.
// 4 cards (Alipay / WeChat / Bank transfer / Cash). The page owns
// `selectedMethod`; this component just renders the cards.
// ============================================================
import { useTranslation } from 'react-i18next';
import { PaymentMethodCard } from './PaymentMethodCard';
import { PAYMENT_METHOD_IDS, type PaymentMethodType } from './types';

interface Props {
  selectedMethod: PaymentMethodType | null;
  onSelect: (method: PaymentMethodType) => void;
}

export function NewPaymentMethodStep({ selectedMethod, onSelect }: Props) {
  const { t } = useTranslation('payments');

  return (
    <div className="animate-fade-in space-y-4">
      <p className="text-sm text-muted-foreground mb-4">{t('form.howToReceive')}</p>
      {PAYMENT_METHOD_IDS.map((id) => (
        <PaymentMethodCard
          key={id}
          method={id}
          label={t(`form.methods.${id}.label`)}
          description={t(`form.methods.${id}.desc`)}
          isSelected={selectedMethod === id}
          onSelect={() => onSelect(id)}
        />
      ))}
    </div>
  );
}
