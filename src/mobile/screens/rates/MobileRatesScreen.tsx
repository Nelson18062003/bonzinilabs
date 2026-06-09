// ============================================================
// MODULE TAUX — MobileRatesScreen (shell + onglets)
// Structure repensée (passe Fable) : UN SEUL niveau d'onglets,
// 4 destinations claires — Aujourd'hui (définir + flyer) ·
// Simulateur · Historique (graphique + liste fusionnés) ·
// Réglages (ajustements pays/tranches).
// Plus de sous-onglets, plus de bouton « + » cryptique.
// Logique 100% préservée : hooks taux/ajustements,
// PullToRefresh + invalidations.
// ============================================================
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, PRIMARY_PILL } from '@/mobile/designKit';
import { RateSetTab } from './tabs/RateSetTab';
import { RateChartTab } from './tabs/RateChartTab';
import { RateHistoryTab } from './tabs/RateHistoryTab';
import { RateConfigTab } from './tabs/RateConfigTab';
import { RateSimulatorTab } from './tabs/RateSimulatorTab';

type Tab = 'today' | 'simulator' | 'history' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'simulator', label: 'Simulateur' },
  { key: 'history', label: 'Historique' },
  { key: 'settings', label: 'Réglages' },
];

export function MobileRatesScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('today');

  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['daily-rates'] });
    await queryClient.invalidateQueries({ queryKey: ['rate-adjustments'] });
  };

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title="Taux de change" showBack backTo="/m/more" className={SURFACE.canvas} />

      {/* Onglets — un seul niveau, 4 destinations */}
      <div className="px-4 pt-3">
        <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 rounded-full py-2 text-[12px] font-semibold transition-colors',
                  active ? PRIMARY_PILL : cn('bg-transparent', TEXT.muted),
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <PullToRefresh onRefresh={handleRefresh} className="overflow-auto">
        <div className="p-4 pb-24">
          {activeTab === 'today' && <RateSetTab currentRate={activeRate} />}

          {activeTab === 'simulator' && (
            <RateSimulatorTab
              activeRate={activeRate}
              adjustments={adjustments || []}
              isLoading={rateLoading || adjLoading}
              isError={rateError || adjError}
            />
          )}

          {/* Historique = évolution (graphique) + journal des publications */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <RateChartTab />
              <RateHistoryTab />
            </div>
          )}

          {activeTab === 'settings' && <RateConfigTab />}
        </div>
      </PullToRefresh>
    </div>
  );
}
