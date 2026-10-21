import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { ACTIONABLE_PAYMENT_STATUSES } from '@/lib/actionable';
import { CACHE_CONFIG } from '@/lib/constants';
import type { Enums } from '@/integrations/supabase/types';

export interface HomePayment {
  id: string;
  amount_rmb: number;
  method: Enums<'payment_method'>;
  status: Enums<'payment_status'>;
  created_at: string;
  clientName: string;
}

/** Plafond de lecture des montants : bien au-delà d'une file réelle (quelques dizaines). */
const SUM_CAP = 5000;

/**
 * Le chiffre de l'Accueil v2 : ce qui reste à payer (mêmes statuts que le
 * badge « Opérations », src/lib/actionable.ts) — son total en ¥ et son
 * nombre, lus ensemble pour qu'ils ne se contredisent pas —, puis les plus
 * anciens d'abord, ceux qu'on paie en premier.
 */
export function useHomeToPay({ userId, enabled = true, limit = 3 }: { userId: string | undefined; enabled?: boolean; limit?: number }) {
  return useQuery({
    // L'utilisateur dans la clé : sur un téléphone partagé, le suivant ne voit pas la file du précédent.
    queryKey: ['home-to-pay', userId, limit],
    enabled: enabled && !!userId,
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const [sums, firsts] = await Promise.all([
        supabaseAdmin
          .from('payments')
          .select('amount_rmb', { count: 'exact' })
          .in('status', ACTIONABLE_PAYMENT_STATUSES)
          .range(0, SUM_CAP - 1),
        supabaseAdmin
          .from('payments')
          .select('id, amount_rmb, method, status, created_at, user_id')
          .in('status', ACTIONABLE_PAYMENT_STATUSES)
          .order('created_at', { ascending: true })
          .limit(limit),
      ]);
      if (sums.error) throw sums.error;
      if (firsts.error) throw firsts.error;
      const total = (sums.data ?? []).reduce((s, p) => s + (p.amount_rmb ?? 0), 0);
      const rows = firsts.data ?? [];
      const ids = [...new Set(rows.map((p) => p.user_id))];
      const names = new Map<string, string>();
      if (ids.length > 0) {
        const { data: clients, error } = await supabaseAdmin
          .from('clients')
          .select('user_id, first_name, last_name, company_name')
          .in('user_id', ids);
        if (error) throw error;
        for (const c of clients ?? []) {
          const full = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
          names.set(c.user_id, full || c.company_name || 'Client');
        }
      }
      const list: HomePayment[] = rows.map((p) => ({
        id: p.id,
        amount_rmb: p.amount_rmb,
        method: p.method,
        status: p.status,
        created_at: p.created_at,
        clientName: names.get(p.user_id) ?? 'Client',
      }));
      return { total, count: sums.count ?? rows.length, list };
    },
  });
}
