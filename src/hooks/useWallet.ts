import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Cache configuration for performance
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

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
    staleTime: 10 * 1000, // 10 seconds for user's own wallet
    gcTime: CACHE_TIME,
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
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
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
        .limit(100);

      if (error) throw error;
      return data as WalletOperation[];
    },
  });
}

// Fetch wallet by user ID (for admin)
export function useWalletByUserId(userId: string | undefined) {
  return useQuery({
    queryKey: ['wallet-by-user', userId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
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
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      // Get wallets
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (walletsError) throw walletsError;
      if (!wallets) return [];

      // Get unique user IDs
      const userIds = [...new Set(wallets.map(w => w.user_id))];

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Map profiles
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

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
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      if (!walletId) return [];

      const { data, error } = await supabase
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(100);

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
    staleTime: 60 * 1000, // 1 minute for exchange rate
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.rate_xaf_to_rmb ?? 0.01167; // Default rate
    },
  });
}
