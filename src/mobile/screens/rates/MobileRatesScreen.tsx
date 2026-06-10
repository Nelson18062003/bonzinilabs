// ============================================================
// MODULE TAUX — MobileRatesScreen
// Disposition VALIDÉE par le client (maquette rates.tsx) : UN SEUL
// SCROLL, sections empilées sous des intitulés, tout sous les yeux —
// pas d'onglets. Rendu réel et complet en composant les vrais blocs
// déjà migrés sur le kit :
//   · Définir les taux du jour (RateSetTab — saisie + prise d'effet + publier + flyer)
//   · Simulateur (RateSimulatorTab)
//   · Historique (RateHistoryTab) + graphique d'évolution (repli)
//   · Ajustements pays & tranches (RateConfigTab — repli, usage avancé)
// Logique 100% préservée (hooks, RPC, calculs, exports).
// ============================================================
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { MobileHeader } from '@/mobile/components/layout/MobileHeader';
import { PullToRefresh } from '@/mobile/components/ui/PullToRefresh';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { SURFACE, TEXT } from '@/mobile/designKit';
import { RateSetTab } from './tabs/RateSetTab';
import { RateChartTab } from './tabs/RateChartTab';
import { RateHistoryTab } from './tabs/RateHistoryTab';
import { RateConfigTab } from './tabs/RateConfigTab';
import { RateSimulatorTab } from './tabs/RateSimulatorTab';

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <h2 className={cn('mb-3 px-1 text-[12px] font-bold uppercase tracking-wider', TEXT.muted)}>
      {children}
    </h2>
  );
}

// Section repliable — pour les blocs avancés (graphique, ajustements) afin de
// garder le scroll principal compact, comme la maquette aimée.
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

export function MobileRatesScreen() {
  const queryClient = useQueryClient();

  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['daily-rates'] });
    await queryClient.invalidateQueries({ queryKey: ['rate-adjustments'] });
  };

  return (
    <div className={cn('min-h-screen', SURFACE.canvas)}>
      <MobileHeader title="Taux de change" showBack backTo="/m/more" className={SURFACE.canvas} />

      <PullToRefresh onRefresh={handleRefresh} className="overflow-auto">
        <div className="space-y-7 p-4 pb-24">
          {/* ── Définir les taux du jour (+ flyer) ── */}
          <section>
            <Caption>Définir les taux du jour</Caption>
            <RateSetTab currentRate={activeRate} />
          </section>

          {/* ── Simulateur ── */}
          <section>
            <Caption>Simulateur</Caption>
            <RateSimulatorTab
              activeRate={activeRate}
              adjustments={adjustments || []}
              isLoading={rateLoading || adjLoading}
              isError={rateError || adjError}
            />
          </section>

          {/* ── Historique (rows) + graphique en repli ── */}
          <section className="space-y-3">
            <Caption>Historique</Caption>
            <RateHistoryTab />
            <Collapsible title="Graphique d'évolution">
              <RateChartTab />
            </Collapsible>
          </section>

          {/* ── Ajustements pays & tranches (avancé, repli) ── */}
          <section>
            <Caption>Réglages</Caption>
            <Collapsible title="Ajustements pays & tranches">
              <RateConfigTab />
            </Collapsible>
          </section>
        </div>
      </PullToRefresh>
    </div>
  );
}
