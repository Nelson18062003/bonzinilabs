// ============================================================
// PAGE — ClientRatesPage (Taux de change) · refonte « Direction A ».
// En-tête drill-in + canvas designKit · hero · pays · méthodes (vrais
// logos) · convertisseur · indicateur de palier · tendance · info.
// Calculs 100% PRÉSERVÉS (useClientRates, calculateFinalRate, etc.).
// ============================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { useClientRates } from '@/hooks/useDailyRates';
import type { PaymentMethodKey } from '@/types/rates';

import { RateHeroCard } from './components/RateHeroCard';
import { CountrySelector } from './components/CountrySelector';
import { PaymentMethodSelector } from './components/PaymentMethodSelector';
import { RateConverter } from './components/RateConverter';
import { RateIndicator } from './components/RateIndicator';
import { RateTrendChart } from './components/RateTrendChart';
import { RateInfoBanner } from './components/RateInfoBanner';

export function ClientRatesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('client');
  const { data, isLoading } = useClientRates();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>('cash');
  const [selectedCountry, setSelectedCountry] = useState('cameroun');
  const [amount, setAmount] = useState('1000000');

  const numAmount = parseFloat(amount) || 0;

  const Header = (
    <div className="flex items-center gap-3 px-4 pb-1 pt-4">
      <button
        onClick={() => navigate(-1)}
        aria-label={t('rates.title', { defaultValue: 'Taux de change' })}
        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95', SURFACE.card, SURFACE.shadow)}
      >
        <ArrowLeft className={cn('h-5 w-5', TEXT.strong)} />
      </button>
      <span className={cn('truncate text-[17px] font-black', TEXT.strong)}>{t('rates.title', { defaultValue: 'Taux de change' })}</span>
    </div>
  );

  if (isLoading || !data?.activeRate) {
    return (
      <MobileLayout showNav={false} showHeader={false}>
        <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
          {Header}
          <div className="space-y-5 p-4 pt-3">
            <div className={cn('h-44 animate-pulse rounded-[26px]', SURFACE.card, SURFACE.shadow)} />
            <div className={cn('h-12 animate-pulse rounded-full', SURFACE.card, SURFACE.shadow)} />
            <div className={cn('h-24 animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
            <div className={cn('h-64 animate-pulse rounded-[22px]', SURFACE.card, SURFACE.shadow)} />
          </div>
        </div>
      </MobileLayout>
    );
  }

  const { activeRate, adjustments } = data;

  return (
    <MobileLayout showNav={false} showHeader={false}>
      <div className={cn('min-h-[100dvh]', SURFACE.canvas)}>
        {Header}
        <div className="space-y-5 p-4 pt-3">
          <RateHeroCard
            activeRate={activeRate}
            adjustments={adjustments}
            selectedMethod={selectedMethod}
            selectedCountry={selectedCountry}
            previousRate={null}
          />
          <CountrySelector
            activeRate={activeRate}
            adjustments={adjustments}
            selectedMethod={selectedMethod}
            selectedCountry={selectedCountry}
            onCountryChange={setSelectedCountry}
          />
          <PaymentMethodSelector
            activeRate={activeRate}
            adjustments={adjustments}
            selectedMethod={selectedMethod}
            selectedCountry={selectedCountry}
            onMethodChange={setSelectedMethod}
          />
          <RateConverter
            activeRate={activeRate}
            adjustments={adjustments}
            selectedMethod={selectedMethod}
            selectedCountry={selectedCountry}
            amount={amount}
            onAmountChange={setAmount}
          />
          <RateIndicator
            activeRate={activeRate}
            adjustments={adjustments}
            selectedMethod={selectedMethod}
            selectedCountry={selectedCountry}
            amount={numAmount}
          />
          <RateTrendChart />
          <RateInfoBanner />
        </div>
      </div>
    </MobileLayout>
  );
}
