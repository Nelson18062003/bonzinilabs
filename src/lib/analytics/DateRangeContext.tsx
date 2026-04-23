import * as React from 'react';
import {
  buildCustomRange,
  buildRangeFromPreset,
  type DateRange,
  type Granularity,
  type PresetId,
} from './dateRange';

interface DateRangeContextValue {
  range: DateRange;
  setPreset: (preset: PresetId) => void;
  setCustom: (from: Date, to: Date) => void;
  setGranularity: (granularity: Granularity) => void;
  setCompareToPrevious: (enabled: boolean) => void;
}

const Ctx = React.createContext<DateRangeContextValue | undefined>(undefined);

export interface DateRangeProviderProps {
  children: React.ReactNode;
  defaultPreset?: PresetId;
}

/**
 * Provides the shared temporal contract to every analytics consumer
 * below it. One picker → one state → all hooks refetch together.
 */
export function DateRangeProvider({
  children,
  defaultPreset = 'last_30_days',
}: DateRangeProviderProps) {
  const [range, setRange] = React.useState<DateRange>(() =>
    buildRangeFromPreset(defaultPreset),
  );

  const setPreset = React.useCallback((preset: PresetId) => {
    setRange((prev) => ({
      ...buildRangeFromPreset(preset, { granularity: prev.granularity }),
      compareToPrevious: prev.compareToPrevious,
    }));
  }, []);

  const setCustom = React.useCallback((from: Date, to: Date) => {
    setRange((prev) => ({
      ...buildCustomRange(from, to, prev.granularity),
      compareToPrevious: prev.compareToPrevious,
    }));
  }, []);

  const setGranularity = React.useCallback((granularity: Granularity) => {
    setRange((prev) => ({ ...prev, granularity }));
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
