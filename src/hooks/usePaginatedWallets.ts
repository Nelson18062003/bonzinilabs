import { useInfiniteQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';
import type { Wallet } from './useWallet';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

interface WalletWithProfile extends Wallet {
  profiles: any;
}

export function usePaginatedAllWallets() {
  return useInfiniteQuery({
    queryKey: ['all-wallets-paginated'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data: wallets, error: walletsError } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (walletsError) throw walletsError;
      if (!wallets || wallets.length === 0) {
        return { data: [], nextCursor: null };
      }

      const userIds = [...new Set(wallets.map(w => w.user_id))];

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(c => [c.user_id, c]) || []);

      const walletsWithProfiles: WalletWithProfile[] = wallets.map(wallet => ({
        ...wallet,
        profiles: profileMap.get(wallet.user_id) || null,
      }));

      const nextCursor = wallets.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return { data: walletsWithProfiles, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

export function usePaginatedWalletOperations(walletId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['wallet-operations-paginated', walletId],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    enabled: !!walletId,
    queryFn: async ({ pageParam = 0 }) => {
      if (!walletId) {
        return { data: [], nextCursor: null };
      }

      const { data, error } = await supabaseAdmin
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;

      const nextCursor = data && data.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return { data: data || [], nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}
