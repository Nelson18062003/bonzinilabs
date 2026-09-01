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
  ClientStatus,
} from '@/types/admin';

// Cache configuration
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// ============================================
// QUERY HOOKS
// ============================================

/**
 * Fetch the full client roster (balances + totals included).
 *
 * La recherche/le filtre/le tri se font côté client (src/lib/clientSearch.ts) :
 * l'ancien filtre serveur `.or(ilike…)` ne trouvait ni « Jean Dupont »
 * (prénom+nom), ni « Hervé » sans accent, ni un téléphone formaté — et une
 * virgule dans la saisie cassait le filtre PostgREST. Un seul fetch caché
 * par react-query rend la recherche instantanée.
 */
// Les requêtes `.in('user_id', …)` passent les UUID dans l'URL : au-delà de
// ~200 ids on dépasse les limites d'URL des proxys. On découpe donc en lots,
// et on PROPAGE les erreurs — l'ancien code les jetait silencieusement, et un
// lot échoué affichait « solde 0 XAF » pour tout le monde.
const IN_CHUNK = 200;
async function fetchByUserIdChunks<T>(
  userIds: string[],
  fetchChunk: (ids: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < userIds.length; i += IN_CHUNK) {
    const { data, error } = await fetchChunk(userIds.slice(i, i + IN_CHUNK));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      // Roster complet, paginé : PostgREST plafonne à 1000 lignes par requête,
      // et un simple .limit() rendrait les clients les plus anciens
      // introuvables une fois le plafond atteint.
      const PAGE = 1000;
      async function fetchClientsPage(from: number) {
        const { data, error } = await supabaseAdmin
          .from('clients')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        return data ?? [];
      }
      const clients: Awaited<ReturnType<typeof fetchClientsPage>> = [];
      for (let from = 0; ; from += PAGE) {
        const page = await fetchClientsPage(from);
        clients.push(...page);
        if (page.length < PAGE) break;
      }
      if (clients.length === 0) return [];

      const userIds = clients.map(c => c.user_id);

      // Fetch wallets
      const wallets = await fetchByUserIdChunks(userIds, (ids) =>
        supabaseAdmin.from('wallets').select('*').in('user_id', ids),
      );
      const walletMap = new Map(wallets.map(w => [w.user_id, w]));

      // Fetch deposit totals
      const deposits = await fetchByUserIdChunks(userIds, (ids) =>
        supabaseAdmin.from('deposits').select('user_id, amount_xaf, status').eq('status', 'validated').in('user_id', ids),
      );
      const depositSums = new Map<string, number>();
      deposits.forEach(d => {
        depositSums.set(d.user_id, (depositSums.get(d.user_id) || 0) + d.amount_xaf);
      });

      // Fetch payment totals (completed payments)
      const payments = await fetchByUserIdChunks(userIds, (ids) =>
        supabaseAdmin.from('payments').select('user_id, amount_xaf, status').eq('status', 'completed').in('user_id', ids),
      );
      const paymentSums = new Map<string, number>();
      payments.forEach(p => {
        paymentSums.set(p.user_id, (paymentSums.get(p.user_id) || 0) + p.amount_xaf);
      });

      return clients.map(client => ({
        id: client.user_id,
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        phone: client.phone || '',
        email: client.email || '',
        companyName: client.company_name || '',
        avatarUrl: client.avatar_url,
        createdAt: client.created_at,
        updatedAt: client.updated_at,
        walletId: walletMap.get(client.user_id)?.id || null,
        walletBalance: walletMap.get(client.user_id)?.balance_xaf || 0,
        totalDeposits: depositSums.get(client.user_id) || 0,
        totalPayments: paymentSums.get(client.user_id) || 0,
        status: (client.status as ClientStatus) || 'ACTIVE',
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
        // Le statut réel du client — l'ancien 'ACTIVE' codé en dur affichait
        // « Actif » sur la fiche même pour un client suspendu.
        status: (client.status as ClientStatus) || 'ACTIVE',
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
      const adminIds = [...new Set(entries.map(e => e.created_by_admin_id).filter((id): id is string => !!id))];

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

      const rpcResult = result as unknown as AdjustmentResult;
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || i18n.t('hooks.createAdjustment.error', { ns: 'common', defaultValue: "Erreur lors de l'ajustement" }));
      }

      return rpcResult;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['client-ledger', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['admin-wallets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      const action = variables.adjustmentType === 'CREDIT'
        ? i18n.t('hooks.createAdjustment.credited', { ns: 'common', defaultValue: 'crédité' })
        : i18n.t('hooks.createAdjustment.debited', { ns: 'common', defaultValue: 'débité' });
      toast.success(i18n.t('hooks.createAdjustment.success', { ns: 'common', defaultValue: `Portefeuille ${action} avec succès`, action }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.createAdjustment.error', { ns: 'common', defaultValue: "Erreur lors de l'ajustement" }));
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
        throw new Error(rpcResult?.error || i18n.t('hooks.resetClientPassword.error', { ns: 'common', defaultValue: 'Erreur lors de la réinitialisation' }));
      }

      return rpcResult;
    },
    onSuccess: () => {
      toast.success(i18n.t('hooks.resetClientPassword.success', { ns: 'common', defaultValue: 'Mot de passe client réinitialisé' }));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t('hooks.resetClientPassword.errorFull', { ns: 'common', defaultValue: 'Erreur lors de la réinitialisation du mot de passe' }));
    },
  });
}

// NOTE: l'ancien useSearchClients (recherche serveur .or(ilike…)) a été
// supprimé : aucun appelant, et le même filtre fragile que useClients corrigé
// ci-dessus. La recherche passe par src/lib/clientSearch.ts.
