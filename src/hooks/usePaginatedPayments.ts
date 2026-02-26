import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

// ---------- Filter interface ----------

export interface PaymentFilters {
  status?: string;
  statuses?: string[];
  method?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: 'created_at' | 'amount_rmb';
  sortAscending?: boolean;
}

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
 * Paginated hook for admin to view all payments.
 * Supports server-side status, method, date range filtering and sort.
 * Includes client profiles and proof counts joined.
 */
export function usePaginatedAdminPayments(filters?: PaymentFilters) {
  return useInfiniteQuery({
    queryKey: ['admin-payments-paginated', filters],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const sortField = filters?.sortField || 'created_at';
      const sortAscending = filters?.sortAscending ?? false;

      let query = supabaseAdmin
        .from('payments')
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
        query = query.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
      }

      const { data: payments, error: paymentsError } = await query
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (paymentsError) throw paymentsError;
      if (!payments || payments.length === 0) {
        return { data: [], nextCursor: null };
      }

      // Get unique user IDs and payment IDs for this page
      const userIds = [...new Set(payments.map(p => p.user_id))];
      const paymentIds = payments.map(p => p.id);

      // Fetch client info and proof counts in parallel
      const [clientsResult, proofsResult] = await Promise.all([
        supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name, phone, company_name')
          .in('user_id', userIds),
        supabaseAdmin
          .from('payment_proofs')
          .select('payment_id')
          .in('payment_id', paymentIds),
      ]);

      if (clientsResult.error) throw clientsResult.error;

      const clientMap = new Map(clientsResult.data?.map(c => [c.user_id, c]) || []);

      // Build proof count map
      const proofCountMap = new Map<string, number>();
      proofsResult.data?.forEach(p => {
        proofCountMap.set(p.payment_id, (proofCountMap.get(p.payment_id) || 0) + 1);
      });

      const paymentsWithProfiles = payments.map(payment => ({
        ...payment,
        profiles: clientMap.get(payment.user_id) || null,
        proof_count: proofCountMap.get(payment.id) || 0,
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
 * Rich stats for payment list screen (counts + today metrics)
 */
export function usePaymentStats() {
  return useQuery({
    queryKey: ['payment-stats'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const [readyRes, processingRes, cashScannedRes, completedRes, totalRes, todayRes] = await Promise.all([
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'ready_for_payment'),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'processing'),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'cash_scanned'),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'completed'),
        supabaseAdmin
          .from('payments')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('payments')
          .select('amount_rmb')
          .eq('status', 'completed')
          .gte('updated_at', today),
      ]);

      const todayCompleted = todayRes.data || [];
      const todayAmountRmb = todayCompleted.reduce((sum, p) => sum + (p.amount_rmb || 0), 0);

      return {
        toProcess: (readyRes.count || 0) + (cashScannedRes.count || 0),
        inProgress: processingRes.count || 0,
        completed: completedRes.count || 0,
        total: totalRes.count || 0,
        today_completed: todayCompleted.length,
        today_amount_rmb: todayAmountRmb,
      };
    },
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
      let query = supabaseAdmin
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
