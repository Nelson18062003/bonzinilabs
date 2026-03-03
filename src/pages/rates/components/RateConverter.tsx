import { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { formatNumber, formatCompact } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import { MIN_AMOUNT_XAF } from '@/types/rates';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';

interface RateConverterProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  amount: string;
  onAmountChange: (amount: string) => void;
}

const QUICK_AMOUNTS = ['100000', '250000', '500000', '1000000', '2000000'];

export function RateConverter({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  amount,
  onAmountChange,
}: RateConverterProps) {
  const [direction, setDirection] = useState<'xaf' | 'cny'>('xaf');
  const [swapKey, setSwapKey] = useState(0);

  const countryAdj = adjustments.find(a => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter(a => a.type === 'tier');

  const numAmount = parseFloat(amount) || 0;
  const isXaf = direction === 'xaf';

  const result = useMemo(() => {
    if (numAmount <= 0) return 0;
    if (isXaf) {
      const base = getBaseRate(activeRate, selectedMethod);
      const { amountCNY } = calculateFinalRate(base, countryAdj?.percentage ?? 0, numAmount, tierAdjs);
      return Math.round(amountCNY);
    } else {
      // Reverse: CNY → XAF. Use 1M ref rate to get approximate XAF
      const base = getBaseRate(activeRate, selectedMethod);
      const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
      const ratePerUnit = finalRate / 1_000_000;
      return ratePerUnit > 0 ? Math.round(numAmount / ratePerUnit) : 0;
    }
  }, [numAmount, isXaf, activeRate, selectedMethod, countryAdj, tierAdjs]);

  const animatedResult = useCountUp(result, { enabled: true, duration: 300 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s/g, '').replace(/\./g, '');
    if (/^\d*$/.test(val)) {
      onAmountChange(val);
    }
  };

  const handleSwap = () => {
    setDirection(d => d === 'xaf' ? 'cny' : 'xaf');
    setSwapKey(k => k + 1);
  };

  const isUnderMinimum = isXaf && numAmount > 0 && numAmount < MIN_AMOUNT_XAF;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      {/* Direction toggle */}
      <div className="bg-gray-100 rounded-xl p-0.5 flex mb-4">
        {[
          { key: 'xaf' as const, label: 'Par XAF' },
          { key: 'cny' as const, label: 'Par CNY' },
        ].map(d => (
          <button
            key={d.key}
            onClick={() => setDirection(d.key)}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all',
              direction === d.key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-400'
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Input — "Vous envoyez" */}
      <div className="mb-1.5">
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">
          Vous envoyez
        </p>
        <div className="flex items-center justify-between">
          <input
            type="text"
            inputMode="numeric"
            value={numAmount > 0 ? formatNumber(numAmount) : ''}
            onChange={handleInputChange}
            placeholder={isXaf ? '1 000 000' : '11 800'}
            className="text-[28px] font-extrabold text-gray-900 border-none outline-none bg-transparent w-[70%]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
          <span className="text-base font-semibold text-gray-400">
            {isXaf ? 'XAF' : 'CNY'}
          </span>
        </div>
        <div className="h-px bg-gray-200 mt-2" />
      </div>

      {isUnderMinimum && (
        <p className="text-xs text-red-500 mt-1 mb-2">
          Montant minimum : {formatNumber(MIN_AMOUNT_XAF)} XAF
        </p>
      )}

      {/* Swap button */}
      <div className="flex justify-center my-2">
        <button
          key={swapKey}
          onClick={handleSwap}
          className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center border-2 border-violet-100 active:scale-90 transition-transform"
        >
          <ArrowUpDown className="w-[18px] h-[18px] text-violet-500" />
        </button>
      </div>

      {/* Output — "Vous recevez" */}
      <div>
        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">
          Vous recevez
        </p>
        <div className="flex items-center justify-between">
          <span
            className="text-[28px] font-extrabold text-violet-600"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatNumber(animatedResult)}
          </span>
          <span className="text-base font-semibold text-gray-400">
            {isXaf ? 'CNY' : 'XAF'}
          </span>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="flex gap-1.5 mt-4">
        {QUICK_AMOUNTS.map(v => {
          const isActive = amount === v;
          const num = parseInt(v);
          const label = num >= 1_000_000 ? `${(num / 1_000_000).toFixed(1).replace('.', ',')}M` : `${num / 1_000}K`;
          return (
            <button
              key={v}
              onClick={() => onAmountChange(v)}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
                isActive
                  ? 'border-2 border-violet-500 bg-violet-50 text-violet-600'
                  : 'border-[1.5px] border-gray-200 bg-white text-gray-500'
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <p className="text-center mt-3 text-xs text-violet-300 italic">
        Taux appliqu&eacute; au moment du paiement
      </p>
    </div>
  );
}
