import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { formatNumber, formatRelativeDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { PAYMENT_METHODS, COUNTRIES } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';

interface RateHeroCardProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  previousRate: DailyRate | null;
}

export function RateHeroCard({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  previousRate,
}: RateHeroCardProps) {
  const countryAdj = adjustments.find(a => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter(a => a.type === 'tier');

  const refRate = useMemo(() => {
    const base = getBaseRate(activeRate, selectedMethod);
    const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
    return Math.round(finalRate);
  }, [activeRate, selectedMethod, countryAdj, tierAdjs]);

  const animatedRate = useCountUp(refRate, { enabled: true });

  const reverseRate = useMemo(() => Math.round(1_000_000 / refRate), [refRate]);

  const variation = useMemo(() => {
    if (!previousRate) return null;
    const prevBase = getBaseRate(previousRate, selectedMethod);
    const { finalRate: prevFinal } = calculateFinalRate(prevBase, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
    const prevRounded = Math.round(prevFinal);
    const diff = refRate - prevRounded;
    const percent = prevRounded !== 0 ? (diff / prevRounded) * 100 : 0;
    return { diff, percent };
  }, [previousRate, selectedMethod, countryAdj, tierAdjs, refRate]);

  const currentPm = PAYMENT_METHODS.find(p => p.key === selectedMethod)!;
  const currentCountry = COUNTRIES.find(c => c.key === selectedCountry)!;

  return (
    <div className="rounded-2xl p-5 border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-amber-800/70">XAF &rarr; CNY</span>
        <div className="flex gap-1.5">
          <div className="bg-white/60 rounded-lg px-2 py-0.5 flex items-center gap-1">
            <span className="text-xs">{currentCountry.flag}</span>
            <span className="text-[11px] font-semibold text-amber-800">{currentCountry.label}</span>
          </div>
          <div className="bg-white/60 rounded-lg px-2 py-0.5 flex items-center gap-1">
            <span className="text-xs">{currentPm.icon}</span>
            <span className="text-[11px] font-semibold text-amber-800">{currentPm.label}</span>
          </div>
        </div>
      </div>

      <p
        className="text-2xl font-extrabold text-gray-900 mb-1"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {formatNumber(1_000_000)} XAF = {formatNumber(animatedRate)}{' '}
        <span className="text-sm font-medium text-stone-500">CNY</span>
      </p>
      <p className="text-xs text-stone-400">1 CNY = {formatNumber(reverseRate)} XAF</p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-amber-200/50">
        <span className="text-[11px] text-stone-400">
          {formatRelativeDate(activeRate.effective_at)}
        </span>
        {variation && (
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold',
              variation.percent > 0
                ? 'bg-green-100 text-green-600'
                : variation.percent < 0
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-500'
            )}
          >
            {variation.percent > 0 ? (
              <TrendingUp className="w-3 h-3" />
            ) : variation.percent < 0 ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {variation.percent > 0 ? '+' : ''}
            {formatNumber(variation.percent, 1)}%
            <span className="text-[10px] font-normal opacity-60 ml-0.5">(30j)</span>
          </span>
        )}
      </div>
    </div>
  );
}
