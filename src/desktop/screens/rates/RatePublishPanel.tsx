/**
 * Publier le taux du jour — the one screen that sets the price the whole
 * business runs on.
 *
 * Rebuilt off `@/mobile/screens/rates/tabs/RateSetTab` (which the phone still
 * owns, untouched). The phone version rendered 12 controls at rest and 17 once
 * « Autre… » was picked, none of them on the console's 24/28/32 ladder: 44px
 * ±hour / ±minute steppers, 38px date pills, 40px rate fields, 36px segment.
 *
 * What changed, and why:
 *   · **five date controls became one.** Three preset pills, a date field and
 *     four steppers all wrote the same thing — a timestamp — so they are now a
 *     single `<Input type="datetime-local">`. It expresses everything the old
 *     set could (today 00:00, yesterday 00:00, any date at any minute) and one
 *     thing it could not: `new Date('2026-08-08')` parsed the custom date as
 *     *UTC* midnight before `setHours` ran on it, which lands on the previous
 *     day in any negative-offset timezone. A `datetime-local` value parses as
 *     local time, so that class of off-by-a-day is gone.
 *   · **the read-only « Taux actifs » band is gone.** It printed the same four
 *     numbers the four inputs below it were pre-filled with. What was *not*
 *     stated anywhere is the fact that matters before pressing the button —
 *     that a rate is already live today and publishing supersedes it — so that
 *     is what the head and the button now say instead (« Republier »).
 *   · the direction segment reads `XAF` / `CNY`, the same wording as the
 *     simulator's currency segment. It is, as before, a *caption* switch: the
 *     stored value is always CNY per 1M XAF whichever side is selected.
 *
 * **The publishing logic is moved, not rewritten**: same `useCreateDailyRates`
 * RPC call, same `parseFloat(x) || 0` per field, same suggestion bookkeeping
 * (`markApplied` only when a fresh, unapplied suggestion exists). Only
 * `getEffectiveAt` had to be re-expressed, because its inputs changed.
 */
import { useEffect, useState } from 'react';
import { format, formatDistanceToNow, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, RefreshCw, Upload, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import {
  useCreateDailyRates,
  useLatestSuggestion,
  useComputeSuggestion,
  useMarkSuggestionApplied,
} from '@/hooks/useDailyRates';
import { TONE_PILL } from '@/mobile/designKit';
import { MethodLogo } from '@/mobile/screens/rates/components/MethodLogo';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import {
  Badge,
  Button,
  Field,
  Figure,
  Input,
  Panel,
  PanelHead,
  Segment,
} from '@/desktop/ui/primitives';

/** The local-datetime shape `<input type="datetime-local">` reads and writes. */
const LOCAL_DATETIME = "yyyy-MM-dd'T'HH:mm";

export function RatePublishPanel({ currentRate }: { currentRate: DailyRate | null | undefined }) {
  const [direction, setDirection] = useState<'xaf_cny' | 'cny_xaf'>('xaf_cny');
  const [rates, setRates] = useState<Record<string, string>>({
    cash: currentRate?.rate_cash?.toString() || '',
    alipay: currentRate?.rate_alipay?.toString() || '',
    wechat: currentRate?.rate_wechat?.toString() || '',
    virement: currentRate?.rate_virement?.toString() || '',
  });
  const [effectiveAt, setEffectiveAt] = useState(() => format(new Date(), LOCAL_DATETIME));

  // Pré-remplit les champs quand le taux actif arrive APRÈS le montage
  // (chargement réseau) — sans jamais écraser une saisie en cours.
  useEffect(() => {
    if (!currentRate) return;
    setRates((prev) => ({
      cash: prev.cash || currentRate.rate_cash?.toString() || '',
      alipay: prev.alipay || currentRate.rate_alipay?.toString() || '',
      wechat: prev.wechat || currentRate.rate_wechat?.toString() || '',
      virement: prev.virement || currentRate.rate_virement?.toString() || '',
    }));
  }, [currentRate]);

  const createRates = useCreateDailyRates();
  const { data: latestSuggestion } = useLatestSuggestion();
  const computeSuggestion = useComputeSuggestion();
  const markApplied = useMarkSuggestionApplied();

  const handleUseSuggestion = () => {
    if (!latestSuggestion) return;
    const v = latestSuggestion.suggested_rate.toString();
    setRates({ cash: v, alipay: v, wechat: v, virement: v });
  };

  /**
   * The instant the new rate takes effect.
   *
   * The field carries minutes, so publishing "now" would otherwise round the
   * timestamp down to :00 seconds and two publishes inside one minute would
   * tie in `order by effective_at`. When the operator has left the field on the
   * current minute — the overwhelming case, and what the old « Maintenant »
   * pill did — the exact instant is used instead, as before.
   *
   * An unparseable field (the operator cleared it) falls back to now rather
   * than throwing: the previous code called `.toISOString()` on an Invalid Date
   * and raised a RangeError that no handler caught.
   */
  const getEffectiveAt = (): string => {
    const now = new Date();
    const chosen = new Date(effectiveAt);
    if (Number.isNaN(chosen.getTime())) return now.toISOString();
    const sameMinute =
      chosen.getFullYear() === now.getFullYear() &&
      chosen.getMonth() === now.getMonth() &&
      chosen.getDate() === now.getDate() &&
      chosen.getHours() === now.getHours() &&
      chosen.getMinutes() === now.getMinutes();
    return sameMinute ? now.toISOString() : chosen.toISOString();
  };

  const handleApply = () => {
    const suggestionId = latestSuggestion && !latestSuggestion.applied ? latestSuggestion.id : null;
    createRates.mutate(
      {
        rate_cash: parseFloat(rates.cash) || 0,
        rate_alipay: parseFloat(rates.alipay) || 0,
        rate_wechat: parseFloat(rates.wechat) || 0,
        rate_virement: parseFloat(rates.virement) || 0,
        effective_at: getEffectiveAt(),
      },
      {
        onSuccess: (result) => {
          if (suggestionId && result.rate_id) {
            markApplied.mutate({ suggestionId, rateId: result.rate_id });
          }
        },
      },
    );
  };

  const activeSince = currentRate?.effective_at
    ? new Date(currentRate.effective_at).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  /* Publier quand un taux est déjà en ligne aujourd'hui n'est pas une
     correction, c'est un remplacement — l'écran doit le dire avant le clic. */
  const publishedToday = currentRate?.effective_at
    ? isSameDay(new Date(currentRate.effective_at), new Date())
    : false;

  return (
    <div className="space-y-4">
      {/* ── Suggestion automatique — Binance P2P live ── */}
      <Panel>
        <PanelHead
          title="Suggestion automatique"
          hint="Binance P2P · méthode Nelson v2"
          actions={
            <Button
              icon={RefreshCw}
              loading={computeSuggestion.isPending}
              onClick={() => computeSuggestion.mutate()}
            >
              Recalculer
            </Button>
          }
        />
        <div className="p-4">
          {!latestSuggestion ? (
            <p className={cn(DT.body, DFG.muted)}>
              Aucune suggestion encore. « Recalculer » interroge Binance P2P en direct.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn(DT.micro, DFG.faint)}>Taux suggéré · 1M XAF</p>
                  <p className="mt-2">
                    <Figure
                      size="lg"
                      value={latestSuggestion.suggested_rate.toLocaleString('fr-FR')}
                      unit="CNY"
                    />
                  </p>
                </div>
                <Button icon={Wand2} onClick={handleUseSuggestion}>
                  Pré-remplir
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className={cn('rounded-lg p-3', DS.well)}>
                  <p className={cn(DT.micro, DFG.faint)}>
                    CMR · max + {latestSuggestion.cmr_margin_xaf} XAF
                  </p>
                  <p className="mt-2">
                    <Figure
                      value={(
                        latestSuggestion.cmr_rate_max + latestSuggestion.cmr_margin_xaf
                      ).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
                      unit="XAF/USDT"
                    />
                  </p>
                  <p className={cn(DT.label, DFG.faint, 'mt-2')}>
                    {latestSuggestion.cmr_orders.length} ordres MTN/Orange
                  </p>
                </div>
                <div className={cn('rounded-lg p-3', DS.well)}>
                  <p className={cn(DT.micro, DFG.faint)}>CHN · moyenne</p>
                  <p className="mt-2">
                    <Figure
                      value={latestSuggestion.chn_rate_avg.toLocaleString('fr-FR', {
                        maximumFractionDigits: 4,
                      })}
                      unit="CNY/USDT"
                    />
                  </p>
                  <p className={cn(DT.label, DFG.faint, 'mt-2')}>
                    {latestSuggestion.chn_orders.length} ordres Alipay/WeChat
                  </p>
                </div>
              </div>

              <p className={cn(DT.label, DFG.faint, 'mt-3')}>
                Calculé il y a {formatDistanceToNow(new Date(latestSuggestion.computed_at), { locale: fr })}
                {latestSuggestion.applied ? ' · déjà appliqué' : ''}
              </p>
            </>
          )}
        </div>
      </Panel>

      {/* ── Saisie & publication ── */}
      <Panel>
        <PanelHead
          title="Taux du jour"
          hint={activeSince ? `En ligne depuis le ${activeSince}` : 'Aucun taux publié à ce jour'}
          actions={
            publishedToday ? (
              <Badge tone="success">Publié aujourd'hui</Badge>
            ) : (
              <Badge tone="pending">Non publié aujourd'hui</Badge>
            )
          }
        />

        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className={cn(DT.micro, DFG.faint)}>Nouveaux taux</span>
            <Segment
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'xaf_cny', label: 'XAF' },
                { value: 'cny_xaf', label: 'CNY' },
              ]}
            />
          </div>

          <div className="space-y-2">
            {PAYMENT_METHODS.map((pm) => (
              <div key={pm.key} className={cn('flex items-center gap-3 rounded-lg border p-3', DS.line)}>
                <MethodLogo method={pm.key} size={24} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate font-semibold', DT.body, DFG.strong)}>
                    {pm.label}
                  </span>
                  <span className={cn('block truncate', DT.label, DFG.faint)}>
                    {direction === 'xaf_cny' ? 'CNY pour 1M XAF' : 'XAF pour 1 CNY'}
                  </span>
                </span>
                <Input
                  inputMode="decimal"
                  value={rates[pm.key]}
                  onChange={(e) => setRates({ ...rates, [pm.key]: e.target.value })}
                  className="w-28 text-right font-bold tabular-nums"
                  aria-label={`Taux ${pm.label}`}
                />
              </div>
            ))}
          </div>

          <p className={cn(DT.body, DFG.muted)}>
            Taux de base (meilleur cas : Cameroun, ≥ 1M XAF). Les ajustements pays et tranches
            s'appliquent automatiquement — voir « Ajustements pays &amp; tranches ».
          </p>

          <Field
            label="Prise d'effet"
            hint="Laissez la minute courante pour publier immédiatement."
          >
            <Input
              type="datetime-local"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
              className="tabular-nums"
            />
          </Field>

          {publishedToday && activeSince ? (
            <p className={cn('rounded-lg px-3 py-2', DT.body, TONE_PILL.pending)}>
              Un taux est déjà en ligne depuis le {activeSince}. Publier le remplacera
              immédiatement pour tous les clients.
            </p>
          ) : null}

          <Button
            variant="primary"
            icon={createRates.isSuccess ? Check : Upload}
            loading={createRates.isPending}
            onClick={handleApply}
            className="w-full"
          >
            {createRates.isSuccess
              ? 'Taux publiés !'
              : publishedToday
                ? 'Republier les taux du jour'
                : 'Publier les taux du jour'}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
