import { useInfiniteQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';
import type { DepositWithProfile } from '@/types/deposit';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

export interface DepositFilters {
  status?: string;
  statuses?: string[];
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: 'created_at' | 'amount_xaf';
  sortAscending?: boolean;
}

/**
 * Paginated hook for admin to view all deposits with infinite scroll.
 * Supports server-side status, method, date range filtering and sort.
 */
export function usePaginatedAdminDeposits(filters?: DepositFilters) {
  return useInfiniteQuery({
    queryKey: ['admin-deposits-paginated', filters],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const sortField = filters?.sortField || 'created_at';
      const sortAscending = filters?.sortAscending ?? false;

      let query = supabaseAdmin
        .from('deposits')
        .select('*')
        .order(sortField, { ascending: sortAscending });

      // Apply status filter
      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses as any);
      } else if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }

      // Apply method filter
      if (filters?.method && filters.method !== 'all') {
        query = query.eq('method', filters.method as any);
      }

      // Apply date range filter
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        // Add end-of-day to include the full day
        query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
      }

      const { data: deposits, error: depositsError } = await query
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (depositsError) throw depositsError;
      if (!deposits || deposits.length === 0) {
        return { data: [] as DepositWithProfile[], nextCursor: null };
      }

      // Get unique user IDs for this page
      const userIds = [...new Set(deposits.map(d => d.user_id))];
      const depositIds = deposits.map(d => d.id);

      // Fetch client info and proof counts in parallel
      const [clientsResult, proofsResult] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('user_id, first_name, last_name, phone, company_name')
          .in('user_id', userIds),
        supabaseAdmin
          .from('deposit_proofs')
          .select('deposit_id')
          .in('deposit_id', depositIds)
          .is('deleted_at', null),
      ]);

      if (clientsResult.error) throw clientsResult.error;

      const clientMap = new Map(clientsResult.data?.map(c => [c.user_id, c]) || []);

      // Build proof count map
      const proofCountMap = new Map<string, number>();
      proofsResult.data?.forEach(p => {
        proofCountMap.set(p.deposit_id, (proofCountMap.get(p.deposit_id) || 0) + 1);
      });

      const depositsWithProfiles = deposits.map(deposit => ({
        ...deposit,
        profiles: clientMap.get(deposit.user_id) || null,
        proof_count: proofCountMap.get(deposit.id) || 0,
      })) as DepositWithProfile[];

      const nextCursor = deposits.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: depositsWithProfiles,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
