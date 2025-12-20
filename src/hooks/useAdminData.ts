import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fetch all user roles (admin users)
export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (rolesError) throw rolesError;
      if (!roles) return [];
      
      const userIds = roles.map(r => r.user_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);
      
      if (profilesError) throw profilesError;
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return roles.map(role => ({
        ...role,
        profile: profileMap.get(role.user_id) || null,
      }));
    },
  });
}

// Fetch admin audit logs
export function useAdminAuditLogs() {
  return useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Dashboard stats
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Fetch wallets for total balance
      const { data: wallets, error: walletsError } = await supabase
        .from('wallets')
        .select('balance_xaf');
      
      if (walletsError) throw walletsError;
      
      // Count deposits by status
      const { data: deposits, error: depositsError } = await supabase
        .from('deposits')
        .select('status');
      
      if (depositsError) throw depositsError;
      
      // Get exchange rate
      const { data: rate, error: rateError } = await supabase
        .from('exchange_rates')
        .select('rate_xaf_to_rmb')
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (rateError) throw rateError;
      
      const totalWalletBalance = wallets?.reduce((sum, w) => sum + (w.balance_xaf || 0), 0) || 0;
      const pendingDeposits = deposits?.filter(d => 
        ['created', 'awaiting_proof', 'proof_submitted', 'admin_review'].includes(d.status)
      ).length || 0;
      
      return {
        totalClients: wallets?.length || 0,
        activeClients: wallets?.filter(w => w.balance_xaf > 0).length || 0,
        totalWalletBalance,
        pendingDeposits,
        pendingPayments: 0, // No payments table yet
        currentRate: rate?.rate_xaf_to_rmb ? Math.round(1 / rate.rate_xaf_to_rmb) : 87,
      };
    },
  });
}
