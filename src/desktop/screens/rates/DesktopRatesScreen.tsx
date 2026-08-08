/**
 * Taux de change — publier le taux du jour, simuler un règlement, suivre
 * l'historique.
 *
 * This was the last console screen still mounting the mobile component kit.
 * The file itself was short (~144 lines) and looked harmless, but it mounted
 * five whole phone screens, so the cost was invisible from here: the metrology
 * spec measured **eight distinct control heights** on the page — 29, 30, 36,
 * 38, 40, 75 — none of them on the console's 24/28/32 ladder, plus 14px body
 * text. Those are thumb targets — 44 and 48px boxes, full pills, half-step
 * padding — rendered inside a desktop shell.
 *
 * The five blocks now have desktop siblings next to this file; the phone
 * screens are untouched and still own their own. What changed beyond the
 * geometry is documented in each panel, but in one line each:
 *
 *   · `RatePublishPanel`     — five date controls (three pills, a date field,
 *     four ±hour/±minute steppers) became one `datetime-local`; the read-only
 *     « taux actifs » band went away because the inputs below it already
 *     carried the same four numbers; the head and the button now say whether
 *     publishing *replaces* a rate that is already live today.
 *   · `RateSimulatorPanel`   — six country chips became one `Select`, and the
 *     whole block is replaced by one sentence when no rate is published,
 *     instead of fourteen live controls that can only answer "aucun taux".
 *   · `RateHistoryPanel`     — twenty disclosure buttons became twenty inert
 *     rows that print what the disclosure used to hide.
 *   · `RateTrendPanel` / `RateAdjustmentsPanel` — same content, console
 *     geometry, still deferred behind a `Disclosure` (that part was right).
 *
 * Two things are deliberately unchanged:
 *   · **the permission guard is still scoped to the act that matters.** Only
 *     the « Publier » column and the adjustments require `canManageRates`;
 *     reading the day's rate, simulating a settlement and browsing history stay
 *     open, because support answers « quel est le taux du jour ? » all day.
 *   · **« Flyer du jour »** is still `disabled` with an explanatory `title`
 *     when there is no active rate — the pattern the rest of the console was
 *     aligned to.
 *
 * Admin context throughout → every query and mutation goes through
 * `supabaseAdmin` (inside `@/hooks/useDailyRates`).
 */
import { useState } from 'react';
import { Image as ImageIcon, Lock } from 'lucide-react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useActiveDailyRate, useRateAdjustments } from '@/hooks/useDailyRates';
import { BottomSheet } from '@/mobile/designKit';
import { RateFlyerSheet } from '@/mobile/components/rates/RateFlyerSheet';
import { Button, EmptyState, Panel } from '@/desktop/ui/primitives';
import { ScreenHead, Workspace } from '@/desktop/ui/layout';
import { Disclosure } from './Disclosure';
import { RatePublishPanel } from './RatePublishPanel';
import { RateSimulatorPanel } from './RateSimulatorPanel';
import { RateHistoryPanel } from './RateHistoryPanel';
import { RateTrendPanel } from './RateTrendPanel';
import { RateAdjustmentsPanel } from './RateAdjustmentsPanel';

export function DesktopRatesScreen() {
  const { hasPermission } = useAdminAuth();
  const { data: activeRate, isLoading: rateLoading, isError: rateError } = useActiveDailyRate();
  const { data: adjustments, isLoading: adjLoading, isError: adjError } = useRateAdjustments();
  const [flyerOpen, setFlyerOpen] = useState(false);

  const canPublish = hasPermission('canManageRates');

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
            <Button
              icon={ImageIcon}
              disabled={rateLoading || !activeRate}
              title={activeRate ? undefined : 'Aucun taux actif publié'}
              onClick={() => setFlyerOpen(true)}
            >
              Flyer du jour
            </Button>
          }
        />
      }
    >
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-5">
          {canPublish ? (
            <RatePublishPanel currentRate={activeRate} />
          ) : (
            <Panel>
              <EmptyState
                icon={Lock}
                title="Publication réservée"
                hint="Seuls les rôles disposant de la gestion des taux peuvent publier le taux du jour. Le simulateur et l'historique restent accessibles."
              />
            </Panel>
          )}
        </div>

        <div className="xl:col-span-4">
          <RateSimulatorPanel
            activeRate={activeRate}
            adjustments={adjustments || []}
            isLoading={rateLoading || adjLoading}
            isError={rateError || adjError}
          />
        </div>

        <div className="space-y-4 xl:col-span-3">
          <RateHistoryPanel />
          <Disclosure title="Graphique d'évolution">
            <RateTrendPanel />
          </Disclosure>
          {canPublish ? (
            <Disclosure title="Ajustements pays & tranches">
              <RateAdjustmentsPanel />
            </Disclosure>
          ) : null}
        </div>
      </div>

      <BottomSheet open={flyerOpen} onClose={() => setFlyerOpen(false)} title="Flyer du jour">
        <RateFlyerSheet rates={flyerRates} />
      </BottomSheet>
    </Workspace>
  );
}
