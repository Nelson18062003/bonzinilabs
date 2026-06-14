import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/types/rates';
import type { DailyRate, RateAdjustment, PaymentMethodKey } from '@/types/rates';
import { SURFACE, TEXT } from '@/mobile/designKit';

interface CountrySelectorProps {
  activeRate: DailyRate;
  adjustments: RateAdjustment[];
  selectedMethod: PaymentMethodKey;
  selectedCountry: string;
  onCountryChange: (country: string) => void;
}

export function CountrySelector({ selectedCountry, onCountryChange }: CountrySelectorProps) {
  return (
    <section>
      <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>Pays</h2>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {COUNTRIES.map((c) => {
          const active = selectedCountry === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onCountryChange(c.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors',
                active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              <span>{c.flag}</span> {c.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
