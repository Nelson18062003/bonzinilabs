import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CashPayment {
  id: string;
  reference: string;
  amount_rmb: number;
  amount_xaf: number;
  status: string;
  method: string;
  created_at: string;
  cash_beneficiary_type: string | null;
  cash_beneficiary_first_name: string | null;
  cash_beneficiary_last_name: string | null;
  cash_beneficiary_phone: string | null;
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_email: string | null;
  cash_paid_at: string | null;
  cash_paid_by: string | null;
  cash_scanned_by: string | null;
  cash_signature_url: string | null;
  cash_signed_by_name: string | null;
  user_id: string;
  profile?: {
    first_name: string;
    last_name: string;
    phone: string | null;
  };
}

export function useAgentCashPayments(status: 'pending' | 'paid', agentUserId?: string) {
  return useQuery({
    queryKey: ['agent-cash-payments', status, agentUserId],
    queryFn: async () => {
      // To Pay tab: only show cash payments with "processing" status (En cours)
      const statusFilter = status === 'pending'
        ? (['processing'] as const)
        : (['completed'] as const);

      let query = supabase
        .from('payments')
        .select(`
          id,
          reference,
          amount_rmb,
          amount_xaf,
          status,
          method,
          created_at,
          cash_beneficiary_type,
          cash_beneficiary_first_name,
          cash_beneficiary_last_name,
          cash_beneficiary_phone,
          beneficiary_name,
          beneficiary_phone,
          beneficiary_email,
          cash_paid_at,
          cash_paid_by,
          cash_scanned_by,
          cash_signature_url,
          cash_signed_by_name,
          user_id
        `)
        .eq('method', 'cash')
        .in('status', statusFilter);

      // Paid tab must show ONLY payments paid by this cash agent
      if (status === 'paid') {
        if (!agentUserId) return [];
        query = query.eq('cash_paid_by', agentUserId);
      }

      const { data, error } = await query.order('created_at', { ascending: status === 'pending' });

      if (error) throw error;

      // Fetch profiles for each payment
      const userIds = [...new Set(data?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]));

      return (data || []).map(payment => ({
        ...payment,
        profile: profileMap.get(payment.user_id),
      })) as CashPayment[];
    },
  });
}

export function useAgentCashPaymentDetail(paymentId: string | undefined) {
  return useQuery({
    queryKey: ['agent-cash-payment', paymentId],
    queryFn: async () => {
      if (!paymentId) return null;

      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          reference,
          amount_rmb,
          amount_xaf,
          status,
          method,
          created_at,
          cash_beneficiary_type,
          cash_beneficiary_first_name,
          cash_beneficiary_last_name,
          cash_beneficiary_phone,
          beneficiary_name,
          beneficiary_phone,
          beneficiary_email,
          cash_paid_at,
          cash_paid_by,
          cash_scanned_by,
          cash_signature_url,
          cash_signed_by_name,
          user_id
        `)
        .eq('id', paymentId)
        .eq('method', 'cash')
        .single();

      if (error) throw error;

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, phone')
        .eq('user_id', data.user_id)
        .single();

      return {
        ...data,
        profile,
      } as CashPayment;
    },
    enabled: !!paymentId,
  });
}
