import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useCountUp } from '@/hooks/useCountUp';
import { formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import { MIN_AMOUNT_XAF } from '@/types/rates';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';

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

  const countryAdj = adjustments.find((a) => a.type === 'country' && a.key === selectedCountry);
  const tierAdjs = adjustments.filter((a) => a.type === 'tier');

  const numAmount = parseFloat(amount) || 0;
  const isXaf = direction === 'xaf';

  const result = useMemo(() => {
    if (numAmount <= 0) return 0;
    if (isXaf) {
      const base = getBaseRate(activeRate, selectedMethod);
      const { amountCNY } = calculateFinalRate(base, countryAdj?.percentage ?? 0, numAmount, tierAdjs);
      return Math.round(amountCNY);
    } else {
      const base = getBaseRate(activeRate, selectedMethod);
      const { finalRate } = calculateFinalRate(base, countryAdj?.percentage ?? 0, 1_000_000, tierAdjs);
      const ratePerUnit = finalRate / 1_000_000;
      return ratePerUnit > 0 ? Math.round(numAmount / ratePerUnit) : 0;
    }
  }, [numAmount, isXaf, activeRate, selectedMethod, countryAdj, tierAdjs]);

  const animatedResult = useCountUp(result, { enabled: true, duration: 300 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\s/g, '').replace(/\./g, '');
    if (/^\d*$/.test(val)) onAmountChange(val);
  };

  const isUnderMinimum = isXaf && numAmount > 0 && numAmount < MIN_AMOUNT_XAF;

  return (
    <section>
      <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Convertisseur</h2>
      <div className={cn('rounded-[22px] p-5', SURFACE.card, SURFACE.shadow)}>
        {/* Sens */}
        <div className={cn('mb-4 flex rounded-full p-1', SURFACE.canvas)}>
          {[
            { key: 'xaf' as const, label: 'Par XAF' },
            { key: 'cny' as const, label: 'Par ¥' },
          ].map((d) => (
            <button
              key={d.key}
              onClick={() => setDirection(d.key)}
              className={cn('flex-1 rounded-full py-2 text-[13px] font-bold transition-colors', direction === d.key ? 'bg-[#8B5CF6] text-white' : TEXT.muted)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Vous envoyez */}
        <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Vous envoyez</div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          {/* gros chiffre 28px (≥16 → pas d'auto-zoom iOS) : input nu volontaire */}
          {/* eslint-disable-next-line no-restricted-syntax */}
          <input
            type="text"
            inputMode="numeric"
            value={numAmount > 0 ? formatNumber(numAmount) : ''}
            onChange={handleInputChange}
            placeholder={isXaf ? '1 000 000' : '11 800'}
            className={cn('min-w-0 flex-1 bg-transparent text-[28px] font-black tabular-nums outline-none placeholder:text-[#C7C2D6] dark:placeholder:text-[#4A4658]', TEXT.strong)}
          />
          <span className={cn('shrink-0 text-[15px] font-extrabold', TEXT.muted)}>{isXaf ? 'XAF' : '¥'}</span>
        </div>
        {isUnderMinimum && (
          <p className="mt-1 text-[12px] font-medium text-[#C0504D] dark:text-[#E79A9A]">
            Montant minimum : {formatNumber(MIN_AMOUNT_XAF)} XAF
          </p>
        )}

        {/* Swap */}
        <div className="my-3 flex justify-center">
          <button
            onClick={() => setDirection((d) => (d === 'xaf' ? 'cny' : 'xaf'))}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDEAFA] transition active:scale-90 dark:bg-[#221F33]"
          >
            <ArrowUpDown className="h-[18px] w-[18px] text-[#5B4CC4] dark:text-[#B5AAF0]" />
          </button>
        </div>

        {/* Vous recevez */}
        <div className={cn('text-[11px] font-bold uppercase tracking-wider', TEXT.muted)}>Vous recevez</div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[28px] font-black tabular-nums text-[#5B4CC4] dark:text-[#B5AAF0]">{formatNumber(animatedResult)}</span>
          <span className={cn('shrink-0 text-[15px] font-extrabold', TEXT.muted)}>{isXaf ? '¥' : 'XAF'}</span>
        </div>

        {/* Montants rapides */}
        <div className="mt-4 grid grid-cols-5 gap-2">
          {QUICK_AMOUNTS.map((v) => {
            const active = amount === v;
            const num = parseInt(v);
            const label = num >= 1_000_000 ? `${(num / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',')}M` : `${num / 1_000}K`;
            return (
              <button
                key={v}
                onClick={() => onAmountChange(v)}
                className={cn('rounded-xl py-2 text-[12px] font-bold transition-colors', active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.canvas, TEXT.muted))}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className={cn('mt-3 text-center text-[11px]', TEXT.muted)}>Taux appliqué au moment du paiement</p>
      </div>
    </section>
  );
}
