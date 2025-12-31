import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { subDays, subMonths, startOfDay, endOfDay } from 'date-fns';

export interface ExchangeRate {
  id: string;
  rate_xaf_to_rmb: number;
  effective_date: string;
  effective_at: string;
  created_by: string | null;
  created_at: string;
  is_locked?: boolean;
  usage_count?: number;
}

export type DateRangeFilter = '7d' | '30d' | '3m' | '12m' | 'custom';

interface DateRange {
  from: Date;
  to: Date;
}

// Get date range based on filter
export function getDateRangeFromFilter(filter: DateRangeFilter, customRange?: DateRange): DateRange {
  const now = new Date();
  switch (filter) {
    case '7d':
      return { from: subDays(now, 7), to: now };
    case '30d':
      return { from: subDays(now, 30), to: now };
    case '3m':
      return { from: subMonths(now, 3), to: now };
    case '12m':
      return { from: subMonths(now, 12), to: now };
    case 'custom':
      return customRange || { from: subDays(now, 30), to: now };
    default:
      return { from: subDays(now, 30), to: now };
  }
}

// Fetch exchange rates with optional date filtering
export function useExchangeRates(filter?: DateRangeFilter, customRange?: DateRange) {
  const range = filter ? getDateRangeFromFilter(filter, customRange) : null;
  
  return useQuery({
    queryKey: ['exchange-rates', filter, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('exchange_rates')
        .select('*')
        .order('effective_at', { ascending: false });
      
      if (range) {
        query = query
          .gte('effective_at', startOfDay(range.from).toISOString())
          .lte('effective_at', endOfDay(range.to).toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch all exchange rates for chart (sorted ascending for display)
export function useExchangeRatesForChart(filter: DateRangeFilter, customRange?: DateRange) {
  const range = getDateRangeFromFilter(filter, customRange);
  
  return useQuery({
    queryKey: ['exchange-rates-chart', filter, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .gte('effective_at', startOfDay(range.from).toISOString())
        .lte('effective_at', endOfDay(range.to).toISOString())
        .order('effective_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Fetch current (latest) exchange rate
export function useCurrentExchangeRate() {
  return useQuery({
    queryKey: ['current-exchange-rate'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('effective_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });
}

// Add new exchange rate
export function useAddExchangeRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ rateRmbToXaf, effectiveAt }: { rateRmbToXaf: number; effectiveAt?: Date }) => {
      const rateXafToRmb = 1 / rateRmbToXaf;
      
      const { data, error } = await supabase.rpc('add_exchange_rate', {
        p_rate_xaf_to_rmb: rateXafToRmb,
        p_effective_at: effectiveAt?.toISOString() || new Date().toISOString(),
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; rate_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rates-chart'] });
      queryClient.invalidateQueries({ queryKey: ['current-exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Taux de change ajouté');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout du taux');
    },
  });
}

// Update exchange rate
export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      rateId, 
      rateRmbToXaf, 
      effectiveAt 
    }: { 
      rateId: string; 
      rateRmbToXaf: number; 
      effectiveAt?: Date;
    }) => {
      const rateXafToRmb = 1 / rateRmbToXaf;
      
      const { data, error } = await supabase.rpc('update_exchange_rate', {
        p_rate_id: rateId,
        p_rate_xaf_to_rmb: rateXafToRmb,
        p_effective_at: effectiveAt?.toISOString() || null,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rates-chart'] });
      queryClient.invalidateQueries({ queryKey: ['current-exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      toast.success('Taux de change modifié');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la modification du taux');
    },
  });
}

// Delete exchange rate
export function useDeleteExchangeRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rateId: string) => {
      const { data, error } = await supabase.rpc('delete_exchange_rate', {
        p_rate_id: rateId,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erreur inconnue');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rates-chart'] });
      queryClient.invalidateQueries({ queryKey: ['current-exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      toast.success('Taux de change supprimé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression du taux');
    },
  });
}

// Check if rate is used
export function useCheckRateUsage(rateId: string | undefined) {
  return useQuery({
    queryKey: ['rate-usage', rateId],
    queryFn: async () => {
      if (!rateId) return { isUsed: false, usageCount: 0 };
      
      const { data: isUsed, error: usedError } = await supabase.rpc('is_rate_used', {
        p_rate_id: rateId,
      });
      
      if (usedError) throw usedError;
      
      const { data: count, error: countError } = await supabase.rpc('get_rate_usage_count', {
        p_rate_id: rateId,
      });
      
      if (countError) throw countError;
      
      return {
        isUsed: isUsed as boolean,
        usageCount: (count as number) || 0,
      };
    },
    enabled: !!rateId,
  });
}
