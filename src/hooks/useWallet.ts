import { useQuery } from '@tanstack/react-query';
import { supabase, supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG, QUERY_LIMITS, BUSINESS_RULES } from '@/lib/constants';

export interface Wallet {
  id: string;
  user_id: string;
  balance_xaf: number;
  created_at: string;
  updated_at: string;
}

export interface WalletOperation {
  id: string;
  wallet_id: string;
  operation_type: 'deposit' | 'payment' | 'adjustment';
  amount_xaf: number;
  balance_before: number;
  balance_after: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  performed_by: string | null;
  created_at: string;
}

// Fetch current user's wallet
export function useMyWallet() {
  return useQuery({
    queryKey: ['my-wallet'],
    staleTime: CACHE_CONFIG.STALE_TIME.OWN_DATA,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as Wallet | null;
    },
  });
}

// Fetch wallet operations for current user
export function useMyWalletOperations() {
  return useQuery({
    queryKey: ['my-wallet-operations'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // First get the wallet
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (walletError) throw walletError;
      if (!wallet) return [];

      // Then get operations
      const { data, error } = await supabase
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(QUERY_LIMITS.WALLET_OPERATIONS);

      if (error) throw error;
      return data as WalletOperation[];
    },
  });
}

// Fetch wallet by user ID (for admin)
export function useWalletByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['wallet-by-user', userId],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as Wallet | null;
    },
    enabled: !!userId,
  });
}

// Fetch all wallets (for admin)
export function useAllWallets() {
  return useQuery({
    queryKey: ['all-wallets'],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      // Get wallets
      const { data: wallets, error: walletsError } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(QUERY_LIMITS.ALL_WALLETS);

      if (walletsError) throw walletsError;
      if (!wallets) return [];

      // Get unique user IDs
      const userIds = [...new Set(wallets.map(w => w.user_id))];

      // Fetch client info
      const { data: clients, error: clientsError } = await supabaseAdmin
        .from('clients')
        .select('*')
        .in('user_id', userIds);

      if (clientsError) throw clientsError;

      // Map clients (keep property name 'profiles' for UI compatibility)
      const profileMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      return wallets.map(wallet => ({
        ...wallet,
        profiles: profileMap.get(wallet.user_id) || null,
      }));
    },
  });
}

// Fetch wallet operations for a specific wallet (for admin)
export function useWalletOperations(walletId: string | undefined) {
  return useQuery({
    queryKey: ['wallet-operations', walletId],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      if (!walletId) return [];

      const { data, error } = await supabaseAdmin
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(QUERY_LIMITS.WALLET_OPERATIONS);

      if (error) throw error;
      return data as WalletOperation[];
    },
    enabled: !!walletId,
  });
}

// Fetch current exchange rate
export function useExchangeRate() {
  return useQuery({
    queryKey: ['exchange-rate'],
    staleTime: CACHE_CONFIG.STALE_TIME.EXCHANGE_RATES,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.rate_xaf_to_rmb ?? BUSINESS_RULES.DEFAULT_EXCHANGE_RATE;
    },
  });
}
