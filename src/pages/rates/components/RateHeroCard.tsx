import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { formatNumber, formatRelativeDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { PAYMENT_METHODS, COUNTRIES } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface RateHeroCardProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  previousRate: DailyRate | null;
}

const GREEN = '#2E7D52', RED = '#C0504D', AMBER = '#E8932A';

export function RateHeroCard({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  previousRate,
}: RateHeroCardProps) {
  const countryAdj = adjustments.find((a) => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');

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

  const currentPm = PAYMENT_METHODS.find((p) => p.key === selectedMethod)!;
  const currentCountry = COUNTRIES.find((c) => c.key === selectedCountry)!;
  const tone = variation ? (variation.percent > 0 ? GREEN : variation.percent < 0 ? RED : '#8E8BA0') : '#8E8BA0';
  const TrendIcon = variation && variation.percent > 0 ? TrendingUp : variation && variation.percent < 0 ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-[26px] p-6', SURFACE.card, SURFACE.shadow)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-[12px] font-bold uppercase tracking-wide', TEXT.muted)}>Taux du jour · XAF → ¥</span>
        {variation && (
          <span className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold" style={{ color: tone, background: `${tone}1F` }}>
            <TrendIcon className="h-3 w-3" />
            {variation.percent > 0 ? '+' : ''}{formatNumber(variation.percent, 1)}%
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>{formatNumber(1_000_000)}</span>
        <span className="text-[14px] font-extrabold" style={{ color: AMBER }}>XAF</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={cn('text-[13px] font-semibold', TEXT.muted)}>=</span>
        <span className={cn('text-[30px] font-black leading-none tabular-nums', TEXT.strong)}>{formatNumber(animatedRate)}</span>
        <span className="text-[16px] font-black text-[#C3BDD2] dark:text-[#5C5772]">¥</span>
      </div>
      <div className={cn('mt-2 text-[12px] tabular-nums', TEXT.muted)}>
        1 ¥ = {formatNumber(reverseRate)} XAF · {formatRelativeDate(activeRate.effective_at)}
      </div>
      <div className="mt-3 flex gap-2">
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>{currentCountry.flag} {currentCountry.label}</span>
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', SURFACE.holder)}>{currentPm.label}</span>
      </div>
    </div>
  );
}
