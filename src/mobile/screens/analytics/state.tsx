/**
 * Analyses mobile v2 — l'état partagé par tous les écrans du module : la
 * période (DateRangeProvider, une seule pour tout le module), le pas propre à
 * chaque graphe, et les feuilles (« … », Période, Exporter, Partager…).
 *
 * Le module vit sous une seule route (`/m/dashboard/*`) : passer d'un écran
 * à l'autre garde la période et la comparaison choisies.
 */
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDateRange } from '@/lib/analytics/DateRangeContext';
import {
  coerceGranularity,
  defaultGranularityOf,
  granularityIsCompatible,
  type DateRange,
  type Granularity,
} from '@/lib/analytics/dateRange';
import type { CsvRow } from '@/lib/analytics/csvExport';
import type { BarDatum, Tone } from '@/mobile/designKit';

/** Ce qu'un écran expose à « … » : exporter, voir en tableau, partager. */
export interface ChartDataset {
  key: string;
  title: string;
  figure: { label?: string; value: string; unit?: string; delta?: { tone: Tone; label: string }; note?: string };
  bars?: BarDatum[];
  barEdges?: [string, string];
  columns: { key: string; label: string }[];
  rows: CsvRow[];
  /** Le graphe a un pas (Jour / Semaine / Mois) réglable. */
  stepKey?: string;
  /** « Voir les 348 paiements ». */
  list?: { label: string; href: string };
  /** La comparaison s'applique à ce graphe. */
  compare?: boolean;
}

export type Sheet =
  | { type: 'menu'; ds: ChartDataset }
  | { type: 'period' }
  | { type: 'custom' }
  | { type: 'step'; key: string }
  | { type: 'export'; ds: ChartDataset | null }
  | { type: 'share'; ds: ChartDataset }
  | { type: 'table'; ds: ChartDataset };

/** Le pas qu'un graphe prend tant que personne n'a choisi. */
const STEP_DEFAULTS: Record<string, Granularity> = { depots: 'week', flux: 'week', comparer: 'day' };

const ALL_STEPS: Granularity[] = ['hour', 'day', 'week', 'month', 'quarter', 'year'];

interface Ui {
  range: DateRange;
  setPreset: ReturnType<typeof useDateRange>['setPreset'];
  setCustom: ReturnType<typeof useDateRange>['setCustom'];
  setGranularity: (g: Granularity) => void;
  setCompare: (on: boolean) => void;
  /** Le pas effectif d'un graphe, toujours compatible avec la période. */
  stepFor: (key: string) => Granularity;
  rangeFor: (key: string) => DateRange;
  setStep: (key: string, g: Granularity) => void;
  /** Les pas proposés pour la période (2 à 4). */
  steps: Granularity[];
  sheet: Sheet | null;
  open: (s: Sheet) => void;
  close: () => void;
  refresh: () => Promise<void>;
}

const Ctx = React.createContext<Ui | null>(null);

export function AnalyticsUiProvider({ children }: { children: React.ReactNode }) {
  const { range, setPreset, setCustom, setGranularity: setGlobal, setCompareToPrevious } = useDateRange();
  const queryClient = useQueryClient();
  const [overrides, setOverrides] = React.useState<Record<string, Granularity>>({});
  const [sheet, setSheet] = React.useState<Sheet | null>(null);

  const stepFor = React.useCallback(
    (key: string): Granularity => {
      const preferred = overrides[key]
        ?? (range.granularity === defaultGranularityOf(range) && STEP_DEFAULTS[key] && granularityIsCompatible(STEP_DEFAULTS[key], range) ? STEP_DEFAULTS[key] : range.granularity);
      return coerceGranularity({ ...range, granularity: preferred });
    },
    [overrides, range],
  );

  const rangeFor = React.useCallback((key: string): DateRange => ({ ...range, granularity: stepFor(key) }), [range, stepFor]);

  const steps = React.useMemo(() => {
    const ok = ALL_STEPS.filter((g) => granularityIsCompatible(g, range));
    return ok.length > 4 ? ok.slice(ok.length - 4) : ok;
  }, [range]);

  const value = React.useMemo<Ui>(
    () => ({
      range,
      setPreset,
      setCustom,
      // Le pas de la feuille Période vaut pour tout le module : les réglages
      // propres à un graphe cèdent.
      setGranularity: (g) => { setOverrides({}); setGlobal(g); },
      setCompare: setCompareToPrevious,
      stepFor,
      rangeFor,
      setStep: (key, g) => setOverrides((o) => ({ ...o, [key]: g })),
      steps,
      sheet,
      open: setSheet,
      close: () => setSheet(null),
      refresh: async () => {
        await queryClient.invalidateQueries({
          predicate: (q) => {
            const k = String(q.queryKey[0] ?? '');
            return k.startsWith('analytics-v2') || k === 'treasury';
          },
        });
      },
    }),
    [range, setPreset, setCustom, setGlobal, setCompareToPrevious, stepFor, rangeFor, steps, sheet, queryClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalyticsUi(): Ui {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('useAnalyticsUi : AnalyticsUiProvider manquant.');
  return ctx;
}
