/**
 * La période de la Trésorerie — UN seul socle, celui du tableau de bord.
 *
 * Régression réelle, signalée : « dans la Trésorerie je ne peux plus mettre
 * une plage personnalisée ; il n'y a plus aujourd'hui, cette semaine, ce
 * mois ». La reconstruction desktop avait remplacé les 7 presets + calendrier
 * de l'écran précédent par quatre durées glissantes (7 j, 30 j, 3 mois,
 * 1 an), dupliquées à l'identique dans l'Analyse et dans le workbench des
 * Opérations. Deux modules, deux sélecteurs, deux calculs de bornes : c'est
 * ainsi que l'un a pu régresser sans que l'autre ne le voie.
 *
 * Ici, la Trésorerie consomme `DateRangeProvider` / `DateRangePicker` —
 * presets calendaires (aujourd'hui, cette semaine, ce mois, ce trimestre,
 * cette année, tout) ET plage personnalisée, bornes en jours civils de
 * Douala — sans les réglages propres aux seaux du tableau de bord
 * (granularité, comparaison), qui n'ont pas de sens pour des séries
 * d'événements.
 *
 * Constante et hook vivent dans `treasuryPeriod.ts` (Fast Refresh).
 */
import type { ReactNode } from 'react';
import { DateRangePicker } from '@/components/analytics/DateRangePicker';
import { DateRangeProvider, useDateRange, useOptionalDateRange } from '@/lib/analytics/DateRangeContext';
import { formatBusinessDay } from '@/lib/analytics/dateRange';
import { cn } from '@/lib/utils';
import { NUM, T } from './marketKit';
import { TREASURY_DEFAULT_PRESET } from './treasuryPeriod';

/**
 * Se fournit son contexte QUAND AUCUN PARENT NE LE FAIT — l'écran reste
 * montable seul (la leçon du plantage `useDateRange must be used within…`).
 * Quand `DesktopTreasuryScreen` fournit le contexte, il est partagé : la
 * période choisie survit au passage Opérations ↔ Analyse.
 */
export function TreasuryPeriodScope({ children }: { children: ReactNode }) {
  const parent = useOptionalDateRange();
  if (parent) return <>{children}</>;
  return <DateRangeProvider defaultPreset={TREASURY_DEFAULT_PRESET}>{children}</DateRangeProvider>;
}

/**
 * Barre de période : la plage EFFECTIVE, en jours civils de Douala, et le
 * sélecteur partagé. `toLocaleDateString` affichait des bornes « minuit
 * Douala » à la veille sur un poste hors UTC+1.
 */
export function TreasuryPeriodBar({ className }: { className?: string }) {
  const { range } = useDateRange();
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className={cn('text-[11.5px]', NUM, T.muted)}>
        {formatBusinessDay(range.from)} → {formatBusinessDay(range.to)}
      </span>
      <DateRangePicker showGranularity={false} showCompare={false} />
    </div>
  );
}
