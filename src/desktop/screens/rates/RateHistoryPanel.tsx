/**
 * Historique des taux — les 20 dernières publications.
 *
 * Rebuilt off `@/mobile/screens/rates/tabs/RateHistoryTab` +
 * `RateHistoryCard`, which the phone still owns.
 *
 * One structural change: **a history line is no longer a button.** On the
 * phone each row expanded to show the same four numbers again, with logos —
 * twenty disclosure buttons for information that fits on the collapsed row.
 * The desktop column is wide enough to print the four rates outright, so the
 * rows are inert and the method order is stated once, in the panel head.
 *
 * Data and derivations are unchanged: `useDailyRatesHistory(20)` through
 * `supabaseAdmin`, and the variation is still cash-vs-previous-cash.
 */
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { AlertTriangle, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/types/rates';
import type { DailyRate } from '@/types/rates';
import { useDailyRatesHistory } from '@/hooks/useDailyRates';
import { DS, DT, DFG } from '@/desktop/ui/tokens';
import { Badge, EmptyState, Figure, Panel, PanelHead, Spinner } from '@/desktop/ui/primitives';

const METHOD_ORDER = PAYMENT_METHODS.map((pm) => pm.label).join(' · ');

function HistoryRow({
  rate,
  previousRate,
  isLast,
}: {
  rate: DailyRate;
  previousRate?: DailyRate;
  isLast: boolean;
}) {
  const dateStr = format(parseISO(rate.effective_at), "dd MMM yyyy 'à' HH:mm", { locale: fr });

  // Variation basée sur le taux cash vs précédent
  const variation = previousRate
    ? ((rate.rate_cash - previousRate.rate_cash) / previousRate.rate_cash) * 100
    : null;
  const variationStr = variation !== null ? `${variation >= 0 ? '+' : ''}${variation.toFixed(1)}%` : null;
  const isPositive = variation !== null && variation >= 0;

  const rateValues: Record<string, number> = {
    cash: rate.rate_cash,
    alipay: rate.rate_alipay,
    wechat: rate.rate_wechat,
    virement: rate.rate_virement,
  };

  return (
    <div className={cn('px-4 py-3', !isLast && 'border-b', DS.line)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(DT.body, DFG.strong, 'font-semibold')}>{dateStr}</span>
        {rate.is_active ? <Badge tone="success">Actif</Badge> : null}
        {variationStr ? (
          <Figure size="sm" value={variationStr} tone={isPositive ? 'positive' : 'negative'} />
        ) : null}
      </div>
      <p className={cn('mt-1', DT.mono, DFG.base)}>
        ¥ {PAYMENT_METHODS.map((pm) => rateValues[pm.key].toLocaleString('fr-FR')).join(' · ')}
      </p>
    </div>
  );
}

export function RateHistoryPanel() {
  const { data: history, isLoading, isError } = useDailyRatesHistory(20);

  if (isLoading) {
    return (
      <Panel>
        <PanelHead title="Historique" />
        <Spinner />
      </Panel>
    );
  }

  if (isError) {
    return (
      <Panel>
        <PanelHead title="Historique" />
        <EmptyState
          icon={AlertTriangle}
          title="Erreur de chargement"
          hint="Impossible de charger l'historique. Vérifiez que la migration SQL a été exécutée."
        />
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden">
      <PanelHead title="Historique" hint={METHOD_ORDER} />
      {!history || history.length === 0 ? (
        <EmptyState icon={History} title="Aucun historique de taux" />
      ) : (
        history.map((rate, i) => (
          <HistoryRow
            key={rate.id}
            rate={rate}
            previousRate={i < history.length - 1 ? history[i + 1] : undefined}
            isLast={i === history.length - 1}
          />
        ))
      )}
    </Panel>
  );
}
