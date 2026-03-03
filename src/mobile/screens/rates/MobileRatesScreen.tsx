import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
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
  { key: 'set', label: 'Definir' },
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
    <div className="min-h-screen bg-background">
      <MobileHeader
        title="Taux de change"
        showBack
        backTo="/m/more"
        rightElement={
          <button
            onClick={handlePlusClick}
            className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-md"
            style={{ background: '#7c3aed', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
          >
            <Plus className="w-5 h-5" />
          </button>
        }
      />

      {/* Main tabs */}
      <div className="flex bg-background border-b border-border px-3">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3.5 px-1.5 text-[13px] cursor-pointer border-b-[3px] transition-colors ${
              activeTab === tab.key
                ? 'border-purple-600 text-purple-600 font-bold'
                : 'border-transparent text-muted-foreground font-medium'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={handleRefresh} className="overflow-auto">
        <div className="p-4 pb-24">
          {/* Rates tab */}
          {activeTab === 'rates' && (
            <>
              {/* Sub-tabs */}
              <div className="flex bg-muted rounded-xl p-0.5 mb-4">
                {SUB_TABS.map((st) => (
                  <button
                    key={st.key}
                    onClick={() => setActiveSubTab(st.key)}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] cursor-pointer transition-all ${
                      activeSubTab === st.key
                        ? 'bg-white text-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {activeSubTab === 'set' && <RateSetTab currentRate={activeRate} />}
              {activeSubTab === 'chart' && <RateChartTab />}
              {activeSubTab === 'history' && <RateHistoryTab />}
            </>
          )}

          {/* Config tab */}
          {activeTab === 'config' && <RateConfigTab />}

          {/* Simulator tab */}
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
