// ============================================================
// MODULE TAUX — RateHistoryTab (historique des taux)
// Présentation migrée sur le design kit (Ofspace/Mola) : états
// load/erreur/vide via le kit, liste de RateHistoryCard.
// Logique 100% préservée : useDailyRatesHistory(20), passage du
// taux précédent pour la variation.
// ============================================================
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RateHistoryCard } from '../components/RateHistoryCard';
import { useDailyRatesHistory } from '@/hooks/useDailyRates';
import { SURFACE, TEXT, ScreenError } from '@/mobile/designKit';

export function RateHistoryTab() {
  const { data: history, isLoading, isError } = useDailyRatesHistory(20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#8B5CF6]" />
      </div>
    );
  }

  if (isError) {
    return (
      <ScreenError
        title="Erreur de chargement"
        description="Impossible de charger l'historique. Vérifiez que la migration SQL a été exécutée."
      />
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className={cn('rounded-2xl p-8 text-center', SURFACE.card, SURFACE.shadow)}>
        <div className={cn('text-[14px]', TEXT.muted)}>Aucun historique de taux</div>
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
