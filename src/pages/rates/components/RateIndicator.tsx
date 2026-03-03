import { useMemo } from 'react';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';

interface RateIndicatorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  amount: number;
}

export function RateIndicator({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  amount,
}: RateIndicatorProps) {
  const countryAdj = adjustments.find(a => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter(a => a.type === 'tier');

  const finalRate = useMemo(() => {
    const base = getBaseRate(activeRate, selectedMethod);
    const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, amount, tierAdjs);
    return Math.round(finalRate);
  }, [activeRate, selectedMethod, countryAdj, tierAdjs, amount]);

  const tier = useMemo(() => {
    if (amount >= 1_000_000) return { label: 'Meilleur taux', color: 'green' as const, icon: '\u2726' };
    if (amount >= 400_000) return { label: 'Taux standard', color: 'yellow' as const, icon: '' };
    return { label: 'Petit montant', color: 'red' as const, icon: '' };
  }, [amount]);

  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
  };

  return (
    <div className="bg-white rounded-2xl px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)] flex items-center justify-between">
      <div>
        <p className="text-[11px] text-gray-400 mb-0.5">Taux appliqu&eacute; &agrave; votre montant</p>
        <p className="text-[15px] font-bold text-gray-900">
          1M XAF = {formatNumber(finalRate)} CNY
        </p>
      </div>
      <div className={cn('rounded-lg px-2.5 py-1.5', colorClasses[tier.color])}>
        <span className="text-[10px] font-semibold">
          {tier.icon && `${tier.icon} `}{tier.label}
        </span>
      </div>
    </div>
  );
}
