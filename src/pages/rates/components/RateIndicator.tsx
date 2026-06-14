import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface RateIndicatorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  amount: number;
}

const TONE = {
  green: 'bg-[#DEEFE5] text-[#2E7D52] dark:bg-[#1E3A2C] dark:text-[#7FCBA0]',
  yellow: 'bg-[#FDF1DD] text-[#9A6B12] dark:bg-[#3A2F1A] dark:text-[#E0B978]',
  red: 'bg-[#FBE7E7] text-[#C0504D] dark:bg-[#3A2526] dark:text-[#E79A9A]',
} as const;

export function RateIndicator({ activeRate, adjustments, selectedMethod, selectedCountry, amount }: RateIndicatorProps) {
  const countryAdj = adjustments.find((a) => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');

  const finalRate = useMemo(() => {
    const base = getBaseRate(activeRate, selectedMethod);
    const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, amount, tierAdjs);
    return Math.round(finalRate);
  }, [activeRate, selectedMethod, countryAdj, tierAdjs, amount]);

  const tier = useMemo(() => {
    if (amount >= 1_000_000) return { label: 'Meilleur taux', color: 'green' as const, star: true };
    if (amount >= 400_000) return { label: 'Taux standard', color: 'yellow' as const, star: false };
    return { label: 'Petit montant', color: 'red' as const, star: false };
  }, [amount]);

  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-[18px] px-4 py-3', SURFACE.card, SURFACE.shadow)}>
      <div className="min-w-0">
        <p className={cn('text-[11px]', TEXT.muted)}>Taux appliqué à votre montant</p>
        <p className={cn('mt-0.5 text-[15px] font-black tabular-nums', TEXT.strong)}>1 000 000 XAF = {formatNumber(finalRate)} ¥</p>
      </div>
      <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold', TONE[tier.color])}>
        {tier.star && <Sparkles className="h-3 w-3" />}
        {tier.label}
      </span>
    </div>
  );
}
