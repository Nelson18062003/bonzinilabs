import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type {
  CreateClientData,
  CreateClientResult,
  ClientFilters,
} from '@/types/admin';

// Cache configuration
const STALE_TIME = 30 * 1000;
const CACHE_TIME = 5 * 60 * 1000;

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch clients with optional filters
 */
export function useClients(filters?: ClientFilters) {
  return useQuery({
    queryKey: ['clients', filters],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      let query = supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      const { data: profiles, error } = await query;
      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map(p => p.user_id);

      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .in('user_id', userIds);

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('user_id, amount_xaf, status')
        .eq('status', 'validated')
        .in('user_id', userIds);

      const depositSums = new Map<string, number>();
      deposits?.forEach(d => {
        depositSums.set(d.user_id, (depositSums.get(d.user_id) || 0) + d.amount_xaf);
      });

      return profiles.map(profile => ({
        id: profile.user_id,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        walletId: walletMap.get(profile.user_id)?.id || null,
        walletBalance: walletMap.get(profile.user_id)?.balance_xaf || 0,
        totalDeposits: depositSums.get(profile.user_id) || 0,
        totalPayments: 0,
        status: 'ACTIVE' as const,
      }));
    },
  });
}

/**
 * Fetch single client detail with wallet info
 */
export function useClient(userId: string) {
  return useQuery({
    queryKey: ['client', userId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!userId,
    queryFn: async () => {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!profile) return null;

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('amount_xaf, status')
        .eq('user_id', userId)
        .eq('status', 'validated');

      const totalDeposits = deposits?.reduce((sum, d) => sum + d.amount_xaf, 0) || 0;

      // Use wallet_operations instead of ledger_entries
      const { data: lastOperation } = await supabaseAdmin
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', wallet?.id || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: profile.user_id,
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        phone: profile.phone || '',
        avatarUrl: profile.avatar_url,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        walletId: wallet?.id || null,
        walletBalance: wallet?.balance_xaf || 0,
        totalDeposits,
        totalPayments: 0,
        status: 'ACTIVE' as const,
        lastOperation: lastOperation || null,
      };
    },
  });
}

/**
 * Fetch client wallet operations (ledger)
 */
export function useClientLedger(userId: string, filters?: { dateFrom?: Date; dateTo?: Date }) {
  return useQuery({
    queryKey: ['client-ledger', userId, filters],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!userId,
    queryFn: async () => {
      // First get the wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!wallet) return [];

      let query = supabaseAdmin
        .from('wallet_operations')
        .select('*')
        .eq('wallet_id', wallet.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data: operations, error } = await query;
      if (error) throw error;

      return (operations || []).map(op => ({
        id: op.id,
        walletId: op.wallet_id,
        userId,
        entryType: op.operation_type.toUpperCase(),
        amountXAF: op.amount_xaf,
        balanceBefore: op.balance_before,
        balanceAfter: op.balance_after,
        referenceType: op.reference_type,
        referenceId: op.reference_id,
        description: op.description || '',
        createdAt: new Date(op.created_at),
      }));
    },
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create a new client via edge function
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientData): Promise<CreateClientResult> => {
      const cleanedPhone = data.whatsappNumber.replace(/[\s\-\.\(\)]/g, '');

      const { data: result, error } = await supabaseAdmin.functions.invoke('create-client', {
        body: {
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: cleanedPhone,
          email: data.email?.trim() || undefined,
          country: data.country || '',
          city: data.city || '',
          company: data.company || '',
        },
      });

      if (error) {
        console.error('create-client error:', error);
        throw new Error(error.message);
      }

      const rpcResult = result as Record<string, unknown>;

      if (!rpcResult?.success) {
        throw new Error((rpcResult?.error as string) || 'Erreur lors de la création du client');
      }

      return {
        success: true,
        clientId: rpcResult.clientId as string,
        walletId: (rpcResult.walletId as string) || undefined,
        authEmail: rpcResult.authEmail as string,
        tempPassword: rpcResult.tempPassword as string,
        message: (rpcResult.message as string) || `Client créé avec succès`,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Client créé avec succès');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création du client');
    },
  });
}

/**
 * Update client profile
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; firstName?: string; lastName?: string; phone?: string }) => {
      const updateData: Record<string, string> = {};
      if (data.firstName) updateData.first_name = data.firstName;
      if (data.lastName) updateData.last_name = data.lastName;
      if (data.phone) updateData.phone = data.phone;

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('user_id', data.userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      toast.success('Profil client modifié');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la modification');
    },
  });
}

/**
 * Create a wallet adjustment (credit or debit)
 */
export function useCreateAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; adjustmentType: string; amountXAF: number; reason: string }) => {
      const { data: result, error } = await supabaseAdmin.rpc('admin_adjust_wallet', {
        p_user_id: data.userId,
        p_adjustment_type: data.adjustmentType.toLowerCase(),
        p_amount: data.amountXAF,
        p_reason: data.reason,
      });

      if (error) throw new Error(error.message);

      const rpcResult = result as unknown as { success: boolean; error?: string };
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de l\'ajustement');
      }

      return rpcResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['client-ledger', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      const action = variables.adjustmentType === 'CREDIT' ? 'crédité' : 'débité';
      toast.success(`Portefeuille ${action} avec succès`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de l\'ajustement');
    },
  });
}

/**
 * Search clients by name or phone
 */
export function useSearchClients(searchTerm: string) {
  return useQuery({
    queryKey: ['search-clients', searchTerm],
    staleTime: 10 * 1000,
    gcTime: CACHE_TIME,
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map(p => p.user_id);
      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('user_id, id, balance_xaf')
        .in('user_id', userIds);

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      return profiles.map(p => ({
        id: p.user_id,
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        phone: p.phone || '',
        walletId: walletMap.get(p.user_id)?.id || null,
        walletBalance: walletMap.get(p.user_id)?.balance_xaf || 0,
      }));
    },
  });
}