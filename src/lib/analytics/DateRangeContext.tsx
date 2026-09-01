import * as React from 'react';
import {
  buildCustomRange,
  buildRangeFromPreset,
  coerceGranularity,
  defaultGranularityOf,
  granularityIsCompatible,
  type DateRange,
  type Granularity,
  type PresetId,
} from './dateRange';

interface DateRangeContextValue {
  range: DateRange;
  setPreset: (preset: PresetId) => void;
  /** Jours civils, en `Date` (composants locaux) ou en chaîne 'YYYY-MM-DD'. */
  setCustom: (from: Date | string, to: Date | string) => void;
  setGranularity: (granularity: Granularity) => void;
  setCompareToPrevious: (enabled: boolean) => void;
}

const Ctx = React.createContext<DateRangeContextValue | undefined>(undefined);

export interface DateRangeProviderProps {
  children: React.ReactNode;
  defaultPreset?: PresetId;
}

/**
 * La granularité SUIT la plage.
 *
 * Régression réelle, signalée : « après une plage personnalisée, les axes
 * sont bizarres ». `setPreset` et `setCustom` reportaient la granularité
 * précédente telle quelle. « 30 derniers jours » (par jour) puis « Cette
 * année » donnait 365 seaux journaliers — 730 barres-filaments et des
 * étiquettes « Ven 16 · Lun 2 · Mer 18 » sans le mois ; « Aujourd'hui » après
 * un preset journalier donnait UN seul seau.
 *
 * Le mobile se protégeait à la consommation avec `coerceGranularity` ; le
 * desktop ne le faisait pas. Corriger à la consommation, c'est garantir que
 * le prochain consommateur l'oubliera : la garantie vit ICI, à la source.
 * Un choix explicite qui reste compatible est conservé (« par semaine » sur
 * 30 jours survit au passage à 90 jours) ; un choix devenu incompatible cède
 * la place au défaut de la nouvelle plage.
 */
const withCoercedGranularity = (candidate: DateRange): DateRange => ({
  ...candidate,
  granularity: coerceGranularity(candidate),
});

/**
 * Une granularité HÉRITÉE n'est pas un choix. « 30 derniers jours » (par
 * jour) puis « 90 derniers jours » : « par jour » est encore compatible, mais
 * l'utilisateur ne l'a jamais demandé — c'était le défaut du preset
 * précédent. La nouvelle plage reçoit alors SON défaut (par semaine). Seule
 * une granularité posée par `setGranularity` est reportée, et seulement tant
 * qu'elle reste compatible.
 */
const rangeFor = (built: DateRange, prev: DateRange, explicit: boolean): DateRange =>
  withCoercedGranularity({
    ...built,
    granularity: explicit ? prev.granularity : defaultGranularityOf(built),
    compareToPrevious: prev.compareToPrevious,
  });

/**
 * Provides the shared temporal contract to every analytics consumer
 * below it. One picker → one state → all hooks refetch together.
 */
export function DateRangeProvider({
  children,
  defaultPreset = 'last_30_days',
}: DateRangeProviderProps) {
  const [range, setRange] = React.useState<DateRange>(() =>
    withCoercedGranularity(buildRangeFromPreset(defaultPreset)),
  );
  // Vrai seulement après un `setGranularity` : c'est ce qui distingue un
  // choix d'un héritage (voir `rangeFor`).
  const explicitRef = React.useRef(false);

  const setPreset = React.useCallback((preset: PresetId) => {
    setRange((prev) => rangeFor(buildRangeFromPreset(preset), prev, explicitRef.current));
  }, []);

  const setCustom = React.useCallback((from: Date | string, to: Date | string) => {
    setRange((prev) => rangeFor(buildCustomRange(from, to), prev, explicitRef.current));
  }, []);

  const setGranularity = React.useCallback((granularity: Granularity) => {
    // Le sélecteur désactive déjà les boutons incompatibles ; cette garde
    // couvre un état hydraté depuis l'URL ou un appel programmatique — un
    // seul seau vide ou 4 000 seaux ne doivent jamais atteindre un graphique.
    setRange((prev) => {
      if (!granularityIsCompatible(granularity, prev)) return prev;
      explicitRef.current = true;
      return { ...prev, granularity };
    });
  }, []);

  const setCompareToPrevious = React.useCallback((enabled: boolean) => {
    setRange((prev) => ({ ...prev, compareToPrevious: enabled }));
  }, []);

  const value = React.useMemo<DateRangeContextValue>(
    () => ({ range, setPreset, setCustom, setGranularity, setCompareToPrevious }),
    [range, setPreset, setCustom, setGranularity, setCompareToPrevious],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error('useDateRange must be used within a DateRangeProvider.');
  }
  return ctx;
}

/**
 * Variante qui ne lève pas : pour un écran qui se fournit lui-même son
 * contexte quand aucun parent ne le fait (montable seul), tout en partageant
 * celui d'un parent quand il existe (la période survit alors au changement
 * d'onglet). Voir `TreasuryPeriodScope`.
 */
export function useOptionalDateRange(): DateRangeContextValue | undefined {
  return React.useContext(Ctx);
}
