// ============================================================
// MODULE TAUX — MobileRatesScreen (shell + onglets)
// Présentation migrée sur le design kit (Ofspace/Mola), calquée
// sur la maquette validée rates.tsx : canvas doux · onglets en
// pilule (Segmented) · sous-onglets en pilule · cartes à ombre
// douce dans les tabs.
// Logique 100% préservée : onglets principaux/sous-onglets,
// hooks taux/ajustements, PullToRefresh + invalidations, bouton +.
// ============================================================
import { useState } from 'react';
import { Plus } from 'lucide-react';
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

type MainTab = 'rates' | 'config' | 'simulator';
type RatesSubTab = 'set' | 'chart' | 'history';

const MAIN_TABS: { key: MainTab; label: string }[] = [
  { key: 'rates', label: 'Taux' },
  { key: 'config', label: 'Config' },
  { key: 'simulator', label: 'Simuler' },
];

const SUB_TABS: { key: RatesSubTab; label: string }[] = [
  { key: 'set', label: 'Définir' },
  { key: 'chart', label: 'Graphique' },
  { key: 'history', label: 'Historique' },
];

export function MobileRatesScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<MainTab>('rates');
  const [activeSubTab, setActiveSubTab] = useState<RatesSubTab>('set');

  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['daily-rates'] });
    await queryClient.invalidateQueries({ queryKey: ['rate-adjustments'] });
  };

  const handlePlusClick = () => {
    setActiveTab('rates');
    setActiveSubTab('set');
  };

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader
        title="Taux de change"
        showBack
        backTo="/m/more"
        className={SURFACE.canvas}
        rightElement={
          <button
            onClick={handlePlusClick}
            aria-label="Définir les taux"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(139,92,246,0.55)] transition active:scale-95"
          >
            <Plus className="h-5 w-5" strokeWidth={2.6} />
          </button>
        }
      />

      {/* Onglets principaux — pilule (langage Segmented du kit) */}
      <div className="px-4 pt-3">
        <div className={cn('inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
          {MAIN_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
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
          {/* Onglet Taux */}
          {activeTab === 'rates' && (
            <>
              {/* Sous-onglets — pilule douce */}
              <div className={cn('mb-4 inline-flex w-full items-center gap-1 rounded-full p-1', SURFACE.card, SURFACE.shadow)}>
                {SUB_TABS.map((st) => {
                  const active = activeSubTab === st.key;
                  return (
                    <button
                      key={st.key}
                      onClick={() => setActiveSubTab(st.key)}
                      className={cn(
                        'flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors',
                        active ? PRIMARY_PILL : cn('bg-transparent', TEXT.muted),
                      )}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>

              {activeSubTab === 'set' && <RateSetTab currentRate={activeRate} />}
              {activeSubTab === 'chart' && <RateChartTab />}
              {activeSubTab === 'history' && <RateHistoryTab />}
            </>
          )}

          {/* Onglet Config */}
          {activeTab === 'config' && <RateConfigTab />}

          {/* Onglet Simulateur */}
          {activeTab === 'simulator' && (
            <RateSimulatorTab
              activeRate={activeRate}
              adjustments={adjustments || []}
              isLoading={rateLoading || adjLoading}
              isError={rateError || adjError}
            />
          )}
        </div>
      </PullToRefresh>
    </div>
  );
}
