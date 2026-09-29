// ============================================================
// La revue du COMMISSIONNAIRE AGRÉÉ et de l'équipe (espace /m, session
// `supabaseAdmin` — jamais `supabase` ici : .claude/rules/supabase-clients.md).
// Gardes serveur : canViewCustoms pour lire, canSignCustoms + agrément
// enregistré pour prendre et signer, canManageUsers pour enregistrer un CAD.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabaseAdmin } from '@/integrations/supabase/client';
import { customsKeys } from '@/lib/queryKeys';
import type { Classification, ClientCard } from '@/lib/customs/files';

type RpcResult<T> = ({ success: true } & T) | { success: false; error?: string };

async function rpcJson<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(name as never, args as never);
  if (error) throw new Error(error.message);
  const res = data as unknown as RpcResult<T>;
  if (!res || res.success !== true) throw new Error((res as { error?: string })?.error || 'Opération refusée');
  return res as T;
}

export interface QueueClassification {
  id: string; ref: string; product_name: string; proposed_code: string | null; status: string;
  submitted_at: string | null; claimed_by: string | null; mine: boolean; client: ClientCard | null;
}
export interface QueueAudit {
  id: string; ref: string; dau_number: string | null; overpaid_xaf: number | null; claim_deadline: string | null;
  status: string; submitted_at: string | null; claimed_by: string | null; mine: boolean; client: ClientCard | null;
}
export interface ReviewQueue {
  is_broker: boolean;
  classifications: QueueClassification[];
  audits: QueueAudit[];
  recent: { kind: string; id: string; ref: string; label: string; status: string; final_code: string | null; reviewed_at: string }[];
}

export function useCustomsReviewQueue(enabled = true) {
  return useQuery({
    queryKey: customsKeys.queue(),
    queryFn: () => rpcJson<ReviewQueue>('customs_review_queue'),
    enabled,
    staleTime: 10_000,
    refetchInterval: 60_000,
  });
}

export function useAdminClassification(id: string | undefined) {
  return useQuery({
    queryKey: [...customsKeys.classification(id), 'admin'] as const,
    queryFn: async () => (await rpcJson<{ classification: Classification }>('customs_classification_get', { p_id: id })).classification,
    enabled: !!id,
  });
}

/** Les photos du client, signées pour une heure avec la session de l'équipe. */
export function useCustomsPhotoUrls(paths: string[] | undefined) {
  return useQuery({
    queryKey: [...customsKeys.all, 'photos', ...(paths ?? [])] as const,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin.storage.from('customs-documents').createSignedUrls(paths ?? [], 3600);
      if (error) throw new Error(error.message);
      return (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
    },
    enabled: !!paths?.length,
    staleTime: 30 * 60_000,
  });
}

function useRefresh(id: string | undefined) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: customsKeys.classification(id) });
    void qc.invalidateQueries({ queryKey: customsKeys.queue() });
  };
}

export function useClaimClassification(id: string | undefined) {
  const refresh = useRefresh(id);
  return useMutation({ mutationFn: () => rpcJson('customs_classification_claim', { p_id: id }), onSuccess: refresh });
}

export function useDecideClassification(id: string | undefined) {
  const refresh = useRefresh(id);
  return useMutation({
    mutationFn: (v: { decision: 'approved' | 'changed' | 'needs_info'; finalCode?: string | null; note?: string | null }) =>
      rpcJson<{ status: string; final_code: string | null }>('customs_classification_decide', {
        p_id: id, p_decision: v.decision, p_final_code: v.finalCode ?? null, p_note: v.note ?? null,
      }),
    onSuccess: refresh,
  });
}

export function useRegisterBroker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; company: string; licenseNo: string; representativeNo?: string | null; active?: boolean }) =>
      rpcJson('customs_broker_register', {
        p_user_id: v.userId, p_company: v.company, p_license_no: v.licenseNo,
        p_representative_no: v.representativeNo ?? null, p_active: v.active ?? true,
      }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: [...customsKeys.all, 'broker'] }); },
  });
}

export function useBrokerProfile(userId: string | undefined) {
  return useQuery({
    queryKey: [...customsKeys.all, 'broker', userId] as const,
    queryFn: async () => {
      const { data, error } = await supabaseAdmin
        .from('customs_brokers' as never)
        .select('company, license_no, representative_no, active')
        .eq('user_id', userId as never)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as unknown as { company: string; license_no: string; representative_no: string | null; active: boolean } | null;
    },
    enabled: !!userId,
  });
}
