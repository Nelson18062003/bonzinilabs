import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { COUNTRIES } from '@/types/rates';
import { CountryFlag } from '@/components/form/CountryFlag';
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
  const { t } = useTranslation('client');
  return (
    <section>
      <h2 className={cn('mb-2 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{t('rates.country.title')}</h2>
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {COUNTRIES.map((c) => {
          const active = selectedCountry === c.key;
          return (
            <button
              key={c.key}
              onClick={() => onCountryChange(c.key)}
              className={cn(
                'flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors',
                active ? 'bg-[#8B5CF6] text-white' : cn(SURFACE.card, SURFACE.shadow, TEXT.muted),
              )}
            >
              <CountryFlag iso={c.iso} size={18} /> {t(`rates.countries.${c.key}`, { defaultValue: c.label })}
            </button>
          );
        })}
      </div>
    </section>
  );
}
