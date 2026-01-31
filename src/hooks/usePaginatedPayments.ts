import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

/**
 * Paginated hook for user's own payments
 */
export function usePaginatedMyPayments() {
  return useInfiniteQuery({
    queryKey: ['my-payments-paginated'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: [], nextCursor: null };
      }

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;

      const nextCursor = data && data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: data || [],
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Paginated hook for admin to view all payments
 * Includes user profile data joined
 */
export function usePaginatedAdminPayments(filters?: {
  status?: string;
  method?: string;
}) {
  return useInfiniteQuery({
    queryKey: ['admin-payments-paginated', filters],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters if provided
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.method && filters.method !== 'all') {
        query = query.eq('method', filters.method);
      }

      const { data: payments, error: paymentsError } = await query
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (paymentsError) throw paymentsError;
      if (!payments || payments.length === 0) {
        return { data: [], nextCursor: null };
      }

      // Get unique user IDs
      const userIds = [...new Set(payments.map(p => p.user_id))];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles to payments
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const paymentsWithProfiles = payments.map(payment => ({
        ...payment,
        profiles: profileMap.get(payment.user_id) || null,
      }));

      const nextCursor = payments.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: paymentsWithProfiles,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Paginated hook for agent cash payments
 */
export function usePaginatedAgentCashPayments(statusFilter?: string) {
  return useInfiniteQuery({
    queryKey: ['agent-cash-payments-paginated', statusFilter],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('payments')
        .select('*')
        .eq('method', 'cash')
        .order('created_at', { ascending: false });

      // Apply status filter if provided
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;

      const nextCursor = data && data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: data || [],
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
