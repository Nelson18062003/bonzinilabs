/**
 * La période de la Trésorerie — la partie SANS composant (constante + hook),
 * séparée de `treasuryPeriodScope.tsx` pour que Fast Refresh fonctionne
 * (un fichier qui exporte autre chose que des composants recharge à froid).
 */
import { useDateRange } from '@/lib/analytics/DateRangeContext';
import { toSupabaseBounds, type DateRange } from '@/lib/analytics/dateRange';

/** Le mois en cours : ce que l'ancien écran desktop ouvrait par défaut. */
export const TREASURY_DEFAULT_PRESET = 'this_month' as const;

/** La plage courante et ses bornes prêtes pour les RPC (`>= from`, `<= to`). */
export function useTreasuryBounds(): { range: DateRange; fromIso: string; toIso: string } {
  const { range } = useDateRange();
  const { fromISO, toISO } = toSupabaseBounds(range);
  return { range, fromIso: fromISO, toIso: toISO };
}
