import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { ACTIONABLE_PAYMENT_STATUSES } from '@/lib/actionable';
import { CACHE_CONFIG } from '@/lib/constants';
import type { Enums } from '@/integrations/supabase/types';

export interface HomePayment {
  id: string;
  reference: string;
  amount_rmb: number;
  method: Enums<'payment_method'>;
  status: Enums<'payment_status'>;
  created_at: string;
  clientName: string;
}

/**
 * Le chiffre de l'Accueil v2 : ce qui reste à payer (mêmes statuts que le
 * badge « Opérations », src/lib/actionable.ts), son total en ¥, et les plus
 * anciens d'abord — ceux qu'on paie en premier.
 */
export function useHomeToPay(limit = 3) {
  return useQuery({
    queryKey: ['home-to-pay', limit],
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, reference, amount_rmb, method, status, created_at, user_id')
        .in('status', ACTIONABLE_PAYMENT_STATUSES)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      const rows = data ?? [];
      const total = rows.reduce((s, p) => s + (p.amount_rmb ?? 0), 0);
      const first = rows.slice(0, limit);
      const ids = [...new Set(first.map((p) => p.user_id))];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: clients } = await supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name, company_name')
          .in('user_id', ids);
        for (const c of clients ?? []) {
          const full = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
          names.set(c.user_id, full || c.company_name || 'Client');
        }
      }
      const list: HomePayment[] = first.map((p) => ({
        id: p.id,
        reference: p.reference,
        amount_rmb: p.amount_rmb,
        method: p.method,
        status: p.status,
        created_at: p.created_at,
        clientName: names.get(p.user_id) ?? 'Client',
      }));
      return { total, count: rows.length, list };
    },
  });
}
