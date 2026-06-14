import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { PaymentMethodLogo } from '@/mobile/components/payments/PaymentMethodLogo';

interface PaymentMethodSelectorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  onMethodChange: (method: PaymentMethodKey) => void;
}

// PaymentMethodKey → clé du logo (virement → bank_transfer).
const LOGO: Record<PaymentMethodKey, 'alipay' | 'wechat' | 'bank_transfer' | 'cash'> = {
  alipay: 'alipay',
  wechat: 'wechat',
  virement: 'bank_transfer',
  cash: 'cash',
};

export function PaymentMethodSelector({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  onMethodChange,
}: PaymentMethodSelectorProps) {
  const countryAdj = adjustments.find((a) => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');

  const methodRates = useMemo(() => {
    return PAYMENT_METHODS.map((pm) => {
      const base = getBaseRate(activeRate, pm.key);
      const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
      return { ...pm, rate: Math.round(finalRate) };
    });
  }, [activeRate, countryAdj, tierAdjs]);

  return (
    <section>
      <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Mode de paiement</h2>
      <div className="grid grid-cols-4 gap-2">
        {methodRates.map((pm) => {
          const active = selectedMethod === pm.key;
          return (
            <button
              key={pm.key}
              onClick={() => onMethodChange(pm.key)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-[18px] p-2.5 transition active:scale-[0.98]',
                SURFACE.card,
                SURFACE.shadow,
                active && 'ring-2 ring-[#8B5CF6]',
              )}
            >
              <PaymentMethodLogo method={LOGO[pm.key]} size={34} />
              <span className={cn('text-[10px] font-bold', TEXT.strong)}>{pm.label}</span>
              <span className={cn('text-[11px] font-black tabular-nums', active ? TEXT.strong : TEXT.muted)}>{formatNumber(pm.rate)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
