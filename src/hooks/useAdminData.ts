import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startOfDay, subDays } from 'date-fns';

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
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesError) throw rolesError;
      if (!roles) return [];

      // Fetch profiles for admin users
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return roles.map(role => ({
        id: role.user_id,
        email: role.email || '',
        firstName: profileMap.get(role.user_id)?.first_name || 'Admin',
        lastName: profileMap.get(role.user_id)?.last_name || '',
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

      // Fetch admin names from profiles
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', adminUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return logs.map(log => ({
        ...log,
        adminProfile: profileMap.get(log.admin_user_id)
          ? {
              first_name: profileMap.get(log.admin_user_id)!.first_name || 'Admin',
              last_name: profileMap.get(log.admin_user_id)!.last_name || '',
              user_id: log.admin_user_id,
            }
          : null,
      }));
    },
  });
}

// Dashboard stats
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    staleTime: 10 * 1000,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const weekStart = startOfDay(subDays(new Date(), 7)).toISOString();

      const [
        walletsRes,
        depositsRes,
        rateRes,
        pendingPaymentsRes,
        todayPaymentsRes,
        weekDepositsRes,
      ] = await Promise.all([
        supabaseAdmin.from('wallets').select('balance_xaf'),
        supabaseAdmin.from('deposits').select('status'),
        supabaseAdmin.from('exchange_rates')
          .select('rate_xaf_to_rmb')
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin.from('payments')
          .select('id', { count: 'exact', head: true })
          .in('status', ['created', 'waiting_beneficiary_info', 'ready_for_payment', 'processing', 'cash_pending', 'cash_scanned']),
        supabaseAdmin.from('payments')
          .select('amount_xaf')
          .eq('status', 'completed')
          .gte('processed_at', todayStart),
        supabaseAdmin.from('deposits')
          .select('amount_xaf')
          .eq('status', 'validated')
          .gte('validated_at', weekStart),
      ]);

      if (walletsRes.error) throw walletsRes.error;
      if (depositsRes.error) throw depositsRes.error;
      if (rateRes.error) throw rateRes.error;

      const wallets = walletsRes.data;
      const deposits = depositsRes.data;
      const rate = rateRes.data;

      const totalWalletBalance = wallets?.reduce((sum, w) => sum + (w.balance_xaf || 0), 0) || 0;
      const pendingDeposits = deposits?.filter(d =>
        ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(d.status)
      ).length || 0;
      const todayPaymentsAmount = todayPaymentsRes.data?.reduce((sum, p) => sum + (p.amount_xaf || 0), 0) || 0;
      const weekVolume = weekDepositsRes.data?.reduce((sum, d) => sum + (d.amount_xaf || 0), 0) || 0;

      return {
        totalClients: wallets?.length || 0,
        activeClients: wallets?.filter(w => w.balance_xaf > 0).length || 0,
        totalWalletBalance,
        pendingDeposits,
        pendingPayments: pendingPaymentsRes.count || 0,
        currentRate: rate?.rate_xaf_to_rmb ? Math.round(1 / rate.rate_xaf_to_rmb) : 87,
        todayPaymentsAmount,
        weekVolume,
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
        .select(`
          *,
          deposit_proofs(*),
          deposit_timeline_events(*)
        `)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      if (!deposits) return [];
      
      const userIds = [...new Set(deposits.map(d => d.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return deposits.map(deposit => ({
        ...deposit,
        profile: profileMap.get(deposit.user_id) || null,
        clientName: profileMap.get(deposit.user_id)
          ? `${profileMap.get(deposit.user_id)!.first_name} ${profileMap.get(deposit.user_id)!.last_name}`
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
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      if (!wallets) return [];
      
      const userIds = [...new Set(wallets.map(w => w.user_id))];
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

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
        profile: profileMap.get(wallet.user_id) || null,
        clientName: profileMap.get(wallet.user_id)
          ? `${profileMap.get(wallet.user_id)!.first_name} ${profileMap.get(wallet.user_id)!.last_name}`
          : 'Client inconnu',
        totalDeposits: depositSums.get(wallet.user_id) || 0,
        totalPayments: 0,
      }));
    },
  });
}

// Fetch all clients (profiles with wallets)
export function useAdminClients() {
  return useQuery({
    queryKey: ['admin-clients'],
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    queryFn: async () => {
      const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!profiles) return [];

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
        ...profile,
        wallet: walletMap.get(profile.user_id) || null,
        walletBalance: walletMap.get(profile.user_id)?.balance_xaf || 0,
        totalDeposits: depositSums.get(profile.user_id) || 0,
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
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!profile) return null;
      
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('*, wallet_operations(*)')
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
        ...profile,
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
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return proofs.map(proof => ({
        ...proof,
        clientName: proof.deposits && profileMap.get(proof.deposits.user_id)
          ? `${profileMap.get(proof.deposits.user_id)!.first_name} ${profileMap.get(proof.deposits.user_id)!.last_name}`
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
        .select('*')
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