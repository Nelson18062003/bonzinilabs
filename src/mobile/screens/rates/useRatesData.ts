/**
 * Les données communes du module Taux : publication active, la précédente
 * (pour « hier »), les écarts pays / paliers et le droit de les modifier.
 * Aucune lecture nouvelle : ce sont les hooks existants (`supabaseAdmin`).
 */
import { useMemo } from 'react';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { useActiveDailyRate, useDailyRatesHistory, useRateAdjustments } from '@/hooks/useDailyRates';
import { baseMethodRates, buildCountryRateSheets, type MethodRates } from '@/lib/countryRates';
import type { DailyRate } from '@/types/rates';

/** Les publications lues par l'historique et l'accueil (même cache). */
export const HISTORY_LIMIT = 60;

export function useRatesData() {
  const { hasPermission } = useAdminAuth();
  const active = useActiveDailyRate();
  const history = useDailyRatesHistory(HISTORY_LIMIT);
  const adjustments = useRateAdjustments();
  const activeRate = active.data ?? null;

  const previous: DailyRate | null = useMemo(() => {
    const list = history.data ?? [];
    if (!activeRate) return list[0] ?? null;
    const at = new Date(activeRate.effective_at).getTime();
    return list.find((r) => r.id !== activeRate.id && new Date(r.effective_at).getTime() <= at) ?? null;
  }, [history.data, activeRate]);

  const sheets = useMemo(() => buildCountryRateSheets(activeRate, adjustments.data ?? []), [activeRate, adjustments.data]);
  const base: MethodRates | null = activeRate ? baseMethodRates(activeRate) : null;
  const prevBase: MethodRates | null = previous ? baseMethodRates(previous) : null;

  return {
    activeRate,
    previous,
    base,
    prevBase,
    history: history.data ?? [],
    adjustments: adjustments.data ?? [],
    sheets,
    isLoading: active.isLoading || adjustments.isLoading,
    isError: active.isError || adjustments.isError,
    canManage: hasPermission('canManageRates'),
    refetch: () => Promise.all([active.refetch(), history.refetch(), adjustments.refetch()]),
  };
}
