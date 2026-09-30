// ============================================================
// Les délais observés sur nos expéditions, par ligne (RPC
// logistics_observed_transit : agrégats seulement, lisibles par tous).
// Côté public et client : `supabase` ; espace équipe : `supabaseAdmin`
// (.claude/rules/supabase-clients.md).
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { customsKeys } from '@/lib/queryKeys';
import type { Mode, Observed } from '@/lib/logistics/atlas';

export interface ObservedLane extends Observed { mode: Mode; lane: string }
export interface ObservedTransit {
  window_months: number;
  min_count: number;
  lanes: ObservedLane[];
  /** Par ligne (« CNNSA>CMKBI »), pour planRoute. */
  byLane: Record<string, Observed>;
}

export function useObservedTransit(scope: 'public' | 'admin' = 'public') {
  return useQuery({
    queryKey: customsKeys.observedTransit(scope),
    queryFn: async (): Promise<ObservedTransit> => {
      const client = scope === 'admin' ? supabaseAdmin : supabase;
      const { data, error } = await client.rpc('logistics_observed_transit' as never);
      if (error) throw new Error(error.message);
      const raw = (data ?? {}) as Partial<ObservedTransit>;
      const lanes = Array.isArray(raw.lanes) ? raw.lanes : [];
      return {
        window_months: raw.window_months ?? 18,
        min_count: raw.min_count ?? 3,
        lanes,
        byLane: Object.fromEntries(lanes.map((l) => [l.lane, l])),
      };
    },
    staleTime: 30 * 60_000,
    retry: 1,
  });
}
