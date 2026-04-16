import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import type {
  CreateClientData,
  CreateClientResult,
  CreateAdjustmentData,
  AdjustmentResult,
  LedgerEntry,
  LedgerEntryType,
  LedgerFilters,
  ClientFilters,
} from '@/types/admin';

// Cache configuration
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

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
      // Query clients table directly (no admin filtering needed)
      let query = supabaseAdmin
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      // Apply search filter server-side
      if (filters?.search) {
        query = query.or(
          `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
        );
      }

      const { data: clients, error } = await query;
      if (error) throw error;
      if (!clients || clients.length === 0) return [];

      const userIds = clients.map(c => c.user_id);

      // Fetch wallets
      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .in('user_id', userIds);

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      // Fetch deposit totals
      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('user_id, amount_xaf, status')
        .eq('status', 'validated')
        .in('user_id', userIds);

      const depositSums = new Map<string, number>();
      deposits?.forEach(d => {
        depositSums.set(d.user_id, (depositSums.get(d.user_id) || 0) + d.amount_xaf);
      });

      // Fetch payment totals (completed payments)
      const { data: payments } = await supabaseAdmin
        .from('payments')
        .select('user_id, amount_xaf, status')
        .eq('status', 'completed')
        .in('user_id', userIds);

      const paymentSums = new Map<string, number>();
      payments?.forEach(p => {
        paymentSums.set(p.user_id, (paymentSums.get(p.user_id) || 0) + p.amount_xaf);
      });

      return clients.map(client => ({
        id: client.user_id,
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        phone: client.phone || '',
        avatarUrl: client.avatar_url,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
        walletId: walletMap.get(client.user_id)?.id || null,
        walletBalance: walletMap.get(client.user_id)?.balance_xaf || 0,
        totalDeposits: depositSums.get(client.user_id) || 0,
        totalPayments: paymentSums.get(client.user_id) || 0,
        status: (client.status as 'ACTIVE') || 'ACTIVE',
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
      const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!client) return null;

      // Fetch wallet
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Fetch deposit totals
      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('amount_xaf, status')
        .eq('user_id', userId)
        .eq('status', 'validated');

      const totalDeposits = deposits?.reduce((sum, d) => sum + d.amount_xaf, 0) || 0;

      // Fetch payment totals (completed payments)
      const { data: clientPayments } = await supabaseAdmin
        .from('payments')
        .select('amount_xaf, status')
        .eq('user_id', userId)
        .eq('status', 'completed');

      const totalPayments = clientPayments?.reduce((sum, p) => sum + p.amount_xaf, 0) || 0;

      // Fetch last ledger entry
      const { data: lastLedgerEntry } = await supabaseAdmin
        .from('ledger_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: client.user_id,
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        phone: client.phone || '',
        email: client.email || '',
        companyName: client.company_name || '',
        country: client.country || '',
        city: client.city || '',
        avatarUrl: client.avatar_url,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
        walletId: wallet?.id || null,
        walletBalance: wallet?.balance_xaf || 0,
        totalDeposits,
        totalPayments,
        status: 'ACTIVE' as const,
        utmSource:   client.utm_source   || null,
        utmMedium:   client.utm_medium   || null,
        utmCampaign: client.utm_campaign || null,
        lastLedgerEntry: lastLedgerEntry ? {
          id: lastLedgerEntry.id,
          walletId: lastLedgerEntry.wallet_id,
          userId: lastLedgerEntry.user_id,
          entryType: lastLedgerEntry.entry_type as LedgerEntryType,
          amountXAF: lastLedgerEntry.amount_xaf,
          balanceBefore: lastLedgerEntry.balance_before,
          balanceAfter: lastLedgerEntry.balance_after,
          referenceType: lastLedgerEntry.reference_type,
          referenceId: lastLedgerEntry.reference_id,
          description: lastLedgerEntry.description,
          createdAt: new Date(lastLedgerEntry.created_at),
        } : null,
      };
    },
  });
}

/**
 * Fetch client ledger entries
 */
export function useClientLedger(userId: string, filters?: LedgerFilters) {
  return useQuery({
    queryKey: ['client-ledger', userId, filters],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: !!userId,
    queryFn: async () => {
      let query = supabaseAdmin
        .from('ledger_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000);

      // Apply entry type filter
      if (filters?.entryType && filters.entryType !== 'all') {
        query = query.eq('entry_type', filters.entryType);
      }

      // Apply date filters
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom.toISOString());
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo.toISOString());
      }

      const { data: entries, error } = await query;
      if (error) throw error;
      if (!entries) return [];

      // Fetch admin names from user_roles for entries created by admins
      const adminIds = [...new Set(entries.map(e => e.created_by_admin_id).filter(Boolean))];

      const adminNameMap = new Map<string, string>();
      if (adminIds.length > 0) {
        const { data: adminRoles } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, first_name, last_name')
          .in('user_id', adminIds);

        adminRoles?.forEach(r => {
          adminNameMap.set(r.user_id, `${r.first_name || ''} ${r.last_name || ''}`.trim());
        });
      }

      return entries.map(entry => ({
        id: entry.id,
        walletId: entry.wallet_id,
        userId: entry.user_id,
        entryType: entry.entry_type as LedgerEntryType,
        amountXAF: entry.amount_xaf,
        balanceBefore: entry.balance_before,
        balanceAfter: entry.balance_after,
        referenceType: entry.reference_type,
        referenceId: entry.reference_id,
        description: entry.description,
        metadata: entry.metadata,
        createdByAdminId: entry.created_by_admin_id,
        createdByAdminName: entry.created_by_admin_id
          ? adminNameMap.get(entry.created_by_admin_id)
          : undefined,
        createdAt: new Date(entry.created_at),
      })) as LedgerEntry[];
    },
  });
}

// ============================================
// MUTATION HOOKS
// ============================================

/**
 * Create a new client via RPC (server-side, no email rate limits)
 * The RPC inserts directly into auth.users + profiles + wallets
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientData): Promise<CreateClientResult> => {
      const cleanedPhone = data.whatsappNumber.replace(/[\s\-.()]/g, '');

      const { data: result, error } = await supabaseAdmin.rpc('admin_create_client', {
        p_first_name: data.firstName.trim(),
        p_last_name: data.lastName.trim(),
        p_phone: cleanedPhone,
        p_email: data.email?.trim() || undefined,
        p_gender: data.gender || 'OTHER',
        p_country: data.country || '',
        p_city: data.city || '',
        p_company: data.company || '',
      });

      if (error) {
        console.error('RPC admin_create_client error:', error);
        throw new Error(error.message);
      }

      const rpcResult = result as Record<string, unknown>;

      if (!rpcResult?.success) {
        throw new Error((rpcResult?.error as string) || i18n.t('hooks.createClient.error', { ns: 'common', defaultValue: 'Erreur lors de la création du client' }));
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
      toast.success(i18n.t('hooks.createClient.success', { ns: 'common', defaultValue: 'Client créé avec succès' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createClient.error', { ns: 'common', defaultValue: 'Erreur lors de la création du client' }));
    },
  });
}

/**
 * Update client profile
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { userId: string; firstName?: string; lastName?: string; phone?: string; email?: string; companyName?: string; country?: string; city?: string }) => {
      const updateData: Record<string, string> = {};
      if (data.firstName !== undefined) updateData.first_name = data.firstName;
      if (data.lastName !== undefined) updateData.last_name = data.lastName;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.companyName !== undefined) updateData.company_name = data.companyName;
      if (data.country !== undefined) updateData.country = data.country;
      if (data.city !== undefined) updateData.city = data.city;

      const { error } = await supabaseAdmin
        .from('clients')
        .update(updateData)
        .eq('user_id', data.userId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-clients'] });
      toast.success(i18n.t('hooks.updateClient.success', { ns: 'common', defaultValue: 'Profil client modifié' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.updateClient.error', { ns: 'common', defaultValue: 'Erreur lors de la modification' }));
    },
  });
}

/**
 * Create a wallet adjustment (credit or debit)
 */
export function useCreateAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAdjustmentData): Promise<AdjustmentResult> => {
      const { data: result, error } = await supabaseAdmin.rpc('create_wallet_adjustment', {
        p_user_id: data.userId,
        p_adjustment_type: data.adjustmentType,
        p_amount_xaf: data.amountXAF,
        p_reason: data.reason,
        p_proof_urls: data.proofUrls || [],
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as AdjustmentResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de l\'ajustement');
      }

      return rpcResult;
    },
    onSuccess: (result, variables) => {
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
 * Reset a client's password via RPC (Super Admin only)
 */
export function useResetClientPassword() {
  return useMutation({
    mutationFn: async (userId: string): Promise<{ success: boolean; tempPassword?: string; error?: string }> => {
      const { data: result, error } = await supabaseAdmin.rpc('admin_reset_client_password', {
        p_target_user_id: userId,
      });

      if (error) {
        throw new Error(error.message);
      }

      const rpcResult = result as unknown as { success: boolean; tempPassword?: string; error?: string };
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'Erreur lors de la réinitialisation');
      }

      return rpcResult;
    },
    onSuccess: () => {
      toast.success('Mot de passe client réinitialisé');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    },
  });
}

/**
 * Search clients by name or phone (for deposit creation)
 */
export function useSearchClients(searchTerm: string) {
  return useQuery({
    queryKey: ['search-clients', searchTerm],
    staleTime: 10 * 1000, // 10 seconds
    gcTime: CACHE_TIME,
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      // Search clients table directly (no admin filtering needed)
      const { data: clients, error } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name, phone')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
        .limit(20);

      if (error) throw error;
      if (!clients || clients.length === 0) return [];

      // Fetch wallets
      const userIds = clients.map(c => c.user_id);
      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('user_id, id, balance_xaf')
        .in('user_id', userIds);

      const walletMap = new Map(wallets?.map(w => [w.user_id, w]) || []);

      return clients.map(c => ({
        id: c.user_id,
        firstName: c.first_name || '',
        lastName: c.last_name || '',
        phone: c.phone || '',
        walletId: walletMap.get(c.user_id)?.id || null,
        walletBalance: walletMap.get(c.user_id)?.balance_xaf || 0,
      }));
    },
  });
}
