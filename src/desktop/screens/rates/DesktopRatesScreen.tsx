/**
 * Desktop admin — Taux de change : UN MÉTIER PAR VUE
 * (docs/admin-redesign/06-rates-module.md, v2 après retour utilisateur :
 * « trop d'informations d'un coup »).
 *
 * Le sélecteur de vue suit la fréquence réelle d'usage :
 *   · Simulateur (défaut) — coter un client WhatsApp : champs XAF⇅CNY liés
 *     + cotation de marque à partager (PNG / texte).
 *   · Publier — la saisie du jour, seule, centrée.
 *   · Historique — tendance + table, la surveillance.
 *   · Réglages — ajustements pays & tranches.
 * Rien d'autre n'est affiché que la vue choisie. Le flyer reste accessible
 * depuis l'en-tête, en dialogue centré.
 */
import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { TEXT, SOFT_PILL, PRIMARY_PILL, CenterDialog } from '@/desktop/designKit';
import { RateFlyerSheet } from '@/mobile/components/rates/RateFlyerSheet';
import { RatePublishCard } from './RatePublishCard';
import { RateQuoteSimulator } from './RateQuoteSimulator';
import { DesktopRateHistory } from './DesktopRateHistory';
import { RateTrendCard } from './RateTrendCard';
import { RateAdjustmentsCard } from './RateAdjustmentsCard';

export type RatesView = 'simulator' | 'publish' | 'history' | 'settings';

const VIEWS: { key: RatesView; label: string }[] = [
  { key: 'simulator', label: 'Simulateur' },
  { key: 'publish', label: 'Publier' },
  { key: 'history', label: 'Historique' },
  { key: 'settings', label: 'Réglages' },
];

export function DesktopRatesScreen({ initialView = 'simulator' }: { initialView?: RatesView } = {}) {
  const { data: activeRate } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();
  const [view, setView] = useState<RatesView>(initialView);
  const [flyerOpen, setFlyerOpen] = useState(false);

  // Le flyer partagé reflète les taux ACTIFS (publiés) — ce que voient les clients.
  const flyerRates = {
    alipay: activeRate?.rate_alipay || 0,
    wechat: activeRate?.rate_wechat || 0,
    bank: activeRate?.rate_virement || 0,
    cash: activeRate?.rate_cash || 0,
  };

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

      {/* ── Sélecteur de vue — un seul métier à l'écran à la fois ───────── */}
      <nav className="flex items-center gap-1.5" aria-label="Vues du module Taux">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            aria-current={view === v.key ? 'page' : undefined}
            className={cn(
              'h-9 rounded-full px-4 text-[13px] font-bold transition-colors',
              view === v.key ? PRIMARY_PILL : SOFT_PILL,
            )}
          >
            {v.label}
          </button>
        ))}
      </nav>

      {view === 'simulator' && (
        <RateQuoteSimulator
          activeRate={activeRate}
          adjustments={adjustments ?? []}
          adjustmentsLoading={adjLoading}
          adjustmentsError={adjError}
        />
      )}

      {view === 'publish' && (
        <div className="mx-auto max-w-[560px]">
          <RatePublishCard activeRate={activeRate} />
        </div>
      )}

      {view === 'history' && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_560px]">
          <RateTrendCard />
          <DesktopRateHistory />
        </div>
      )}

      {view === 'settings' && (
        <div className="mx-auto max-w-[560px]">
          <RateAdjustmentsCard />
        </div>
      )}

      {/* ── Flyer WhatsApp ──────────────────────────────────────────────── */}
      <CenterDialog open={flyerOpen} onClose={() => setFlyerOpen(false)} title="Flyer du jour" width={560}>
        <RateFlyerSheet rates={flyerRates} />
      </CenterDialog>
    </div>
  );
}
