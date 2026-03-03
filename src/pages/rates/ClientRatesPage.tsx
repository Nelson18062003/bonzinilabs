import { useState, useMemo } from 'react';
import { MobileLayout } from '@/components/layout/MobileLayout';
import { PageHeader } from '@/components/layout/PageHeader';
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
  const { data, isLoading } = useClientRates();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodKey>('cash');
  const [selectedCountry, setSelectedCountry] = useState('cameroun');
  const [amount, setAmount] = useState('1000000');

  const numAmount = parseFloat(amount) || 0;

  if (isLoading || !data?.activeRate) {
    return (
      <MobileLayout>
        <PageHeader title="Taux de change" showBack />
        <div className="px-4 space-y-5">
          <div className="rounded-2xl p-5 animate-pulse bg-amber-50/50 border border-amber-200/50">
            <div className="h-3 w-16 bg-amber-200/40 rounded mb-4" />
            <div className="h-8 w-48 bg-amber-200/40 rounded mb-3" />
            <div className="h-4 w-32 bg-amber-200/40 rounded" />
          </div>
          <div className="bg-white rounded-2xl p-5 animate-pulse space-y-3">
            <div className="h-10 bg-gray-100 rounded-lg" />
            <div className="h-14 bg-gray-100 rounded-xl" />
            <div className="h-14 bg-gray-100 rounded-xl" />
          </div>
          <div className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex-1 h-8 bg-gray-100 rounded-md" />
              ))}
            </div>
            <div className="h-[200px] bg-gray-100 rounded" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  const { activeRate, adjustments } = data;

  return (
    <MobileLayout>
      <PageHeader title="Taux de change" showBack />

      <div className="px-4 space-y-3 pb-6">
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
    </MobileLayout>
  );
}
