import { Loader2 } from 'lucide-react';
import { RateHistoryCard } from '../components/RateHistoryCard';
import { useDailyRatesHistory } from '@/hooks/useDailyRates';

export function RateHistoryTab() {
  const { data: history, isLoading, isError } = useDailyRatesHistory(20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 rounded-2xl p-6 text-center border border-red-200">
        <div className="text-red-600 font-semibold text-sm mb-1">Erreur de chargement</div>
        <div className="text-muted-foreground text-xs">
          Impossible de charger l'historique. Verifiez que la migration SQL a ete executee.
        </div>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
        <div className="text-muted-foreground text-sm">Aucun historique de taux</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((rate, i) => (
        <RateHistoryCard
          key={rate.id}
          rate={rate}
          previousRate={i < history.length - 1 ? history[i + 1] : undefined}
        />
      ))}
    </div>
  );
}
