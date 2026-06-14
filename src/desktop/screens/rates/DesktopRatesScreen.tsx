/**
 * Desktop admin — exchange rates.
 *
 * Reuses the exact rate building blocks (RateSetTab, RateSimulatorTab,
 * RateHistoryTab, RateChartTab, RateConfigTab, RateFlyerSheet) and data hooks as
 * MobileRatesScreen — only the layout differs: a two-column composition instead
 * of one long scroll, so everything is visible at once on a wide screen.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, SOFT_PILL, BottomSheet } from '@/mobile/designKit';
import { RateFlyerSheet } from '@/mobile/components/rates/RateFlyerSheet';
import { RateSetTab } from '@/mobile/screens/rates/tabs/RateSetTab';
import { RateChartTab } from '@/mobile/screens/rates/tabs/RateChartTab';
import { RateHistoryTab } from '@/mobile/screens/rates/tabs/RateHistoryTab';
import { RateConfigTab } from '@/mobile/screens/rates/tabs/RateConfigTab';
import { RateSimulatorTab } from '@/mobile/screens/rates/tabs/RateSimulatorTab';

function Caption({ children }: { children: React.ReactNode }) {
  return <h2 className={cn('mb-3 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>{children}</h2>;
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn('flex w-full items-center justify-between rounded-2xl px-4 py-3.5', SURFACE.card, SURFACE.shadow)}
      >
        <span className={cn('text-[14px] font-bold', TEXT.strong)}>{title}</span>
        <ChevronDown className={cn('h-5 w-5 transition-transform', TEXT.muted, !open && '-rotate-90')} />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function DesktopRatesScreen() {
  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();
  const [flyerOpen, setFlyerOpen] = useState(false);

  const flyerRates = {
    alipay: activeRate?.rate_alipay || 0,
    wechat: activeRate?.rate_wechat || 0,
    bank: activeRate?.rate_virement || 0,
    cash: activeRate?.rate_cash || 0,
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Taux de change</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>Définir, simuler et suivre les taux du jour</p>
        </div>
        <button
          onClick={() => setFlyerOpen(true)}
          className={cn('inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold', SOFT_PILL)}
        >
          Voir le flyer du jour <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* Left — set + simulate */}
        <div className="space-y-7">
          <section>
            <Caption>Définir les taux du jour</Caption>
            <RateSetTab currentRate={activeRate} />
          </section>
          <section>
            <Caption>Simulateur</Caption>
            <RateSimulatorTab
              activeRate={activeRate}
              adjustments={adjustments || []}
              isLoading={rateLoading || adjLoading}
              isError={rateError || adjError}
            />
          </section>
        </div>

        {/* Right — history + settings */}
        <div className="space-y-7">
          <section className="space-y-3">
            <Caption>Historique</Caption>
            <RateHistoryTab />
            <Collapsible title="Graphique d'évolution">
              <RateChartTab />
            </Collapsible>
          </section>
          <section>
            <Caption>Réglages</Caption>
            <Collapsible title="Ajustements pays &amp; tranches">
              <RateConfigTab />
            </Collapsible>
          </section>
        </div>
      </div>

      <BottomSheet open={flyerOpen} onClose={() => setFlyerOpen(false)} title="Flyer du jour">
        <RateFlyerSheet rates={flyerRates} />
      </BottomSheet>
    </div>
  );
}
