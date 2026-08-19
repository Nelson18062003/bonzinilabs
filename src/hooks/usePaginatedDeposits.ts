import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';
import type { DepositWithProfile } from '@/types/deposit';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

export interface DepositFilters {
  status?: string;
  statuses?: string[];
  method?: string;
  /** Server-side method-family filter (several DB methods at once). */
  methods?: string[];
  /** Server-side search: reference ilike OR client name/phone (resolved via clients). */
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: 'created_at' | 'amount_xaf';
  sortAscending?: boolean;
}

/** Escape PostgREST `or=` special characters in a user-typed search term. */
function sanitizeTerm(s: string): string {
  return s.replace(/[,()"\\]/g, ' ').trim();
}

/**
 * Resolve a free-text search into a deposits query predicate. Matches the
 * reference directly, and client first/last name, phone or company via a
 * preliminary clients lookup (the deposits table stores only user_id) — this
 * makes search TRUE server-side search over all deposits, not a filter over
 * the pages already loaded.
 */
async function searchUserIds(term: string): Promise<string[]> {
  const t = sanitizeTerm(term);
  if (!t) return [];
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('user_id')
    .or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,phone.ilike.%${t}%,company_name.ilike.%${t}%`)
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((c) => c.user_id);
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
        query = query.in('status', filters.statuses);
      } else if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply method filter
      if (filters?.method && filters.method !== 'all') {
        query = query.eq('method', filters.method);
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
          .from('clients')
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

/**
 * Desktop workbench hook: numbered pages with an exact total count, plus the
 * two server-side capabilities the desktop table needs — free-text search
 * (reference OR client name/phone/company) and method-family filtering.
 * Page is 1-based. `keepPreviousData` semantics via placeholderData so the
 * table doesn't flash on page/filter changes.
 */
export function usePagedAdminDeposits(filters: DepositFilters | undefined, page: number) {
  return useQuery({
    queryKey: ['admin-deposits-paged', filters, page],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const sortField = filters?.sortField || 'created_at';
      const sortAscending = filters?.sortAscending ?? false;
      const from = (page - 1) * PAGE_SIZE;

      let query = supabaseAdmin
        .from('deposits')
        .select('*', { count: 'exact' })
        .order(sortField, { ascending: sortAscending });

      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in('status', filters.statuses);
      } else if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters?.methods && filters.methods.length > 0) {
        query = query.in('method', filters.methods);
      } else if (filters?.method && filters.method !== 'all') {
        query = query.eq('method', filters.method);
      }
      if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);

      if (filters?.search?.trim()) {
        const term = sanitizeTerm(filters.search);
        const userIds = await searchUserIds(term);
        if (userIds.length > 0) {
          query = query.or(`reference.ilike.%${term}%,user_id.in.(${userIds.join(',')})`);
        } else {
          query = query.ilike('reference', `%${term}%`);
        }
      }

      const { data: deposits, error, count } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;

      const total = count ?? 0;
      if (!deposits || deposits.length === 0) {
        return { data: [] as DepositWithProfile[], total, pageSize: PAGE_SIZE };
      }

      const userIds = [...new Set(deposits.map((d) => d.user_id))];
      const depositIds = deposits.map((d) => d.id);
      const [clientsResult, proofsResult] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name, phone, company_name')
          .in('user_id', userIds),
        supabaseAdmin
          .from('deposit_proofs')
          .select('deposit_id')
          .in('deposit_id', depositIds)
          .is('deleted_at', null),
      ]);
      if (clientsResult.error) throw clientsResult.error;

      const clientMap = new Map(clientsResult.data?.map((c) => [c.user_id, c]) || []);
      const proofCountMap = new Map<string, number>();
      proofsResult.data?.forEach((p) => {
        proofCountMap.set(p.deposit_id, (proofCountMap.get(p.deposit_id) || 0) + 1);
      });

      const data = deposits.map((deposit) => ({
        ...deposit,
        profiles: clientMap.get(deposit.user_id) || null,
        proof_count: proofCountMap.get(deposit.id) || 0,
      })) as DepositWithProfile[];

      return { data, total, pageSize: PAGE_SIZE };
    },
  });
}
