/**
 * Desktop admin — Taux de change, salle de contrôle
 * (docs/admin-redesign/06-rates-module.md).
 *
 * Remplace l'empilement des blocs mobiles en deux colonnes. Composition
 * hiérarchisée par fréquence d'usage :
 *   A. Publier (gauche, 480px) — actif → nouveau + Δ, suggestion Binance,
 *      prise d'effet, publication confirmée en dialogue.
 *   B. Simulateur (droite, haut) — détail du calcul toujours visible.
 *   C. Historique (droite, bas) — vraie table par mode.
 *   D. Tendance (bas, large) — graphique sorti de l'accordéon, période 1A.
 *   E. Ajustements (bas, droite) — visibles, sauvegarde si modifié.
 * Le flyer WhatsApp s'ouvre en dialogue centré (plus de BottomSheet).
 * Données/RPC inchangées : useDailyRates.ts, lib/rateCalculation.ts.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { TEXT, SOFT_PILL, ScreenLoader, ScreenError, CenterDialog } from '@/desktop/designKit';
import { RateFlyerSheet } from '@/mobile/components/rates/RateFlyerSheet';
import { RatePublishCard } from './RatePublishCard';
import { RateSimulatorCard } from './RateSimulatorCard';
import { DesktopRateHistory } from './DesktopRateHistory';
import { RateTrendCard } from './RateTrendCard';
import { RateAdjustmentsCard } from './RateAdjustmentsCard';

export function DesktopRatesScreen() {
  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();
  const [flyerOpen, setFlyerOpen] = useState(false);

  // Le flyer partagé reflète les taux ACTIFS (publiés) — ce que voient les clients.
  const flyerRates = {
    alipay: activeRate?.rate_alipay || 0,
    wechat: activeRate?.rate_wechat || 0,
    bank: activeRate?.rate_virement || 0,
    cash: activeRate?.rate_cash || 0,
  };

  if (rateLoading || adjLoading) return <ScreenLoader />;
  if (rateError || adjError) {
    return (
      <ScreenError
        title="Erreur de chargement"
        description="Impossible de charger les taux. Vérifiez que la migration SQL a été exécutée."
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={cn('text-[26px] font-extrabold tracking-tight', TEXT.strong)}>Taux de change</h2>
          <p className={cn('mt-1 text-[14px]', TEXT.muted)}>
            {activeRate
              ? `Taux actifs depuis le ${new Date(activeRate.effective_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`
              : 'Aucun taux actif — publiez les taux du jour'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFlyerOpen(true)}
          className={cn('inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold', SOFT_PILL)}
        >
          Flyer du jour <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      {/* ── A | B + C ── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[480px_minmax(0,1fr)]">
        <RatePublishCard activeRate={activeRate} />
        <div className="min-w-0 space-y-5">
          <RateSimulatorCard activeRate={activeRate} adjustments={adjustments ?? []} />
          <DesktopRateHistory />
        </div>
      </div>

      {/* ── D | E ── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <RateTrendCard />
        <RateAdjustmentsCard />
      </div>

      {/* ── Flyer WhatsApp ── */}
      <CenterDialog open={flyerOpen} onClose={() => setFlyerOpen(false)} title="Flyer du jour" width={560}>
        <RateFlyerSheet rates={flyerRates} />
      </CenterDialog>
    </div>
  );
}
