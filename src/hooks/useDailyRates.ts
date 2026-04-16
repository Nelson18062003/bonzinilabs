import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import type { DailyRate, RateAdjustment, CalculationResult } from '@/types/rates';

export type ChartPeriod = '7d' | '30d' | '3m' | '1y';

function getPeriodRange(period: ChartPeriod) {
  const now = new Date();
  switch (period) {
    case '7d':  return { from: subDays(now, 7), to: now };
    case '30d': return { from: subDays(now, 30), to: now };
    case '3m':  return { from: subMonths(now, 3), to: now };
    case '1y':  return { from: subMonths(now, 12), to: now };
  }
}

// ============================================================
// Admin hooks (use supabaseAdmin)
// ============================================================

/** Fetch the currently active daily rate set */
export function useActiveDailyRate() {
  return useQuery({
    queryKey: ['daily-rates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('daily_rates')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as DailyRate | null;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

/** Fetch daily rates history (descending by effective_at) */
export function useDailyRatesHistory(limit = 20) {
  return useQuery({
    queryKey: ['daily-rates', 'history', limit],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('daily_rates')
        .select('*')
        .order('effective_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as DailyRate[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

/** Fetch daily rates for chart (ascending by effective_at, filtered by period) */
export function useDailyRatesForChart(period: ChartPeriod) {
  const range = getPeriodRange(period);

  return useQuery({
    queryKey: ['daily-rates', 'chart', period],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('daily_rates')
        .select('*')
        .gte('effective_at', startOfDay(range.from).toISOString())
        .lte('effective_at', endOfDay(range.to).toISOString())
        .order('effective_at', { ascending: true });

      if (error) throw error;
      return (data || []) as DailyRate[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

/** Create a new set of daily rates (deactivates previous) */
export function useCreateDailyRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      rate_cash: number;
      rate_alipay: number;
      rate_wechat: number;
      rate_virement: number;
      effective_at?: string;
    }) => {
      const { data, error } = await supabaseAdmin.rpc('create_daily_rates', {
        p_rate_cash: params.rate_cash,
        p_rate_alipay: params.rate_alipay,
        p_rate_wechat: params.rate_wechat,
        p_rate_virement: params.rate_virement,
        p_effective_at: params.effective_at,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; rate_id?: string };
      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.createDailyRates.unknownError', { ns: 'common', defaultValue: 'Erreur inconnue' }));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-rates'] });
      queryClient.invalidateQueries({ queryKey: ['client-rates'] });
      toast.success(i18n.t('hooks.createDailyRates.success', { ns: 'common', defaultValue: 'Nouveaux taux appliqués' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createDailyRates.error', { ns: 'common', defaultValue: "Erreur lors de l'application des taux" }));
    },
  });
}

/** Fetch all rate adjustments (countries + tiers) */
export function useRateAdjustments() {
  return useQuery({
    queryKey: ['rate-adjustments'],
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('rate_adjustments')
        .select('*')
        .order('type')
        .order('sort_order');

      if (error) throw error;
      return (data || []) as RateAdjustment[];
    },
    staleTime: 30_000,
    retry: 1,
  });
}

/** Update a single rate adjustment percentage */
export function useUpdateRateAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { adjustmentId: string; percentage: number }) => {
      const { data, error } = await supabaseAdmin.rpc('update_rate_adjustment', {
        p_adjustment_id: params.adjustmentId,
        p_percentage: params.percentage,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; key?: string; percentage?: number };
      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.updateRateAdjustment.unknownError', { ns: 'common', defaultValue: 'Erreur inconnue' }));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate-adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['client-rates'] });
      toast.success(i18n.t('hooks.updateRateAdjustment.success', { ns: 'common', defaultValue: 'Ajustement mis à jour' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.updateRateAdjustment.error', { ns: 'common', defaultValue: 'Erreur lors de la mise à jour' }));
    },
  });
}

// ============================================================
// Client hooks (use supabase)
// ============================================================

/** Fetch active rate + adjustments for client-side calculation */
export function useClientRates() {
  return useQuery({
    queryKey: ['client-rates'],
    queryFn: async () => {
      const [ratesRes, adjustmentsRes] = await Promise.all([
        supabase
          .from('daily_rates')
          .select('*')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('rate_adjustments')
          .select('*')
          .order('type')
          .order('sort_order'),
      ]);

      if (ratesRes.error) throw ratesRes.error;
      if (adjustmentsRes.error) throw adjustmentsRes.error;

      return {
        activeRate: ratesRes.data as DailyRate | null,
        adjustments: (adjustmentsRes.data || []) as RateAdjustment[],
      };
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/** Fetch daily rates for client chart (ascending, only rate_cash for Cash Cameroun reference) */
export function useClientRatesChart(period: ChartPeriod) {
  const range = getPeriodRange(period);

  return useQuery({
    queryKey: ['client-rates', 'chart', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_rates')
        .select('id, rate_cash, effective_at')
        .gte('effective_at', startOfDay(range.from).toISOString())
        .lte('effective_at', endOfDay(range.to).toISOString())
        .order('effective_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Pick<DailyRate, 'id' | 'rate_cash' | 'effective_at'>[];
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/** Server-side rate calculation via RPC (for payment submission) */
export function useCalculateRate() {
  return useMutation({
    mutationFn: async (params: {
      payment_method: string;
      country_key: string;
      amount_xaf: number;
    }) => {
      const { data, error } = await supabase.rpc('calculate_final_rate', {
        p_payment_method: params.payment_method,
        p_country_key: params.country_key,
        p_amount_xaf: params.amount_xaf,
      });

      if (error) throw error;

      const result = data as CalculationResult;
      if (!result.success) {
        throw new Error(result.error || i18n.t('hooks.calculateRate.error', { ns: 'common', defaultValue: 'Erreur de calcul' }));
      }

      return result;
    },
  });
}
