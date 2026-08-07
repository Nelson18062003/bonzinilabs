/**
 * Taux de change — publish and monitor the day's rates.
 *
 * Two changes beyond the layout rework:
 *  · **Permission guard.** This screen publishes the rate the whole business
 *    prices on, yet it was gated only by hiding its nav entry — anyone who
 *    typed the URL got the full publishing UI. It now requires
 *    `canManageRates`, like every other privileged screen.
 *  · A three-column composition (publier · simuler · historique) so the
 *    operator can set a rate and immediately check what a client would pay,
 *    without scrolling between the two.
 *
 * The five rate blocks themselves are the shared mobile components
 * (RateSetTab, RateSimulatorTab, …) — one source of truth for the pricing
 * formulas across form factors.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ChevronDown, Image as ImageIcon } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { BottomSheet } from '@/mobile/designKit';
import { RateFlyerSheet } from '@/mobile/components/rates/RateFlyerSheet';
import { RateSetTab } from '@/mobile/screens/rates/tabs/RateSetTab';
import { RateChartTab } from '@/mobile/screens/rates/tabs/RateChartTab';
import { RateHistoryTab } from '@/mobile/screens/rates/tabs/RateHistoryTab';
import { RateConfigTab } from '@/mobile/screens/rates/tabs/RateConfigTab';
import { RateSimulatorTab } from '@/mobile/screens/rates/tabs/RateSimulatorTab';
import { cn } from '@/lib/utils';
import { DS, DT, DFG, DFOCUS } from '@/desktop/ui/tokens';
import { Button } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className={cn(DT.micro, DFG.faint, 'mb-2')}>{title}</h3>
      {children}
    </section>
  );
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn('overflow-hidden rounded-xl border', DS.card, DS.line)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn('flex w-full items-center justify-between px-4 py-3 transition-colors', DS.hover, DFOCUS)}
      >
        <span className={cn('text-[13px] font-bold', DFG.strong)}>{title}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', DFG.faint, !open && '-rotate-90')} />
      </button>
      {open && <div className={cn('border-t p-3', DS.line)}>{children}</div>}
    </div>
  );
}

export function DesktopRatesScreen() {
  const { hasPermission } = useAdminAuth();
  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();
  const [flyerOpen, setFlyerOpen] = useState(false);

  /* Publishing a rate is a privileged, business-critical action. */
  if (!hasPermission('canManageRates')) return <Navigate to="/m" replace />;

  const flyerRates = {
    alipay: activeRate?.rate_alipay || 0,
    wechat: activeRate?.rate_wechat || 0,
    bank: activeRate?.rate_virement || 0,
    cash: activeRate?.rate_cash || 0,
  };

  return (
    <Workspace
      head={
        <ScreenHead
          title="Taux de change"
          subtitle="Publier le taux du jour, simuler un règlement et suivre l'historique"
          actions={
            <Button icon={ImageIcon} onClick={() => setFlyerOpen(true)}>
              Flyer du jour
            </Button>
          }
        />
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-5">
          <Section title="Publier">
            <RateSetTab currentRate={activeRate} />
          </Section>
        </div>

        <div className="space-y-5 xl:col-span-4">
          <Section title="Simulateur client">
            <RateSimulatorTab
              activeRate={activeRate}
              adjustments={adjustments || []}
              isLoading={rateLoading || adjLoading}
              isError={rateError || adjError}
            />
          </Section>
        </div>

        <div className="space-y-3 xl:col-span-3">
          <Section title="Historique">
            <RateHistoryTab />
          </Section>
          <Disclosure title="Graphique d'évolution">
            <RateChartTab />
          </Disclosure>
          <Disclosure title="Ajustements pays & tranches">
            <RateConfigTab />
          </Disclosure>
        </div>
      </div>

      <BottomSheet open={flyerOpen} onClose={() => setFlyerOpen(false)} title="Flyer du jour">
        <RateFlyerSheet rates={flyerRates} />
      </BottomSheet>
    </Workspace>
  );
}
