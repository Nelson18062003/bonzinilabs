import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/formatters';
import { COUNTRIES } from '@/types/rates';
import { calculateFinalRate, getBaseRate } from '@/lib/rateCalculation';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';

interface CountrySelectorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  onCountryChange: (country: string) => void;
}

export function CountrySelector({
  activeRate,
  adjustments,
  selectedMethod,
  selectedCountry,
  onCountryChange,
}: CountrySelectorProps) {
  const [open, setOpen] = useState(false);
  const tierAdjs = adjustments.filter(a => a.type === 'tier');

  const currentCountry = COUNTRIES.find(c => c.key === selectedCountry)!;
  const countryAdj = adjustments.find(a => a.type === 'country' && a.key === selectedCountry);
  const isAdjusted = (countryAdj?.percentage ?? 0) !== 0;

  const countryRates = useMemo(() => {
    const base = getBaseRate(activeRate, selectedMethod);
    return COUNTRIES.map(c => {
      const adj = adjustments.find(a => a.type === 'country' && a.key === c.key);
      const { finalRate } = calculateFinalRate(base, adj?.percentage ?? 0, 1_000_000, tierAdjs);
      return { ...c, rate: Math.round(finalRate) };
    });
  }, [activeRate, selectedMethod, adjustments, tierAdjs]);

  return (
    <div className="bg-white rounded-2xl p-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <p className="text-xs text-gray-400 font-medium mb-2">Votre pays</p>

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full p-3 rounded-xl border-2 flex items-center justify-between transition-all',
          open ? 'border-violet-500 bg-violet-50/50' : 'border-gray-100 bg-gray-50/50'
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{currentCountry.flag}</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">{currentCountry.label}</p>
            {isAdjusted && (
              <p className="text-[11px] text-gray-400">Taux ajust&eacute; zone CEMAC</p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'text-sm text-gray-400 transition-transform',
            open && 'rotate-180'
          )}
        >
          &#x25BC;
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl overflow-hidden border border-gray-100">
          {countryRates.map((c, i) => {
            const isSelected = selectedCountry === c.key;
            return (
              <button
                key={c.key}
                onClick={() => { onCountryChange(c.key); setOpen(false); }}
                className={cn(
                  'w-full px-3.5 py-3 flex items-center justify-between transition-colors',
                  isSelected ? 'bg-violet-50' : i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white',
                  i < countryRates.length - 1 && 'border-b border-gray-100/80'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{c.flag}</span>
                  <span className={cn(
                    'text-sm',
                    isSelected ? 'font-bold text-violet-600' : 'font-medium text-gray-900'
                  )}>
                    {c.label}
                  </span>
                  {isSelected && <span className="text-sm text-violet-600">&#x2713;</span>}
                </div>
                <span className="text-[13px] font-semibold text-gray-500">
                  {formatNumber(c.rate)} &yen;
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
