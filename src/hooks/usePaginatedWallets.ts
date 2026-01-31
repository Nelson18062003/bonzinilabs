import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS } from '@/lib/constants';
import type { Wallet } from './useWallet';

const PAGE_SIZE = QUERY_LIMITS.ITEMS_PER_PAGE;

interface WalletWithProfile extends Wallet {
  profiles: any;
}

/**
 * Paginated hook for admin to fetch all wallets
 * Uses cursor-based pagination with infinite scroll support
 */
export function usePaginatedAllWallets() {
  return useInfiniteQuery({
    queryKey: ['all-wallets-paginated'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      // Get wallets for this page
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .order('updated_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (walletsError) throw walletsError;
      if (!wallets || wallets.length === 0) {
        return { data: [], nextCursor: null };
      }

      // Get unique user IDs for this page
      const userIds = [...new Set(wallets.map(w => w.user_id))];

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles to wallets
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const walletsWithProfiles: WalletWithProfile[] = wallets.map(wallet => ({
        ...wallet,
        profiles: profileMap.get(wallet.user_id) || null,
      }));

      // Calculate next cursor
      const nextCursor = wallets.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null;

      return {
        data: walletsWithProfiles,
        nextCursor,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Paginated hook for wallet operations
 * Supports both user's own operations and admin viewing any wallet
 */
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

      const { data, error } = await supabase
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', walletId)
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
