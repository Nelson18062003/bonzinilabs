import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { PAYMENT_METHODS } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';

interface PaymentMethodSelectorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  onMethodChange: (method: PaymentMethodKey) => void;
}

export function PaymentMethodSelector({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  onMethodChange,
}: PaymentMethodSelectorProps) {
  const countryAdj = adjustments.find(a => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter(a => a.type === 'tier');

  const methodRates = useMemo(() => {
    return PAYMENT_METHODS.map(pm => {
      const base = getBaseRate(activeRate, pm.key);
      const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
      return { ...pm, rate: Math.round(finalRate) };
    });
  }, [activeRate, countryAdj, tierAdjs]);

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <p className="text-xs text-gray-400 font-medium mb-2">Mode de paiement</p>
      <div className="flex gap-1.5">
        {methodRates.map(pm => {
          const isActive = selectedMethod === pm.key;
          return (
            <button
              key={pm.key}
              onClick={() => onMethodChange(pm.key)}
              className={cn(
                'flex-1 py-2.5 px-1 rounded-xl border-2 flex flex-col items-center gap-1 transition-all',
                isActive
                  ? 'bg-opacity-5 border-current'
                  : 'border-gray-100 bg-gray-50/50'
              )}
              style={isActive ? { borderColor: pm.color, backgroundColor: `${pm.color}08` } : undefined}
            >
              <span className="text-lg">{pm.icon}</span>
              <span
                className="text-[10px] font-semibold"
                style={{ color: isActive ? pm.color : '#aaa' }}
              >
                {pm.label}
              </span>
              <span
                className={cn(
                  'text-[10px] font-bold',
                  isActive ? 'text-gray-900' : 'text-gray-300'
                )}
              >
                {formatNumber(pm.rate)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
