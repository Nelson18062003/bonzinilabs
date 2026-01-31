import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

/**
 * Paginated hook for user's own deposits
 */
export function usePaginatedMyDeposits() {
  return useInfiniteQuery({
    queryKey: ['my-deposits-paginated'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { data: [], nextCursor: null };
      }

      const { data, error } = await supabase
        .from('deposits')
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
 * Paginated hook for admin to view all deposits
 * Includes user profile data joined
 */
export function usePaginatedAdminDeposits(statusFilter?: string) {
  return useInfiniteQuery({
    queryKey: ['admin-deposits-paginated', statusFilter],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply status filter if provided
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: deposits, error: depositsError } = await query
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (depositsError) throw depositsError;
      if (!deposits || deposits.length === 0) {
        return { data: [], nextCursor: null };
      }

      // Get unique user IDs
      const userIds = [...new Set(deposits.map(d => d.user_id))];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles to deposits
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const depositsWithProfiles = deposits.map(deposit => ({
        ...deposit,
        profiles: profileMap.get(deposit.user_id) || null,
      }));

      const nextCursor = deposits.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: depositsWithProfiles,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
