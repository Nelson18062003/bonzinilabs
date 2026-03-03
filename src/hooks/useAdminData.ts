import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cache configuration for performance
const STALE_TIME = 30 * 1000; // 30 seconds
const CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// Fetch all user roles (admin users) with profile info
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, email, first_name, last_name, role, is_disabled, created_at')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;
      if (!roles) return [];

      return roles.map(role => ({
        id: role.user_id,
        email: role.email || '',
        firstName: role.first_name || 'Admin',
        lastName: role.last_name || '',
        role: role.role,
        status: 'ACTIVE' as const,
        createdAt: role.created_at,
        lastLoginAt: null,
      }));
    },
  });
}

// Fetch admin audit logs
export function useAdminAuditLogs() {
  return useQuery({
    queryKey: ['admin-audit-logs'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: logs, error } = await supabaseAdmin
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!logs) return [];
      
      // Get admin user IDs
      const adminUserIds = [...new Set(logs.map(l => l.admin_user_id))];

      // Fetch admin names from user_roles (source of truth for admins)
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, first_name, last_name')
        .in('user_id', adminUserIds);

      const adminMap = new Map(adminRoles?.map(r => [r.user_id, r]) || []);

      return logs.map(log => ({
        ...log,
        adminProfile: adminMap.get(log.admin_user_id)
          ? {
              first_name: adminMap.get(log.admin_user_id)!.first_name || 'Admin',
              last_name: adminMap.get(log.admin_user_id)!.last_name || '',
              user_id: log.admin_user_id,
            }
          : null,
      }));
    },
  });
}

// Dashboard stats — single RPC call instead of 6 separate queries
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    staleTime: 60 * 1000, // 1 minute — updated via invalidation after mutations
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.rpc('get_dashboard_stats' as never);
      if (error) throw error;
      return data as {
        totalClients: number;
        activeClients: number;
        totalWalletBalance: number;
        pendingDeposits: number;
        pendingPayments: number;
        currentRate: number;
        todayPaymentsAmount: number;
        weekVolume: number;
      };
    },
  });
}

// Fetch all deposits with client info for admin
export function useAdminDeposits() {
  return useQuery({
    queryKey: ['admin-deposits'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: deposits, error } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!deposits) return [];


      const userIds = [...new Set(deposits.map(d => d.user_id))];
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      return deposits.map(deposit => ({
        ...deposit,
        profile: clientMap.get(deposit.user_id) || null,
        clientName: clientMap.get(deposit.user_id)
          ? `${clientMap.get(deposit.user_id)!.first_name} ${clientMap.get(deposit.user_id)!.last_name}`
          : 'Client inconnu',
      }));
    },
  });
}

// Fetch all wallets with client info for admin
export function useAdminWallets() {
  return useQuery({
    queryKey: ['admin-wallets'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: wallets, error } = await supabaseAdmin
        .from('wallets')
        .select('id, user_id, balance_xaf, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!wallets) return [];

      const userIds = [...new Set(wallets.map(w => w.user_id))];
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('user_id, amount_xaf, status')
        .eq('status', 'validated')
        .in('user_id', userIds);

      const depositSums = new Map<string, number>();
      deposits?.forEach(d => {
        depositSums.set(d.user_id, (depositSums.get(d.user_id) || 0) + d.amount_xaf);
      });

      return wallets.map(wallet => ({
        ...wallet,
        profile: clientMap.get(wallet.user_id) || null,
        clientName: clientMap.get(wallet.user_id)
          ? `${clientMap.get(wallet.user_id)!.first_name} ${clientMap.get(wallet.user_id)!.last_name}`
          : 'Client inconnu',
        totalDeposits: depositSums.get(wallet.user_id) || 0,
        totalPayments: 0,
      }));
    },
  });
}

// Fetch all clients
export function useAdminClients() {
  return useQuery({
    queryKey: ['admin-clients'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: clientsList, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!clientsList) return [];

      const userIds = clientsList.map(c => c.user_id);

      const { data: wallets } = await supabaseAdmin
        .from('wallets')
        .select('id, user_id, balance_xaf, created_at, updated_at')
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

      return clientsList.map(client => ({
        ...client,
        wallet: walletMap.get(client.user_id) || null,
        walletBalance: walletMap.get(client.user_id)?.balance_xaf || 0,
        totalDeposits: depositSums.get(client.user_id) || 0,
        totalPayments: 0,
      }));
    },
  });
}

// Fetch single client detail
export function useAdminClientDetail(userId: string) {
  return useQuery({
    queryKey: ['admin-client', userId],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!client) return null;

      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('id, user_id, balance_xaf, created_at, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      const { data: deposits } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      const totalDeposits = deposits?.filter(d => d.status === 'validated')
        .reduce((sum, d) => sum + d.amount_xaf, 0) || 0;
      
      return {
        ...client,
        wallet,
        deposits: deposits || [],
        totalDeposits,
        totalPayments: 0,
      };
    },
    enabled: !!userId,
  });
}

// Fetch all deposit proofs
export function useAdminProofs() {
  return useQuery({
    queryKey: ['admin-proofs'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: proofs, error } = await supabaseAdmin
        .from('deposit_proofs')
        .select(`
          *,
          deposits(*)
        `)
        .order('uploaded_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (!proofs) return [];
      
      const userIds = [...new Set(proofs.map(p => p.deposits?.user_id).filter(Boolean))] as string[];
      const { data: clients } = await supabaseAdmin
        .from('clients')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const clientMap = new Map(clients?.map(c => [c.user_id, c]) || []);

      return proofs.map(proof => ({
        ...proof,
        clientName: proof.deposits && clientMap.get(proof.deposits.user_id)
          ? `${clientMap.get(proof.deposits.user_id)!.first_name} ${clientMap.get(proof.deposits.user_id)!.last_name}`
          : 'Client inconnu',
      }));
    },
  });
}

// Fetch exchange rates history
export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    staleTime: 60 * 1000,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('exchange_rates')
        .select('id, rate_xaf_to_rmb, effective_date, created_at')
        .order('effective_date', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Add new exchange rate
export function useAddExchangeRate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rateXafToRmb: number) => {
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      
      const { data, error } = await supabaseAdmin
        .from('exchange_rates')
        .insert({
          rate_xaf_to_rmb: rateXafToRmb,
          effective_date: new Date().toISOString().split('T')[0],
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
      queryClient.invalidateQueries({ queryKey: ['exchange-rate'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Taux de change mis à jour');
    },
    onError: (error) => {
      toast.error('Erreur lors de la mise à jour du taux');
      console.error(error);
    },
  });
}