/**
 * Opérations v2 — deux lectures (rien n'écrit ici), qui manquaient aux
 * hooks existants :
 *   · les compteurs des puces de paiements (À payer = prêt, au bureau, QR
 *     lu ; En cours ; Sans fournisseur), comptés comme la liste les filtre ;
 *   · l'avancement des lots (combien de lignes payées), que la table
 *     `payment_batches` ne porte pas.
 * Client admin uniquement.
 */
import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { CACHE_CONFIG } from '@/lib/constants';
import type { Enums } from '@/integrations/supabase/types';

type PayStatus = Enums<'payment_status'>;

export const PAY_TO_PAY: PayStatus[] = ['ready_for_payment', 'cash_pending', 'cash_scanned'];

export function useOpsPaymentCounts(enabled = true) {
  return useQuery({
    queryKey: ['ops-payment-counts'],
    enabled,
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const count = async (statuses: PayStatus[]) => {
        const { count: c, error } = await supabaseAdmin.from('payments').select('id', { count: 'exact', head: true }).in('status', statuses);
        if (error) throw error;
        return c ?? 0;
      };
      const [toPay, inProgress, noSupplier] = await Promise.all([
        count(PAY_TO_PAY),
        count(['processing']),
        count(['waiting_beneficiary_info']),
      ]);
      return { toPay, inProgress, noSupplier };
    },
  });
}

/** Les soldes de tous les clients, une lecture (repris de l'assistant de paiement v1). */
export function useWalletsMap() {
  return useQuery({
    queryKey: ['all-wallets-for-new-payment'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.from('wallets').select('user_id, balance_xaf, overdraft_limit_xaf');
      if (error) throw error;
      return new Map((data ?? []).map((w) => [w.user_id, { balance: Number(w.balance_xaf) || 0, overdraft: Number(w.overdraft_limit_xaf) || 0 }]));
    },
  });
}

export interface BatchProgress { total: number; paid: number; closed: number; nextId: string | null; nextRmb: number | null }

/** L'avancement de chaque lot : lignes, payées, et la prochaine à payer. */
export function useBatchProgress(batchIds: string[]) {
  const key = [...batchIds].sort().join(',');
  return useQuery({
    queryKey: ['ops-batch-progress', key],
    enabled: batchIds.length > 0,
    staleTime: CACHE_CONFIG.STALE_TIME.LISTS,
    gcTime: CACHE_CONFIG.GC_TIME,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id, batch_id, status, amount_rmb, created_at')
        .in('batch_id', batchIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const map = new Map<string, BatchProgress>();
      for (const row of data ?? []) {
        if (!row.batch_id) continue;
        const p = map.get(row.batch_id) ?? { total: 0, paid: 0, closed: 0, nextId: null, nextRmb: null };
        p.total += 1;
        if (row.status === 'completed') p.paid += 1;
        if (row.status === 'completed' || row.status === 'rejected' || row.status === 'cancelled_by_admin') p.closed += 1;
        else if (!p.nextId) { p.nextId = row.id; p.nextRmb = Number(row.amount_rmb) || 0; }
        map.set(row.batch_id, p);
      }
      return map;
    },
  });
}
