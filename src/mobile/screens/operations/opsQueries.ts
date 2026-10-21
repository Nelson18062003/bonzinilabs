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
import { signStored } from '@/lib/signedUrls';
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

export interface PaymentProofFeedItem {
  id: string;
  payment_id: string;
  file_name: string;
  file_type: string | null;
  uploaded_by_type: string;
  created_at: string;
  signedUrl: string | null;
  amount_rmb: number;
  method: string;
  clientName: string;
}

/**
 * Justificatifs des PAIEMENTS (manquaient des deux côtés) : les 100 pièces
 * les plus récentes, avec le paiement, le client et une URL signée — même
 * forme que useAdminProofs pour les dépôts.
 */
export function usePaymentProofsFeed(enabled = true) {
  return useQuery({
    queryKey: ['ops-payment-proofs-feed'],
    enabled,
    staleTime: 50 * 60_000,
    gcTime: 60 * 60_000,
    queryFn: async (): Promise<PaymentProofFeedItem[]> => {
      const { data: proofs, error } = await supabaseAdmin
        .from('payment_proofs')
        .select('id, payment_id, file_url, file_name, file_type, uploaded_by_type, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = proofs ?? [];
      const payIds = [...new Set(rows.map((p) => p.payment_id))];
      const { data: pays } = payIds.length
        ? await supabaseAdmin.from('payments').select('id, amount_rmb, method, user_id').in('id', payIds)
        : { data: [] as { id: string; amount_rmb: number; method: string; user_id: string }[] };
      const payMap = new Map((pays ?? []).map((p) => [p.id, p]));
      const userIds = [...new Set((pays ?? []).map((p) => p.user_id))];
      const { data: clients } = userIds.length
        ? await supabaseAdmin.from('clients').select('user_id, first_name, last_name').in('user_id', userIds)
        : { data: [] as { user_id: string; first_name: string | null; last_name: string | null }[] };
      const clientMap = new Map((clients ?? []).map((c) => [c.user_id, `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()]));
      return Promise.all(rows.map(async (p) => {
        const pay = payMap.get(p.payment_id);
        return {
          id: p.id,
          payment_id: p.payment_id,
          file_name: p.file_name,
          file_type: p.file_type,
          uploaded_by_type: p.uploaded_by_type,
          created_at: p.created_at,
          signedUrl: await signStored(supabaseAdmin.storage, p.file_url),
          amount_rmb: Number(pay?.amount_rmb) || 0,
          method: pay?.method ?? 'alipay',
          clientName: (pay && clientMap.get(pay.user_id)) || 'Client',
        };
      }));
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
